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
  assert.equal([...s.timers.values()][0].duration, 5000);
});

test('process plays the three phases and holds on the final result', async () => {
  const s = setup();
  await s.player.activate();
  while (s.timers.size) await s.next();
  assert.deepEqual(s.events.filter(item => item.action).map(item => item.frame), [0, 1, 3, 5, 7]);
  assert.equal(s.timers.size, 0);
});

test('the three comparison panels hold their own phase when activated or revisited', async () => {
  const panels = [0, 3, 7].map(frame => setup('2.1', undefined, frame));
  for (const [index, panel] of panels.entries()) {
    await panel.player.activate();
    assert.equal(panel.events.at(-1).frame, [0, 3, 7][index]);
    assert.equal(panel.timers.size, 0, 'comparison panels never advance to another phase');
    panel.player.deactivate();
    await panel.player.activate();
    assert.equal(panel.events.at(-1).frame, [0, 3, 7][index]);
  }
});

test('the process slide renders three distinct embedded phases on the same page', () => {
  const html = fs.readFileSync('design-strategy-slides.html', 'utf8');
  const source = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]).find(script => script.includes('const pointSlides'));
  const canvas = {innerHTML: ''};
  vm.runInNewContext(source.split('    const pages=')[0], {
    document: {getElementById: () => canvas}, CatPawStrategyScenes: {scenes},
  });
  const slide = canvas.innerHTML.match(/<section class="slide phase-demo-slide"[\s\S]*?<\/section>/)[0];
  assert.equal((slide.match(/<iframe /g) || []).length, 3);
  assert.deepEqual([...slide.matchAll(/data-frame="(\d+)"/g)].map(match => Number(match[1])), [0, 3, 7]);
  for (const label of ['工作前', '工作时', '工作结束']) assert.ok(slide.includes(label));
  assert.equal((canvas.innerHTML.match(/id="slide-2\.1"/g) || []).length, 1);
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
  const s = setup('1.2-3');
  await s.player.preview();
  assert.equal(s.events.find(item => item.action).action, 'case');
  assert.equal(s.events.at(-1), 'stop');
  assert.equal(s.ready, 1);
  assert.equal(s.timers.size, 0);
  await s.player.activate();
  await s.next();
  assert.equal(s.events.at(-1).action, 'reuse');
});

test('every scene points to a current design action and a real interaction handler', () => {
  const html = fs.readFileSync('design-strategy-slides.html', 'utf8');
  const source = fs.readFileSync('app.js', 'utf8');
  const points = vm.runInNewContext(html.match(/const pointSlides = (\[[\s\S]*?\n    \]);/)[1]);
  const ids = points.flatMap(point => point.actions.map((_, index) => index ? `${point.no}-${index + 1}` : point.no));
  for (const [id, steps] of Object.entries(scenes)) {
    assert.ok(ids.includes(id), id);
    for (const [index, step] of steps.entries()) {
      assert.ok(source.includes(`case '${step.action}':`), step.action);
      if (index < steps.length - 1) assert.ok(step.hold >= 3000);
    }
  }
  assert.equal(scenes['3.3'], undefined, 'unbuilt version UI keeps its placeholder');
  assert.equal(scenes['3.1-4'], undefined, 'desktop pet stays a concept diagram');
});
