const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
function setup(){
 const context={backgroundDemoCompleted:new Map(),backgroundDemoFollowups:new Map(),backgroundDemoTerminated:new Map(),renderConversationTurnTime:date=>`<time>${date.toISOString()}</time>`,renderUserMessage:prompt=>`<div class="user-message">${prompt}</div>`};
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

test('terminating one process leaves other tasks and processes running',()=>{
 const ctx=setup(),task={},other={};
 assert.equal(ctx.terminateBackgroundDemoProcess(task,'导出明细'),true);
 assert.equal(ctx.terminateBackgroundDemoProcess(task,'导出明细'),false);
 assert.equal(ctx.backgroundDemoTerminated.get(task).has('导出明细'),true);
 assert.equal(ctx.backgroundDemoTerminated.get(task).has('汇总指标'),false);
 assert.equal(ctx.backgroundDemoTerminated.has(other),false);
 ctx.setBackgroundDemoState(task,'replied');assert.ok(ctx.backgroundDemoTerminated.get(task).has('导出明细'));
 ctx.setBackgroundDemoState(task,'running');assert.equal(ctx.backgroundDemoTerminated.has(task),false);
 ctx.setBackgroundDemoState(task,'complete');assert.equal(ctx.terminateBackgroundDemoProcess(task,'导出明细'),false);
});

test('summary process stop is separate from navigation and no runtime status is rendered',()=>{
 const nodes=[];
 function node(){return {dataset:{},children:[],events:{},append(child){this.children.push(child)},setAttribute(){},addEventListener(type,fn){this.events[type]=fn}};}
 const list=node();list.querySelectorAll=()=>[];
 let opened=0,terminated=0;
 const process={dataset:{backgroundTitle:'导出明细',agentStatus:'执行中'},click(){opened++},dispatchEvent(event){assert.equal(event.type,'background-terminate');terminated++}};
 const ctx={document:{createElement:()=>{const n=node();nodes.push(n);return n}},backgroundProcesses:[process],processList:list,esc:String,setSummaryOpen(){},Event};
 vm.createContext(ctx);
 const start=source.indexOf(' for (const backgroundProcess of backgroundProcesses) {');
 vm.runInContext(source.slice(start,source.indexOf('\n} else if (!processSection.hidden)',start)),ctx);
 const [open,stop]=list.children[0].children;
 assert.match(stop.innerHTML,/process-stop-figma.svg/);assert.match(stop.innerHTML,/终止/);
 assert.doesNotMatch(open.innerHTML,/summary-agent-status|运行中/);
 stop.events.click();assert.equal(terminated,1);assert.equal(opened,0);
 open.events.click();assert.equal(opened,1);
});

test('multi-task disclosure opens only on click and supports toggle, outside close and Escape',()=>{
 const ctx=setup(),events={},attrs={'aria-expanded':'false'},classes=new Set();let focused=0,prevented=0;
 const aggregate={addEventListener:(name,handler)=>events['button:'+name]=handler,setAttribute:(name,value)=>attrs[name]=value,getAttribute:name=>attrs[name],focus(){focused++}};
 const popup={inert:true,querySelector:()=>({focus(){focused++}})};
 const disclosure={classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name)},addEventListener:(name,handler)=>events[name]=handler,contains:target=>target===aggregate||target===popup};
 ctx.wireBackgroundDisclosure(disclosure,aggregate,popup);
 assert.equal(events.pointerenter,undefined);assert.equal(events.focusin,undefined);assert.equal(events.pointerleave,undefined);
 events['button:click']();assert.equal(attrs['aria-expanded'],'true');assert.equal(popup.inert,false);assert.ok(classes.has('is-open'));
 events['button:click']();assert.equal(attrs['aria-expanded'],'false');assert.equal(popup.inert,true);
 events['button:click']();events['background-close']();assert.equal(attrs['aria-expanded'],'false');
 events['button:click']();events.keydown({key:'Escape',preventDefault(){prevented++},stopPropagation(){}});
 assert.equal(attrs['aria-expanded'],'false');assert.equal(prevented,1);assert.ok(focused>0);
});
