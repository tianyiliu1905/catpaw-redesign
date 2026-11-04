const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {createModel,createController,draft,output}=require('../conversation-queue-demo.js');
const {scenes,createPlayer}=require('../strategy-scenes.js');

function harness({onEdit,characterInterval}={}){
  let clock=1000,serial=0,sent=[],edited=[],resumed=[];
  const timers=new Map(),handlers={},threadHandlers={},views=[];
  function addView(){
    const classes=new Set(),section={classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name),add:name=>classes.add(name),remove:name=>classes.delete(name)}};
    const view={classes,section,body:{textContent:'',closest:()=>section},label:{textContent:''},time:{textContent:''},
      control:{hidden:false,dataset:{queueControl:'pause'},setAttribute(name,value){this[name]=value;}}};
    views.push(view);return view;
  }
  addView();
  const container={hidden:true,innerHTML:'',addEventListener:(name,handler)=>handlers[name]=handler,querySelector:()=>null};
  const keys={'[data-queue-agent-body]':'body','[data-queue-agent-label]':'label','[data-queue-agent-time]':'time','[data-queue-control]':'control'};
  const thread={querySelectorAll:selector=>views.map(view=>view[keys[selector]]),addEventListener:(name,handler)=>threadHandlers[name]=handler};
  const controller=createController({container,thread,characterInterval,onSend:message=>sent.push(message),onEdit:onEdit||((message)=>{edited.push(message);return true;}),now:()=>clock,
    onResume:message=>{resumed.push(message);addView();},
    setTimer:callback=>{timers.set(++serial,callback);return serial;},clearTimer:id=>timers.delete(id)});
  return {controller,container,views,get body(){return views.at(-1).body;},get label(){return views.at(-1).label;},get time(){return views.at(-1).time;},get classes(){return views.at(-1).classes;},
    handlers,sent,edited,resumed,timers,setClock:value=>clock=value,
    tick(){for(const callback of [...timers.values()])callback();},
    statusClick(){if(controller.state.paused)controller.resume();else controller.pause();},
    click(action,id){handlers.click({target:{closest:selector=>selector==='[data-queue-action]'?{dataset:{queueAction:action,queueId:String(id)}}:null}});},
  };
}

test('queue accepts only meaningful messages and preserves the full draft payload when taken',()=>{
  const model=createModel();
  assert.equal(model.enqueue({text:'  '}),false);
  const attachments=[{node:{name:'记录.xlsx'}}],references=[{fileName:'复盘.pptx',label:'第 3 页'}];
  const skills=['data-analysis'];
  assert.equal(model.enqueue({text:'只看华东 skill:data-analysis',rawText:'只看华东',skills,attachments,references}),true);
  skills.length=0;
  attachments.length=0;references.length=0;
  const id=model.state.prompts[0].id;
  const message=model.take(id);
  assert.equal(message.rawText,'只看华东');assert.deepEqual(message.skills,['data-analysis']);assert.equal(message.attachments[0].node.name,'记录.xlsx');
  assert.equal(message.references[0].label,'第 3 页');assert.equal(model.state.prompts.length,0);
  assert.equal(model.take(id),null);model.finish();assert.equal(model.enqueue({text:'新的补充'}),false);
});

test('queued messages can be reordered without changing their IDs or attachments',()=>{
  const model=createModel(),attachment={node:{name:'经营数据.xlsx'}};
  model.enqueue({text:'第一条'});
  model.enqueue({text:'第二条',attachments:[attachment]});
  model.enqueue({text:'第三条'});
  assert.equal(model.move(3,1),true);
  assert.deepEqual(model.state.prompts.map(item=>item.id),[3,1,2]);
  assert.equal(model.move(1,2,true),true);
  assert.deepEqual(model.state.prompts.map(item=>item.id),[3,2,1]);
  assert.equal(model.state.prompts[1].attachments[0],attachment);
  assert.equal(model.move(9,1),false);
});

test('global pause freezes output; continuing preserves it and starts a fresh thinking round',()=>{
  const h=harness();h.controller.activate(true);h.setClock(3000);h.tick();
  const before=h.body.textContent,stale=[...h.timers.values()][0];
  assert.ok(!h.controller.initial().includes('data-queue-control'));
  h.statusClick();assert.equal(h.controller.state.paused,true);assert.equal(h.controller.state.running,true);
  assert.equal(h.label.textContent,'已暂停');assert.equal(h.time.textContent,'2秒');assert.ok(h.classes.has('is-paused'));
  assert.equal(h.timers.size,0);
  h.setClock(25000);stale();h.tick();assert.equal(h.body.textContent,before);assert.equal(h.time.textContent,'2秒');
  assert.equal(h.controller.enqueue({text:'暂停时不进队列'}),false);
  h.statusClick();assert.equal(h.controller.state.paused,false);assert.equal(h.label.textContent,'思考中');assert.equal(h.time.textContent,'0秒');
  assert.equal(h.views.length,2);assert.equal(h.views[0].body.textContent,before);assert.equal(h.views[0].label.textContent,'已暂停');assert.equal(h.body.textContent,'');assert.ok(!h.classes.has('is-paused'));
  assert.match(h.controller.initial(),/data-queue-agent-thinking/);
  h.setClock(27200);h.tick();assert.equal(h.time.textContent,'2秒');assert.equal(h.label.textContent,'生成中');assert.ok(h.body.textContent.length>0);
  assert.equal(h.resumed.length,1);assert.equal(h.resumed[0],null);
});

test('sending while paused starts a new thinking round while retaining previous output and queued messages',()=>{
  const h=harness();h.controller.activate(true);h.controller.enqueue({text:'之后再处理的要求'});h.setClock(3000);h.tick();
  const previous=h.views[0],before=h.body.textContent;h.statusClick();h.setClock(25000);
  const message={text:'只看华东',rawText:'只看华东',attachments:[{node:{name:'记录.xlsx'}}],references:[{id:'r1'}]};
  assert.equal(h.controller.resume(message),true);assert.equal(h.resumed[0],message);assert.equal(h.sent.length,0);
  assert.equal(h.views.length,2);assert.equal(previous.body.textContent,before);assert.equal(previous.label.textContent,'已调整');
  assert.equal(h.body.textContent,'');assert.equal(h.label.textContent,'思考中');assert.equal(h.time.textContent,'0秒');assert.equal(h.controller.state.paused,false);
  assert.equal(h.controller.state.prompts.length,1);assert.equal(h.controller.state.prompts[0].text,'之后再处理的要求');
  h.setClock(34000);h.tick();assert.match(h.body.textContent,/只看华东/);assert.equal(h.time.textContent,'9秒');assert.equal(previous.body.textContent,before);
  h.setClock(100000);h.tick();assert.equal(h.label.textContent,'已完成');
  assert.equal(h.controller.pause(),false);assert.equal(h.controller.resume(message),false);
});

test('a paused task stays paused across navigation and replay restores the original run',()=>{
  const h=harness();h.controller.activate(true);h.setClock(3000);h.tick();h.statusClick();
  const before=h.body.textContent;h.controller.activate(false);h.setClock(25000);h.controller.activate(true);
  assert.equal(h.controller.state.paused,true);assert.equal(h.body.textContent,before);assert.equal(h.time.textContent,'2秒');assert.equal(h.timers.size,0);
  h.controller.reset();h.controller.activate(true);assert.equal(h.controller.state.paused,false);assert.equal(h.time.textContent,'0秒');assert.equal(h.timers.size,1);
});

test('enqueuing does not send a turn or interrupt ongoing output',()=>{
  const h=harness();h.controller.activate(true);
  const before=h.body.textContent;
  assert.equal(h.controller.enqueue({text:draft}),true);
  assert.equal(h.container.hidden,false);assert.match(h.container.innerHTML,/data-queue-row="1"/);
  assert.ok(!h.container.innerHTML.includes('data-queue-toggle'));assert.ok(!h.container.innerHTML.includes('条待发送'));
  assert.equal(h.sent.length,0);assert.equal(h.controller.state.running,true);
  h.setClock(3000);h.tick();
  assert.ok(h.body.textContent.length>before.length);assert.equal(h.controller.state.prompts.length,1);
  assert.equal(h.label.textContent,'生成中');assert.equal(h.time.textContent,'2秒');
});

test('queued text stays escaped in the row and returns as plain text to the composer',()=>{
  const h=harness();h.controller.activate(true);h.controller.enqueue({text:'<img src=x onerror="alert(1)">'});
  assert.ok(!h.container.innerHTML.includes('<img src=x'));assert.match(h.container.innerHTML,/&lt;img/);
  h.click('edit',1);assert.equal(h.edited[0].text,'<img src=x onerror="alert(1)">');
  assert.ok(!h.container.innerHTML.includes('data-queue-input'));assert.equal(h.controller.state.prompts.length,0);
});

test('editing, removing and sending target stable message IDs and preserve other queued messages',()=>{
  const h=harness();h.controller.activate(true);h.controller.enqueue({text:'第一条'});h.controller.enqueue({text:'第二条'});
  h.click('edit',2);
  assert.equal(h.edited[0].text,'第二条');assert.equal(h.controller.state.prompts.length,1);
  h.controller.enqueue({text:'改后的第二条'});
  h.click('remove',1);assert.equal(h.sent.length,0);assert.equal(h.controller.state.running,true);
  h.click('send',3);assert.equal(h.resumed.length,1);assert.equal(h.resumed[0].text,'改后的第二条');
  assert.equal(h.controller.state.running,true);assert.equal(h.timers.size,1);assert.equal(h.controller.state.prompts.length,0);
});

test('guiding sends only the chosen queued message, preserves partial output and rethinks without finishing the old output',()=>{
  const h=harness();h.controller.activate(true);h.setClock(3000);h.tick();
  const partial=h.body.textContent,previous=h.views[0],stale=[...h.timers.values()][0];
  const attachment={node:{name:'补充.xlsx'}};
  h.controller.enqueue({text:'先看华东',attachments:[attachment]});h.controller.enqueue({text:'稍后补充其他区域'});
  assert.match(h.container.innerHTML,/data-queue-action="send"[^>]*aria-label="引导当前任务"/);h.click('send',1);
  assert.equal(h.resumed.length,1);assert.equal(h.resumed[0].text,'先看华东');assert.equal(h.resumed[0].attachments[0],attachment);
  assert.equal(previous.body.textContent,partial);assert.ok(partial.length<output.length);assert.equal(previous.label.textContent,'已调整');
  assert.equal(h.label.textContent,'思考中');assert.equal(h.time.textContent,'0秒');assert.equal(h.controller.state.prompts[0].text,'稍后补充其他区域');
  stale();assert.equal(h.body.textContent,'');
  h.setClock(100000);h.tick();assert.equal(h.controller.state.running,false);
  h.click('send',2);assert.equal(h.label.textContent,'思考中');assert.equal(h.time.textContent,'0秒');assert.equal(h.resumed.length,2);assert.equal(h.controller.state.prompts.length,0);
});

test('editing neither sends a turn nor stops output, and a refused restore leaves the queued message intact',()=>{
  const h=harness({onEdit:()=>false});h.controller.activate(true);h.controller.enqueue({text:draft});
  h.click('edit',1);assert.equal(h.controller.state.prompts.length,1);assert.equal(h.controller.state.running,true);assert.equal(h.sent.length,0);
  h.controller.activate(false);h.click('remove',1);assert.equal(h.controller.state.prompts.length,1,'stale controls cannot change another task');
});

test('restoring a queued message fills and focuses the real composer while preserving its existing draft and materials',()=>{
  const source=fs.readFileSync('app.js','utf8');
  const restore=source.slice(source.indexOf('  function restoreQueuedMessage('),source.indexOf('  const queueDemo = window.CatPawQueueDemo.createController('));
  const task={},node={name:'数据.xlsx'},files=[{node}],references=[{id:'r1',fileName:'复盘.pptx',label:'第 3 页'}],restored=[],skills=[];
  let focused=false,selection,rendered=0,resized=0;
  const input={value:'原先正在写的补充',focus(){focused=true;},setSelectionRange(start,end){selection=[start,end];}};
  const ctx={activeConversationTask:task,interventionTask:task,conversationPage:{hidden:false},conversationPrompt:input,
    selectedLibraryFiles:new Map([[input,files]]),renderLibraryFileCards(){rendered++;},addSkillTag(input,skill){skills.push(skill);},
    artifactSelection:{restoreDraft:refs=>restored.push(...refs)},resizeConversationPrompt(){resized++;},conversationComposerDrafts:new Map()};
  vm.createContext(ctx);vm.runInContext(restore,ctx);
  assert.equal(ctx.restoreQueuedMessage({text:'只看华东 skill:data-analysis',rawText:'只看华东',skills:['data-analysis'],attachments:[{node}],references}),true);
  assert.equal(input.value,'只看华东\n\n原先正在写的补充');assert.equal(files.length,1);assert.equal(restored[0],references[0]);assert.deepEqual(skills,['data-analysis']);
  assert.equal(focused,true);assert.deepEqual(selection,[0,4]);assert.equal(rendered,1);assert.equal(resized,1);assert.equal(ctx.conversationComposerDrafts.get(task),input.value);
  ctx.activeConversationTask={};assert.equal(ctx.restoreQueuedMessage({text:'另一个任务'}),false);assert.equal(input.value,'只看华东\n\n原先正在写的补充');
});

test('switching tasks hides the queue, preserves its messages and invalidates stale stream callbacks',()=>{
  const h=harness();h.controller.activate(true);h.controller.enqueue({text:draft});
  const stale=[...h.timers.values()][0];h.controller.activate(false);
  const before=h.body.textContent;h.setClock(3000);stale();
  assert.equal(h.body.textContent,before);assert.equal(h.container.hidden,true);assert.equal(h.timers.size,0);
  h.controller.activate(true);assert.equal(h.container.hidden,false);assert.equal(h.controller.state.prompts[0].text,draft);
  assert.equal(h.time.textContent,'2秒');
});

test('natural completion keeps pending messages and freezes elapsed time; replay clears the previous run',()=>{
  const h=harness();h.controller.activate(true);h.controller.enqueue({text:draft});
  h.setClock(65000);h.tick();
  assert.equal(h.controller.state.running,false);assert.equal(h.body.textContent,output);
  assert.equal(h.controller.state.prompts.length,1);assert.equal(h.sent.length,0);assert.equal(h.timers.size,0);
  const elapsed=h.time.textContent;h.setClock(100000);h.controller.activate(true);assert.equal(h.time.textContent,elapsed);
  h.controller.reset();assert.equal(h.container.hidden,true);assert.equal(h.controller.state.prompts.length,0);
  h.controller.activate(true);assert.equal(h.time.textContent,'0秒');assert.equal(h.controller.state.running,true);
});

test('the real conversation send handler enqueues the draft, clears the composer and leaves the thread unchanged',()=>{
  const source=fs.readFileSync('app.js','utf8');
  const handler=source.slice(source.indexOf('  function sendConversationMessage()'),source.indexOf('  conversationExamples.forEach((example, task)'));
  const h=harness();h.controller.activate(true);
  const task={},input={value:draft};let resized=0,cleared=0;
  const ctx={conversationPrompt:input,selectedLibraryFiles:new Map([[input,[]]]),selectedSkills:new Map([[input,[]]]),selectedConnectors:new Map([[input,new Set()]]),
    conversationGoalTag:{hidden:true},artifactSelection:{entries:()=>[],clear:()=>cleared++},
    activeConversationTask:task,interventionTask:task,conversationTask:{},queueDemo:h.controller,showConversationFeedback(){},
    clearSkillTags(){},clearLibraryFileCards(){},resizeConversationPrompt(){resized++;},
    beginConversationTurn(){throw Error('enqueued messages must not become sent turns');}};
  vm.createContext(ctx);vm.runInContext(handler,ctx);ctx.sendConversationMessage();
  assert.equal(h.controller.state.prompts[0].text,draft);assert.equal(input.value,'');assert.equal(cleared,1);assert.equal(resized,1);
});

test('the real send handler sends a paused update directly, preserving other queued messages and payloads',()=>{
  const source=fs.readFileSync('app.js','utf8');
  const handler=source.slice(source.indexOf('  function sendConversationMessage()'),source.indexOf('  conversationExamples.forEach((example, task)'));
  const h=harness();h.controller.activate(true);h.controller.enqueue({text:'稍后再补充'});h.statusClick();
  const task={},input={value:'先只看华东'},file={node:{name:'经营数据.xlsx'}},ref={id:'r1'},feedback=[];
  const ctx={conversationPrompt:input,selectedLibraryFiles:new Map([[input,[file]]]),selectedSkills:new Map([[input,['data-analysis']]]),selectedConnectors:new Map([[input,new Set(['文件系统连接器'])]]),
    conversationGoalTag:{hidden:true},artifactSelection:{entries:()=>[ref],clear(){}},activeConversationTask:task,interventionTask:task,conversationTask:{},
    queueDemo:h.controller,showConversationFeedback:value=>feedback.push(value),clearSkillTags(){},clearLibraryFileCards(){},resizeConversationPrompt(){},
    beginConversationTurn(){throw Error('the revised task must resume rather than use the generic prototype receipt');}};
  vm.createContext(ctx);vm.runInContext(handler,ctx);ctx.sendConversationMessage();
  assert.equal(h.resumed.length,1);assert.equal(h.resumed[0].rawText,'先只看华东');assert.equal(h.resumed[0].attachments[0],file);
  assert.equal(h.resumed[0].references[0],ref);assert.equal(h.resumed[0].skills[0],'data-analysis');
  assert.equal(h.resumed[0].connectors[0],'文件系统连接器');
  assert.ok(ctx.selectedConnectors.get(input).has('文件系统连接器'));
  assert.equal(h.controller.state.prompts.length,1);assert.equal(h.controller.state.prompts[0].text,'稍后再补充');
  assert.equal(input.value,'');assert.deepEqual(feedback,['已按补充要求继续']);
  input.value='继续检查';ctx.sendConversationMessage();
  assert.ok(ctx.selectedConnectors.get(input).has('文件系统连接器'));
  assert.equal(h.controller.state.prompts.at(-1).connectors[0],'文件系统连接器');

});

test('composer switches between sending, pause and continue for both streaming tasks',()=>{
  const source=fs.readFileSync('app.js','utf8');
  const preview=fs.readFileSync('icon-preview.html','utf8');
  const pauseIcon=preview.match(/\['暂停', 'pause', '([^']+)'/)[1],playIcon=preview.match(/\['开始', 'play', '([^']+)'/)[1],sendIcon=preview.match(/\['发送', 'send', '([^']+)'/)[1];
  const sync=source.slice(source.indexOf('  function syncInterventionComposer('),source.indexOf("  window.addEventListener('pagehide',()=>queueDemo.stop());"));
  const task={},firstTask={},classes=new Set(),caption={hidden:true},input={value:'补充要求'},icon={},calls=[];
  const panel={dataset:{stageFrame:'1'}};
  const button={title:'发送',dataset:{},setAttribute(name,value){this[name]=value;},classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name)},querySelector:()=>icon};
  const ctx={activeConversationTask:task,interventionTask:task,conversationPage:{hidden:false},conversationGoalTag:{hidden:true},
    conversationTask:firstTask,conversationThread:{querySelector:()=>panel},conversationStageFrames:[{stage:'plan'},{stage:'work'},{stage:'done'}],
    conversationPrompt:input,selectedLibraryFiles:new Map([[input,[]]]),selectedSkills:new Map([[input,[]]]),artifactSelection:{entries:()=>[]},
    queueDemo:{state:{running:true,paused:false},pause(){calls.push('pause');this.state.paused=true;ctx.syncInterventionComposer();},resume(){calls.push('continue');this.state.paused=false;ctx.syncInterventionComposer();}},
    conversationSend:button,document:{getElementById:()=>caption},sendConversationMessage:()=>calls.push('send'),
    setConversationStagePaused(stage,paused){calls.push(['first-task',paused]);if(paused)stage.dataset.pausedAt='1000';else delete stage.dataset.pausedAt;ctx.syncInterventionComposer();},
    resumeConversationStageWithMessage(){calls.push(['first-task',false]);delete panel.dataset.pausedAt;ctx.syncInterventionComposer();}};
  vm.createContext(ctx);vm.runInContext(sync,ctx);ctx.syncInterventionComposer();assert.equal(button.title,'加入队列');assert.equal(caption.hidden,true);
  input.value='';ctx.syncInterventionComposer();assert.equal(button.dataset.executionAction,'pause');assert.equal(button.disabled,false);assert.ok(classes.has('is-pause'));assert.equal(icon.innerHTML,pauseIcon);
  ctx.handleConversationComposerAction();assert.equal(calls.at(-1),'pause');assert.equal(button.dataset.executionAction,'continue');assert.equal(button.disabled,false);assert.equal(icon.innerHTML,playIcon);
  ctx.handleConversationComposerAction();assert.equal(calls.at(-1),'continue');assert.equal(button.dataset.executionAction,'pause');
  ctx.handleConversationComposerAction();input.value='修改要求';ctx.syncInterventionComposer();assert.equal(button.dataset.executionAction,'resume');assert.equal(button['aria-label'],'发送');assert.equal(caption.hidden,true);assert.ok(!classes.has('is-resume'));assert.ok(!classes.has('is-pause'));assert.equal(icon.innerHTML,sendIcon);
  ctx.handleConversationComposerAction();assert.equal(calls.at(-1),'send');
  ctx.activeConversationTask=firstTask;input.value='';ctx.syncInterventionComposer();assert.equal(button.dataset.executionAction,'pause');
  ctx.handleConversationComposerAction();assert.deepEqual(calls.at(-1),['first-task',true]);assert.equal(button.dataset.executionAction,'continue');
  input.value='按补充内容继续';ctx.syncInterventionComposer();assert.equal(button.dataset.executionAction,'resume');assert.equal(button['aria-label'],'发送');assert.ok(!classes.has('is-resume'));assert.ok(!classes.has('is-pause'));assert.equal(icon.innerHTML,sendIcon);
  input.value='';ctx.syncInterventionComposer();
  ctx.handleConversationComposerAction();assert.deepEqual(calls.at(-1),['first-task',false]);assert.equal(button.dataset.executionAction,'pause');
  ctx.selectedLibraryFiles.set(input,[{node:{name:'补充.xlsx'}}]);ctx.syncInterventionComposer();assert.equal(button.dataset.executionAction,'send','an attachment still enables sending');assert.equal(button.disabled,false);
  ctx.selectedLibraryFiles.set(input,[]);panel.dataset.stageFrame='2';ctx.syncInterventionComposer();assert.equal(button.dataset.executionAction,'send');assert.equal(button.disabled,true);
  ctx.activeConversationTask={};ctx.syncInterventionComposer();assert.equal(button.title,'发送');assert.equal(caption.hidden,true);assert.ok(!classes.has('is-resume'));assert.ok(!classes.has('is-pause'));
});

test('continuation renders fresh assistant state without inventing a user message; explicit updates remain visible',()=>{
  const source=fs.readFileSync('app.js','utf8'),start=source.indexOf('    onResume:message=>{');
  const callback=source.slice(start,source.indexOf('    onEdit:restoreQueuedMessage',start)).trim().replace(/^onResume:/,'').replace(/,$/,'');
  const rendered=[],messages=[];
  const onResume=vm.runInNewContext(`(${callback})`,{
    conversationThread:{insertAdjacentHTML:(position,html)=>rendered.push(html)},queueDemo:{initial:()=>'<section>思考中 0秒</section>'},
    renderConversationTurnTime:()=>'<time>本轮</time>',renderUserMessage:(...args)=>{messages.push(args);return '<div class="user-message">补充要求</div>';},
    moveConversationProgressToLatestTurn(){},renderConversationTurnNav(){},requestAnimationFrame:callback=>callback(),conversationScroll:{scrollHeight:400,scrollTop:0},
  });
  onResume(null);assert.equal(messages.length,0);assert.doesNotMatch(rendered[0],/user-message|<time>/);assert.match(rendered[0],/assistant-message.*思考中 0秒/);
  const message={text:'只看华东',attachments:[{node:{name:'补充.xlsx'}}],references:[{id:'r1'}]};
  onResume(message);assert.equal(messages.length,1);assert.equal(messages[0][0],message.text);assert.equal(messages[0][1],message.attachments);assert.equal(messages[0][4],message.references);
  assert.match(rendered[1],/user-message/);assert.match(rendered[1],/<time>/);
});

for(const scene of ['2.2','2.2-2'])test(`slide ${scene} preserves paused output and starts a new round without enqueuing`,async()=>{
  const source=fs.readFileSync('app.js','utf8');
  const cases=source.slice(source.indexOf("        case 'intervention-stream':"),source.indexOf("        case 'development':"));
  const h=harness(),task={},input={value:draft,focus(){},getBoundingClientRect:()=>({left:10,top:20})};
  const cursorClasses=new Set(),cursor={hidden:true,style:{setProperty(){}},classList:{add:name=>cursorClasses.add(name),remove:name=>cursorClasses.delete(name)}};
  const clicks=[],timers=new Map();let serial=0,clock=1000;
  const ctx={conversationPrompt:input,interventionTask:task,greetingDemoCursor:cursor,ensureStrategyDemoCursor:()=>cursor,
    setConversationOpen(open,selected){assert.equal(selected,task);h.controller.activate(open);},resizeConversationPrompt(){},
    window:{CatPawQueueDemo:{draft}},conversationSend:{getBoundingClientRect:()=>({left:100,top:200,width:30,height:30}),click(){
      if(h.controller.state.paused){const message=input.value?{text:input.value,rawText:input.value,attachments:[],references:[]}:null;clicks.push(message?'send-and-resume':'continue');h.controller.resume(message);input.value='';}
      else{clicks.push('pause');assert.equal(input.value,'');h.controller.pause();}
    }}};
  const present=vm.runInNewContext(`(step)=>{switch(step.action){${cases}}}`,ctx);
  const player=createPlayer({scene,reset(){h.controller.reset();},present,ready(){},stop(){h.controller.stop();},
    setTimer:(callback,duration)=>{timers.set(++serial,{callback,duration});return serial;},clearTimer:id=>timers.delete(id)});
  await player.activate();assert.equal(input.value,'');
  while(timers.size){
    const [id,timer]=timers.entries().next().value;timers.delete(id);
    const paused=h.controller.state.paused,before=h.body.textContent;
    clock+=timer.duration;h.setClock(clock);h.tick();
    if(paused){assert.equal(h.body.textContent,before);assert.ok(h.classes.has('is-paused'));}
    await timer.callback();
    if(clicks.length===1){assert.equal(h.controller.state.paused,true);assert.ok(h.body.textContent.length>42);assert.ok(h.body.textContent.length<output.length);}
  }
  assert.deepEqual(clicks,['pause',scene==='2.2'?'continue':'send-and-resume']);assert.equal(h.resumed.length,1);
  if(scene==='2.2')assert.equal(h.resumed[0],null);else assert.equal(h.resumed[0].text,draft);
  assert.equal(h.controller.state.prompts.length,0);assert.equal(h.controller.state.paused,false);assert.equal(h.label.textContent,'思考中');assert.equal(h.time.textContent,'0秒');assert.equal(cursor.hidden,true);
  player.deactivate();assert.equal(h.timers.size,0);
});

test('slide 2.2-3 automatically clicks the real send button and cancels delayed clicks when leaving',async()=>{
  const timers=new Map(),steps=[];let serial=0;
  const player=createPlayer({scene:'2.2-3',reset(){},present:step=>steps.push(step.action),stop(){},ready(){},
    setTimer:callback=>{timers.set(++serial,callback);return serial;},clearTimer:id=>timers.delete(id)});
  await player.activate();assert.deepEqual(steps,['intervention-start']);
  let [id,callback]=timers.entries().next().value;timers.delete(id);await callback();
  assert.deepEqual(steps,['intervention-start','intervention-pointer']);
  const stale=[...timers.values()][0];player.deactivate();await stale();assert.equal(steps.length,2);
  await player.activate();while(timers.size){[id,callback]=timers.entries().next().value;timers.delete(id);await callback();}
  assert.equal(steps.at(-1),'intervention-guide');assert.ok(steps.includes('intervention-send'));
  assert.equal(scenes['2.2-3'].find(step=>step.action==='intervention-send').focus,'#conversationQueueGroup');
  const html=fs.readFileSync('index.html','utf8');
  assert.ok(html.indexOf('id="conversationQueueGroup"')<html.indexOf('id="conversationComposer"'));
  assert.ok(html.indexOf('conversation-queue-demo.js')<html.indexOf('src="./app.js"'));
});


test('presentation streaming is faster and remains pausable before the scripted pause',()=>{
 const fast=harness({characterInterval:80}),normal=harness();
 fast.controller.activate(true);normal.controller.activate(true);
 fast.setClock(5200);normal.setClock(5200);fast.tick();normal.tick();
 assert.ok(fast.body.textContent.length>normal.body.textContent.length);
 assert.equal(fast.controller.state.running,true);
 const before=fast.body.textContent;fast.controller.pause();fast.setClock(9000);fast.tick();
 assert.equal(fast.body.textContent,before);assert.equal(fast.controller.state.paused,true);
});
