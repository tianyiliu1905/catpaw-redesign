const ns='http://www.w3.org/2000/svg', animations=[];let paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
const names=['Check delay duration','Assess impact','Investigate recurring issues','Review findings'];

const packets=[];
for(const panel of document.querySelectorAll('.panel')){
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
  packets.push({p,gradient,route:base,length,mode:panel.dataset.mode,group});
 }
});
}
const duration=Math.max(1100,Math.min(2600,(Math.max(...packets.map(x=>x.length))+40)*14));
function start(){animations.forEach(a=>a.cancel());animations.length=0;const epoch=document.timeline.currentTime;
for(const label of document.querySelectorAll('.heading-copy')){
 const a=label.animate([{backgroundPosition:'100% 0',offset:0},{backgroundPosition:'100% 0',offset:.12},{backgroundPosition:'0% 0',offset:.88},{backgroundPosition:'0% 0',offset:1}],{duration:1800,iterations:Infinity,easing:'linear'});
 a.startTime=epoch;a.playbackRate=Number(document.getElementById('speed').value);if(paused)a.pause();animations.push(a);
}
for(const packet of packets){const {p,length,mode}=packet;const frames=mode==='current'?[{opacity:0,offset:0},{opacity:1,offset:.06},{opacity:1,offset:.94},{opacity:0,offset:1}]:[{opacity:0,offset:0},{opacity:1,offset:.06},{opacity:1,offset:.8},{opacity:0,offset:.9},{opacity:0,offset:1}];const a=p.animate(frames,{duration,delay:packet.group*duration/2,iterations:Infinity,easing:'linear'});a.startTime=epoch;a.playbackRate=Number(document.getElementById('speed').value);if(paused)a.pause();packet.animation=a;animations.push(a);}document.getElementById('play').textContent=paused?'Play':'Pause';}
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
document.getElementById('play').onclick=()=>{paused=!paused;animations.forEach(a=>paused?a.pause():a.play());document.getElementById('play').textContent=paused?'Play':'Pause';};document.getElementById('replay').onclick=start;document.getElementById('speed').onchange=e=>animations.forEach(a=>a.updatePlaybackRate(Number(e.target.value)));start();
