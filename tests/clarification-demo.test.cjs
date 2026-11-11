const test=require('node:test');
const assert=require('node:assert/strict');
const {createModel,createController}=require('../clarification-demo.js');
const {scenes}=require('../strategy-scenes.js');

test('required direction, optional details and range, explicit confirmation',()=>{
 const m=createModel();assert.equal(m.act('next'),false);assert.equal(m.act('skip'),false);
 m.act('pick-1');m.act('next');m.type('暂不含海鲜');m.act('next');
 m.type('200','min');m.type('100','max');assert.equal(m.canNext,false);assert.match(m.error,/下限/);
 m.type('300','max');assert.equal(m.canNext,true);m.act('next');assert.equal(m.phase,'asking');
 m.act('edit-1');assert.equal(m.custom,'暂不含海鲜');m.type('周末可用，暂不含海鲜');m.act('next');assert.equal(m.range.max,'300');m.act('next');
 assert.equal(m.act('next'),false);m.act('confirm');assert.equal(m.phase,'done');assert.equal(m.answers[1],'周末可用，暂不含海鲜');
});
test('empty, negative, nonfinite and reversed budgets cannot continue; skips remain unknown',()=>{
 const m=createModel();m.act('pick-0');m.act('next');m.act('skip');
 for(const [min,max] of [['','200'],['-1','200'],['2','Infinity'],['200','100'],['1','10001']]){m.type(min,'min');m.type(max,'max');assert.equal(m.act('next'),false);}
 m.act('skip');assert.deepEqual(m.answers,['吸引新客到店',null,null]);m.act('confirm');assert.equal(m.phase,'done');
});
test('slide exercises all four input modes with cursor preceding each fill',()=>{
 const m=createModel();let previous;
 for(const step of scenes['2.3']){
  if(step.action==='recovery-act')assert.equal(m.act(step.target),true,step.target);
  if(step.action==='recovery-fill'){assert.equal(previous.action,'recovery-pointer');assert.equal(previous.field,step.field);assert.equal(m.type(step.value,step.field),true);}
  previous=step;
 }
 assert.equal(m.phase,'done');assert.deepEqual(m.answers,['提升客单价与连带销售','主推招牌烤鸡，搭配两份小食和两杯饮品；周末可用，暂不含海鲜。','128–168 元／套']);
});
function fixture(){let html='',inputListener;const classes=new Set();const buttons=[{disabled:true},{disabled:true}];const host={hidden:true,innerHTML:'',addEventListener(type,fn){if(type==='input')inputListener=fn;},querySelectorAll:sel=>sel.includes('next')?buttons:[],querySelector:()=>null};const c=createController({intro:false,host,thread:{addEventListener(){},querySelector:()=>({set outerHTML(v){html=v;}})},composer:{closest:()=>({classList:{toggle(n,on){if(on)classes.add(n);else classes.delete(n);}}})}});return {c,host,classes,buttons,get html(){return html;},input(value){inputListener({target:{dataset:{clarifyField:'text'},value}});}};}
test('card activation and close preserve answers; only confirmation restores composer with final summary',()=>{
 const f=fixture();f.c.activate(true);assert.equal(f.host.hidden,false);assert.ok(f.classes.has('has-clarification'));
 f.c.act('pick-2');f.c.activate(false);assert.equal(f.host.hidden,true);assert.equal(f.classes.size,0);f.c.activate(true);assert.match(f.host.innerHTML,/aria-pressed="true"/);
 f.c.act('close');assert.match(f.html,/继续补充要求/);f.c.act('reopen');f.c.act('next');f.c.act('skip');f.c.act('skip');
 assert.equal(f.host.hidden,false);assert.match(f.host.innerHTML,/确认并继续/);f.c.act('confirm');assert.equal(f.host.hidden,true);assert.equal(f.classes.size,0);assert.match(f.html,/未补充/);
 f.c.reset();assert.match(f.host.innerHTML,/1 \/ 4/);assert.doesNotMatch(f.host.innerHTML,/aria-pressed="true"/);
});
test('input updates both next buttons without replacing textarea and escapes markup on review',()=>{
 const f=fixture();f.c.activate(true);f.c.act('pick-0');f.c.act('next');const before=f.host.innerHTML;
 f.input('<img src=x onerror=alert(1)>');assert.equal(f.host.innerHTML,before);assert.ok(f.buttons.every(b=>!b.disabled));
 f.c.act('next');f.c.act('skip');assert.match(f.host.innerHTML,/&lt;img/);assert.doesNotMatch(f.host.innerHTML,/<img src=x/);f.c.act('confirm');assert.match(f.html,/&lt;img/);
});

test('pending questions show the matching request tool and parameters, and remove it after confirmation',()=>{
 const {renderQuestionTool}=require('../clarification-demo.js');
 const m=createModel();
 assert.match(renderQuestionTool(m),/请求补充信息：经营目标/);
 assert.match(renderQuestionTool(m),/request_user_input/);
 assert.match(renderQuestionTool(m),/data-tool-state="waiting"/);
 assert.match(renderQuestionTool(m),/吸引新客到店/);
 m.act('pick-0');m.act('next');
 assert.match(renderQuestionTool(m,true),/菜品与限制/);
 assert.match(renderQuestionTool(m,true),/ open>/);
 assert.doesNotMatch(renderQuestionTool(m),/吸引新客到店/);
 m.type('<script>alert(1)</script>');m.act('next');
 assert.match(renderQuestionTool(m),/套餐售价/);assert.match(renderQuestionTool(m),/元／套/);
 m.act('skip');assert.match(renderQuestionTool(m),/确认上线要求/);
 assert.match(renderQuestionTool(m),/&lt;script&gt;/);assert.doesNotMatch(renderQuestionTool(m),/<script>/);
 m.act('confirm');assert.equal(renderQuestionTool(m),'');
});

test('closing and reopening the question changes the pending request tool visibility',()=>{
 const f=fixture();f.c.activate(true);assert.match(f.html,/clarify-tool-call/);
 f.c.act('close');assert.doesNotMatch(f.html,/clarify-tool-call/);
 f.c.act('reopen');assert.match(f.html,/请求补充信息：经营目标/);
});

function continuationFixture(){
 let request='',execution=null,clock=0;const timers=new Map(),turns=[],updates=[],frames=[];
 const host={hidden:true,innerHTML:'',addEventListener(){},querySelectorAll:()=>[],querySelector:()=>null};
 const panel={set outerHTML(html){request=html;}};
 const thread={addEventListener(){},querySelector:selector=>selector==='.clarify-execution'?execution:panel};
 const c=createController({intro:false,thread,host,composer:{closest:()=>({classList:{toggle(){}}})},
  renderPlan:state=>`<div class="stage-plan">待办任务 ${state.phase==='done'?'1/3':'0/3'} 等待补充</div>`,
  renderExecution:(answers,frame)=>{frames.push(frame);return `<div>执行帧 ${frame}</div>`;},
  appendTurn(text,html){turns.push({text,html});execution={dataset:{executionFrame:'0'},innerHTML:html,querySelector:()=>null};},
  onChange:(phase,state)=>updates.push({phase,...state}),
  setTimer:fn=>{timers.set(++clock,fn);return clock;},clearTimer:id=>timers.delete(id)
 });
 return {c,host,timers,turns,updates,frames,get request(){return request;},next(){const first=timers.entries().next().value;if(first){timers.delete(first[0]);first[1]();}},flush(){while(timers.size)this.next();}};
}

test('the request retains a task plan before answering and confirmation creates one continuation turn',()=>{
 const f=continuationFixture();f.c.activate(true);assert.match(f.request,/待办任务 0\/3/);
 f.c.act('pick-1');f.c.act('next');f.c.act('skip');f.c.act('skip');
 assert.match(f.request,/待办任务 0\/3/);assert.equal(f.turns.length,0);
 f.c.act('confirm');assert.equal(f.turns.length,1);assert.match(f.turns[0].text,/经营目标：提升客单价与连带销售/);
 assert.match(f.turns[0].text,/菜品与限制：未补充，保留待确认/);assert.match(f.turns[0].html,/clarify-execution/);
 assert.equal(f.host.hidden,true);assert.equal(f.updates.at(-1).complete,false);
 assert.equal(f.c.act('confirm'),false);assert.equal(f.turns.length,1);
 f.flush();assert.deepEqual(f.frames,[0,1,2,3]);assert.equal(f.updates.at(-1).complete,true);
});

test('leaving the task suspends continuation and returning resumes from its execution frame',()=>{
 const f=continuationFixture();f.c.activate(true);f.c.act('pick-0');f.c.act('next');f.c.act('skip');f.c.act('skip');f.c.act('confirm');
 f.next();assert.equal(f.frames.at(-1),1);f.c.activate(false);assert.equal(f.timers.size,0);
 f.c.activate(true);assert.equal(f.frames.at(-1),1);assert.equal(f.timers.size,1);
 f.flush();assert.equal(f.frames.at(-1),3);assert.equal(f.turns.length,1);
});

test('the shared task renderer differentiates a user wait from active execution',()=>{
 const fs=require('node:fs'),vm=require('node:vm');const source=fs.readFileSync('app.js','utf8');
 const start=source.indexOf('  function renderConversationPlan('),end=source.indexOf('  function renderConversationStageBody(',start);
 const context={esc:String,stageToolIcons:{list:''}};vm.createContext(context);vm.runInContext(source.slice(start,end),context);
 const steps=[{title:'确认要求'},{title:'整理套餐'},{title:'撰写文案'}];
 const waiting=context.renderConversationPlan(steps,0,true,false,true,'waiting-plan');
 assert.match(waiting,/data-state="waiting"/);assert.doesNotMatch(waiting,/class="spinner"/);assert.match(waiting,/已完成 0\/3/);
 const running=context.renderConversationPlan(steps,0,true,true);assert.match(running,/class="spinner"/);
 const done=context.renderConversationPlan(steps,3,false);assert.equal((done.match(/data-state="done"/g)||[]).length,3);
});

test('the continuation reuses stage frames and returns an escaped draft without invented optional conditions',()=>{
 const fs=require('node:fs'),vm=require('node:vm');const source=fs.readFileSync('app.js','utf8');let captured;
 const start=source.indexOf('  const clarificationPlan ='),end=source.indexOf('  function renderWidgetStage(',start);
 const context={esc:value=>String(value).replaceAll('<','&lt;').replaceAll('>','&gt;'),renderConversationStageBody:(...args)=>{captured=args.at(-1);return '<div>shared-stage</div>';}};
 vm.createContext(context);vm.runInContext(source.slice(start,end),context);
 const state={startedAt:Date.now(),planOpen:true,thinkingOpen:false};
 context.renderClarificationExecution(['吸引新客',null,null],1,state);
 assert.equal(captured.planSteps.length,3);assert.equal(captured.frames[1].call.name,'draft_meal_plan');assert.equal(captured.frames[2].call.name,'draft_listing_copy');
 const output=context.renderClarificationExecution(['吸引新客','<script>bad</script>',null],3,state);
 assert.match(output,/待确认/);assert.match(output,/上架文案草稿/);assert.match(output,/&lt;script&gt;/);assert.doesNotMatch(output,/<script>/);
});

test('conversation introduction precedes the question and pauses when leaving',()=>{
 const timers=new Map();let id=0;
 const host={hidden:true,innerHTML:'',addEventListener(){}};
 const c=createController({host,thread:{addEventListener(){},querySelector:()=>null},composer:{closest:()=>({classList:{toggle(){}}})},setTimer:fn=>{timers.set(++id,fn);return id;},clearTimer:id=>timers.delete(id)});
 const tick=()=>{const [key,fn]=timers.entries().next().value;timers.delete(key);fn();};
 c.activate(true);assert.equal(host.hidden,true);assert.match(c.initial(),/正在理解需求/);
 tick();assert.equal(host.hidden,true);assert.match(c.initial(),/我先和你确认几个要求/);
 const stale=[...timers.values()][0];c.activate(false);stale();assert.equal(host.hidden,true);
 c.activate(true);tick();assert.equal(host.hidden,true);
 tick();assert.equal(host.hidden,true);assert.doesNotMatch(c.initial(),/clarify-tool-call/);
 tick();assert.equal(host.hidden,true);assert.match(c.initial(),/clarify-tool-call/);
 tick();assert.equal(host.hidden,false);assert.match(host.innerHTML,/最希望达成什么目标/);
});
