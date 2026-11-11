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


for(const mode of ['exhausted'])test(`${mode}: manual retry appears only after automatic attempts finish`,()=>{
  const s=setup(mode);s.controller.activate(true);s.next();
  for(let attempt=1;attempt<=4;attempt++){
    assert.equal(s.controller.stage,'retrying');assert.match(s.html,new RegExp(`第 ${attempt} 次重试`));
    if(mode==='retry'){assert.match(s.html,/stage-tool-call/);assert.doesNotMatch(s.html,/recovery-retry-card|重试已暂停|data-recovery-action="cancel"/);}else assert.match(s.html,/recovery-retry-card/);assert.doesNotMatch(s.html,/data-recovery-action="retry"/);
    s.next();
  }
  assert.equal(s.controller.stage,'blocked');assert.equal(s.timers.size,0);
  assert.match(s.html,/data-recovery-action="retry"/);
  s.controller.act('retry');assert.equal(s.controller.stage,'retrying');assert.match(s.html,/第 1 次重试/);
  const stale=[...s.timers.values()][0];s.controller.activate(false);stale();assert.equal(s.controller.stage,'retrying');
});

test('capability failure waits for a choice and never claims the original output was generated',()=>{
  const s=setup('failure');s.controller.activate(true);s.next();
  assert.equal(s.controller.stage,'failed');assert.equal(s.timers.size,0);
  assert.match(s.html,/目前还不能直接生成视频/);
  assert.equal(s.controller.act('continue'),false);
  s.controller.act('fallback');assert.equal(s.controller.stage,'alternative');
  const stale=[...s.timers.values()][0];s.controller.activate(false);stale();
  assert.equal(s.controller.stage,'alternative');
  s.controller.activate(true);s.next();assert.equal(s.controller.stage,'done');
  assert.match(s.html,/视频文件尚未生成/);assert.match(s.html,/替代内容已整理/);
  s.controller.act('restart');assert.equal(s.controller.stage,'reading');
});

test('login recovery requires explicit handoff completion',()=>{
  const s=setup('auth');s.controller.activate(true);s.next();
  assert.equal(s.controller.stage,'blocked');assert.equal(s.timers.size,0);
  assert.equal(s.controller.act('confirm'),false);
  s.controller.act('login');assert.equal(s.timers.size,0);
  s.controller.act('confirm');s.next();assert.equal(s.controller.stage,'done');
});
test('unknown submission can only query and cannot resubmit',()=>{
  const s=setup('receipt');s.controller.activate(true);s.next();
  assert.equal(s.controller.stage,'unknown');assert.equal(s.timers.size,0);
  assert.equal(s.controller.act('retry'),false);
  s.controller.act('check');s.next();assert.equal(s.controller.stage,'done');
});
test('capability fallback can pause and choose narration only',()=>{
  const s=setup('failure');s.controller.activate(true);s.next();
  s.controller.act('pause');assert.equal(s.controller.stage,'paused');assert.equal(s.timers.size,0);
  s.controller.act('script');s.next();assert.equal(s.controller.stage,'done');
  assert.match(s.html,/经营复盘解说稿/);assert.doesNotMatch(s.html,/>画面</);
  assert.doesNotMatch(s.html,/data-recovery-action="restart"/);
});

for(const mode of ['exhausted'])test(`${mode}: stop cancels pending retries and restart begins a fresh attempt`,()=>{
  const s=setup(mode);s.controller.activate(true);s.next();
  assert.match(s.html,/data-recovery-action="cancel"/);
  assert.doesNotMatch(s.html,/间隔一会儿再试|不用从头开始/);
  const stale=[...s.timers.values()][0];
  s.controller.act('cancel');assert.equal(s.controller.stage,'paused');
  assert.equal(s.timers.size,0);stale();assert.equal(s.controller.stage,'paused');
  assert.match(s.html,/data-recovery-action="retry"/);
  s.controller.act('retry');assert.equal(s.controller.stage,'retrying');
  assert.match(s.html,/第 1 次重试/);assert.equal(s.timers.size,1);
});

test('supplier retry does not expose or accept pause',()=>{const s=setup('retry');s.controller.activate(true);s.next();assert.equal(s.controller.act('cancel'),false);assert.equal(s.controller.stage,'retrying');assert.doesNotMatch(s.html,/重试已暂停|停止重试/);});

test('supplier keeps retrying while showing delayed reassurance and manual retry',()=>{
  const s=setup('retry');s.controller.activate(true);s.next();
  for(let i=1;i<=4;i++){assert.equal(s.controller.stage,'retrying');assert.doesNotMatch(s.html,/recovery-retry-card/);s.next();}
  assert.equal(s.controller.stage,'retrying');assert.match(s.html,/stage-tool-call/);assert.match(s.html,/recovery-retry-card/);assert.equal(s.timers.size,1);
  assert.equal(s.controller.act('retry'),true);assert.match(s.html,/第 6 次重试/);assert.equal(s.timers.size,1);
  s.next();assert.equal(s.controller.stage,'retrying');assert.match(s.html,/第 7 次重试/);
});
