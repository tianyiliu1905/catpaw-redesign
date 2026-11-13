'use strict';
const variants = [
 {id:'left',name:'A · Slide left',note:'Current demo: progress exits first, then the tool slides left. New content enters from the right.',timing:'Sequential exit / Slide left',out:'translateX(-14px)',from:'translateX(8px)'},
 {id:'up',name:'B · Slide up',note:'Roll tool calls upward within their own clipped row; progress text fades in place.',timing:'In-place tool roll',out:'translateY(-8px)',from:'translateY(8px)'},
 {id:'scale',name:'C · Subtle scale',note:'Gently shrink the old content and bring the next state in at 98% scale.',timing:'Sequential exit / Subtle scale',out:'scale(.98)',from:'scale(.98)'},
 {id:'blur',name:'D · Blur reveal',note:'Reveal content from left to right as it comes into focus.',timing:'Sequential exit / 2px blur',out:'none',from:'none',blur:true}
];
const workProgress='Reviewing this week’s store fulfillment exceptions to identify priority issues and follow-up actions.';
const frames = [
 {label:'Reading',progress:workProgress,tool:'Check arrival and preparation timestamps',detail:'Read this week’s orders and check arrival times, preparation times, and missing records.',icon:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>'},
 {label:'Analyzing',progress:workProgress,tool:'Compare delays and affected orders',detail:'Group exceptions by store and time slot, prioritizing evening peaks, recurring issues, and wider impact.',icon:'<path d="M4 20h16M7 16v-5m5 5V5m5 11V8"/>'},
 {label:'Preparing',progress:workProgress,tool:'Prepare exception details and follow-up actions',detail:'Prepare the exception report with data sources, causes, and items that need confirmation.',icon:'<path d="M12 3v12m-4-4 4 4 4-4M5 15v5h14v-5"/>'},
 {label:'Completed',result:true}
];
const $ = id => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let index=0, target=0, playing=false, busy=false, paused=false, resumeAuto=false, serial=0, animations=[], timer=null, holdRemaining=1600, holdStarted=0;
const grid=$('comparisons');
for(const variant of variants){
 const card=document.createElement('section');card.className='comparison';card.dataset.variant=variant.id;
 card.innerHTML=`<div class="conversation"><div class="viewport"></div></div><h2 class="case-caption">${variant.name}</h2>`;
 grid.append(card);
}
function layer(frame){
 const node=document.createElement('div');node.className='layer'+(frame.result?' result':'');
 node.innerHTML=frame.result?'<p class="result-copy">Review complete. Five exceptions need priority follow-up, with a focus on evening delays and delivery capacity. Records requiring confirmation and follow-up actions are included in the report.</p><div class="artifact"><span class="file-icon" aria-hidden="true">X</span><span><strong>Store fulfillment exceptions.xlsx</strong><small>Output</small></span></div>':`<p class="progress">${frame.progress}</p><details class="tool"><summary><svg viewBox="0 0 24 24" aria-hidden="true">${frame.icon}</svg><span class="tool-label">${frame.tool}</span></summary><p>${frame.detail}</p></details>`;
 return node;
}
function rate(){return Number($('speed').value)}
function baseIndex(){return $('scene').value==='result'?2:0}
function reserveResultHeight(){
 const probes=[...grid.children].map(card=>{
  const viewport=card.querySelector('.viewport'),probe=layer(frames[frames.length-1]);
  probe.style.visibility='hidden';probe.inert=true;probe.setAttribute('aria-hidden','true');
  viewport.append(probe);return {viewport,probe};
 });
 const heights=probes.map(({probe})=>Math.ceil(probe.getBoundingClientRect().height));
 probes.forEach(({viewport,probe},i)=>{probe.remove();viewport.style.minHeight=`${heights[i]}px`;});
}
function render(preserveRoll=false){
 for(const card of grid.children){
  const viewport=card.querySelector('.viewport'),finishRoll=viewport.firstElementChild?.finishRoll;
  if(preserveRoll&&card.dataset.variant==='up'&&finishRoll)finishRoll();
  else viewport.replaceChildren(layer(frames[index]));
 }
 reserveResultHeight();
 target=index;sync();
}
function sync(){
 grid.style.setProperty('--shimmer-duration','1800ms');
 grid.classList.toggle('is-motion-paused',paused);
 $('play').textContent=busy?(paused?'Resume':'Pause'):(playing?'Pause':'Autoplay');
 $('next').disabled=busy||index===frames.length-1;
 $('status').textContent=(busy?'Transitioning':frames[index].label)+(busy&&paused?' · Paused':'');
}
function clearHold(){if(timer!==null){clearTimeout(timer);timer=null;holdRemaining=Math.max(0,holdRemaining-(performance.now()-holdStarted));}}
function stop(){resumeAuto=playing;paused=true;playing=false;clearHold();animations.forEach(a=>a.pause());sync();}
function schedule(){
 if(!playing||busy)return;
 if(index===frames.length-1){playing=false;sync();return;}
 holdStarted=performance.now();timer=setTimeout(()=>{timer=null;holdRemaining=1600;transition(index+1)},holdRemaining);
}
function animate(node,variant,enter,delay,duration){
 const normal={opacity:1,transform:'none',filter:'blur(0px)'};
 const hidden={opacity:0,transform:enter?variant.from:variant.out,filter:variant.blur?'blur(2px)':'blur(0px)'};
 if(variant.blur&&enter){hidden.clipPath='inset(0 100% 0 0)';normal.clipPath='inset(0 0 0 0)';}
 const a=node.animate(enter?[hidden,normal]:[normal,hidden],{duration,delay,easing:enter?'cubic-bezier(.22,.68,0,1)':'cubic-bezier(.4,0,.6,1)',fill:'both'});
 a.playbackRate=rate();animations.push(a);return a;
}
// Each successive gap gets smaller, approaching the total spread smoothly.
function rollingStagger(index,firstGap,spread){return spread*(-Math.expm1(-index*firstGap/spread));}
function rollTool(old, incoming, viewport, variant){
 const textSlot=document.createElement('div'),toolSlot=document.createElement('div'),wrapper=document.createElement('div');
 wrapper.className='layer';wrapper.inert=true;
 textSlot.className='roll-text';toolSlot.className='tool-roll-slot';
 const oldText=old.querySelector('.progress'),newText=incoming.querySelector('.progress');
 const oldTool=old.querySelector('.tool'),newTool=incoming.querySelector('.tool');
 oldText.setAttribute('aria-hidden','true');oldTool.setAttribute('aria-hidden','true');
 oldTool.open=false;newTool.open=false;
 const textChanges=oldText.textContent!==newText.textContent;
 if(textChanges)textSlot.append(oldText,newText);else textSlot.append(newText);
 toolSlot.append(oldTool,newTool);
 wrapper.append(textSlot,toolSlot);viewport.replaceChildren(wrapper);
 const fade={...variant,out:'none',from:'none'};
 if(textChanges){animate(oldText,fade,false,0,220);animate(newText,fade,true,120,220);}
 const label=newTool.querySelector('.tool-label'),text=label.textContent;
 label.classList.add('rolling-label');label.setAttribute('aria-label',text);label.replaceChildren();
 const letters=[];
 for(const word of text.split(/(\s+)/)){
  if(!word)continue;
  if(/^\s+$/.test(word)){label.append(document.createTextNode(word));continue;}
  const group=document.createElement('span');group.className='roll-word';group.setAttribute('aria-hidden','true');
  for(const character of Array.from(word)){
   const letter=document.createElement('span');letter.className='roll-letter';letter.textContent=character;group.append(letter);letters.push(letter);
  }
  label.append(group);
 }
 const roll=(node,from,to,delay,duration,fade=false)=>{
  const a=node.animate([{transform:from,opacity:fade?0:1},{transform:to,opacity:1}],{duration,delay,easing:'cubic-bezier(.32,.72,0,1)',fill:'both'});
  a.playbackRate=rate();animations.push(a);
 };
 roll(oldTool,'translateY(0)','translateY(-100%)',120,420);
 for(const icon of newTool.querySelectorAll('summary > svg'))roll(icon,'translateY(110%)','translateY(0)',120,420,true);
 letters.forEach((letter,i)=>roll(letter,'translateY(110%)','translateY(0)',120+rollingStagger(i,5,110),360+rollingStagger(i,2,60),true));
 // Keep the settled row and its word layout instead of rebuilding it after the roll.
 wrapper.finishRoll=()=>{
  oldTool.remove();oldText.remove();
  wrapper.inert=false;
  label.classList.remove('rolling-label');
  delete wrapper.finishRoll;
 };

}
function revealResult(incoming,variant){
 const summary=incoming.querySelector('.result-copy'),artifact=incoming.querySelector('.artifact');
 const reveal=(node,from,to,delay,duration)=>{
  const a=node.animate([from,to],{delay,duration,easing:'cubic-bezier(.22,.68,0,1)',fill:'both'});
  a.playbackRate=rate();animations.push(a);
 };
 if(variant.id==='left'){
  reveal(summary,{opacity:0,transform:'translateX(10px)'},{opacity:1,transform:'translateX(0)'},260,300);
  reveal(artifact,{opacity:0,transform:'translateX(18px)'},{opacity:1,transform:'translateX(0)'},430,360);
 }else if(variant.id==='up'){
  const text=summary.textContent;summary.setAttribute('aria-label',text);summary.replaceChildren();
  let i=0;
  for(const token of text.split(/(\s+)/)){
   if(!token)continue;
   if(/^\s+$/.test(token)){summary.append(document.createTextNode(token));continue;}
   const mask=document.createElement('span'),word=document.createElement('span');
   mask.className='result-roll-word';mask.setAttribute('aria-hidden','true');word.textContent=token;
   mask.append(word);summary.append(mask);
   reveal(word,{opacity:0,transform:'translateY(110%)'},{opacity:1,transform:'translateY(0)'},260+rollingStagger(i++,12,150),380);
  }
  reveal(artifact,{opacity:0,transform:'translateY(22px)',clipPath:'inset(0 0 100% 0)'},{opacity:1,transform:'translateY(0)',clipPath:'inset(0 0 0 0)'},500,420);
 }else if(variant.id==='scale'){
  summary.style.transformOrigin='left top';artifact.style.transformOrigin='center top';
  reveal(summary,{opacity:0,transform:'scale(.98)'},{opacity:1,transform:'scale(1)'},260,360);
  reveal(artifact,{opacity:0,transform:'scale(.94)'},{opacity:1,transform:'scale(1)'},460,440);
 }else{
  reveal(summary,{opacity:0,filter:'blur(3px)',clipPath:'inset(0 100% 0 0)'},{opacity:1,filter:'blur(0)',clipPath:'inset(0 0 0 0)'},260,500);
  reveal(artifact,{opacity:0,filter:'blur(5px)',clipPath:'inset(0 100% 0 0)'},{opacity:1,filter:'blur(0)',clipPath:'inset(0 0 0 0)'},540,500);
 }
}
async function transition(next){
 if(busy)return;
 clearHold();busy=true;paused=false;target=next;const run=++serial;
 if(reduced.matches){index=next;busy=false;render();schedule();return;}
 for(const variant of variants){
  const card=grid.querySelector(`[data-variant="${variant.id}"]`),viewport=card.querySelector('.viewport'),old=viewport.firstElementChild,incoming=layer(frames[next]);
  if(variant.id==='up'&&!frames[index].result&&!frames[next].result){rollTool(old,incoming,viewport,variant);continue;}
  old.inert=true;old.setAttribute('aria-hidden','true');incoming.inert=true;viewport.append(incoming);
  incoming.style.transformOrigin=old.style.transformOrigin='left top';
  const cross=variant.id==='fade';
  if(frames[next].result){
   animate(old,variant,false,0,260);revealResult(incoming,variant);
  }else{
   const textChanges=frames[index].progress!==frames[next].progress;
   if(textChanges){
    animate(old.querySelector('.progress'),variant,false,0,240);
    animate(incoming.querySelector('.progress'),variant,true,cross?120:500,220);
   }else old.querySelector('.progress').style.visibility='hidden';
   animate(old.querySelector('.tool'),variant,false,textChanges&&!cross?240:0,260);
   animate(incoming.querySelector('.tool'),variant,true,textChanges?(cross?190:570):260,260);
  }
 }
 // A manual next-step plays once; pausing during a transition freezes every comparison.
 sync();
 await Promise.allSettled(animations.map(a=>a.finished));
 if(run!==serial)return;
 animations.forEach(a=>a.cancel());animations=[];index=next;busy=false;render(true);holdRemaining=1600;schedule();
}
$('next').onclick=()=>transition(index+1);
$('play').onclick=()=>{
 if(busy){
  if(paused){paused=false;playing=resumeAuto;animations.forEach(a=>a.play());sync();}
  else stop();
  return;
 }
 if(playing){stop();return;}
 if(index===frames.length-1&&!busy){index=baseIndex();render();}
 paused=false;playing=true;animations.forEach(a=>a.play());sync();schedule();
};
function reset(){serial++;clearHold();animations.forEach(a=>a.cancel());animations=[];busy=false;paused=false;playing=false;index=baseIndex();holdRemaining=1600;render();}
$('reset').onclick=reset;$('scene').onchange=reset;
// Playback speed affects transitions only; holds keep their wall-clock duration.
$('speed').onchange=()=>{
 animations.forEach(a=>a.updatePlaybackRate(rate()));sync();
};
let resizeFrame;
window.addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(reserveResultHeight);});
reduced.addEventListener('change',reset);
render();
