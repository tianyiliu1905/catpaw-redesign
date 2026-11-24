const percentageCases=[
 {name:'A · Count up',kind:'linear'},
 {name:'B · Ease out',kind:'smooth'},
 {name:'C · Continuous odometer',kind:'odometer'},
 {name:'D · Eased updates',kind:'eased-updates'},
 {name:'E · Number flow',kind:'number-flow'},
 {name:'F · Blur steps',kind:'blur-steps'}
];
const percentageGrid=document.querySelector('.percentage-experiments');
const percentageReduced=matchMedia('(prefers-reduced-motion: reduce)');
for(const item of percentageCases){
 const panel=document.createElement('section');panel.className='comparison';panel.dataset.kind=item.kind;
 panel.innerHTML=`<div class="conversation"><div class="percentage-demo"><div class="percentage-value"><span class="percentage-number">0</span><span class="percentage-sign">%</span></div><p class="percentage-label">Completed</p>${item.kind==='progress'?'<div class="percentage-track" role="progressbar" aria-label="Completion" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="percentage-fill"></div></div>':''}</div></div><h2 class="case-caption">${item.name}</h2>`;
 percentageGrid.append(panel);
}
const odometerNumber=percentageGrid.querySelector('[data-kind="odometer"] .percentage-number');
odometerNumber.classList.add('percentage-odometer');
odometerNumber.setAttribute('aria-label','0');
for(const place of [100,10,1]){
 const window=document.createElement('span');window.className='odometer-window';window.dataset.place=String(place);window.setAttribute('aria-hidden','true');
 const strip=document.createElement('span');strip.className='odometer-strip';
 for(let digit=0;digit<=Math.ceil(100/place);digit++){
  const face=document.createElement('span');face.textContent=String(digit%10);strip.append(face);
 }
 window.append(strip);odometerNumber.append(window);
}
// Remove the initial plain-text zero after constructing the digit drums.
for(const node of [...odometerNumber.childNodes])if(node.nodeType===3)node.remove();
const numberFlowNode=percentageGrid.querySelector('[data-kind="number-flow"] .percentage-number');
numberFlowNode.classList.add('percentage-number-flow');
numberFlowNode.textContent='';
const numberFlowAnimations=new Set();
let numberFlowValue=null;
for(let i=0;i<3;i++){
 const digit=document.createElement('span');digit.className='number-flow-digit';digit.setAttribute('aria-hidden','true');
 numberFlowNode.append(digit);
}
function flowAnimate(node,frames,duration=700){
 const animation=node.animate(frames,{duration,easing:'cubic-bezier(.23,1,.32,1)',fill:'both'});
 animation.playbackRate=Number(document.getElementById('speed').value);
 if(percentagePaused)animation.pause();
 numberFlowAnimations.add(animation);
 animation.finished.then(()=>numberFlowAnimations.delete(animation),()=>numberFlowAnimations.delete(animation));
 return animation;
}
function renderNumberFlow(value,instant=false){
 if(value===numberFlowValue)return;
 const old=String(numberFlowValue??value).padStart(3,' '),next=String(value).padStart(3,' ');
 numberFlowValue=value;numberFlowNode.setAttribute('aria-label',`${value} percent`);
 for(const [index,window] of [...numberFlowNode.children].entries()){
  if(!instant&&old[index]===next[index]&&window.firstElementChild)continue;
  window.getAnimations({subtree:true}).forEach(animation=>animation.cancel());
  const strip=document.createElement('span');strip.className='number-flow-strip';
  const from=Number(old[index]),to=Number(next[index]);
  const distance=(to-from+10)%10;
  const rolling=!instant&&!percentageReduced.matches&&old[index]!==' '&&next[index]!==' ';
  for(let step=0;step<=(rolling?distance:0);step++){
   const face=document.createElement('span');face.textContent=String(rolling?(from+step)%10:to);strip.append(face);
  }
  window.replaceChildren(strip);window.style.opacity=next[index]===' '?'0':'1';
  if(rolling){
   strip.style.transform=`translateY(${-distance}em)`;
   flowAnimate(strip,[{transform:'translateY(0)'},{transform:`translateY(${-distance}em)`}]);
  }else if(!instant&&!percentageReduced.matches&&next[index]!==' '){
   flowAnimate(window,[{opacity:0},{opacity:1}]);
  }
 }
}
function renderBlurPercentage(node,value,instant=false){
 const previous=node.dataset.value;
 if(previous!==undefined&&Number(previous)===value)return;
 const old=String(previous??value).padStart(3,' '),next=String(value).padStart(3,' ');
 node.dataset.value=String(value);
 node.classList.add('percentage-blur-value');
 node.setAttribute('aria-label',String(value));
 if(!node.querySelector('.blur-digit')){
  node.textContent='';
  for(let i=0;i<3;i++){
   const digit=document.createElement('span');digit.className='blur-digit';digit.setAttribute('aria-hidden','true');node.append(digit);
  }
 }
 for(const [index,digit] of [...node.children].entries()){
  if(!instant&&old[index]===next[index]&&digit.firstElementChild)continue;
  digit.getAnimations({subtree:true}).forEach(animation=>animation.cancel());
  const incoming=document.createElement('span');incoming.textContent=next[index]===' '?'\u00a0':next[index];
  digit.replaceChildren(incoming);
  if(previous===undefined||instant||percentageReduced.matches)continue;
  const outgoing=document.createElement('span');outgoing.textContent=old[index]===' '?'\u00a0':old[index];digit.prepend(outgoing);
  flowAnimate(outgoing,[{opacity:1,filter:'blur(0px)'},{opacity:0,filter:'blur(4px)'}],240);
  const entry=flowAnimate(incoming,[{opacity:0,filter:'blur(6px)'},{opacity:1,filter:'blur(0px)'}],480);
  entry.finished.then(()=>outgoing.remove(),()=>outgoing.remove());
 }
}
let percentageTime=0,percentagePlaying=false,percentagePaused=false,percentageFrame=null,percentageLast=0;
const percentageDuration=8000;
const blurProgressSteps=[0,8,17,26,34,41,48,49,58,67,79,88,96,100];
const percentageRunDuration=Math.max(percentageDuration,(blurProgressSteps.length-1)*2000);
function paintPercentage(instant=false){
 const fraction=Math.min(1,percentageTime/percentageDuration);
 for(const panel of percentageGrid.children){
  const eased=panel.dataset.kind==='smooth'?1-Math.pow(1-fraction,3):fraction;
  const value=panel.dataset.kind==='steps'?Math.floor(eased*10)*10:Math.round(eased*100);
  const number=panel.querySelector('.percentage-number');
  if(panel.dataset.kind==='odometer'){
   const position=percentageReduced.matches?value:fraction*100;
   number.setAttribute('aria-label',String(Math.round(position)));
   for(const window of number.children){
    const place=Number(window.dataset.place);
    const roll=place===1?position:Math.floor(position/place)+Math.max(0,position%place-(place-1));
    window.querySelector('.odometer-strip').style.transform=`translateY(${-roll}em)`;
    window.style.opacity=place===1||position>place-1?'1':'0';
   }
  }else if(panel.dataset.kind==='blur-steps'){
   renderBlurPercentage(number,blurProgressSteps[Math.min(blurProgressSteps.length-1,Math.floor(percentageTime/2000))],instant);
  }else if(panel.dataset.kind==='number-flow'){
   renderNumberFlow([0,17,43,68,84,100][Math.min(5,Math.floor(fraction*5))]);
  }else if(panel.dataset.kind==='eased-updates'){
   const segment=Math.min(3,Math.floor(fraction*4));
   const local=Math.min(1,fraction*4-segment);
   number.textContent=String(Math.round(segment*25+25*(1-Math.pow(1-local,3))));
  }else number.textContent=String(value);
  const fill=panel.querySelector('.percentage-fill');
  if(fill){fill.style.transform=`scaleX(${percentageReduced.matches?value/100:fraction})`;panel.querySelector('.percentage-track').setAttribute('aria-valuenow',String(value));}
 }
}
function percentageTick(now){
 const elapsed=Math.min(100,Math.max(0,now-percentageLast));percentageLast=now;
 if(!percentagePlaying)return;
 if(!percentagePaused&&!document.hidden){percentageTime=Math.min(percentageRunDuration,percentageTime+elapsed*Number(document.getElementById('speed').value));paintPercentage();}
 if(percentageTime>=percentageRunDuration){percentagePlaying=false;document.getElementById('play').textContent='Autoplay';return;}
 percentageFrame=requestAnimationFrame(percentageTick);
}
function replayPercentage(){for(const animation of numberFlowAnimations)animation.cancel();numberFlowAnimations.clear();numberFlowValue=null;renderNumberFlow(0,true);percentageTime=0;paintPercentage(true);}
document.getElementById('play').onclick=()=>{
 if(percentagePlaying){percentagePaused=!percentagePaused;}
 else{replayPercentage();percentagePlaying=true;percentagePaused=false;percentageLast=performance.now();cancelAnimationFrame(percentageFrame);percentageFrame=requestAnimationFrame(percentageTick);}
 document.getElementById('play').textContent=percentagePaused?'Resume':'Pause';document.getElementById('pause').textContent=percentagePaused?'Resume':'Pause';for(const animation of numberFlowAnimations)percentagePaused?animation.pause():animation.play();
};
document.getElementById('replay').onclick=replayPercentage;
document.getElementById('pause').onclick=()=>{percentagePaused=!percentagePaused;document.getElementById('pause').textContent=percentagePaused?'Resume':'Pause';if(percentagePlaying)document.getElementById('play').textContent=percentagePaused?'Resume':'Pause';for(const animation of numberFlowAnimations)percentagePaused?animation.pause():animation.play();};
paintPercentage();

document.getElementById('speed').addEventListener('change',()=>{for(const animation of numberFlowAnimations)animation.updatePlaybackRate(Number(document.getElementById('speed').value));});
