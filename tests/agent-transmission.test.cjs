const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(process.env.AGENT_APP || 'app.js','utf8');
function setup(){
 const animations=[];let running=[0,38,76].map(offsetTop=>({offsetTop,querySelector:selector=>(selector==='summary'||selector==='.stage-agent-open')?{offsetTop:0,offsetHeight:36}:{getBoundingClientRect:()=>({left:125})}}));
 const svg={children:[],setAttribute(){},replaceChildren(){this.children=[]},append(node){this.children.push(node)}};
 const heading={offsetTop:0,querySelector:()=>({offsetTop:1.5,offsetHeight:19})};
 const section={querySelector:()=>heading};
 const tree={getBoundingClientRect:()=>({left:100}),isConnected:true,clientWidth:400,clientHeight:128,offsetTop:26,closest:selector=>selector==='.stage-delegation'?section:{dataset:{}},querySelector:selector=>selector==='.stage-delegation-flow'?svg:{offsetLeft:9},querySelectorAll:()=>running};
 let nextFrame=0;const frames=new Map(),observers=[];
 const ctx={ResizeObserver:class{constructor(callback){this.callback=callback;observers.push(this)}observe(node){this.node=node}disconnect(){this.disconnected=true}},requestAnimationFrame(fn){frames.set(++nextFrame,fn);return nextFrame},cancelAnimationFrame(id){frames.delete(id)},reducedMotion:{matches:false},document:{timeline:{currentTime:2468},createElementNS:()=>({attrs:{},style:{},children:[],append(node){this.children.push(node)},setAttribute(k,v){this.attrs[k]=v},getTotalLength:()=>120,getPointAtLength:distance=>({x:9.5,y:distance}),animate(frames,options){const animation={d:this.attrs.d,currentTime:0,frames,options,cancel(){this.cancelled=true}};animations.push(animation);return animation}})}};
 vm.createContext(ctx);const start=source.indexOf('  const agentTransmissionStates =');vm.runInContext(source.slice(start,source.indexOf("  conversationThread.addEventListener('toggle'",start)),ctx);
 const panel={querySelectorAll:()=>[tree]};return{animations,svg,ctx,panel,tree,frames,observers,getRunning:()=>running,setRunning:value=>running=value};
}
test('A dispatches two overlapping groups with equal timing and a fading tail',()=>{
 const s=setup();s.ctx.syncAgentTransmissionPaths(s.panel);assert.equal(s.animations.length,6);
 for(const [index,a] of s.animations.entries()){
  assert.equal(a.frames[0].opacity,0);assert.equal(a.frames.at(-1).opacity,0);
  assert.equal(a.options.delay,index%2*a.options.duration/2);
  assert.equal(a.options.iterations,Infinity);assert.equal(a.startTime,2468);
 }
 assert.equal(new Set(s.animations.map(a=>a.options.duration)).size,1);
 const defs=s.svg.children.find(p=>p.children?.length);
 const routes=defs.children.filter(p=>p.attrs.d);
 assert.equal(routes.length,3);assert.equal(new Set(routes.map(p=>p.attrs.d)).size,3);
 assert.ok(routes.every(p=>p.attrs.d.startsWith('M9.5 -5.5V')));
 assert.ok(routes.every(p=>p.attrs.d.endsWith('H25')),'moving branches reach the avatar edge');
 const gradients=defs.children.filter(p=>p.attrs.gradientUnits);
 assert.equal(gradients.length,6);
 assert.ok(gradients.every(g=>g.children[0].attrs['stop-opacity']===0&&g.children.at(-1).attrs['stop-opacity']===1));
 assert.equal(s.svg.children.filter(p=>p.attrs.class==='stage-agent-packet').length,6);
 // Move to a visible phase and draw: a real moving stroke replaces the initial empty path.
 s.animations.forEach(a=>a.currentTime=a.options.duration*.3);
 const draw=s.frames.values().next().value;draw();
 assert.ok(s.svg.children.some(p=>p.attrs.class==='stage-agent-packet'&&p.attrs.d?.startsWith('M')));
});
test('unchanged geometry never recreates the packet or restarts its timeline',()=>{
 const s=setup();s.ctx.syncAgentTransmissionPaths(s.panel);const packet=s.svg.children.at(-1);
 for(let i=0;i<6;i++)s.ctx.syncAgentTransmissionPaths(s.panel);
 assert.equal(s.animations.length,6);assert.equal(s.svg.children.at(-1),packet);
});
test('all completed branches stop transmission and remove the packet',()=>{
 const s=setup();s.ctx.syncAgentTransmissionPaths(s.panel);s.setRunning([]);s.ctx.syncAgentTransmissionPaths(s.panel);assert.equal(s.svg.children.length,0);assert.ok(s.animations.every(a=>a.cancelled));assert.equal(s.frames.size,0);
});

test('rapid detail expansion and collapse update paths without restarting or replacing packets',()=>{
 const s=setup();s.ctx.syncAgentTransmissionPaths(s.panel);
 const children=[...s.svg.children],timeline=s.animations.map(a=>a.startTime);
 s.animations.forEach(a=>a.currentTime=600);
 for(let i=0;i<30;i++){
  const expanded=i%2===0;
  s.tree.clientHeight=expanded?192:128;
  s.getRunning()[1].offsetTop=expanded?102:38;
  s.getRunning()[2].offsetTop=expanded?140:76;
  s.observers[0].callback();
 }
 assert.equal(s.animations.length,6);assert.equal(s.observers.length,1);
 assert.ok(s.animations.every((a,i)=>!a.cancelled&&a.currentTime===600&&a.startTime===timeline[i]));
 assert.ok(s.svg.children.every((node,i)=>node===children[i]));
 assert.equal(s.frames.size,1,'only one drawing loop survives repeated resize callbacks');
 const defs=s.svg.children.find(node=>node.children?.length);
 const routes=defs.children.filter(node=>node.attrs.d);
 assert.ok(routes[1].attrs.d.includes('Q9.5 56 '),'collapsed branch tracks the avatar again');
 s.setRunning([]);s.ctx.syncAgentTransmissionPaths(s.panel);
 assert.equal(s.observers[0].disconnected,true);assert.equal(s.frames.size,0);
});

test('delegations use direct workspace buttons with task metadata and no inline disclosure',()=>{
 const ctx={esc:String,conversationStageDelegations:[{title:'核对超时时长',detail:'核对时间记录'},{title:'评估影响范围',detail:'统计影响订单'}]};
 vm.createContext(ctx);
 const start=source.indexOf('  function renderStageDelegations(');
 vm.runInContext(source.slice(start,source.indexOf('  const agentTransmissionStates',start)),ctx);
 const html=ctx.renderStageDelegations(4);
 assert.equal((html.match(/class="stage-agent-open"/g)||[]).length,2);
 assert.match(html,/data-summary-agent="核对超时时长"/);assert.match(html,/data-agent-detail="核对时间记录"/);
 assert.match(html,/stage-agent-open-arrow/);assert.doesNotMatch(html,/<details|<summary|stage-delegation-chevron/);
});

test('clicking a delegation task opens the matching subagent workspace',()=>{
 let click,opened;
 const ctx={conversationThread:{addEventListener:(type,handler)=>click=handler},openSubagentConversation:button=>opened=button};
 vm.createContext(ctx);
 const start=source.indexOf("  conversationThread.addEventListener('click', event => {\n    const button = event.target.closest('.stage-agent-open');");
 assert.ok(start>=0);
 vm.runInContext(source.slice(start,source.indexOf("  document.getElementById('summaryAgentsList')",start)),ctx);
 const button={dataset:{summaryAgent:'核对超时时长',agentDetail:'核对时间记录',agentStatus:'执行中'}};
 click({target:{closest:()=>button}});assert.equal(opened,button);
});
