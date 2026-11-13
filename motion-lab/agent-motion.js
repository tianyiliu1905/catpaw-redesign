const ns='http://www.w3.org/2000/svg', animations=[];let paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
const names=['Check delay duration','Assess impact','Investigate recurring issues','Review findings'];

let firstAgentCompleted=false, firstProgress=0, selectedCapsule=0, selectedConstellation=0;
const packets=[];
for(const panel of document.querySelectorAll('.panel[data-mode="current"]')){
const demo=panel.querySelector('.demo');demo.innerHTML='<div class="heading"><img src="assets/subagent-figma.svg" alt=""><span class="heading-copy">Calling subagents to analyze store exceptions</span></div><div class="rows">'+names.map(n=>`<div class="row"><span class="agent-icon" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 5.33333V2.66667H5.33333" stroke-width="1.12" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor"/><path d="M4 5.33333H12C12.7364 5.33333 13.3333 5.93029 13.3333 6.66667V12C13.3333 12.7364 12.7364 13.3333 12 13.3333H4C3.26362 13.3333 2.66667 12.7364 2.66667 12V6.66667C2.66667 5.93029 3.26362 5.33333 4 5.33333Z" stroke-width="1.12" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor"/><path d="M1.33333 9.33333H2.66667" stroke-width="1.12" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor"/><path d="M13.3333 9.33333H14.6667" stroke-width="1.12" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor"/><path d="M10 8.66667V10" stroke-width="1.12" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor"/><path d="M6 8.66667V10" stroke-width="1.12" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor"/></svg></span><span>${n}</span></div>`).join('')+'</div>';
const svg=document.createElementNS(ns,'svg');demo.append(svg);
const syncStemTop=()=>{svg.style.top=`${demo.querySelector('.heading').offsetHeight+4}px`;};
syncStemTop();
new ResizeObserver(syncStemTop).observe(demo);
const defs=document.createElementNS(ns,'defs'),baseLayer=document.createElementNS(ns,'g'),motionLayer=document.createElementNS(ns,'g');svg.append(defs,baseLayer,motionLayer);
const svgTop=svg.getBoundingClientRect().top;
const routes=[...demo.querySelectorAll('.row')].map(row=>{const rect=row.getBoundingClientRect();const y=rect.top+rect.height/2-svgTop;const endX=row.querySelector('.agent-icon').getBoundingClientRect().left-svg.getBoundingClientRect().left;return `M9.5 0V${y-8}Q9.5 ${y} 17.5 ${y}H${endX}`;});
routes.forEach((d,i)=>{
 const base=document.createElementNS(ns,'path');base.setAttribute('d',d);base.setAttribute('class','base');baseLayer.append(base);
 if(i===3)return;
 const length=base.getTotalLength();
 for(let group=0;group<2;group++){
  const p=base.cloneNode(),gradient=document.createElementNS(ns,'linearGradient');
  const id=`packet-tail-${panel.dataset.mode}-${i}-${group}`;
  gradient.id=id;gradient.setAttribute('gradientUnits','userSpaceOnUse');
  for(const [offset,opacity] of [[0,0],[.18,.35],[.4,.8],[.55,1],[1,1]]){
   const stop=document.createElementNS(ns,'stop');stop.setAttribute('offset',offset);stop.setAttribute('stop-color','#a6a6a6');stop.setAttribute('stop-opacity',opacity);gradient.append(stop);
  }
  defs.append(gradient);p.setAttribute('class','packet');p.style.stroke=`url(#${id})`;p.setAttribute('d','');motionLayer.append(p);
  packets.push({p,gradient,route:base,length,mode:panel.dataset.mode,group,agentIndex:i});
 }
});
}
const cardDemo=document.querySelector('.agent-cards-demo');
const taskDescriptions=[
 'Check arrival and preparation timestamps to identify the longest delays.',
 'Compare affected orders by store and time slot to assess the impact.',
 'Find recurring exceptions and compare their common causes.',
 'Cross-check the findings after the other agents complete their analysis.'
];
const agentIcon=document.querySelector('.row .agent-icon').innerHTML;
cardDemo.innerHTML='<div class="heading"><img src="assets/subagent-figma.svg" alt=""><span class="heading-copy">Calling subagents to analyze store exceptions</span></div><div class="agent-card-grid">'+names.map((name,i)=>`
 <button class="agent-card" type="button" data-agent-index="${i}" data-state="${i===3?'queued':'running'}" aria-expanded="false" aria-controls="agentCardDetail">
  <span class="agent-card-top"><span class="agent-icon" aria-hidden="true">${agentIcon}</span><span class="agent-card-state"><span class="agent-state-copy">${i===3?'Waiting':'Running'}</span><svg class="agent-card-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></span></span>
  <span class="agent-card-name">${name}</span><span class="agent-card-action"></span>
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
  detail.querySelector('.agent-detail-status').textContent=i===0&&firstAgentCompleted?'Completed · Delay analysis is ready':i===3?'Waiting for the first three agents':'Working independently · Analysis in progress';
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
 ['Waiting for other agents','Waiting for other agents','Waiting for other agents','Waiting for other agents']
];
const headingMarkup='<div class="heading"><img src="assets/subagent-figma.svg" alt=""><span class="heading-copy">Calling subagents to analyze store exceptions</span></div>';
const capsulesDemo=document.querySelector('.agent-capsules-demo');
const activityDemo=document.querySelector('.agent-activity-demo');
capsulesDemo.innerHTML=headingMarkup+'<div class="agent-capsules" aria-label="Select an agent">'+names.map((name,i)=>`<button type="button" class="agent-chip" data-agent-index="${i}" aria-pressed="${i===0}"><span class="agent-icon" aria-hidden="true">${agentIcon}</span><span>${name}</span><span class="chip-done" aria-hidden="true" hidden>✓</span></button>`).join('')+'</div>';
const constellationPaths=['M50 50C30 50 12 40 12 16','M50 50C70 50 88 40 88 16','M50 50C30 50 12 60 12 84','M50 50C70 50 88 60 88 84'];
const constellationLabels=['Delay check','Impact','Recurring issues','Review'];
activityDemo.innerHTML=headingMarkup+`<div class="agent-constellation"><svg class="constellation-wires" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${constellationPaths.map((d,i)=>`<path class="constellation-wire" data-agent-index="${i}" d="${d}"/><path class="constellation-signal" data-agent-index="${i}" pathLength="100" d="${d}"/>`).join('')}</svg><div class="constellation-hub"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H6V3h1m7 0v5h4M9 12h6m-6 4h4"/></svg><strong>Store exceptions</strong><span class="hub-result">Collecting findings</span></div>${names.map((name,i)=>`<button class="constellation-agent" data-agent-index="${i}" type="button" aria-pressed="${i===0}" aria-label="${name}" aria-controls="constellationReadout"><span class="agent-icon" aria-hidden="true">${agentIcon}</span><span class="constellation-agent-name">${constellationLabels[i]}</span><span class="constellation-agent-state"></span></button>`).join('')}</div><div class="constellation-readout" id="constellationReadout" aria-live="polite"><span class="readout-mark" aria-hidden="true"></span><span><strong></strong><span class="readout-action"></span></span></div>`;
activityDemo.querySelector('.agent-constellation').addEventListener('click',event=>{
 const agent=event.target.closest('.constellation-agent');if(!agent)return;
 selectedConstellation=Number(agent.dataset.agentIndex);syncProgressDisplays();
});
function agentProgress(i){return i===0?(firstAgentCompleted?3:firstProgress):i===1?1:i===2?0:-1;}
function currentAction(i){const phase=agentProgress(i);return stageActions[i][Math.max(0,phase)];}
function syncProgressDisplays(){
 cardDemo.querySelectorAll('.agent-card').forEach((card,i)=>{card.querySelector('.agent-card-action').textContent=currentAction(i);});
 capsulesDemo.querySelectorAll('.agent-chip').forEach((chip,i)=>{
  chip.setAttribute('aria-pressed',String(i===selectedCapsule));
  chip.dataset.state=i===3?'queued':agentProgress(i)===3?'done':'running';
  chip.querySelector('.chip-done').hidden=agentProgress(i)!==3;
 });
 activityDemo.querySelectorAll('.constellation-agent').forEach((agent,i)=>{
  const state=agentProgress(i)<0?'queued':agentProgress(i)===3?'done':'running';
  agent.dataset.state=state;agent.setAttribute('aria-pressed',String(i===selectedConstellation));
  agent.querySelector('.constellation-agent-state').textContent=state==='done'?'Findings ready':state==='queued'?'Waiting':'Working';
  for(const path of activityDemo.querySelectorAll(`.constellation-wires [data-agent-index="${i}"]`))path.dataset.state=state;
 });
 const readout=activityDemo.querySelector('.constellation-readout');
 readout.querySelector('strong').textContent=names[selectedConstellation];
 readout.querySelector('.readout-action').textContent=currentAction(selectedConstellation);
 readout.dataset.state=agentProgress(selectedConstellation)===3?'done':agentProgress(selectedConstellation)<0?'queued':'running';
 activityDemo.querySelector('.hub-result').textContent=firstAgentCompleted?'Delay findings received':'Collecting findings';
 activityDemo.querySelector('.constellation-hub').classList.toggle('has-result',firstAgentCompleted);
 document.getElementById('advance').disabled=firstProgress>=2||firstAgentCompleted;
}
capsulesDemo.querySelector('.agent-capsules').addEventListener('click',event=>{
 const chip=event.target.closest('.agent-chip');if(!chip)return;
 selectedCapsule=Number(chip.dataset.agentIndex);syncProgressDisplays();
});
document.getElementById('advance').onclick=()=>{if(firstAgentCompleted)return;firstProgress=Math.min(2,firstProgress+1);syncProgressDisplays();};
syncProgressDisplays();
function handoffFinding(){
 const graph=activityDemo.querySelector('.agent-constellation');
 const node=graph.querySelector('.constellation-agent'),hub=graph.querySelector('.constellation-hub');
 const box=graph.getBoundingClientRect(),from=node.getBoundingClientRect(),to=hub.getBoundingClientRect();
 const note=document.createElement('span');note.className='finding-handoff';note.textContent='Finding ready';note.setAttribute('aria-hidden','true');graph.append(note);
 const x=from.left+from.width/2-box.left,y=from.top+from.height/2-box.top;
 const dx=to.left+to.width/2-box.left,dy=to.top+to.height/2-box.top;
 const a=note.animate([{transform:`translate(${x}px,${y}px) translate(-50%,-50%) scale(.95)`,opacity:0},{transform:`translate(${x}px,${y}px) translate(-50%,-50%) scale(1)`,opacity:1,offset:.15},{transform:`translate(${dx}px,${dy}px) translate(-50%,-50%) scale(.95)`,opacity:0}],{duration:700,easing:'cubic-bezier(.32,.72,0,1)'});
 a.playbackRate=Number(document.getElementById('speed').value);if(paused)a.pause();animations.push(a);
 a.finished.then(()=>note.remove(),()=>note.remove());
}
function completeFirstAgent(){
 if(firstAgentCompleted)return;
 firstAgentCompleted=true;firstProgress=3;syncProgressDisplays();
 const row=document.querySelector('.rows .row'),card=cardDemo.querySelector('.agent-card');
 row.dataset.state='done';card.dataset.state='done';
 for(const route of new Set(packets.filter(packet=>packet.agentIndex===0).map(packet=>packet.route))){
  route.classList.add('is-complete');route.parentNode.append(route);
 }
 card.querySelector('.agent-state-copy').textContent='Completed';
 document.getElementById('complete').disabled=true;
 for(const packet of packets){
  if(packet.agentIndex!==0)continue;
  const i=animations.indexOf(packet.animation);if(i>=0)animations.splice(i,1);
  packet.animation?.cancel();packet.animation=null;packet.p.setAttribute('d','');
 }
 if(card.getAttribute('aria-expanded')==='true')detail.querySelector('.agent-detail-status').textContent='Completed · Delay analysis is ready';
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 handoffFinding();
 for(const icon of [row.querySelector('.agent-icon svg'),card.querySelector('.agent-icon svg'),capsulesDemo.querySelector('.agent-chip .agent-icon svg'),activityDemo.querySelector('.constellation-agent .agent-icon svg')]){
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
 firstAgentCompleted=false;firstProgress=0;selectedCapsule=0;selectedConstellation=0;closeAgentCard();syncProgressDisplays();
 for(const packet of packets)packet.route.classList.remove('is-complete');
 const row=document.querySelector('.rows .row'),card=cardDemo.querySelector('.agent-card');
 delete row.dataset.state;card.dataset.state='running';
 card.querySelector('.agent-state-copy').textContent='Running';document.getElementById('complete').disabled=false;
 start();
}
document.getElementById('complete').onclick=completeFirstAgent;
const duration=Math.max(1100,Math.min(2600,(Math.max(...packets.map(x=>x.length))+40)*14));
function start(){animations.forEach(a=>a.cancel());animations.length=0;const epoch=document.timeline.currentTime;
for(const label of document.querySelectorAll('.heading-copy')){
 const a=label.animate([{backgroundPosition:'100% 0',offset:0},{backgroundPosition:'100% 0',offset:.12},{backgroundPosition:'0% 0',offset:.88},{backgroundPosition:'0% 0',offset:1}],{duration:1800,iterations:Infinity,easing:'linear'});
 a.startTime=epoch;a.playbackRate=Number(document.getElementById('speed').value);if(paused)a.pause();animations.push(a);
}
for(const signal of activityDemo.querySelectorAll('.constellation-signal')){
 if(signal.dataset.state!=='running'||matchMedia('(prefers-reduced-motion: reduce)').matches)continue;
 const a=signal.animate([{strokeDashoffset:0},{strokeDashoffset:-110}],{duration:2200,iterations:Infinity,easing:'linear'});
 a.startTime=epoch;a.playbackRate=Number(document.getElementById('speed').value);if(paused)a.pause();animations.push(a);
}
for(const packet of packets){if(firstAgentCompleted&&packet.agentIndex===0)continue;const {p,length,mode}=packet;const frames=mode==='current'?[{opacity:0,offset:0},{opacity:1,offset:.06},{opacity:1,offset:.94},{opacity:0,offset:1}]:[{opacity:0,offset:0},{opacity:1,offset:.06},{opacity:1,offset:.8},{opacity:0,offset:.9},{opacity:0,offset:1}];const a=p.animate(frames,{duration,delay:packet.group*duration/2,iterations:Infinity,easing:'linear'});a.startTime=epoch;a.playbackRate=Number(document.getElementById('speed').value);if(paused)a.pause();packet.animation=a;animations.push(a);}document.getElementById('play').textContent=paused?'Play':'Pause';}
// Keep the original travel timing; move each tail gradient with its packet.
const alignedTravel=Math.max(...packets.filter(packet=>packet.mode==='aligned').map(packet=>packet.length))+28;
function drawPackets(){
 for(const {p,gradient,route,length,mode,group,animation} of packets){
  if(!animation)continue;
  const elapsed=(animation.currentTime||0)-group*duration/2;
  if(elapsed<0){p.setAttribute('d','');continue;}
  const phase=(elapsed%duration)/duration;
  const travel=mode==='aligned'?alignedTravel*Math.min(phase/.85,1):-2+(length+60)*phase;
  const end=Math.min(length,travel),begin=Math.max(0,travel-28);
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
