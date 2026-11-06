const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
function extract(a,b){const start=source.indexOf(a);return source.slice(start,source.indexOf(b,start));}
test('first transition collapses acknowledgement and plan together before replacing content',()=>{
 let timer,updated=0,preserved=0;const classes=new Set(),ack={style:{},offsetHeight:40,getBoundingClientRect:()=>({height:40})},body={},toggle={setAttribute(k,v){this[k]=v}},plan={dataset:{},querySelector:s=>s==='.stage-plan-body'?body:toggle};
 const panel={dataset:{stageFrame:'0'},isConnected:true,classList:{toggle:(k,on)=>on?classes.add(k):classes.delete(k)},querySelector:s=>s==='.stage-plan'?plan:ack};
 const ctx={stageAutoTimer:null,stageAdvanceTimer:null,reducedMotion:{matches:false},stageDemoAdvance:{disabled:false},clearTimeout(){},preserveConversationScrollRange(){preserved++},setTimeout(fn,ms){assert.equal(ms,420);timer=fn;return 1},updateConversationStage(){updated++}};
 vm.createContext(ctx);vm.runInContext(extract('  function advanceConversationStage(',"  const stageDemoControls ="),ctx);ctx.advanceConversationStage(panel,1);
 assert.equal(updated,0);assert.equal(preserved,1);assert.equal(ack.style.height,'40px');assert.ok(classes.has('is-advancing'));assert.equal(plan.dataset.collapsed,'true');assert.equal(toggle['aria-expanded'],'false');assert.equal(body.inert,true);
 timer();assert.equal(updated,1);
});
test('stage updates reserve scroll range and avoid bottom-snapping on shrink or manual reading',()=>{
 function update({grow=false,follow=true}={}){
  const frames=[],task={},scroll={scrollHeight:1000,scrollTop:400,clientHeight:600},thread={offsetHeight:976,style:{},innerHTML:''};
  let writes=0;Object.defineProperty(scroll,'scrollTop',{get:()=>400,set(){writes++}});
  const panel={dataset:{stageFrame:'0'},isConnected:true,querySelector:()=>null,querySelectorAll:()=>[],classList:{toggle(){}},set innerHTML(value){scroll.scrollHeight=grow?1100:900}};
  const ctx={conversationScroll:scroll,conversationThread:thread,conversationFollowLatest:follow,conversationStageFrames:[{stage:'plan'},{stage:'work'}],stageAutoTimer:null,clearTimeout(){},replaceStageContent:(panel,markup)=>{panel.innerHTML=markup},renderConversationStageBody:()=>'',syncStageDemoControls(){},conversationThreads:new Map(),conversationTask:task,activeConversationTask:task,scheduleStageAutoAdvance(){},requestAnimationFrame:f=>frames.push(f)};
  vm.createContext(ctx);vm.runInContext(extract('  function preserveConversationScrollRange()', '  function advanceConversationStage('),ctx);ctx.updateConversationStage(panel,1);frames.forEach(f=>f());return {writes,thread};
 }
 const shrink=update();assert.equal(shrink.thread.style.minHeight,'976px');assert.equal(shrink.writes,0);
 assert.equal(update({grow:true}).writes,1);assert.equal(update({grow:true,follow:false}).writes,0);
});

test('manual todo clicks record explicit open and closed preferences',()=>{
 let click;const panel={dataset:{}},body={},plan={dataset:{},closest:()=>panel,querySelector:()=>body};
 const toggle={attrs:{'aria-expanded':'false'},closest:()=>plan,getAttribute(k){return this.attrs[k]},setAttribute(k,v){this.attrs[k]=v}};
 const ctx={conversationThread:{innerHTML:'',addEventListener:(type,fn)=>click=fn},conversationThreads:new Map(),activeConversationTask:{}};vm.createContext(ctx);
 vm.runInContext(extract("  conversationThread.addEventListener('click', (event) => {\n    const toggle = event.target.closest('.stage-plan-toggle');","  conversationThread.addEventListener('animationend'"),ctx);
 click({target:{closest:()=>toggle}});assert.equal(panel.dataset.planExpanded,'true');assert.equal(body.inert,false);
 click({target:{closest:()=>toggle}});assert.equal(panel.dataset.planExpanded,'false');assert.equal(body.inert,true);
});
test('a manually open plan skips automatic first-step collapse',()=>{
 let timer;const body={inert:false},toggle={setAttribute(){throw Error('manual plan must remain open')}},plan={dataset:{collapsed:'false'},querySelector:s=>s==='.stage-plan-body'?body:toggle};
 const panel={dataset:{stageFrame:'0',planExpanded:'true'},classList:{toggle(){}},querySelector:s=>s==='.stage-plan'?plan:null,isConnected:true};
 const ctx={stageAutoTimer:null,stageAdvanceTimer:null,reducedMotion:{matches:false},stageDemoAdvance:{},clearTimeout(){},preserveConversationScrollRange(){},setTimeout(fn){timer=fn;return 1},updateConversationStage(){}};vm.createContext(ctx);
 vm.runInContext(extract('  function advanceConversationStage(',"  const stageDemoControls ="),ctx);ctx.advanceConversationStage(panel,1);assert.equal(plan.dataset.collapsed,'false');assert.equal(body.inert,false);timer();
});
test('phase updates honor manual open/closed preferences, including completion',()=>{
 for(const preference of ['true','false'])for(const done of [false,true]){
  let rendered;const task={},panel={dataset:{stageFrame:'0',planExpanded:preference},classList:{toggle(){}},querySelector:()=>null,querySelectorAll:()=>[]};
  const ctx={conversationScroll:{scrollHeight:1000,scrollTop:0,clientHeight:600},conversationThread:{innerHTML:''},conversationFollowLatest:false,conversationStageFrames:[{stage:'plan'},{stage:done?'done':'work'}],stageAutoTimer:null,clearTimeout(){},preserveConversationScrollRange(){},replaceStageContent:(panel,markup)=>{panel.innerHTML=markup},renderConversationStageBody:(...args)=>{rendered=args;return ''},syncStageDemoControls(){},scheduleStageAutoAdvance(){},conversationThreads:new Map(),conversationTask:task,Date};vm.createContext(ctx);
  vm.runInContext(extract('  function updateConversationStage(', '  function advanceConversationStage('),ctx);ctx.updateConversationStage(panel,1);assert.equal(rendered[1],preference==='true');assert.equal(rendered[3],done&&preference==='true');
 }
});

test('progress updates keep existing DOM nodes and insert checkpoints without rebuilding current work',()=>{
 class Node {
  constructor(tag,cls='',text=null){this.nodeType=text===null?1:3;this.tagName=tag;this.classList=cls?[cls]:[];this.id='';this.nodeValue=text;this.childNodes=[];this.attrs=new Map(cls?[['class',cls]]:[]);}
  get attributes(){return [...this.attrs].map(([name,value])=>({name,value}));}
  get firstChild(){return this.childNodes[0]||null;}
  get nextSibling(){return this.parent?.childNodes[this.parent.childNodes.indexOf(this)+1]||null;}
  getAttribute(n){return this.attrs.get(n)||null;}
  hasAttribute(n){return this.attrs.has(n);}
  setAttribute(n,v){this.attrs.set(n,v);}
  removeAttribute(n){this.attrs.delete(n);}
  insertBefore(n,c){n.remove();n.parent=this;const i=c?this.childNodes.indexOf(c):this.childNodes.length;this.childNodes.splice(i,0,n);}
  remove(){if(this.parent){this.parent.childNodes.splice(this.parent.childNodes.indexOf(this),1);this.parent=null;}}
 }
 const element=(cls,text)=>{const e=new Node('SECTION',cls);if(text)e.insertBefore(new Node(null,'',text),null);return e;};
 const parent=element('panel'),thinking=element('stage-thinking','分析中'),plan=element('stage-plan','已完成 0/3'),current=element('stage-current','核对资料');
 for(const el of [thinking,plan,current])parent.insertBefore(el,null);
 const ctx={};vm.createContext(ctx);vm.runInContext(extract('  function stageContentKey(', '  function replaceStageContent('),ctx);
 const next=element('fragment');for(const el of [element('stage-thinking','整理中'),element('stage-plan','已完成 1/3'),element('stage-checkpoint','资料已核对'),element('stage-current','比较优先级')])next.insertBefore(el,null);
 ctx.reconcileStageContent(parent,next);
 assert.equal(parent.childNodes[0],thinking);assert.equal(parent.childNodes[1],plan);assert.equal(parent.childNodes[3],current);assert.equal(current.firstChild.nodeValue,'比较优先级');assert.equal(thinking.firstChild.nodeValue,'整理中');
 const final=element('fragment');final.insertBefore(element('stage-thinking','已完成'),null);final.insertBefore(element('stage-result','结果'),null);ctx.reconcileStageContent(parent,final);
 assert.equal(parent.childNodes.length,2);assert.equal(parent.firstChild,thinking);assert.equal(current.parent,null);
});
