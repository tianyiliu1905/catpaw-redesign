'use strict';
const taskSets={
 3:['Check data consistency','Prioritize store follow-ups','Prepare recommendations and items for review'],
 8:['Check data consistency','Read order records','Verify order timestamps','Assess affected stores','Investigate recurring issues','Prioritize store follow-ups','Prepare recommendations','Review items needing confirmation']
};
let steps=taskSets[3];
const variants=[
 {id:'baseline',name:'A · Gentle rise',note:'Entrance: gently rise in. Completion: keep numbers and strike through finished tasks.'},
 {id:'cascade',name:'B · Cascade',note:'Entrance: rise in row by row. Completion: gently introduce the next active task.'},
 {id:'focus',name:'C · Focus slide',note:'Entrance: slide in one row at a time from the left. Completion: move focus to the next task.'},
 {id:'check',name:'D · Check handoff',note:'Entrance: two independent sequences — numbers from the left at 200ms intervals; labels from the right at 300ms intervals, starting 100ms later. Completion: check off and hand focus to the next number.'},
];
const listIcon='<path d="M9 6h11M9 12h11M9 18h11"/><path d="m4 6 1 1 2-2m-3 7 1 1 2-2m-3 7 1 1 2-2"/>';
const grid=document.getElementById('taskExperiments'),motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
const live=new Set(),controllers=[];
let completed=0,paused=false;
function rate(){return Number(document.getElementById('speed').value);}
function animate(node,frames,options={}){
 if(!node||motionQuery.matches)return null;
 const a=node.animate(frames,{duration:200,easing:'cubic-bezier(.23,1,.32,1)',...options});
 a.playbackRate=rate();if(paused)a.pause();live.add(a);
 a.finished.then(()=>live.delete(a),()=>live.delete(a));return a;
}
function cancelMotion(){for(const a of live)a.cancel();live.clear();grid.querySelectorAll('.task-ghost').forEach(n=>n.remove());}
function renderTaskRows(){return steps.map((title,i)=>`<li class="stage-plan-step" data-index="${i}" data-state="${i===0?'current':'pending'}"><span class="stage-plan-number" aria-hidden="true"><span class="stage-plan-digit">${i+1}</span><svg class="task-check" viewBox="0 0 16 16"><path d="m4 8 3 3 5-6"/></svg></span><span class="stage-plan-title"><span class="stage-plan-title-text">${title}<span class="task-strike" aria-hidden="true"></span></span></span></li>`).join('');}
for(const variant of variants){
 const panel=document.createElement('section');panel.className='task-case';panel.dataset.mode=variant.id;
 panel.innerHTML=`<header class="task-case-heading"><h2>${variant.name}</h2></header><div class="task-preview"><div class="stage-plan"><button class="stage-plan-toggle" type="button" aria-expanded="true" aria-controls="task-body-${variant.id}"><svg viewBox="0 0 24 24" class="ic stage-plan-icon" aria-hidden="true">${listIcon}</svg><strong>Tasks</strong><span class="task-count">Completed 0/${steps.length}</span><svg viewBox="0 0 24 24" class="ic stage-plan-chevron" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div class="stage-plan-body" id="task-body-${variant.id}"><div class="task-list-wrap"><div class="task-focus" aria-hidden="true"></div><ol>${renderTaskRows()}</ol></div>${variant.id==='compact'?'<button class="completed-toggle" type="button" aria-expanded="false" hidden>Show completed</button>':''}</div></div></div>`;
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
 const selection=document.getElementById('numbering').value;
 for(const c of controllers){
  const layout=selection==='per-case'?numberingByCase[c.id]:selection;
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
 c.count.textContent=`Completed ${completed}/${steps.length}`;
 c.rows.forEach((row,i)=>{
  const state=i<completed?'done':i===completed?'current':'pending';
  row.dataset.state=state;row.hidden=c.id==='compact'&&!c.showCompleted&&i<completed;
  row.setAttribute('aria-label',`${steps[i]}, ${state==='done'?'completed':state==='current'?'in progress':'not started'}`);
  if(state==='current')row.setAttribute('aria-current','step');else row.removeAttribute('aria-current');
  const strike=row.querySelector('.task-strike'),number=row.querySelector('.stage-plan-number');
  const showStrike=state==='done'&&c.id!=='check'&&c.id!=='compact';strike.style.transform=`scaleX(${showStrike?1:0})`;
  if(withMotion&&!row.hidden&&state==='done'&&i>=previous&&completed>previous){
   if(c.id==='check'){
    animate(row.querySelector('.task-check'),[{opacity:0,transform:'scale(.9)'},{opacity:1,transform:'scale(1)'}],{duration:360});
   }else if(showStrike){
    animate(strike,[{transform:'scaleX(0)'},{transform:'scaleX(1)'}],{duration:c.id==='baseline'?500:380,easing:'ease-out'});
   }
   if(c.id==='fade')animate(number,[{opacity:.45},{opacity:1}],{duration:180});
  }
  if(withMotion&&state==='current'&&completed!==previous){
   if(c.id==='cascade')animate(row,[{opacity:.4,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:420});
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
 if(withMotion&&completed!==previous)animate(c.count,[{opacity:.35},{opacity:1}],{duration:180});
}
function enter(c){
 if(!c.open)return;
 const rows=c.rows.filter(r=>!r.hidden);
 const top=rows[0]?.offsetTop||0;
 rows.forEach((row,i)=>{
  if(c.id==='baseline'){
   animate(row,[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:360,delay:180*i,fill:'backwards'});
  }else if(c.id==='fade'){
   animate(row,[{opacity:0},{opacity:1}],{duration:240,fill:'backwards'});
  }else if(c.id==='cascade'){
   animate(row,[{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:460,delay:110*i,fill:'backwards'});
  }else if(c.id==='focus'){
   animate(row,[{opacity:0,transform:'translateX(-14px)'},{opacity:1,transform:'translateX(0)'}],{duration:480,delay:480*i,fill:'backwards'});
  }else if(c.id==='check'){
   animate(row.querySelector('.stage-plan-number'),[{opacity:0,transform:'translateX(-14px)'},{opacity:1,transform:'translateX(0)'}],{duration:200,delay:200*i,fill:'backwards'});
   animate(row.querySelector('.stage-plan-title'),[{opacity:0,transform:'translateX(14px)'},{opacity:1,transform:'translateX(0)'}],{duration:260,delay:100+300*i,fill:'backwards'});
  }else if(c.id==='compact'){
   animate(row,[{opacity:0,transform:`translateY(${top-row.offsetTop}px)`},{opacity:1,transform:'translateY(0)'}],{duration:300,delay:50*i,fill:'backwards'});
  }
 });
 if(c.id==='focus'&&!c.focus.hidden)animate(c.focus,[{opacity:0},{opacity:1}],{duration:420,fill:'backwards'});
}
function update(next){
 cancelMotion();const previous=completed;completed=Math.max(0,Math.min(steps.length,next));
 for(const c of controllers)renderController(c,previous,true);controls();
}
function replay(){
 cancelMotion();completed=0;
 for(const c of controllers){c.open=true;c.showCompleted=false;c.body.hidden=false;c.panel.querySelector('.stage-plan-toggle').setAttribute('aria-expanded','true');c.panel.querySelector('.stage-plan-chevron').style.transform='rotate(0)';renderController(c,0,false);enter(c);}controls();
}
document.getElementById('previous').onclick=()=>update(completed-1);
document.getElementById('advance').onclick=()=>update(completed+1);
document.getElementById('replay').onclick=replay;
document.getElementById('pause').onclick=()=>{paused=!paused;document.getElementById('pause').textContent=paused?'Resume':'Pause';for(const a of live)paused?a.pause():a.play();};
document.getElementById('taskCount').onchange=event=>{
 cancelMotion();steps=taskSets[Number(event.target.value)];completed=0;
 for(const c of controllers){
  c.panel.querySelector('ol').innerHTML=renderTaskRows();
  c.rows=[...c.panel.querySelectorAll('.stage-plan-step')];
 }
 applyNumbering();replay();
};
document.getElementById('numbering').onchange=applyNumbering;
document.getElementById('speed').onchange=()=>{for(const a of live)a.updatePlaybackRate(rate());};
document.getElementById('view').onchange=event=>{
 const id=event.target.value;grid.classList.toggle('focused',id!=='all');
 for(const c of controllers)c.panel.hidden=id!=='all'&&c.id!==id;
};
motionQuery.addEventListener('change',()=>{cancelMotion();for(const c of controllers)renderController(c,completed,false);});
applyNumbering();
replay();
