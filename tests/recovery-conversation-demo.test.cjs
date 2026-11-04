const test=require('node:test');
const assert=require('node:assert/strict');
const {createModel,createController}=require('../recovery-conversation-demo.js');

test('missing material requires selection and explicit confirmation before resuming',()=>{
  const model=createModel();
  assert.equal(model.act('continue'),false);
  model.act('finish');
  assert.equal(model.stage,'blocked');
  assert.equal(model.act('continue'),false);
  model.act('choose');model.act('select');
  assert.equal(model.stage,'selected');
  model.act('continue');
  assert.equal(model.stage,'resuming');
  model.act('finish');
  assert.equal(model.stage,'done');
  assert.equal(model.act('continue'),false);
  model.act('restart');
  assert.equal(model.stage,'reading');
});

test('cancel and replace never silently advance execution',()=>{
  const model=createModel();model.act('finish');model.act('choose');model.act('cancel');
  assert.equal(model.stage,'blocked');
  model.act('choose');model.act('select');model.act('replace');
  assert.equal(model.stage,'choosing');
  assert.equal(model.act('continue'),false);
});

function setup(mode='supplement'){
  const timers=new Map();let id=0,html='';
  const panel={set outerHTML(value){html=value;}};
  const controller=createController({mode,thread:{querySelector:()=>panel,addEventListener(){}},setTimer:fn=>{timers.set(++id,fn);return id;},clearTimer:id=>timers.delete(id)});
  return {controller,timers,get html(){return html;},next(){const [id,fn]=timers.entries().next().value;timers.delete(id);fn();}};
}

test('switching tasks cancels timers and preserves the recovery stage',()=>{
  const s=setup();s.controller.activate(true);
  const stale=[...s.timers.values()][0];
  s.controller.activate(false);stale();
  assert.equal(s.controller.stage,'reading');assert.equal(s.timers.size,0);
  s.controller.activate(true);s.next();
  assert.equal(s.controller.stage,'blocked');assert.equal(s.timers.size,0);
  s.controller.act('choose');s.controller.act('select');
  s.controller.activate(false);s.controller.activate(true);
  assert.equal(s.controller.stage,'selected');
  assert.match(s.html,/资料库示例/);
  assert.match(s.html,/费用明细与渠道分类已保留/);
  s.controller.act('continue');s.next();
  assert.equal(s.controller.stage,'done');assert.match(s.html,/11,200/);
  assert.match(s.html,/示例数据/);
});

test('inactive controllers ignore clicks and reset cannot be completed by an old timer',()=>{
  const s=setup();assert.equal(s.controller.act('finish'),false);
  s.controller.activate(true);const stale=[...s.timers.values()][0];
  s.controller.reset();stale();assert.equal(s.controller.stage,'reading');
});


test('temporary failure reports retrying, supports stopping, and resumes only incomplete work',()=>{
  const s=setup('retry');s.controller.activate(true);s.next();
  assert.equal(s.controller.stage,'retrying');assert.match(s.html,/第 2 次/);
  const stale=[...s.timers.values()][0];
  s.controller.act('cancel');stale();
  assert.equal(s.controller.stage,'paused');assert.equal(s.timers.size,0);
  assert.match(s.html,/交付记录尚未读取/);
  s.controller.act('retry');s.next();assert.equal(s.controller.stage,'verifying');
  assert.match(s.html,/连接已恢复/);s.next();
  assert.equal(s.controller.stage,'done');assert.match(s.html,/示例内容/);
  assert.equal(s.timers.size,0);
});

test('capability failure waits for a choice and never claims the original output was generated',()=>{
  const s=setup('failure');s.controller.activate(true);s.next();
  assert.equal(s.controller.stage,'failed');assert.equal(s.timers.size,0);
  assert.match(s.html,/无法直接交付视频文件/);
  assert.equal(s.controller.act('continue'),false);
  s.controller.act('fallback');assert.equal(s.controller.stage,'alternative');
  const stale=[...s.timers.values()][0];s.controller.activate(false);stale();
  assert.equal(s.controller.stage,'alternative');
  s.controller.activate(true);s.next();assert.equal(s.controller.stage,'done');
  assert.match(s.html,/视频文件尚未生成/);assert.match(s.html,/替代内容已整理/);
  s.controller.act('restart');assert.equal(s.controller.stage,'reading');
});
