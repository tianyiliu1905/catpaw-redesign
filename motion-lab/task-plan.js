'use strict';
const taskSets={
 3:['Check data consistency','Prioritize store follow-ups','Prepare recommendations and items for review'],
 8:['Check data consistency','Read order records','Verify order timestamps','Assess affected stores','Investigate recurring issues','Prioritize store follow-ups','Prepare recommendations','Review items needing confirmation']
};
let steps=taskSets[3];
const variants=[
 {id:'cascade',name:'A · Cascade',note:'Entrance: rise in row by row. Completion: gently introduce the next active task.'},
 {id:'baseline',name:'B · Blur reveal',note:'Entrance: reveal each task label from blurred to clear. Completion: keep numbers and strike through finished tasks.'},
 {id:'focus',name:'C · Focus slide',note:'Entrance: slide in one row at a time from the left. Completion: move focus to the next task.'},
 {id:'check',name:'D · Check handoff',note:'Entrance: two independent sequences — numbers from the left at 200ms intervals; labels from the right at 300ms intervals, starting 100ms later. Completion: check off and hand focus to the next number.'},
];
const listIcon='<path d="M9 6h11M9 12h11M9 18h11"/><path d="m4 6 1 1 2-2m-3 7 1 1 2-2m-3 7 1 1 2-2"/>';
const grid=document.getElementById('taskExperiments'),motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
const live=new Set(),strikeTimelines=new Set(),controllers=[];
let completed=0,paused=false,autoPlaying=false,autoFrame=null,autoRemaining=0,autoLastTime=0;
function rate(){return Number(document.getElementById('speed').value)*.75;}
function animate(node,frames,options={}){
 if(!node||motionQuery.matches)return null;
 const a=node.animate(frames,{duration:200,easing:'cubic-bezier(.23,1,.32,1)',...options});
 a.playbackRate=rate();if(paused)a.pause();live.add(a);
 a.finished.then(()=>live.delete(a),()=>live.delete(a));return a;
}
function cancelMotion(){for(const a of live)a.cancel();live.clear();for(const entry of strikeTimelines){entry.timeline.kill();gsap.set(entry.node,{clearProps:'transform,opacity'});}strikeTimelines.clear();grid.querySelectorAll('.task-ghost').forEach(n=>n.remove());}
function renderTaskRows(){return steps.map((title,i)=>`<li class="stage-plan-step" data-index="${i}" data-state="${i===0?'current':'pending'}"><span class="stage-plan-number" aria-hidden="true"><span class="task-completion-fill"></span><span class="stage-plan-digit">${i+1}</span><svg class="task-check" viewBox="0 0 16 16"><path d="m4 8 3 3 5-6" pathLength="1"/></svg></span>${i<steps.length-1?'<span class="task-connector" aria-hidden="true"></span>':''}<span class="stage-plan-title"><span class="stage-plan-title-text">${title}<span class="task-strike" aria-hidden="true"></span></span></span></li>`).join('');}
for(const variant of variants){
 const panel=document.createElement('section');panel.className='task-case';panel.dataset.mode=variant.id;
 panel.innerHTML=`<header class="task-case-heading"><h2>${variant.name}</h2></header><div class="task-preview"><div class="stage-plan"><button class="stage-plan-toggle" type="button" aria-expanded="true" aria-controls="task-body-${variant.id}"><svg viewBox="0 0 24 24" class="ic stage-plan-icon" aria-hidden="true">${listIcon}</svg><strong>Tasks</strong><span class="task-count"><span class="task-count-label">Completed</span><span class="task-count-value"><span>0</span></span><span class="task-count-total">/${steps.length}</span></span><svg viewBox="0 0 24 24" class="ic stage-plan-chevron" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div class="stage-plan-body" id="task-body-${variant.id}"><div class="task-list-wrap"><div class="task-focus" aria-hidden="true"></div><ol>${renderTaskRows()}</ol></div>${variant.id==='compact'?'<button class="completed-toggle" type="button" aria-expanded="false" hidden>Show completed</button>':''}</div></div></div>`;
 panel.append(panel.querySelector('.task-case-heading'));
 grid.append(panel);
 const c={...variant,panel,rows:[...panel.querySelectorAll('.stage-plan-step')],body:panel.querySelector('.stage-plan-body'),focus:panel.querySelector('.task-focus'),count:panel.querySelector('.task-count'),open:true,showCompleted:false};
 controllers.push(c);
 panel.querySelector('.stage-plan-toggle').addEventListener('click',()=>{
  c.open=!c.open;c.body.hidden=!c.open;
  panel.querySelector('.stage-plan-toggle').setAttribute('aria-expanded',String(c.open));
  const chevron=panel.querySelector('.stage-plan-chevron');
  animate(chevron,[{transform:c.open?'rotate(-90deg)':'rotate(0)'},{transform:c.open?'rotate(0)':'rotate(-90deg)'}],{duration:160});
  chevron.style.transform=c.open?'rotate(0)':'rotate(-90deg)';
  if(c.open){renderController(c,completed,false);enter(c);}
 });
 panel.querySelector('.completed-toggle')?.addEventListener('click',()=>{
  cancelMotion();c.showCompleted=!c.showCompleted;renderController(c,completed,true);
 });
}
const numberingByCase={baseline:'circle',fade:'plain',cascade:'padded',focus:'column',check:'tile',compact:'timeline'};
function applyNumbering(){
 cancelMotion();
 for(const c of controllers){
  const layout=numberingByCase[c.id];
  c.panel.dataset.numbering=layout;
  c.rows.forEach((row,i)=>row.querySelector('.stage-plan-digit').textContent=layout==='padded'?String(i+1).padStart(2,'0'):String(i+1));
  renderController(c,completed,false);
 }
}
function controls(){
 document.getElementById('previous').disabled=completed===0;
 document.getElementById('advance').disabled=completed===steps.length;
 document.getElementById('state').textContent=completed===steps.length?'All tasks completed':`Current task ${completed+1} / ${steps.length}`;
}
function animateTaskStrike(node,variant){
 if(motionQuery.matches)return;
 const settings={cascade:{duration:.64,ease:'power3.out'},baseline:{duration:.70,ease:'power2.inOut'},focus:{duration:.60,ease:'expo.out'}}[variant];
 if(!settings)return;
 const entry={node,timeline:null};
 entry.timeline=gsap.timeline({paused:true,onComplete:()=>strikeTimelines.delete(entry)});
 entry.timeline.fromTo(node,{scaleX:0,opacity:.6},{scaleX:1,opacity:1,...settings,overwrite:'auto'},0);
 entry.timeline.timeScale(rate());strikeTimelines.add(entry);
 if(!paused)entry.timeline.play();
}
function renderTaskCount(c,withMotion){
 const previous=c.count.dataset.completed;
 c.count.dataset.completed=String(completed);
 c.count.setAttribute('aria-label',`Completed ${completed}/${steps.length}`);
 c.count.querySelector('.task-count-total').textContent=`/${steps.length}`;
 const slot=c.count.querySelector('.task-count-value');
 const incoming=document.createElement('span');incoming.textContent=String(completed);
 slot.replaceChildren(incoming);
 if(!withMotion||previous===undefined||Number(previous)===completed||motionQuery.matches)return;
 const outgoing=document.createElement('span');outgoing.textContent=previous;outgoing.setAttribute('aria-hidden','true');
 slot.prepend(outgoing);
 const direction=completed>Number(previous)?1:-1;
 const options={duration:320,easing:'cubic-bezier(.23,1,.32,1)',fill:'both'};
 const exit=animate(outgoing,[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:`translateY(${-100*direction}%)`}],options);
 const entry=animate(incoming,[{opacity:0,transform:`translateY(${100*direction}%)`},{opacity:1,transform:'translateY(0)'}],options);
 entry?.finished.then(()=>{outgoing.remove();exit?.cancel();entry.cancel();},()=>outgoing.remove());
}
function renderController(c,previous,withMotion){
 const oldPositions=new Map(c.rows.filter(r=>!r.hidden).map(r=>[r,r.getBoundingClientRect().top]));
 const oldFocus=c.focus.style.transform||'translateY(0px)';
 const bodyRect=c.body.getBoundingClientRect();
 // A fading copy lets the finished row leave without animating layout height.
 if(withMotion&&c.id==='compact'&&!c.showCompleted&&completed>previous){
  for(const row of c.rows.filter(r=>Number(r.dataset.index)>=previous&&Number(r.dataset.index)<completed&&!r.hidden)){
   const rect=row.getBoundingClientRect(),ghost=row.cloneNode(true);ghost.classList.add('task-ghost');ghost.setAttribute('aria-hidden','true');
   Object.assign(ghost.style,{top:`${rect.top-bodyRect.top}px`,left:'0',width:`${rect.width}px`});c.body.append(ghost);
   const a=animate(ghost,[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-5px)'}],{duration:140});
   if(a)a.finished.then(()=>ghost.remove(),()=>ghost.remove());else ghost.remove();
  }
 }
 renderTaskCount(c,withMotion);
 c.rows.forEach((row,i)=>{
  const state=i<completed?'done':i===completed?'current':'pending';
  row.dataset.state=state;row.hidden=c.id==='compact'&&!c.showCompleted&&i<completed;
  row.setAttribute('aria-label',`${steps[i]}, ${state==='done'?'completed':state==='current'?'in progress':'not started'}`);
  if(state==='current')row.setAttribute('aria-current','step');else row.removeAttribute('aria-current');
  const strike=row.querySelector('.task-strike'),number=row.querySelector('.stage-plan-number');
  const showStrike=state==='done'&&c.id!=='check'&&c.id!=='compact';strike.style.transform=`scaleX(${showStrike?1:0})`;
  if(withMotion&&!row.hidden&&state==='done'&&i>=previous&&completed>previous){
   if(c.id==='check'){
    animate(row.querySelector('.task-completion-fill'),[{opacity:0},{opacity:1}],{duration:560,easing:'linear'});
    animate(row.querySelector('.stage-plan-digit'),[{opacity:1},{opacity:0}],{duration:120});
    animate(row.querySelector('.task-check path'),[{strokeDashoffset:1},{strokeDashoffset:0}],{duration:360,delay:100,easing:'cubic-bezier(.23,1,.32,1)',fill:'backwards'});
    animate(row.querySelector('.task-check'),[
     {transform:'scale(.9)',offset:0,easing:'cubic-bezier(.23,1,.32,1)'},
     {transform:'scale(1.12)',offset:.48,easing:'ease-in-out'},
     {transform:'scale(.98)',offset:.76,easing:'ease-out'},
     {transform:'scale(1)',offset:1}
    ],{duration:460,delay:100,fill:'backwards'});
   }else if(showStrike){
    animateTaskStrike(strike,c.id);
   }
   if(c.id==='fade')animate(number,[{opacity:.45},{opacity:1}],{duration:180});
  }
  if(withMotion&&state==='current'&&completed!==previous){
   if(c.id==='check')animate(number,[{transform:'scale(1.08)'},{transform:'scale(1)'}],{delay:200,duration:360});
  }
  if(withMotion&&c.id==='compact'&&!row.hidden){
   const delta=(oldPositions.get(row)??row.getBoundingClientRect().top)-row.getBoundingClientRect().top;
   if(delta)animate(row,[{transform:`translateY(${delta}px)`},{transform:'translateY(0)'}],{duration:240});
   else if(completed<previous)animate(row,[{opacity:0},{opacity:1}],{duration:180});
  }
 });
 c.focus.hidden=c.id!=='focus'||completed===steps.length;
 if(c.id==='focus'&&completed<steps.length){
  const y=c.rows[completed].offsetTop;c.focus.style.height=`${c.rows[completed].offsetHeight}px`;c.focus.style.transform=`translateY(${y}px)`;
  if(withMotion)animate(c.focus,[{transform:oldFocus},{transform:`translateY(${y}px)`}],{duration:480,easing:'cubic-bezier(.77,0,.175,1)'});
 }
 const toggle=c.panel.querySelector('.completed-toggle');
 if(toggle){toggle.hidden=completed===0;toggle.textContent=`${c.showCompleted?'Hide':'Show'} completed (${completed})`;toggle.setAttribute('aria-expanded',String(c.showCompleted));}
}
function enter(c){
 if(!c.open)return;
 const rows=c.rows.filter(r=>!r.hidden);
 const top=rows[0]?.offsetTop||0;
 const rowDuration=480,rowStagger=480;
 rows.forEach((row,i)=>{
  if(c.id==='baseline'){
   animate(row.querySelector('.stage-plan-number'),[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:rowDuration,delay:rowStagger*i,fill:'backwards'});
   animate(row.querySelector('.stage-plan-title'),[{opacity:0,filter:'blur(4px)'},{opacity:1,filter:'blur(0px)'}],{duration:rowDuration,delay:rowStagger*i,fill:'backwards'});
   animate(row.querySelector('.task-connector'),[{opacity:0,transform:'translateX(-50%) scaleY(0)'},{opacity:1,transform:'translateX(-50%) scaleY(1)'}],{duration:320,delay:rowStagger*i+160,fill:'backwards'});
  }else if(c.id==='fade'){
   animate(row,[{opacity:0},{opacity:1}],{duration:240,fill:'backwards'});
  }else if(c.id==='cascade'){
   animate(row,[{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:rowDuration,delay:rowStagger*i,fill:'backwards'});
  }else if(c.id==='focus'){
   animate(row,[{opacity:0,transform:'translateX(-14px)'},{opacity:1,transform:'translateX(0)'}],{duration:rowDuration,delay:rowStagger*i,fill:'backwards'});
  }else if(c.id==='check'){
   animate(row.querySelector('.stage-plan-number'),[{opacity:0,transform:'translateX(-14px)'},{opacity:1,transform:'translateX(0)'}],{duration:200,delay:200*i,fill:'backwards'});
   animate(row.querySelector('.stage-plan-title'),[{opacity:0,transform:'translateX(14px)'},{opacity:1,transform:'translateX(0)'}],{duration:260,delay:100+300*i,fill:'backwards'});
  }else if(c.id==='compact'){
   animate(row,[{opacity:0,transform:`translateY(${top-row.offsetTop}px)`},{opacity:1,transform:'translateY(0)'}],{duration:300,delay:50*i,fill:'backwards'});
  }
 });
 if(c.id==='focus'&&!c.focus.hidden)animate(c.focus,[{opacity:0},{opacity:1}],{duration:420,fill:'backwards'});
}
function stopAutoplay(){
 autoPlaying=false;cancelAnimationFrame(autoFrame);autoFrame=null;
 const button=document.getElementById('autoplay');button.textContent='Autoplay';button.setAttribute('aria-pressed','false');
}
function autoplayTick(now){
 const elapsed=Math.min(100,Math.max(0,now-autoLastTime));autoLastTime=now;
 if(!autoPlaying)return;
 if(!paused&&!document.hidden){
  autoRemaining-=elapsed*rate();
  if(autoRemaining<=0){
   update(completed+1);
   if(completed===steps.length){stopAutoplay();return;}
   autoRemaining=1600;
  }
 }
 autoFrame=requestAnimationFrame(autoplayTick);
}
function startAutoplay(){
 stopAutoplay();autoPlaying=true;paused=false;
 document.getElementById('pause').textContent='Pause';
 document.getElementById('autoplay').textContent='Stop autoplay';
 document.getElementById('autoplay').setAttribute('aria-pressed','true');
 replay();autoLastTime=performance.now();autoFrame=requestAnimationFrame(autoplayTick);
}
function update(next){
 cancelMotion();const previous=completed;completed=Math.max(0,Math.min(steps.length,next));
 for(const c of controllers)renderController(c,previous,true);controls();
}
function replay(){
 autoRemaining=(motionQuery.matches?0:480*steps.length)+700;
 cancelMotion();completed=0;
 for(const c of controllers){c.open=true;c.showCompleted=false;c.body.hidden=false;c.panel.querySelector('.stage-plan-toggle').setAttribute('aria-expanded','true');c.panel.querySelector('.stage-plan-chevron').style.transform='rotate(0)';renderController(c,0,false);enter(c);}controls();
}
document.getElementById('autoplay').onclick=()=>autoPlaying?stopAutoplay():startAutoplay();
document.getElementById('previous').onclick=()=>{stopAutoplay();update(completed-1);};
document.getElementById('advance').onclick=()=>{stopAutoplay();update(completed+1);};
document.getElementById('replay').onclick=replay;
document.getElementById('pause').onclick=()=>{paused=!paused;document.getElementById('pause').textContent=paused?'Resume':'Pause';for(const a of live)paused?a.pause():a.play();for(const entry of strikeTimelines)paused?entry.timeline.pause():entry.timeline.play();};
document.getElementById('taskCount').onchange=event=>{
 cancelMotion();steps=taskSets[Number(event.target.value)];completed=0;
 for(const c of controllers){
  c.panel.querySelector('ol').innerHTML=renderTaskRows();
  c.rows=[...c.panel.querySelectorAll('.stage-plan-step')];
 }
 applyNumbering();replay();
};
document.getElementById('speed').onchange=()=>{for(const a of live)a.updatePlaybackRate(rate());for(const entry of strikeTimelines)entry.timeline.timeScale(rate());};
motionQuery.addEventListener('change',()=>{cancelMotion();for(const c of controllers)renderController(c,completed,false);});
applyNumbering();
replay();

window.addEventListener("lab-case-change",()=>{for(const c of controllers)if(!c.panel.hidden)renderController(c,completed,false);});
