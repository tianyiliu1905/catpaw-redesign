const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { scenes, createPlayer } = require('../strategy-scenes.js');

function setup(scene = '2.1', present, snapshotFrame = null) {
  const timers = new Map(), events = [];
  let sequence = 0, ready = 0;
  const player = createPlayer({ scene, snapshotFrame,
    reset: () => events.push('reset'), stop: () => events.push('stop'),
    present: present || (step => events.push(step)), ready: () => ready++,
    setTimer: (callback, duration) => { const id = ++sequence; timers.set(id, { callback, duration }); return id; },
    clearTimer: id => timers.delete(id),
  });
  return { player, timers, events, get ready() { return ready; },
    async next() { const [id, timer] = timers.entries().next().value; timers.delete(id); await timer.callback(); },
  };
}

test('embedded scenes wait for activation and only play on the active slide', async () => {
  const s = setup();
  assert.equal(s.events.length, 0);
  assert.equal(s.timers.size, 0);
  await s.player.activate();
  assert.equal(s.events.at(-1).frame, 0);
  assert.equal(s.ready, 1);
  assert.equal([...s.timers.values()][0].duration, 6500);
  await s.next();
  assert.equal(s.events.at(-1).frame, 1);
  assert.equal([...s.timers.values()][0].duration, 2500);
});

test('process plays the three phases and holds on the final result', async () => {
  const s = setup();
  await s.player.activate();
  while (s.timers.size) await s.next();
  assert.deepEqual(s.events.filter(item => item.action).map(item => item.frame), [0,1,3,4,6,7,9,10]);
  assert.equal(s.timers.size, 0);
});

test('one layout action demonstrates conversation, side-by-side and on-call states', async () => {
  const s = setup('3.1');
  await s.player.activate();
  while (s.timers.size) await s.next();
  assert.deepEqual(s.events.filter(item => item.action).map(item => [item.action, item.kind]), [
    ['artifact-conversation', undefined], ['artifact-side', 'ppt'],
    ['artifact-full', 'ppt'],
  ]);
  assert.equal(scenes['3.1-2'], undefined, 'the next design action belongs to the desktop pet');
});

test('on-call and feedback scenes use full-screen artifacts, collapsed tasks and the floating composer', async () => {
  const source=fs.readFileSync('app.js','utf8');
  const renderer=source.slice(source.indexOf('    function showStrategyArtifact('),source.indexOf('    const player = window.CatPawStrategyScenes.createPlayer('));
  const task={},node={name:'季度经营复盘.pptx',preview:{kind:'ppt'}};
  const folder={id:'quarterly',files:[node]},item={};
  const state={collapsed:false,expanded:false,reserved:0,selected:0,references:[],inputEvents:0};
  const input={value:'',dispatchEvent(event){assert.equal(event.type,'input');state.inputEvents++;}};
  const ctx={
    document:{querySelectorAll:()=>[]},strategyDemoActive:false,frameReady:async()=>{},
    artifactEditingTask:task,conversationExamples:new Map([[task,{folderId:'quarterly',files:[node.name]}]]),FOLDERS:[folder],
    setConversationOpen(open,selectedTask){assert.equal(open,true);assert.equal(selectedTask,task);},
    reserveStrategySplit(){state.reserved++;},
    openArtifactPreview(selectedNode,chain){assert.equal(selectedNode,node);assert.equal(chain[0],folder);item.node=node;},
    currentFileWorkspace:()=>item,renderToolFileWorkspace(){},
    setCollapsed(value){state.collapsed=value;},setWorkbenchExpanded(value){state.expanded=value;},
    toolFilePreviewBody:{querySelector:selector=>({click(){if(selector==='[data-reference-slide="4"]')item.referenceSlide=4;else state.selected++;}})},
    toolFilePptReference:{click(){state.references.push(item.referenceSlide);}},fullscreenChatInput:input,
    Event:class {constructor(type){this.type=type;}},
  };
  vm.createContext(ctx);vm.runInContext(renderer,ctx);
  await ctx.presentStrategyStep(scenes['3.1'][2]);
  assert.equal(state.collapsed,true);assert.equal(state.expanded,true);assert.equal(state.reserved,0);
  ctx.showStrategyArtifact('ppt',false);
  assert.equal(state.collapsed,false);assert.equal(state.expanded,false);assert.equal(state.reserved,1,'side-by-side keeps its conversation column');
  for(const scene of ['3.2','3.2-2','3.2-3']){
    state.references.length=0;state.inputEvents=0;
    for(const step of scenes[scene])await ctx.presentStrategyStep(step);
    assert.equal(state.collapsed,true,scene);assert.equal(state.expanded,true,scene);
    if(scene==='3.2')assert.equal(state.selected,1);
    else{
      assert.equal(scenes[scene][0].focus,'#fullscreenChat');
      assert.equal(state.inputEvents,scenes[scene].length);
      assert.deepEqual(state.references,scene==='3.2-3'?[2,4]:[2]);
      assert.match(input.value,scene==='3.2-3'?/第 3 页.*第 5 页/:/区域差异/);
    }
  }
});

test('layout comparison renders three fixed scenarios side by side without advancing', async () => {
  const html = fs.readFileSync('design-strategy-slides.html', 'utf8');
  const source = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]).find(script => script.includes('const pointSlides'));
  const canvas = {innerHTML: ''};
  vm.runInNewContext(source.split('    const pages=')[0], {document: {getElementById: () => canvas}, CatPawStrategyScenes: {scenes}});
  const slide = canvas.innerHTML.match(/<section[^>]*id="slide-3\.1"[\s\S]*?<\/section>/)[0];
  assert.equal((slide.match(/<iframe /g) || []).length, 3);
  assert.deepEqual([...slide.matchAll(/data-frame="(\d+)"/g)].map(match => Number(match[1])), [0, 1, 2]);
  for (const title of ['Face-to-face', 'Side-by-side', 'On-call']) assert.ok(slide.includes(title));
  for (const [frame, action] of ['artifact-conversation', 'artifact-side', 'artifact-full'].entries()) {
    const s = setup('3.1', undefined, frame);
    await s.player.activate();
    assert.equal(s.events.at(-1).action, action);
    assert.equal(s.timers.size, 0);
    s.player.deactivate();
    await s.player.activate();
    assert.equal(s.events.at(-1).action, action);
  }
});

test('greeting demo moves a pointer before focusing the input and cancels the click on navigation', async () => {
  const s = setup('1.3-2');
  await s.player.activate();
  assert.equal(s.events.at(-1).action, 'greeting-ready');
  await s.next();
  assert.equal(s.events.at(-1).action, 'greeting-pointer');
  const staleClick = [...s.timers.values()][0].callback;
  s.player.deactivate();
  const count = s.events.length;
  await staleClick();
  assert.equal(s.events.length, count);
  await s.player.activate();
  await s.next();
  await s.next();
  assert.equal(s.events.at(-1).action, 'greeting-click');
  assert.equal(s.timers.size, 0);
});

test('the three comparison panels hold their own phase when activated or revisited', async () => {
  const panels = [0, 4, 10].map(frame => setup('2.1', undefined, frame));
  for (const [index, panel] of panels.entries()) {
    await panel.player.activate();
    assert.equal(panel.events.at(-1).frame, [0, 4, 10][index]);
    assert.equal(panel.timers.size, 0, 'comparison panels never advance to another phase');
    panel.player.deactivate();
    await panel.player.activate();
    assert.equal(panel.events.at(-1).frame, [0, 4, 10][index]);
  }
});

test('the process slide pairs an animated three-phase schematic with one live conversation', () => {
  const html = fs.readFileSync('design-strategy-slides.html', 'utf8');
  const source = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]).find(script => script.includes('const pointSlides'));
  const canvas = {innerHTML: ''};
  vm.runInNewContext(source.split('    const pages=')[0], {
    document: {getElementById: () => canvas}, CatPawStrategyScenes: {scenes},
  });
  const slide = canvas.innerHTML.match(/<section class="slide phase-demo-slide"[\s\S]*?<\/section>/)[0];
  assert.equal((slide.match(/<iframe /g) || []).length, 1);
  assert.ok(slide.includes('data-process-sync="true"'));
  assert.ok(!slide.includes('strategyFrame='), 'the real conversation advances rather than holding a snapshot');
  assert.equal((slide.match(/class="process-map-column/g)||[]).length, 4);
  for (const label of ['初步生成', '生成中', '生成后', '信息展示示意', '实际对话演示']) assert.ok(slide.includes(label));
  assert.ok(slide.includes('process-map-intent">意图理解</div><div class="process-map-block process-map-plan">任务规划</div>'));
  assert.ok(slide.includes('data-process-status'));
  assert.equal((canvas.innerHTML.match(/id="slide-2\.1"/g) || []).length, 1);
});

test('process strategy starts with design research and maps four actions to stages and disclosure depth', () => {
  const html = fs.readFileSync('design-strategy-slides.html', 'utf8');
  const source = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]).find(script => script.includes('const pointSlides'));
  const canvas = {innerHTML: ''};
  const context = {document: {getElementById: () => canvas}, CatPawStrategyScenes: {scenes}, location: {hash: ''}};
  vm.createContext(context);
  vm.runInContext(source.split('    const pages=')[0], context);
  vm.runInContext(source.slice(source.indexOf('    const fromHash=()=>{'), source.indexOf('    let current=')) + ';globalThis.route=()=>slides[fromHash()]?.no;', context);
  const research=canvas.innerHTML.match(/<section[^>]*id="slide-2\.1"[\s\S]*?<\/section>/)[0];
  assert.ok(research.includes('设计研究'));
  assert.ok(research.includes('按任务阶段切换信息重点'));
  assert.doesNotMatch(research,/设计动作 2\.1\./);
  const concerns = [];
  for (const [index, title] of ['工作前：确认意图与任务规划', '工作时：突出当前执行与阶段总结', '结束后：呈现结果、产物与待确认项', '按需查看不同深度的执行细节'].entries()) {
    const id = `2.1-${index + 2}`;
    context.location.hash = `#${id}`;
    assert.equal(context.route(), id, 'each action hash resolves to its own page');
    const section = canvas.innerHTML.match(new RegExp(`<section[^>]*id="slide-${id.replace('.', '\\.')}"[\\s\\S]*?<\\/section>`))[0];
    assert.ok(section.includes(`设计动作 2.1.${index + 1}`));
    assert.ok(section.includes(title));
    concerns.push(section.match(/class="user-concern"[\s\S]*?<p>([^<]+)<\/p>/)[1]);
  }
  assert.equal(new Set(concerns).size, 4);
  const catalog=canvas.innerHTML.match(/<section[^>]*id="slide-catalog"[\s\S]*?<\/section>/)[0];
  assert.ok(!catalog.includes('按任务阶段切换信息重点'),'research is not listed as a design action');
  assert.doesNotMatch(catalog,/>2\.1\.5</);
  assert.equal(scenes['2.1-5'][0].action, 'mode-settings');
  assert.deepEqual(scenes['2.1-2'].map(step=>step.focus),['.stage-thinking','.stage-acknowledgement','.stage-plan']);
});

test('ink confirmation preserves the complete message and finishes before the plan appears', () => {
  const source=fs.readFileSync('app.js','utf8');
  const start=source.indexOf('  const conversationStageFrames = [');
  const end=source.indexOf('  function renderConversationStage(entering',start);
  const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const context={esc:escape};vm.createContext(context);
  vm.runInContext(source.slice(start,end)+';globalThis.message=conversationStageFrames[0].acknowledgement;globalThis.ink=renderStageAcknowledgement;',context);
  for(const message of [context.message,'明白，保留 <原始数据> 和 🐾，再整理结果。']){
    const html=context.ink(message);
    assert.equal(html.replace(/<span[^>]*>/g,'').replace(/<\/span>/g,''),escape(message));
    const delays=[...html.matchAll(/--ink-delay:(\d+)ms/g)].map(match=>Number(match[1]));
    assert.ok(delays.length>1);assert.equal(delays[0],120);
    const css=fs.readFileSync('styles.css','utf8');
    const planDelay=Number(css.match(/\.conversation-stage-demo\.is-entering \.stage-plan\{ animation-delay:([\d.]+)s/)[1])*1000;
    assert.ok(Math.max(...delays)+640<planDelay);
  }
});

function stageRenderer(mode = 'work') {
  const source = fs.readFileSync('app.js', 'utf8');
  const start = source.indexOf('  const conversationStageFrames = [');
  const end = source.indexOf('  function renderConversationStage(entering', start);
  const context = {
    disclosureMode: mode,
    esc: value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])),
    conversationTask: {}, conversationExamples: {get: () => ({files: ['门店履约异常明细.xlsx']})},
    renderConversationArtifact: () => '<div>异常明细产物</div>',
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end) + ';globalThis.frames=conversationStageFrames;globalThis.render=renderConversationStageBody;', context);
  return context;
}

test('global status responds from task startup and follows each processing stage', () => {
  const s = stageRenderer();
  const labels = ['正在制定计划', '读取中', '分析中', '整理中', '分析中', '检查中', '整理中', '生成中', '检查中', '生成中', '已完成'];
  assert.equal(s.frames.length, labels.length);
  for (const [index, label] of labels.entries()) {
    const html = s.render(index);
    assert.ok(html.includes(`data-global-state="${s.frames[index].globalState}"`));
    const status = html.match(/<strong class="stage-global-label"[^>]*>([^<]+)<\/strong>/);
    assert.equal(status[1], label);
    assert.ok(status[0].includes('aria-live="polite"'));
    assert.ok(html.includes('aria-label="任务累计用时"'));
    if (index > 1) assert.ok(html.includes('class="stage-thinking-status stage-thinking-toggle"'), 'execution history remains accessible through every status');
  }
});

test('global status changes share one task timer and completion freezes elapsed time', () => {
  const source = fs.readFileSync('app.js', 'utf8');
  const s = stageRenderer();
  let now = 100000;
  s.Date = {now: () => now};
  vm.runInContext(source.slice(source.indexOf('  function formatStageElapsed('), source.indexOf('  function syncStageClock()')) + ';globalThis.tick=updateStageClock;', s);
  const elapsed = {textContent: ''};
  const panel = {dataset: {startedAt: '100000'}, querySelector: () => elapsed};
  for (const [seconds, expected] of [[0, '0秒'], [12, '12秒'], [65, '1分5秒']]) {
    now = 100000 + seconds * 1000;
    s.tick(panel);
    assert.equal(elapsed.textContent, expected);
  }
  panel.dataset.finishedAt = String(now);
  now += 15000;
  s.tick(panel);
  assert.equal(elapsed.textContent, '1分5秒');
});

test('work mode explains tool execution in task language while keeping actual calls inspectable', () => {
  const s = stageRenderer();
  for (const [index, frame] of s.frames.entries()) {
    if (!frame.call) continue;
    const html = s.render(index);
    const summary = html.match(/<details class="stage-tool-call"[\s\S]*?<\/summary>/)[0];
    assert.ok(summary.includes(`<strong>${frame.tool}</strong>`));
    assert.ok(!summary.includes(frame.call.name));
    assert.ok(!summary.includes(' open'));
    assert.ok(html.includes(`工具：${frame.call.name}`), 'raw call name remains in expandable details');
    assert.ok(html.includes('调用参数'));
  }
});

test('each tool group ends with a persistent summary before the next group starts', () => {
  const s = stageRenderer();
  const checkpoints = s.frames.map((frame, index) => frame.stage === 'checkpoint' ? index : -1).filter(index => index >= 0);
  assert.equal(checkpoints.length, 3);
  for (const [group, index] of checkpoints.entries()) {
    const html = s.render(index);
    assert.equal((html.match(/class="stage-checkpoint"/g) || []).length, group + 1);
    assert.ok(!html.includes('class="stage-current"'), 'summary has its own pause, with no running tool');
    assert.ok(!s.render(index - 1).includes(s.frames[index].summary), 'summary never appears before the group completes');
    const next = s.render(index + 1);
    assert.ok(next.includes(s.frames[index].summary), 'summary remains when the next step begins');
    if (s.frames[index + 1].call) assert.ok(next.indexOf(s.frames[index].summary) < next.indexOf('class="stage-current"'));
  }
  const done = s.render(s.frames.length - 1);
  assert.equal((done.match(/class="stage-checkpoint"/g) || []).length, 3);
  assert.equal((done.match(/class="stage-completed-text"/g) || []).length, 6, 'checkpoints do not create fake tool records');
  assert.ok(!s.render(0).includes('class="stage-checkpoint"'), 'replay starts with a clean timeline');
});

test('development mode exposes raw calls and retains the same group summaries', () => {
  const s = stageRenderer('development');
  const index = s.frames.findIndex(frame => frame.planCompleted === 1 && frame.call);
  const html = s.render(index);
  assert.ok(html.includes('data-tool-state="running" open'));
  assert.ok(html.includes('<strong>python</strong>'));
  assert.equal((html.match(/class="stage-checkpoint"/g) || []).length, 1);
});

test('leaving a slide cancels pending work; returning replays from its first state', async () => {
  const s = setup();
  await s.player.activate();
  const stale = [...s.timers.values()][0].callback;
  await s.next();
  s.player.deactivate();
  assert.equal(s.timers.size, 0);
  const count = s.events.length;
  await stale();
  assert.equal(s.events.length, count);
  await s.player.activate();
  assert.equal(s.events.at(-1).frame, 0);
  assert.equal(s.timers.size, 1);
});

test('a render finishing after navigation cannot schedule or reveal stale content', async () => {
  let resolve;
  const s = setup('2.1', () => new Promise(done => { resolve = done; }));
  const pending = s.player.activate();
  s.player.deactivate();
  resolve();
  await pending;
  assert.equal(s.ready, 0);
  assert.equal(s.timers.size, 0);
});

test('inactive previews prepare a printable state without consuming the timeline', async () => {
  const s = setup('1.3');
  await s.player.preview();
  assert.equal(s.events.find(item => item.action).action, 'case');
  assert.equal(s.events.at(-1), 'stop');
  assert.equal(s.ready, 1);
  assert.equal(s.timers.size, 0);
  await s.player.activate();
  while(s.timers.size) await s.next();
  assert.equal(s.events.at(-1).action, 'reuse-composer-pointer');
});

test('ninth slide shows the reusable ingredients before clicking and returning to the composer', async () => {
  const s = setup('1.3');
  await s.player.activate();
  while(s.timers.size) await s.next();
  const steps = s.events.filter(item=>item.action);
  assert.deepEqual(steps.map(item=>item.action), ['case','case-reuse-ready','case-reuse-pointer','case-reuse-pointer','case-reuse-pointer','case-reuse-press','reuse','reuse-composer-pointer']);
  assert.deepEqual(steps.filter(item=>item.action==='case-reuse-pointer').map(item=>item.target), ['.case-dialog-skill-block','.case-dialog-prompt-box','#caseDialogPrimary']);
  assert.equal(steps.find(item=>item.action==='case-reuse-press').hold,450);
  assert.equal(s.timers.size,0);
});

test('the presentation pointer moves into the modal top layer and returns to the page', () => {
  const source = fs.readFileSync('app.js','utf8');
  const definition = source.slice(source.indexOf('    function ensureStrategyDemoCursor('),source.indexOf('    function positionCaseReuseCursor('));
  const host = () => ({ append(node){ node.parentElement=this; } });
  const body = host(), dialog = host();
  const context = { document:{ body, createElement:()=>({setAttribute(){}}) }, greetingDemoCursor:null };
  vm.runInNewContext(`${definition}; globalThis.getCursor=ensureStrategyDemoCursor;`,context);
  const cursor = context.getCursor();
  assert.equal(cursor.parentElement,body);
  assert.equal(context.getCursor(dialog),cursor);
  assert.equal(cursor.parentElement,dialog);
  assert.equal(context.getCursor(),cursor);
  assert.equal(cursor.parentElement,body);
});

test('every scene points to current design research or an action and a real interaction handler', () => {
  const html = fs.readFileSync('design-strategy-slides.html', 'utf8');
  const source = fs.readFileSync('app.js', 'utf8');
  const points = vm.runInNewContext(html.match(/const pointSlides = (\[[\s\S]*?\n    \]);/)[1]);
  const ids = points.flatMap(point => [...(point.research?[point.no]:[]),...point.actions.map((_, index) => point.analysis || point.research ? `${point.no}-${index+2}` : index ? `${point.no}-${index + 1}` : point.no)]);
  for (const [id, steps] of Object.entries(scenes)) {
    assert.ok(ids.includes(id), id);
    for (const [index, step] of steps.entries()) {
      assert.ok(source.includes(`case '${step.action}':`), step.action);
      if (index < steps.length - 1) {
        const reuseMinimum = { case:900, 'case-reuse-ready':350, 'case-reuse-pointer':1200, 'case-reuse-press':450, reuse:800 };
        const minimum = id === '1.3' ? reuseMinimum[step.action] : step.action.startsWith('greeting-') || step.action.startsWith('prompt-') || step.action.startsWith('supplier-') || step.action.startsWith('process') ? 1000 : 3000;
        assert.ok(Number.isFinite(minimum) && step.hold >= minimum, `${id}/${step.action} must allow its motion to finish`);
      }
    }
  }
  assert.equal(scenes['3.3'], undefined, 'unbuilt version UI keeps its placeholder');
  assert.equal(scenes['3.1-2'], undefined, 'desktop pet uses its own desktop page and activation protocol');
});


test('capability demo hovers all four prompt cards without selecting them and cancels on exit', async () => {
  const s = setup('1.1');
  await s.player.activate();
  assert.equal(s.events.at(-1).action, 'prompt-hover-ready');
  await s.next();
  assert.equal(s.events.at(-1).action, 'prompt-hover-move');
  await s.next();
  assert.equal(s.events.at(-1).action, 'prompt-hover');
  const stale = [...s.timers.values()][0].callback;
  s.player.deactivate();
  const count = s.events.length;
  await stale();
  assert.equal(s.events.length, count);
  await s.player.activate();
  while(s.timers.size) await s.next();
  assert.deepEqual(s.events.slice(count).filter(step=>step.action==='prompt-hover').map(step=>step.category), ['develop','analyze','create','research']);
  const html = fs.readFileSync('design-strategy-slides.html', 'utf8');
  assert.ok(!html.includes('<div class="capability-cards"'));
  assert.ok(scenes['1.1'].every(step=>!['category','suggestion','greeting-click'].includes(step.action)));
});


test('prompt hover reacts to the cursor entering each card during movement, without waiting for the hold step', () => {
  const source = fs.readFileSync('app.js', 'utf8');
  const helpers = source.slice(source.indexOf('    function syncPromptDemoHover()'), source.indexOf('    function positionPromptDemoCursor('));
  const frames = new Map();
  let id = 0, hit = null;
  const buttons = Array.from({length: 4}, () => ({hovered: false, classList: {toggle(name, value) {this.owner.hovered=value}}}));
  buttons.forEach(button=>button.classList.owner=button);
  const context = {
    greetingDemoCursor: {hidden: false, getBoundingClientRect: () => ({left: 50, top: 60})},
    primaryPromptButtons: buttons, promptHoverFrame: null, strategyDemoActive: true,
    document: {elementFromPoint: (x,y) => {assert.equal(x,53); assert.equal(y,63);return hit ? {closest: () => hit} : null}},
    performance: {now: () => 0},
    requestAnimationFrame: callback => {frames.set(++id,callback);return id},
    cancelAnimationFrame: frame => frames.delete(frame),
  };
  vm.createContext(context);
  vm.runInContext(helpers + ';trackPromptDemoHover();',context);
  const tick = now => {const [id,callback]=frames.entries().next().value;frames.delete(id);callback(now)};
  tick(16);
  assert.equal(buttons.filter(button=>button.hovered).length,0);
  hit=buttons[0];tick(100);
  assert.equal(buttons[0].hovered,true,'hover starts during pointer motion');
  hit=buttons[1];tick(300);
  assert.equal(buttons[0].hovered,false);
  assert.equal(buttons[1].hovered,true,'next card responds on its first pointer frame');
  hit=null;tick(500);
  assert.equal(buttons.filter(button=>button.hovered).length,0);
  context.strategyDemoActive=false;tick(600);
  assert.equal(frames.size,0,'inactive slides stop tracking');
});

test('case recommendations appear after a pointer click instead of opening in a preselected state', async () => {
  const s = setup('1.2');
  await s.player.activate();
  assert.equal(s.events.at(-1).action, 'prompt-hover-ready');
  await s.next();
  assert.equal(s.events.at(-1).action, 'prompt-hover-move');
  assert.ok(!s.events.some(step=>step.action==='category'||step.action==='prompt-category-click'));
  const stale = [...s.timers.values()][0].callback;
  s.player.deactivate();
  const count = s.events.length;
  await stale();
  assert.equal(s.events.length, count);
  await s.player.activate();
  await s.next();
  await s.next();
  assert.equal(s.events.at(-1).action, 'prompt-category-click');
  assert.equal(s.events.at(-1).category, 'analyze');
  await s.next();
  assert.equal(s.events.at(-1).action, 'prompt-hover-end');
  assert.equal(s.timers.size, 0);
  const source=fs.readFileSync('app.js','utf8');
  const handler=source.split("case 'prompt-category-click':")[1].split("case 'prompt-hover-end':")[0];
  assert.ok(handler.includes('?.click()'), 'the demo uses the card click and its normal case entrance animation');
});


test('schematic phase and activity follow the actual process frame instead of a separate timer', () => {
  const api = require('../strategy-scenes.js');
  const html = fs.readFileSync('design-strategy-slides.html','utf8');
  const source = html.slice(html.indexOf('    function syncProcessDiagram('),html.indexOf('    function revealDemo('));
  const columns = ['before','working','after'].map(phase=>({dataset:{phase}, classes:new Set(), setAttribute(name,value){this[name]=value},removeAttribute(name){delete this[name]}}));
  columns.forEach(column=>column.classList={toggle(name,value){if(value)column.classes.add(name);else column.classes.delete(name)}});
  const caption={textContent:''},tool={textContent:''},label={textContent:''},statusLabel={textContent:'',setAttribute(name,value){this[name]=value}};
  const diagram={dataset:{phase:'before'},querySelector:selector=>selector==='[data-process-tool]'?tool:selector==='[data-process-status]'?statusLabel:caption};
  const tabs=[0,4,10].map(frame=>({dataset:{processFrame:String(frame)},setAttribute(name,value){this[name]=value}}));
  const page={querySelector:selector=>selector==='.process-schematic'?diagram:label,querySelectorAll:selector=>selector==='[data-process-frame]'?tabs:columns};
  const ctx={CatPawStrategyScenes:api,page};vm.createContext(ctx);vm.runInContext(source,ctx);
  for(const [frame,phase,activity,status] of [[0,'before','','思考中'],[0,'before','','正在制定计划'],[1,'working','读取文件','读取中'],[3,'working','阶段总结','整理中'],[10,'after','','已完成']]){
    ctx.frame=frame;ctx.activity=activity;ctx.status=status;
    vm.runInContext('syncProcessDiagram(page,frame,activity,status)',ctx);
    assert.equal(statusLabel.textContent,'全局响应状态');
    assert.equal(statusLabel['aria-label'],`全局响应状态：${status}`);
    assert.equal(diagram.dataset.phase,phase);
    assert.equal(diagram.dataset.transition||'',phase==='working'?'before-working':'');
    columns.forEach(column=>assert.equal(column['aria-hidden'],String(column.dataset.phase!==phase)));
    assert.deepEqual(columns.filter(column=>column.classes.has('is-current')).map(column=>column.dataset.phase),[phase]);
    assert.deepEqual(columns.filter(column=>!column.hidden).map(column=>column.dataset.phase),[phase]);
    assert.deepEqual(tabs.filter(tab=>tab['aria-selected']==='true').map(tab=>api.processPhaseForFrame(Number(tab.dataset.processFrame))),[phase]);
    if(activity)assert.equal(tool.textContent,activity);
  }
  assert.equal(api.processPhaseForFrame(11),null);
  assert.equal(api.processPhaseForFrame('1'),null);
  assert.equal(caption.textContent,'收起过程信息，直接呈现结果与产物。');
  assert.ok(html.includes("frame.dataset.processSync==='true'&&page.classList.contains('active')&&!document.hidden"));
});

test('the live process preview shares the conversation renderer and preserves elapsed time through completion', () => {
  const source=fs.readFileSync('app.js','utf8');
  const renderer=source.slice(source.indexOf('    function showStrategyProcessSnapshot('),source.indexOf('    function reserveStrategySplit('));
  const intervals=new Map(),timeouts=new Map(),reported=[],rendered=[],elapsed={textContent:''},status={textContent:''},thinking={dataset:{}};let now=1000,id=0;
  const panel={dataset:{},isConnected:true,scrollHeight:700,scrollTop:0,classList:{toggle(){}},querySelector:selector=>selector==='.stage-global-label'?status:selector==='.stage-thinking'?thinking:elapsed};
  const ctx={document:{documentElement:{classList:{add(){},toggle(){}}},getElementById:()=>panel},Date:{now:()=>now},
    conversationStageFrames:Array.from({length:11},(_,i)=>({stage:i===10?'done':i===0?'plan':'work'})),
    renderConversationStageBody:(frame,open)=>{rendered.push([frame,open]);return `frame-${frame}`},
    reducedMotion:{matches:false},stageClockTimer:null,processPlanningTimer:null,strategyDemoActive:true,processVisibleFrames:[0,1,3,4,6,7,9,10],
    conversationGlobalStates:{thinking:'思考中',planning:'正在制定计划'},reportProcessProgress:frame=>reported.push(frame),
    setTimeout:(callback,duration)=>{timeouts.set(++id,{callback,duration});return id},clearTimeout:id=>timeouts.delete(id),
    setInterval:callback=>{intervals.set(++id,callback);return id},clearInterval:id=>intervals.delete(id),
    updateStageClock:panel=>{elapsed.textContent=String((Number(panel.dataset.finishedAt)||now)-Number(panel.dataset.startedAt))},
    requestAnimationFrame:callback=>callback(),formatStageElapsed:seconds=>`${seconds}秒`};
  vm.createContext(ctx);vm.runInContext(renderer,ctx);
  vm.runInContext('showStrategyProcessSnapshot(0,true)',ctx);
  assert.equal(panel.dataset.startedAt,'1000');assert.equal(intervals.size,1);
  assert.equal(status.textContent,'思考中');
  const [timeoutId,timeout]=timeouts.entries().next().value;
  assert.equal(timeout.duration,1950);timeouts.delete(timeoutId);timeout.callback();
  assert.equal(status.textContent,'正在制定计划');assert.deepEqual(reported,[0]);
  now=3000;vm.runInContext('showStrategyProcessSnapshot(4,true)',ctx);
  assert.equal(panel.dataset.startedAt,'1000');assert.equal(elapsed.textContent,'2000');assert.equal(panel.scrollTop,700);
  now=5000;vm.runInContext('showStrategyProcessSnapshot(0,true)',ctx);
  assert.equal(panel.dataset.startedAt,'1000','returning to the initial phase is not a task restart');
  assert.equal(elapsed.textContent,'4000');
  now=6000;vm.runInContext('showStrategyProcessSnapshot(10,true)',ctx);
  assert.equal(panel.dataset.finishedAt,'6000');assert.equal(intervals.size,0);assert.equal(elapsed.textContent,'5000');
  now=9000;vm.runInContext('showStrategyProcessSnapshot(4,true)',ctx);
  assert.equal(panel.dataset.startedAt,'1000');assert.equal(panel.dataset.finishedAt,'6000');
  assert.equal(elapsed.textContent,'5000','reviewing a finished task keeps its final elapsed time');
  assert.equal(intervals.size,0);
  now=12000;vm.runInContext('showStrategyProcessSnapshot(10,true)',ctx);
  assert.equal(panel.dataset.finishedAt,'6000','completion time must not change on a rerender');
  assert.equal(elapsed.textContent,'5000');
  assert.deepEqual(rendered,[[0,true],[4,false],[0,true],[10,false],[4,false],[10,false]]);
});

test('player distinguishes phase seeking from replay so task clocks can keep the same origin',async()=>{
  const resets=[],timers=new Map();let serial=0;
  const player=createPlayer({scene:'2.1',reset:options=>resets.push(options.restartTask),present(){},stop(){},ready(){},setTimer:(callback,duration)=>{timers.set(++serial,{callback,duration});return serial;},clearTimer:id=>timers.delete(id)});
  await player.activate();
  await player.seek(4);await player.seek(0);await player.seek(10);
  assert.deepEqual(resets,[true,false,false,false]);
  await player.activate();
  assert.equal(resets.at(-1),true,'replaying the task permits a new clock origin');
  player.deactivate();
  const app=fs.readFileSync('app.js','utf8');
  const clockReset=app.slice(app.indexOf("      const processPreview=document.getElementById('strategyProcessPanel');"),app.indexOf("      if (greetingDemoCursor) greetingDemoCursor.className"));
  const panel={dataset:{startedAt:'1000',finishedAt:'6000'},scrollTop:50};
  const ctx={restartTask:false,document:{getElementById:()=>panel}};
  vm.runInNewContext(`{${clockReset}}`,ctx);
  assert.equal(panel.dataset.startedAt,'1000');assert.equal(panel.dataset.finishedAt,'6000');
  ctx.restartTask=true;vm.runInNewContext(`{${clockReset}}`,ctx);
  assert.equal(panel.dataset.startedAt,undefined);assert.equal(panel.dataset.finishedAt,undefined);
});


test('process tabs seek both views to a representative frame and hold it without stale automatic advancement', async () => {
  const s=setup('2.1');
  await s.player.activate();
  const stale=[...s.timers.values()][0].callback;
  for(const frame of [4,10,0]){
    await s.player.seek(frame);
    assert.equal(s.events.at(-1).frame,frame);
    assert.equal(s.timers.size,0,'the selected tab stays available for comparison');
    const count=s.events.length;
    await stale();assert.equal(s.events.length,count);
  }
  assert.equal(s.player.seek(999),false);
  s.player.deactivate();await s.player.activate();
  assert.equal(s.events.at(-1).frame,0);
  assert.equal(s.timers.size,1,'re-entering starts the automatic demo again');
  const html=fs.readFileSync('design-strategy-slides.html','utf8');
  assert.ok(html.includes('data-process-tabs'));
  assert.ok(html.includes("type:'catpaw:scene-seek'"));
  assert.ok(html.includes('column.hidden=column.dataset.phase!==phase'));
});


test('spotlight cutouts follow their visible target and stay clipped to the design viewport', () => {
  const {spotlightBounds}=require('../strategy-scenes.js');
  const viewport={width:1200,height:800};
  assert.deepEqual(spotlightBounds({left:100,top:120,right:300,bottom:160},viewport),{left:92,top:112,width:216,height:56});
  assert.deepEqual(spotlightBounds({left:100,top:120,right:300,bottom:160},viewport,{left:50,top:130,right:250,bottom:400}),{left:92,top:130,width:158,height:38});
  assert.deepEqual(spotlightBounds({left:-20,top:-10,right:40,bottom:20},viewport),{left:0,top:0,width:48,height:28});
  assert.equal(spotlightBounds({left:1500,top:20,right:1700,bottom:60},viewport),null);
  assert.equal(spotlightBounds(null,viewport),null);
  const app=fs.readFileSync('app.js','utf8'),css=fs.readFileSync('styles.css','utf8');
  assert.ok(app.includes("const usesSpotlight = ['2.1-2','2.1-3','2.1-4'].includes(strategyScene)"));
  assert.ok(app.includes('if (usesSpotlight && step.focus) showStrategySpotlight(step.focus)'));
  assert.ok(app.includes('strategyDemoActive = false;\n      stopStrategySpotlight();'));
  assert.ok(app.includes("spotlightMaskPath.setAttribute('fill-rule','evenodd')"));
  assert.ok(css.includes('.strategy-spotlight path{fill:rgba(0,0,0,.56)}'));
  assert.ok(!css.includes('200vmax'),'the overlay must not allocate an oversized shadow texture');
});

test('spotlight path keeps an actual rounded cutout, clamps it and scales to the viewport', () => {
  const {spotlightPath}=require('../strategy-scenes.js');
  assert.equal(spotlightPath({width:1200,height:800}),'M0 0H1200V800H0Z');
  const path=spotlightPath({width:1200,height:800},{left:100,top:120,width:200,height:40});
  assert.equal(path,'M0 0H1200V800H0Z M108 120H292Q300 120 300 128V152Q300 160 292 160H108Q100 160 100 152V128Q100 120 108 120Z');
  assert.equal((path.match(/M/g)||[]).length,2);
  assert.match(spotlightPath({width:600,height:400},{left:-10,top:-10,width:40,height:30}),/^M0 0H600V400H0Z M8 0H22/);
  assert.match(spotlightPath({width:100,height:100},{left:20,top:20,width:4,height:4}),/M22 20H22Q24 20 24 22/,'corner radius cannot exceed half the cutout size');
  assert.equal(spotlightPath({width:0,height:800}),'');
  assert.equal(spotlightPath({width:600,height:400},{left:700,top:0,width:40,height:40}),'M0 0H600V400H0Z');
});

test('only the four affected embedded scenes suppress the composer blur layer', () => {
  const app=fs.readFileSync('app.js','utf8'),css=fs.readFileSync('styles.css','utf8');
  const addClass=app.match(/if \(usesSpotlight \|\| strategyScene === '2.1-5'\) document.documentElement.classList.add\('strategy-flat-composer'\);/)[0];
  for(const scene of ['2.1','2.1-2','2.1-3','2.1-4','2.1-5','1.3','2.3-2']){
    const classes=new Set();
    vm.runInNewContext(addClass,{strategyScene:scene,usesSpotlight:['2.1-2','2.1-3','2.1-4'].includes(scene),document:{documentElement:{classList:{add:value=>classes.add(value)}}}});
    assert.equal(classes.has('strategy-flat-composer'),['2.1-2','2.1-3','2.1-4','2.1-5'].includes(scene));
  }
  assert.ok(css.includes('.strategy-embed.strategy-flat-composer .conversation-composer-wrap::before{content:none;'));
});

test('SVG spotlight follows the target and viewport, then cancels its pending frame on exit', () => {
  const app=fs.readFileSync('app.js','utf8');
  const functions=app.slice(app.indexOf('    function stopStrategySpotlight()'),app.indexOf('    function ensureStrategyDemoCursor('));
  const nodes=[],frames=new Map();
  let serial=0;
  const element=tag=>{
    const node={tag,attributes:{},children:[],hidden:false,setAttribute(key,value){this.attributes[key]=value},append(child){this.children.push(child)}};
    nodes.push(node);return node;
  };
  let rect={left:100,top:120,right:300,bottom:160};
  const target={getBoundingClientRect:()=>rect,closest:()=>null};
  const context={
    spotlightOverlay:null,spotlightSvg:null,spotlightMaskPath:null,spotlightFrame:null,strategyDemoActive:true,
    window:{innerWidth:1200,innerHeight:800,CatPawStrategyScenes:require('../strategy-scenes.js')},
    document:{createElement:element,createElementNS:(_,tag)=>element(tag),body:{append(){}},querySelector:()=>target},
    requestAnimationFrame:callback=>{frames.set(++serial,callback);return serial},cancelAnimationFrame:id=>frames.delete(id),
  };
  vm.runInNewContext(functions+';globalThis.show=showStrategySpotlight;globalThis.stop=stopStrategySpotlight;',context);
  context.show('.stage-current');
  const path=nodes.find(node=>node.tag==='path'),svg=nodes.find(node=>node.tag==='svg');
  assert.equal(path.attributes['fill-rule'],'evenodd');
  assert.equal(svg.attributes.viewBox,'0 0 1200 800');
  const initial=path.attributes.d;
  const next=()=>{const [id,callback]=frames.entries().next().value;frames.delete(id);callback();};
  rect={left:200,top:220,right:400,bottom:300};
  next();
  assert.notEqual(path.attributes.d,initial);
  context.window.innerWidth=600;context.window.innerHeight=400;
  next();
  assert.equal(svg.attributes.viewBox,'0 0 600 400');
  assert.ok(path.attributes.d.startsWith('M0 0H600V400H0Z'));
  const stale=frames.values().next().value;
  context.stop();
  assert.equal(frames.size,0);
  assert.equal(context.spotlightOverlay.hidden,true);
  context.strategyDemoActive=false;
  stale();
  assert.equal(frames.size,0);
});


test('greeting pages continue from input focus through zoom-out, category selection and a more specific prompt', async () => {
  const s=setup('1.3-3');
  await s.player.activate();
  assert.equal(s.events.at(-1).action,'greeting-resume');
  await s.next();assert.equal(s.events.at(-1).action,'greeting-zoom-out');
  while(s.timers.size)await s.next();
  const actions=s.events.filter(step=>step.action).map(step=>step.action);
  assert.ok(actions.indexOf('prompt-category-click')>actions.indexOf('greeting-zoom-out'));
  assert.ok(actions.indexOf('prompt-secondary-click')>actions.indexOf('prompt-category-click'));
  assert.equal(s.events.find(step=>step.action==='prompt-category-click').category,'create');
  assert.equal(s.events.find(step=>step.action==='prompt-secondary-click').index,1);
  const html=fs.readFileSync('design-strategy-slides.html','utf8');
  const source=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match=>match[1]).find(script=>script.includes('const pointSlides'));
  const canvas={innerHTML:''};
  vm.runInNewContext(source.split('    const pages=')[0],{document:{getElementById:()=>canvas},CatPawStrategyScenes:{scenes}});
  for(const id of ['1.3-2','1.3-3']){
    const section=canvas.innerHTML.split(`id="slide-${id}"`)[1].split('</section>')[0];
    assert.ok(section.includes(`<iframe title="CatPaw Demo：`));
    assert.ok(section.includes(`data-scene="${id}"`));
  }
  assert.ok(!html.includes('greeting-cases-grid'));
  assert.ok(html.includes('greetingText:sharedGreetingText'));
});


test('the next greeting page restores the previous welcome text before zooming out', () => {
  const source=fs.readFileSync('app.js','utf8');
  const body=source.slice(source.indexOf("        case 'greeting-resume':"),source.indexOf("        case 'greeting-zoom-out':"));
  const classes=new Set(),bubble={textContent:'',setAttribute(name,value){this[name]=value}};
  let stopped=0;
  const ctx={document:{documentElement:{classList:{add:(...names)=>names.forEach(name=>classes.add(name))}}},
    prompt:{focus(){}},stopGreetingTyping:()=>stopped++,continuedGreetingText:'今天想做点什么？',
    currentGreetingMessage:'另一个欢迎语',currentGreetingContext:'',lastGreetingByContext:new Map(),greetingBubble:bubble};
  vm.createContext(ctx);vm.runInContext(`switch('greeting-resume'){${body}}`,ctx);
  assert.equal(bubble.textContent,'今天想做点什么？');
  assert.equal(bubble['aria-label'],'今天想做点什么？');
  assert.equal(ctx.currentGreetingContext,'default');
  assert.ok(classes.has('strategy-greeting-zoom'));
  assert.ok(classes.has('strategy-greeting-prime'));
  assert.equal(stopped,1);
});


test('tool completion records come from the same execution frames and never include stage summaries as calls', () => {
  const source=fs.readFileSync('app.js','utf8');
  const report=source.slice(source.indexOf('    function reportProcessProgress('),source.indexOf('    function showStrategyProcessSnapshot('));
  const frames=stageRenderer().frames,messages=[];
  const ctx={conversationStageFrames:frames,strategyScene:'2.1',conversationGlobalStates:{},processPanelMode:false,processVisibleFrames:[0,1,3,4,6,7,9,10],window:{parent:{postMessage:message=>messages.push(message)}}};
  vm.createContext(ctx);vm.runInContext(report,ctx);
  vm.runInContext('reportProcessProgress(2,null);reportProcessProgress(3,null);reportProcessProgress(10,null)',ctx);
  assert.deepEqual(Array.from(messages[0].tools.completed,item=>item.id),[1]);
  assert.equal(messages[0].tools.current.id,2);
  assert.equal(messages[1].tools.current,null);
  assert.deepEqual(Array.from(messages[1].tools.completed,item=>item.id),[1,2]);
  assert.deepEqual(Array.from(messages[2].tools.completed,item=>item.id),[1,2,4,5,7,8]);
  const {completedToolTransfer}=require('../strategy-scenes.js');
  assert.equal(completedToolTransfer({frame:1,current:{id:1}},3,messages[1].tools.completed).id,1);
  assert.equal(completedToolTransfer({frame:1,current:{id:1}},10,messages[2].tools.completed),null,'manual jumps do not animate skipped tools');
  assert.equal(completedToolTransfer({frame:2,current:{id:2}},2,messages[0].tools.completed),null,'repeated status updates do not complete a tool');
});

test('a finished tool moves upward without expanding global history and cleanup cancels pending effects', () => {
  const html=fs.readFileSync('design-strategy-slides.html','utf8');
  const source=html.slice(html.indexOf('    function clearProcessToolTransfer('),html.indexOf('    function syncProcessDiagram('));
  const timers=new Map(),ghosts=[],animations=[];let id=0;
  const animate=(frames,options)=>{const animation={frames,options,cancelled:false,cancel(){this.cancelled=true}};animations.push(animation);return animation};
  const status={getBoundingClientRect:()=>({bottom:54}),setAttribute(name,value){this[name]=value}},history={hidden:true,scrollHeight:80};
  const records={rows:[],replaceChildren(...rows){this.rows=rows},querySelector(selector){return this.rows.find(row=>selector.includes(`"${row.dataset.toolRecord}"`))}};
  const block={classList:{toggle(){}},getBoundingClientRect:()=>({left:100,top:200,width:440,height:126}),animate,
    cloneNode:()=>({style:{},setAttribute(){},animate,removed:false,remove(){this.removed=true}})};
  const diagram={dataset:{},offsetWidth:578,clientTop:1,append:ghost=>ghosts.push(ghost),getBoundingClientRect:()=>({left:0,top:0,width:578}),
    querySelector:selector=>({'[data-process-status]':status,'[data-process-history]':history,'[data-process-completed]':records,'.process-map-tools':block}[selector])};
  const ctx={diagram,CatPawStrategyScenes:require('../strategy-scenes.js'),window:{matchMedia:()=>({matches:false})},
    document:{createElement:()=>({dataset:{},textContent:'',getBoundingClientRect:()=>({left:110,top:60,width:420,height:32})})},
    setTimeout:(callback,duration)=>{timers.set(++id,{callback,duration});return id},clearTimeout:id=>timers.delete(id)};
  vm.createContext(ctx);vm.runInContext(source,ctx);
  vm.runInContext("syncProcessToolHistory(diagram,1,{current:{id:1,name:'读取文件'},completed:[]})",ctx);
  assert.equal(status.disabled,true);assert.equal(ghosts.length,0);
  vm.runInContext("syncProcessToolHistory(diagram,3,{current:null,completed:[{id:1,name:'读取文件'}]})",ctx);
  assert.equal(status.disabled,false);assert.equal(history.hidden,true);assert.equal(status['aria-expanded'],'false');
  assert.equal(records.rows[0].textContent,'读取文件');assert.equal(ghosts.length,1);
  assert.ok(animations[0].frames.at(-1).transform.includes('-140px'),'completed tool moves up into the history row');
  for(const [timerId,timer] of [...timers])if(timer.duration===650){timers.delete(timerId);timer.callback()}
  assert.equal(ghosts[0].removed,true);
  assert.equal(history.hidden,true,'completing the transfer keeps history folded');
  diagram.dataset.historyPinned='true';history.hidden=false;status.setAttribute('aria-expanded','true');
  vm.runInContext('clearProcessToolTransfer(diagram)',ctx);
  assert.equal(history.hidden,false,'a history opened by the user stays open');
  assert.equal(status['aria-expanded'],'true');assert.equal(timers.size,0);
  assert.ok(animations.every(animation=>animation.cancelled));
});


test('every slide shows three scene progress segments which fill in order across chapter boundaries', () => {
  const html=fs.readFileSync('design-strategy-slides.html','utf8');
  const source=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match=>match[1]).find(script=>script.includes('const pointSlides'));
  const canvas={innerHTML:''},ctx={document:{getElementById:()=>canvas},CatPawStrategyScenes:{scenes}};
  vm.createContext(ctx);vm.runInContext(source.split('    const pages=')[0]+';globalThis.deckSlides=slides;',ctx);
  const sections=canvas.innerHTML.split(/(?=<section class="slide\b)/).filter(section=>section.startsWith('<section class="slide'));
  assert.equal(sections.length,ctx.deckSlides.length,'nested component sections are not additional slides');
  assert.equal((canvas.innerHTML.match(/class="deck-progress"/g)||[]).length,sections.length);
  for(const section of sections){
    assert.ok(section.includes('role="progressbar"'));
    for(const label of ['对话前','对话','修改中'])assert.ok(section.includes(`<span>${label}</span>`));
  }
  assert.equal(ctx.deckProgressData(0).phase,-1);assert.equal(ctx.deckProgressData(0).value,0);
  let lastValue=0;
  for(let index=0;index<ctx.deckSlides.length;index++){
    const progress=ctx.deckProgressData(index);assert.ok(progress.value>=lastValue);lastValue=progress.value;
  }
  for(let chapter=1;chapter<=3;chapter++){
    const index=ctx.deckSlides.findIndex(slide=>slide.no===`strategy-${chapter}`),progress=ctx.deckProgressData(index);
    assert.equal(progress.phase,chapter-1);
    assert.ok(progress.fractions[chapter-1]>0&&progress.fractions[chapter-1]<1);
    for(let earlier=0;earlier<chapter-1;earlier++)assert.equal(progress.fractions[earlier],1);
  }
  assert.equal(ctx.deckProgressData(ctx.deckSlides.length-1).value,100);
});


test('the generating tab shows exactly three tools and automatically switches to the completed phase', async () => {
  const s=setup('2.1');
  await s.player.seek(1,{endFrame:10});
  assert.equal(s.events.at(-1).frame,1);
  assert.equal([...s.timers.values()][0].duration,2500);
  while(s.timers.size)await s.next();
  const frames=s.events.filter(event=>event.action).map(event=>event.frame);
  assert.deepEqual(frames,[1,3,4,6,7,9,10]);
  const data=stageRenderer();
  assert.deepEqual(frames.filter(frame=>data.frames[frame].call).map(frame=>data.frames[frame].tool),['读取文件','数据分析','整理结果']);
  assert.equal(s.timers.size,0);assert.equal(s.events.at(-1).frame,10);
  const history=data.render(10,false,-1,true,scenes['2.1'].map(step=>step.frame));
  assert.equal((history.match(/class="stage-completed-item/g)||[]).length,3,'the actual demo history also contains only those three tools');
  const html=fs.readFileSync('design-strategy-slides.html','utf8');
  assert.ok(html.includes('id="process-tab-working" role="tab" aria-controls="process-map-working" aria-selected="false" tabindex="-1" data-process-frame="1"'));
  assert.ok(fs.readFileSync('app.js','utf8').includes('player.seek(1,{endFrame:10})'));
});

test('visual replies have one scene analysis followed by exactly two numbered design actions', () => {
  const html = fs.readFileSync('design-strategy-slides.html','utf8');
  const source = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match=>match[1]).find(script=>script.includes('const pointSlides'));
  const canvas = { innerHTML:'' };
  const context = { document:{ getElementById:()=>canvas }, CatPawStrategyScenes:{ scenes }, location:{ hash:'' } };
  vm.createContext(context);
  vm.runInContext(source.split('    const pages=')[0],context);
  vm.runInContext(source.slice(source.indexOf('    const fromHash=()=>{'),source.indexOf('    let current='))+';globalThis.route=()=>slides[fromHash()]?.no;',context);
  const sectionFor=id=>{
    const start=canvas.innerHTML.indexOf(`id="slide-${id}"`);
    const end=canvas.innerHTML.indexOf('<section class="slide ',start);
    return canvas.innerHTML.slice(start,end<0?undefined:end);
  };
  const analysis=sectionFor('2.3');
  assert.ok(analysis.includes('场景分析'));
  assert.ok(analysis.includes('按下一步任务判断回复形式'));
  assert.doesNotMatch(analysis,/设计动作 2\.3\./);
  for(const label of ['短回复','结论与指标摘要','同维度对比','趋势与分布图','视觉选项','结构化确认','可操作清单']) assert.ok(analysis.includes(label),label);
  const concerns=[];
  const titles=['提供适配数据结构的表格样式','用选择与确认降低表达成本'];
  for(const [index,title] of titles.entries()){
    const id=`2.3-${index+2}`;
    context.location.hash=`#${id}`;
    assert.equal(context.route(),id);
    const section=sectionFor(id);
    assert.ok(section.includes(`设计动作 2.3.${index+1}`));
    assert.ok(section.includes(title));
    assert.ok(section.includes('原型验证'));
    concerns.push(section.match(/class="user-concern"[\s\S]*?<p>([^<]+)<\/p>/)[1]);
    if(index)assert.ok(section.includes(`data-scene="${id}"`),'input controls use the real supplier conversation');
    else {
      for(const label of ['明细表','对比表','增强表']) assert.ok(section.includes(label));
      assert.equal((section.match(/<table /g)||[]).length,3);
      assert.ok(section.includes('尚待接入 Demo'));
    }
  }
  assert.equal(new Set(concerns).size,2);
  const catalog=canvas.innerHTML.match(/<section[^>]*id="slide-catalog"[\s\S]*?<\/section>/)[0];
  for(const title of titles)assert.ok(catalog.includes(title));
  assert.ok(!catalog.includes('按下一步任务判断回复形式'),'analysis does not count as an action in the catalog');
  assert.doesNotMatch(catalog,/>2\.3\.[34]</);
  context.location.hash='#2.3-4';assert.equal(context.route(),'2.3-3','old iteration links continue to the merged action');
  assert.ok(!canvas.innerHTML.includes('id="slide-2.3-4"'));
  assert.doesNotMatch(canvas.innerHTML,/具体生成什么界面|可视化回复 \/ 设计方向待探索/);
});

test('the second visual reply action continues from choosing and confirming into iterative replies',async()=>{
  const iteration=setup('2.3-3');
  await iteration.player.activate();
  while(iteration.timers.size)await iteration.next();
  const events=iteration.events.filter(item=>item.action).map(item=>item.action);
  assert.deepEqual(events.slice(0,4),['supplier-start','supplier-confirm','supplier-pick','supplier-follow-up']);
  assert.ok(events.indexOf('supplier-pick')<events.indexOf('supplier-generate'));
  assert.deepEqual(events.slice(-3),['supplier-generate','supplier-note','supplier-update']);
  const interrupted=setup('2.3-3');
  await interrupted.player.activate();
  interrupted.player.deactivate();
  assert.equal(interrupted.timers.size,0);
  assert.equal(interrupted.events.some(item=>item.action==='supplier-generate'),false);
});

test('larger full-window previews preserve exterior margins and keep all app controls visible',()=>{
  const html=fs.readFileSync('design-strategy-slides.html','utf8');
  const definition=html.slice(html.indexOf('    function fitDemo(page){'),html.indexOf('    function clearProcessToolTransfer('));
  const ctx={};vm.runInNewContext(definition+';globalThis.fit=fitDemo;',ctx);
  for(const [width,height] of [[860,584],[397,300]]){
    const frame={style:{}};
    ctx.fit({querySelectorAll:()=>[{clientWidth:width,clientHeight:height,dataset:{},querySelector:()=>frame}]});
    const scale=Number(frame.style.transform.match(/scale\(([^)]+)\)/)[1]);
    const left=parseFloat(frame.style.left),top=parseFloat(frame.style.top);
    assert.equal(scale,Math.min(width/1200,height/800));
    assert.ok(left>=0&&top>=0,'the complete Demo and its exterior wallpaper remain in view');
    assert.ok(left+24*scale>=24*scale&&width-(left+1176*scale)>=24*scale-1e-9,'neither side margin is cropped');
    assert.ok(left+24*scale>=0&&left+1176*scale<=width,'left and right window edges stay visible');
    assert.ok(top+24*scale>=0&&top+776*scale<=height,'top and bottom window edges stay visible');
  }
  const compact={style:{}};
  ctx.fit({querySelectorAll:()=>[{clientWidth:584,clientHeight:374,dataset:{demoWidth:'660',demoHeight:'500'},querySelector:()=>compact}]});
  assert.equal(compact.style.transform,'scale(0.748)');
  assert.ok(parseFloat(compact.style.left)>=0);
  assert.equal(parseFloat(compact.style.top),0,'the compact process view has no exterior margin to crop');
});

test('the three stage-specific process designs stay in their own phase and reuse the same output',async()=>{
  const start=setup('2.1-2');
  await start.player.activate();while(start.timers.size)await start.next();
  const startSteps=start.events.filter(item=>item.action);
  assert.deepEqual(startSteps.filter(item=>item.action==='process').map(item=>item.frame),[0],'focusing acknowledgement and planning must not rerender or advance the task');
  assert.deepEqual(startSteps.map(item=>item.focus),['.stage-thinking','.stage-acknowledgement','.stage-plan']);
  const work=setup('2.1-3');
  await work.player.activate();while(work.timers.size)await work.next();
  const data=stageRenderer();
  assert.ok(work.events.filter(item=>item.action==='process').every(item=>['work','checkpoint'].includes(data.frames[item.frame].stage)));
  assert.ok(work.events.some(item=>item.focus==='.stage-tool-call'));
  assert.ok(work.events.some(item=>item.focus?.startsWith('.stage-checkpoint')));
  const done=setup('2.1-4');
  await done.player.activate();
  assert.equal(done.events.at(-1).frame,10);
  assert.equal(done.events.at(-1).focus,'.stage-result');
  assert.equal(done.timers.size,0);
  data.renderConversationArtifact=name=>`<div>${name}</div>`;
  const output=data.render(10,false);
  assert.ok(output.includes('class="stage-result"><section class="stage-summary"'));
  assert.ok(output.includes('class="stage-output"'));
  assert.ok(output.includes('缺失时间戳与责任归属仍待人工核实。'));
  assert.ok(output.includes('门店履约异常明细.xlsx'));
});
