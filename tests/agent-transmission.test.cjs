const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(process.env.AGENT_APP || 'app.js','utf8');
function setup(){
 const animations=[];let running=[{offsetTop:0},{offsetTop:32},{offsetTop:64}];
 const svg={children:[],setAttribute(){},replaceChildren(){this.children=[]},append(node){this.children.push(node)}};
 const heading={offsetTop:0,querySelector:()=>({offsetTop:1.5,offsetHeight:19})};
 const section={querySelector:()=>heading};
 const tree={isConnected:true,clientWidth:400,clientHeight:128,offsetTop:26,closest:selector=>selector==='.stage-delegation'?section:{dataset:{}},querySelector:selector=>selector==='.stage-delegation-flow'?svg:{offsetLeft:9},querySelectorAll:()=>running};
 const ctx={reducedMotion:{matches:false},document:{timeline:{currentTime:2468},createElementNS:()=>({attrs:{},style:{},setAttribute(k,v){this.attrs[k]=v},getTotalLength:()=>120,animate(frames,options){const animation={d:this.attrs.d,frames,options,cancel(){this.cancelled=true}};animations.push(animation);return animation}})}};
 vm.createContext(ctx);const start=source.indexOf('  const agentTransmissionStates =');vm.runInContext(source.slice(start,source.indexOf("  conversationThread.addEventListener('toggle'",start)),ctx);
 const panel={querySelectorAll:()=>[tree]};return{animations,svg,ctx,panel,tree,setRunning:value=>running=value};
}
test('all running routes animate concurrently from the robot end on one repeating timeline',()=>{
 const s=setup();s.ctx.syncAgentTransmissionPaths(s.panel);assert.equal(s.animations.length,3);
 for(const a of s.animations){
  assert.ok(a.d.startsWith('M9.5 -5.5V'));assert.equal(a.frames[0].opacity,0);assert.equal(a.frames[0].strokeDashoffset,20);assert.equal(a.frames.at(-1).opacity,0);assert.equal(a.frames.at(-1).strokeDashoffset,-140);assert.equal(a.options.iterations,Infinity);assert.equal(a.startTime,2468);
 }
 assert.equal(new Set(s.animations.map(a=>a.options.duration)).size,1);
 assert.equal(new Set(s.animations.map(a=>a.d)).size,3);
 assert.equal(s.svg.children.filter(p=>p.attrs.class==='stage-agent-packet').length,3);
});
test('unchanged geometry never recreates the packet or restarts its timeline',()=>{
 const s=setup();s.ctx.syncAgentTransmissionPaths(s.panel);const packet=s.svg.children.at(-1);
 for(let i=0;i<6;i++)s.ctx.syncAgentTransmissionPaths(s.panel);
 assert.equal(s.animations.length,3);assert.equal(s.svg.children.at(-1),packet);
});
test('all completed branches stop transmission and remove the packet',()=>{
 const s=setup();s.ctx.syncAgentTransmissionPaths(s.panel);s.setRunning([]);s.ctx.syncAgentTransmissionPaths(s.panel);assert.equal(s.svg.children.length,0);assert.ok(s.animations.every(a=>a.cancelled));
});
