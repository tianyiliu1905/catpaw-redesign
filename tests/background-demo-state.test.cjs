const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
function setup(){
 const context={backgroundDemoCompleted:new Map(),backgroundDemoFollowups:new Map(),renderConversationTurnTime:date=>`<time>${date.toISOString()}</time>`,renderUserMessage:prompt=>`<div class="user-message">${prompt}</div>`};
 vm.createContext(context);
 const start=source.indexOf('  function setBackgroundDemoState('),end=source.indexOf('  const backgroundQueueRemoved',start);
 vm.runInContext(source.slice(start,end),context);
 return context;
}
test('all five examples preserve the intervening conversation through completion and isolate their state',()=>{
 const ctx=setup(),tasks=['agent-floating','agent-inline','process-floating','process-inline','process-text'].map(id=>({id}));
 for(const task of tasks){
  ctx.setBackgroundDemoState(task,'replied');
  const sentAt=ctx.backgroundDemoFollowups.get(task);
  assert.ok(sentAt);assert.equal(ctx.backgroundDemoCompleted.has(task),false);
  ctx.setBackgroundDemoState(task,'complete');
  assert.equal(ctx.backgroundDemoFollowups.get(task),sentAt);assert.ok(ctx.backgroundDemoCompleted.get(task)>=sentAt);
  ctx.setBackgroundDemoState(task,'replied');
  assert.equal(ctx.backgroundDemoCompleted.has(task),false);assert.equal(ctx.backgroundDemoFollowups.get(task),sentAt);
 }
 ctx.setBackgroundDemoState(tasks[0],'running');
 assert.equal(ctx.backgroundDemoFollowups.has(tasks[0]),false);assert.equal(ctx.backgroundDemoFollowups.size,4);
});
test('direct completion includes the user turn; historical replies omit the global state',()=>{
 const ctx=setup();
 for(const process of [false,true]){
  const task={};ctx.setBackgroundDemoState(task,'complete');
  const sentAt=ctx.backgroundDemoFollowups.get(task);
  const running=ctx.renderBackgroundFollowup(process,sentAt,false),completed=ctx.renderBackgroundFollowup(process,sentAt,true);
  assert.match(running,/user-message/);assert.match(completed,/user-message/);
  assert.match(running,/stage-thinking/);assert.doesNotMatch(completed,/stage-thinking/);
  assert.match(completed,/可以，下面这段可以直接使用/);
  assert.match(completed,process?/区域负责人/:/各位店长/);
 }
});
