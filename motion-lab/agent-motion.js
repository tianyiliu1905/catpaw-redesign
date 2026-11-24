const ns='http://www.w3.org/2000/svg', animations=[];let paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
const names=['Check delay duration','Assess impact','Investigate recurring issues','Review findings'];
const agentAssets=['07-success','09','11-purple','15-link'];
const agentAvatar=index=>`<img src="../assets/subagent-soft-geometric/${agentAssets[index]}.svg" alt="" draggable="false">`;

let firstAgentCompleted=false, firstProgress=0, selectedCapsule=0;
const packets=[];
const packetGroups=3;
const dispatchEase=gsap.parseEase('power4.out');
for(const panel of document.querySelectorAll('.panel[data-mode="current"]')){
const demo=panel.querySelector('.demo');demo.innerHTML='<div class="heading"><span class="heading-icon" aria-hidden="true"><img src="../assets/subagent-tool-v2-figma.svg" alt="" width="24" height="24"></span><span class="heading-copy">Calling subagents to analyze store exceptions</span></div><div class="rows">'+names.map((n,i)=>`<div class="row"><span class="agent-icon" aria-hidden="true">${agentAvatar(i)}</span><span class="agent-row-name">${n}</span><span class="agent-row-tool"></span></div>`).join('')+'</div>';
const svg=document.createElementNS(ns,'svg');demo.append(svg);
const syncStemTop=()=>{svg.style.top=`${demo.querySelector('.heading').offsetHeight+4}px`;};
syncStemTop();
new ResizeObserver(syncStemTop).observe(demo);
const defs=document.createElementNS(ns,'defs'),baseLayer=document.createElementNS(ns,'g'),motionLayer=document.createElementNS(ns,'g'),dotLayer=document.createElementNS(ns,'g');svg.append(defs,baseLayer,motionLayer,dotLayer);
const svgTop=svg.getBoundingClientRect().top;
const routes=[...demo.querySelectorAll('.row')].map(row=>{const rect=row.getBoundingClientRect();const y=rect.top+rect.height/2-svgTop;const endX=row.querySelector('.agent-icon').getBoundingClientRect().left-svg.getBoundingClientRect().left-6;return `M9.5 0V${y-8}Q9.5 ${y} 17.5 ${y}H${endX}`;});
routes.forEach((d,i)=>{
 const base=document.createElementNS(ns,'path');base.setAttribute('d',d);base.setAttribute('class','base');baseLayer.append(base);
 const length=base.getTotalLength(),endpoint=base.getPointAtLength(length);
 const terminalGradient=document.createElementNS(ns,'linearGradient');
 terminalGradient.id=`base-terminal-${panel.dataset.mode}-${i}`;
 terminalGradient.setAttribute('gradientUnits','userSpaceOnUse');
 terminalGradient.setAttribute('x1',endpoint.x-12);terminalGradient.setAttribute('x2',endpoint.x);
 terminalGradient.setAttribute('y1',endpoint.y);terminalGradient.setAttribute('y2',endpoint.y);
 for(const [offset,color] of [[0,'var(--ds-border-2)'],[1,'var(--ds-border-4)']]){
  const stop=document.createElementNS(ns,'stop');stop.setAttribute('offset',offset);stop.setAttribute('stop-color',color);terminalGradient.append(stop);
 }
 defs.append(terminalGradient);base.style.stroke=`url(#${terminalGradient.id})`;
 const terminalDot=document.createElementNS(ns,'circle');
 terminalDot.setAttribute('cx',endpoint.x);terminalDot.setAttribute('cy',endpoint.y);
 terminalDot.setAttribute('r','1.5');terminalDot.setAttribute('fill','#fff');terminalDot.setAttribute('stroke','var(--ds-text-5)');terminalDot.setAttribute('stroke-width','.8');
 dotLayer.append(terminalDot);
 for(let group=0;group<packetGroups;group++){
  const p=base.cloneNode(),gradient=document.createElementNS(ns,'linearGradient');
  const id=`packet-tail-${panel.dataset.mode}-${i}-${group}`;
  gradient.id=id;gradient.setAttribute('gradientUnits','userSpaceOnUse');
  for(const [offset,opacity] of [[0,0],[.18,.35],[.4,.8],[.55,1],[1,1]]){
   const stop=document.createElementNS(ns,'stop');stop.setAttribute('offset',offset);stop.setAttribute('stop-color','#000');stop.setAttribute('stop-opacity',opacity*.13);gradient.append(stop);
  }
  defs.append(gradient);p.setAttribute('class','packet');p.style.stroke=`url(#${id})`;p.setAttribute('d','');motionLayer.append(p);
  packets.push({p,gradient,route:base,length,mode:panel.dataset.mode,group,agentIndex:i});
 }
});
}
const cardDemo=document.querySelector('.agent-cards-demo');
const cardShapeAvatars=["<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 160 160\" width=\"160\" height=\"160\" role=\"img\" aria-label=\"四宫格\"><defs><linearGradient id=\"card-subject-0\" gradientUnits=\"userSpaceOnUse\" x1=\"28\" y1=\"28\" x2=\"132\" y2=\"132\"><stop offset=\"0\" stop-color=\"#9AEBB1\"/><stop offset=\".45\" stop-color=\"#87E4A4\"/><stop offset=\"1\" stop-color=\"#67D78E\"/></linearGradient></defs><rect width=\"160\" height=\"160\" fill=\"#F6FBF7\"/><g class=\"agent-rolling-shape\" fill=\"url(#card-subject-0)\"><rect x=\"28\" y=\"28\" width=\"48\" height=\"48\" rx=\"12\"/><rect x=\"84\" y=\"28\" width=\"48\" height=\"48\" rx=\"12\"/><rect x=\"28\" y=\"84\" width=\"48\" height=\"48\" rx=\"12\"/><rect x=\"84\" y=\"84\" width=\"48\" height=\"48\" rx=\"12\"/></g></svg>", "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 160 160\" width=\"160\" height=\"160\" role=\"img\" aria-label=\"圆角菱形\"><defs><linearGradient id=\"card-subject-1\" gradientUnits=\"userSpaceOnUse\" x1=\"28\" y1=\"28\" x2=\"132\" y2=\"132\"><stop offset=\"0\" stop-color=\"#FFD6B9\"/><stop offset=\".45\" stop-color=\"#FFD2B2\"/><stop offset=\"1\" stop-color=\"#FFCCA6\"/></linearGradient></defs><rect width=\"160\" height=\"160\" fill=\"#FFF6EF\"/><g class=\"agent-rolling-shape\" fill=\"url(#card-subject-1)\"><g transform=\"rotate(45 80 80)\"><rect x=\"40\" y=\"40\" width=\"80\" height=\"80\" rx=\"12\"/></g></g></svg>", "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 160 160\" width=\"160\" height=\"160\" role=\"img\" aria-label=\"正三圆\"><defs><linearGradient id=\"card-subject-2\" gradientUnits=\"userSpaceOnUse\" x1=\"28\" y1=\"28\" x2=\"132\" y2=\"132\"><stop offset=\"0\" stop-color=\"#C7B3FF\"/><stop offset=\".45\" stop-color=\"#BEA6FF\"/><stop offset=\"1\" stop-color=\"#B08EFF\"/></linearGradient></defs><rect width=\"160\" height=\"160\" fill=\"#F6F3FF\"/><g class=\"agent-rolling-shape\" fill=\"url(#card-subject-2)\"><g transform=\"translate(0 4)\"><circle cx=\"80\" cy=\"49\" r=\"24\"/><circle cx=\"53.15\" cy=\"95.5\" r=\"24\"/><circle cx=\"106.85\" cy=\"95.5\" r=\"24\"/></g></g></svg>", "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 160 160\" width=\"160\" height=\"160\" role=\"img\" aria-label=\"正六边形\"><defs><linearGradient id=\"card-subject-3\" gradientUnits=\"userSpaceOnUse\" x1=\"28\" y1=\"28\" x2=\"132\" y2=\"132\"><stop offset=\"0\" stop-color=\"#B0D3FF\"/><stop offset=\".45\" stop-color=\"#A1CAFF\"/><stop offset=\"1\" stop-color=\"#87BCFF\"/></linearGradient></defs><rect width=\"160\" height=\"160\" fill=\"#F4F9FF\"/><g class=\"agent-rolling-shape\" fill=\"url(#card-subject-3)\"><path d=\"M131,88.66025403784438 L113,119.83716857408417 Q108,128.49742261192856 98,128.49742261192856 L62.000000000000014,128.49742261192858 Q52.000000000000014,128.49742261192858 47.000000000000014,119.8371685740842 L29,88.66025403784438 Q24,80 28.999999999999996,71.3397459621556 L46.99999999999997,40.16283142591583 Q51.99999999999997,31.502577388071444 61.99999999999997,31.502577388071444 L98,31.502577388071437 Q108,31.502577388071437 113,40.162831425915826 L131,71.33974596215562 Q136,80 131,88.66025403784438Z\"/></g></svg>"];
const cardShapeAnimations=new Map();

const taskDescriptions=[
 'Check arrival and preparation timestamps to identify the longest delays.',
 'Compare affected orders by store and time slot to assess the impact.',
 'Find recurring exceptions and compare their common causes.',
 'Cross-check the available findings and verify the supporting records.'
];
cardDemo.innerHTML='<div class="heading"><span class="heading-icon" aria-hidden="true"><img src="../assets/subagent-tool-v2-figma.svg" alt="" width="24" height="24"></span><span class="heading-copy">Calling subagents to analyze store exceptions</span></div><div class="agent-card-grid">'+names.map((name,i)=>`
 <button class="agent-card" type="button" data-agent-index="${i}" data-state="running" aria-expanded="false" aria-controls="agentCardDetail">
  <span class="agent-card-top"><span class="agent-icon" aria-hidden="true">${cardShapeAvatars[i]}</span><span class="agent-card-name">${name}</span></span>
  <span class="agent-card-bottom"><span class="agent-card-action"></span><span class="agent-card-state"><span class="agent-state-copy"></span><svg class="agent-card-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></span></span>
 </button>`).join('')+'</div><section class="agent-card-detail" id="agentCardDetail" aria-label="Agent task details" hidden><div class="agent-detail-top"><strong></strong><button class="agent-detail-close" type="button" aria-label="Close task details">×</button></div><p></p><span class="agent-detail-status"></span></section>';
const detail=cardDemo.querySelector('.agent-card-detail');
function closeAgentCard(){
 cardDemo.querySelectorAll('.agent-card').forEach(card=>card.setAttribute('aria-expanded','false'));
 detail.hidden=true;
}
cardDemo.querySelectorAll('.agent-card').forEach(card=>{
 card.addEventListener('click',()=>{
  const expand=card.getAttribute('aria-expanded')!=='true';closeAgentCard();
  if(!expand)return;
  const i=Number(card.dataset.agentIndex);card.setAttribute('aria-expanded','true');
  detail.querySelector('strong').textContent=names[i];
  detail.querySelector('p').textContent=taskDescriptions[i];
  detail.querySelector('.agent-detail-status').textContent=i===0&&firstAgentCompleted?'Completed · Delay analysis is ready':'Working independently · Analysis in progress';
  detail.hidden=false;
 });
});
detail.querySelector('.agent-detail-close').onclick=()=>{
 const selected=cardDemo.querySelector('.agent-card[aria-expanded="true"]');closeAgentCard();selected?.focus();
};
cardDemo.addEventListener('keydown',event=>{
 if(event.key==='Escape'){
  const selected=cardDemo.querySelector('.agent-card[aria-expanded="true"]');closeAgentCard();selected?.focus();
 }
});
const stageActions=[
 ['Checking timestamps','Comparing delay patterns','Preparing findings','Delay analysis ready'],
 ['Reading store coverage','Comparing affected orders','Reviewing impact','Impact analysis ready'],
 ['Finding recurring issues','Comparing common causes','Reviewing patterns','Recurring issues reviewed'],
 ['Cross-checking findings','Verifying supporting records','Preparing review notes','Review findings ready']
];
const headingMarkup='<div class="heading"><span class="heading-icon" aria-hidden="true"><img src="../assets/subagent-tool-v2-figma.svg" alt="" width="24" height="24"></span><span class="heading-copy">Calling subagents to analyze store exceptions</span></div>';
const capsulesDemo=document.querySelector('.agent-capsules-demo');
capsulesDemo.innerHTML=headingMarkup+'<div class="agent-capsules" aria-label="Select an agent">'+names.map((name,i)=>`<button type="button" class="agent-chip" data-agent-index="${i}" aria-pressed="${i===0}"><span class="agent-icon" aria-hidden="true">${agentAvatar(i)}</span><span>${name}</span><span class="chip-done" aria-hidden="true" hidden>✓</span></button>`).join('')+'</div>';
function syncChipBorderGeometry(chip){
 const {width,height}=chip.getBoundingClientRect();if(!width||!height)return;
 const svg=chip.querySelector('.chip-progress-border');
 svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
 const inset=1,radius=Math.min(parseFloat(getComputedStyle(chip).borderTopLeftRadius)-inset,(width-2*inset)/2,(height-2*inset)/2),left=inset,top=inset,right=width-inset,bottom=height-inset,mid=height/2;
 const d=`M${left} ${mid}V${top+radius}A${radius} ${radius} 0 0 1 ${left+radius} ${top}H${right-radius}A${radius} ${radius} 0 0 1 ${right} ${top+radius}V${bottom-radius}A${radius} ${radius} 0 0 1 ${right-radius} ${bottom}H${left+radius}A${radius} ${radius} 0 0 1 ${left} ${bottom-radius}Z`;
 svg.querySelectorAll('.chip-perimeter').forEach(path=>path.setAttribute('d',d));
 const track=svg.querySelector('.chip-border-track'),length=track.getTotalLength();
 const count=Math.round(length/8),spacing=length/count;
 // Sample the circular perimeter, so every stripe turns with the local tangent.
 const point=s=>track.getPointAtLength((s+length)%length);
 let stripes='';
 for(let i=0;i<count;i++){
  const center=i*spacing;
  const corners=[[-1.7,-1],[.3,-1],[1.7,1],[-.3,1]].map(([offset,normal])=>{
   const q=point(center+offset),before=point(center+offset-.1),after=point(center+offset+.1);
   const dx=after.x-before.x,dy=after.y-before.y,n=Math.hypot(dx,dy);
   return `${q.x-dy/n*normal},${q.y+dx/n*normal}`;
  });
  stripes+=`M${corners.join('L')}Z`;
 }
 svg.querySelectorAll('.chip-hatch').forEach(path=>path.setAttribute('d',stripes));
}
const chipBorderObserver=new ResizeObserver(entries=>entries.forEach(entry=>syncChipBorderGeometry(entry.target)));
capsulesDemo.querySelectorAll('.agent-chip').forEach((chip,index)=>{
 const svg=document.createElementNS(ns,'svg');svg.classList.add('chip-progress-border');svg.setAttribute('aria-hidden','true');
 const make=(tag,attributes={})=>{const node=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attributes))node.setAttribute(key,value);return node;};
 const defs=make('defs'),mask=make('mask',{id:`chip-progress-mask-${index}`,maskUnits:'userSpaceOnUse',x:0,y:0,width:'100%',height:'100%','mask-type':'luminance'});
 const progress=make('path',{class:'chip-perimeter chip-progress-outline',pathLength:100});progress.style.stroke='white';mask.append(progress);defs.append(mask);svg.append(defs);
 const track=make('path',{class:'chip-perimeter chip-border-track'});track.style.stroke='#e5e5e5';
 const grayHatch=make('path',{class:'chip-hatch',fill:'#f5f5f5'});svg.append(track,grayHatch);
 const colorGroup=make('g',{mask:`url(#chip-progress-mask-${index})`});
 const colorTrack=make('path',{class:'chip-perimeter chip-border-track'});colorTrack.style.stroke='var(--chip-progress-color)';
 const colorHatch=make('path',{class:'chip-hatch'});colorHatch.style.fill='oklch(from var(--chip-progress-color) l calc(c * 1.45) h)';
 colorGroup.append(colorTrack,colorHatch);svg.append(colorGroup);chip.append(svg);
 chipBorderObserver.observe(chip);syncChipBorderGeometry(chip);
});
function agentCompletionPercent(index){return index===0?(firstAgentCompleted?100:[36,60,82][firstProgress]):[0,52,28,16][index];}
const ganttDemo=document.querySelector('.agent-gantt-demo');
let selectedGantt=0;
ganttDemo.innerHTML=headingMarkup+'<div class="agent-progress-list">'+names.map((name,i)=>`<div class="agent-progress-row" data-agent-index="${i}"><span class="agent-icon" aria-hidden="true">${agentAvatar(i)}</span><span class="agent-progress-name">${name}</span><span class="agent-progress-track" role="progressbar" aria-label="${name}" aria-valuemin="0" aria-valuemax="100"><span class="agent-progress-fill"></span></span><span class="agent-progress-value"></span></div>`).join('')+'</div>';
function syncGantt(){
 ganttDemo.querySelectorAll('.agent-progress-row').forEach((row,i)=>{
  const value=agentCompletionPercent(i);
  row.dataset.state=i===0&&firstAgentCompleted?'done':'running';
  row.querySelector('.agent-progress-fill').style.transform=`scaleX(${value/100})`;
  row.querySelector('.agent-progress-track').setAttribute('aria-valuenow',String(value));
  row.querySelector('.agent-progress-value').textContent=`${value}%`;
 });
}
function agentProgress(i){return i===0?(firstAgentCompleted?3:firstProgress):i===1?1:0;}
function currentAction(i){const phase=agentProgress(i);return stageActions[i][Math.max(0,phase)];}
const agentToolSteps=[
 ['Read spreadsheet','Analyze data','Write report'],
 ['Read spreadsheet','Analyze data','Write report'],
 ['Search records','Analyze data','Write report'],
 ['Read document','Cross-check data','Write report']
];
const agentToolIcons={
 'Read spreadsheet':'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 9v12M15 9v12M3 15h18"/>',
 'Analyze data':'<path d="M4 20h16M7 16v-5m5 5V5m5 11V8"/>',
 'Search records':'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
 'Read document':'<path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h6"/>',
 'Cross-check data':'<path d="M9 6h11M9 12h11M9 18h11M3 6l1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2"/>',
 'Write report':'<path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h6"/>'
};

function syncProgressDisplays(){
 syncGantt();
 document.querySelectorAll('.rows .row').forEach((row,index)=>{
  const tool=agentToolSteps[index][Math.min(2,Math.max(0,agentProgress(index)))];
  const slot=row.querySelector('.agent-row-tool');
  slot.innerHTML=`<span>${tool}</span>`;
  slot.title=`Current tool: ${tool}`;
 });
 cardDemo.querySelectorAll('.agent-card').forEach((card,i)=>{card.querySelector('.agent-card-action').textContent=currentAction(i);});
 capsulesDemo.querySelectorAll('.agent-chip').forEach((chip,i)=>{
  chip.setAttribute('aria-pressed',String(i===selectedCapsule));
  chip.dataset.state=agentProgress(i)===3?'done':'running';
  chip.querySelector('.chip-done').hidden=agentProgress(i)!==3;
  const value=agentCompletionPercent(i),previous=Number(chip.dataset.progress??value);
  chip.dataset.progress=String(value);chip.setAttribute('aria-label',`${names[i]}, ${value}% complete`);
  const border=chip.querySelector('.chip-progress-outline');border.style.strokeDashoffset=String(100-value);
  if(value!==previous&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
   const motion=border.animate([{strokeDashoffset:100-previous},{strokeDashoffset:100-value}],{duration:500,easing:'cubic-bezier(.23,1,.32,1)'});
   motion.playbackRate=Number(document.getElementById('speed').value);if(paused)motion.pause();animations.push(motion);
  }

 });
 document.getElementById('advance').disabled=firstProgress>=2||firstAgentCompleted;
}
capsulesDemo.querySelector('.agent-capsules').addEventListener('click',event=>{
 const chip=event.target.closest('.agent-chip');if(!chip)return;
 selectedCapsule=Number(chip.dataset.agentIndex);syncProgressDisplays();
});
document.getElementById('advance').onclick=()=>{if(firstAgentCompleted)return;firstProgress=Math.min(2,firstProgress+1);syncProgressDisplays();};
syncProgressDisplays();
function completeFirstAgent(){
 if(firstAgentCompleted)return;
 firstAgentCompleted=true;firstProgress=3;syncProgressDisplays();
 const row=document.querySelector('.rows .row'),card=cardDemo.querySelector('.agent-card');
 row.dataset.state='done';card.dataset.state='done';
 for(const route of new Set(packets.filter(packet=>packet.agentIndex===0).map(packet=>packet.route))){
  route.classList.add('is-complete');route.parentNode.append(route);
 }
 card.querySelector('.agent-state-copy').textContent='Completed';
 const shapeMotion=cardShapeAnimations.get(0);shapeMotion?.cancel();cardShapeAnimations.delete(0);
 document.getElementById('complete').disabled=true;
 for(const packet of packets){
  if(packet.agentIndex!==0)continue;
  const i=animations.indexOf(packet.animation);if(i>=0)animations.splice(i,1);
  packet.animation?.cancel();packet.animation=null;packet.p.setAttribute('d','');
 }
 if(card.getAttribute('aria-expanded')==='true')detail.querySelector('.agent-detail-status').textContent='Completed · Delay analysis is ready';
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 for(const icon of [row.querySelector('.agent-icon img'),card.querySelector('.agent-icon img, .agent-icon svg'),capsulesDemo.querySelector('.agent-chip .agent-icon img')]){
  icon.style.transformOrigin='center bottom';
  const a=icon.animate([
   {transform:'translateY(0) scale(1)',offset:0},
   {transform:'translateY(0) scale(1.06,.92)',offset:.08},
   {transform:'translateY(-6px) scale(.97,1.04)',offset:.28},
   {transform:'translateY(0) scale(1.06,.94)',offset:.6},
   {transform:'translateY(-3px) scale(.98,1.02)',offset:.73},
   {transform:'translateY(0) scale(1.03,.97)',offset:.9},
   {transform:'translateY(0) scale(1)',offset:1}
  ],{duration:1800,easing:'cubic-bezier(.23,1,.32,1)'});
  a.playbackRate=Number(document.getElementById('speed').value);if(paused)a.pause();animations.push(a);
 }
}
function replayAgents(){
 firstAgentCompleted=false;firstProgress=0;selectedCapsule=0;selectedGantt=0;closeAgentCard();syncProgressDisplays();
 for(const packet of packets)packet.route.classList.remove('is-complete');
 const row=document.querySelector('.rows .row'),card=cardDemo.querySelector('.agent-card');
 delete row.dataset.state;card.dataset.state='running';
 card.querySelector('.agent-state-copy').textContent='';document.getElementById('complete').disabled=false;
 start();
}
document.getElementById('complete').onclick=completeFirstAgent;
const duration=Math.max(1100,Math.min(2600,(Math.max(...packets.map(x=>x.length))+40)*14))*1.25;
const packetInterval=duration*.375; // 50% longer than the previous duration / 4 interval.
const packetCycle=packetInterval*packetGroups;
function startCardShapeMotion(){
 cardShapeAnimations.clear();
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 cardDemo.querySelectorAll('.agent-card').forEach((card,index)=>{
  const shape=card.querySelector('.agent-rolling-shape');
  if(!shape||card.dataset.state!=='running')return;
  const turns=index===2?3:index===3?6:4;
  const frames=[{transform:'rotate(0deg)',offset:0}];
  for(let step=1;step<=turns;step++){
   frames.push({transform:`rotate(${(step-1)*360/turns}deg)`,offset:(step-1+.18)/turns,easing:'cubic-bezier(.23,1,.32,1)'});
   frames.push({transform:`rotate(${step*360/turns}deg)`,offset:(step-.08)/turns});
   frames.push({transform:`rotate(${step*360/turns}deg)`,offset:step/turns});
  }
  const motion=shape.animate(frames,{duration:turns*900,iterations:Infinity,easing:'linear'});
  motion.playbackRate=Number(document.getElementById('speed').value);if(paused)motion.pause();
  cardShapeAnimations.set(index,motion);animations.push(motion);
 });
}
function start(){animations.forEach(a=>a.cancel());animations.length=0;const epoch=document.timeline.currentTime;
startCardShapeMotion();
for(const label of document.querySelectorAll('.heading-copy')){
 const a=label.animate([{backgroundPosition:'100% 0',offset:0},{backgroundPosition:'100% 0',offset:.12},{backgroundPosition:'0% 0',offset:.88},{backgroundPosition:'0% 0',offset:1}],{duration:1800,iterations:Infinity,easing:'linear'});
 a.startTime=epoch;a.playbackRate=Number(document.getElementById('speed').value);if(paused)a.pause();animations.push(a);
}
for(const packet of packets){if(firstAgentCompleted&&packet.agentIndex===0)continue;const {p,length,mode}=packet;const frames=mode==='current'?[{opacity:0,offset:0},{opacity:1,offset:.02},{opacity:1,offset:.55},{opacity:.4,offset:.8},{opacity:0,offset:1}]:[{opacity:0,offset:0},{opacity:1,offset:.06},{opacity:1,offset:.8},{opacity:0,offset:.9},{opacity:0,offset:1}];const cycleFrames=frames.map(frame=>({...frame,offset:frame.offset*duration/packetCycle}));cycleFrames.push({opacity:0,offset:1});const a=p.animate(cycleFrames,{duration:packetCycle,delay:packet.group*packetInterval,iterations:Infinity,easing:'linear'});a.startTime=epoch;a.playbackRate=Number(document.getElementById('speed').value);if(paused)a.pause();packet.animation=a;animations.push(a);}document.getElementById('play').textContent=paused?'Play':'Pause';}
// Keep the original travel timing; move each tail gradient with its packet.
const alignedTravel=Math.max(...packets.filter(packet=>packet.mode==='aligned').map(packet=>packet.length))+28;
function drawPackets(){
 for(const {p,gradient,route,length,mode,group,animation} of packets){
  if(!animation)continue;
  const elapsed=(animation.currentTime||0)-group*packetInterval;
  if(elapsed<0){p.setAttribute('d','');continue;}
  const phase=(elapsed%packetCycle)/duration;
  if(phase>=1){p.setAttribute('d','');continue;}
  const travel=mode==='aligned'?alignedTravel*Math.min(phase/.85,1):-2+(length+2)*dispatchEase(phase);
  const tailLength=40*(1-Math.max(0,(phase-.55)/.45));
  const end=Math.min(length,travel),begin=Math.max(0,travel-tailLength);
  if(begin>=end){p.setAttribute('d','');continue;}
  const points=[];
  for(let distance=begin;distance<end;distance+=.5)points.push(route.getPointAtLength(distance));
  points.push(route.getPointAtLength(end));
  const tail=points[0],head=points[points.length-1];
  gradient.setAttribute('x1',tail.x);gradient.setAttribute('y1',tail.y);
  gradient.setAttribute('x2',head.x);gradient.setAttribute('y2',head.y);
  p.setAttribute('d',points.map((point,i)=>`${i?'L':'M'}${point.x} ${point.y}`).join(' '));
 }
 requestAnimationFrame(drawPackets);
}
requestAnimationFrame(drawPackets);
document.getElementById('play').onclick=()=>{paused=!paused;animations.forEach(a=>paused?a.pause():a.play());document.getElementById('play').textContent=paused?'Play':'Pause';};document.getElementById('replay').onclick=replayAgents;document.getElementById('speed').onchange=e=>animations.forEach(a=>a.updatePlaybackRate(Number(e.target.value)));start();


