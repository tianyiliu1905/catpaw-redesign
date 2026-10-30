(function () {
  'use strict';
  const scene='3.1-2';
  const byId=id=>document.getElementById(id);
  let timer=null,active=false,completed=false,generation=0;
  const bubble=byId('petTaskBubble'),cat=byId('desktopCat'),unread=byId('petUnread');
  function announce(type){if(window.parent!==window)window.parent.postMessage({type,scene},'*');}
  function setBubble(open){bubble.hidden=!open;cat.setAttribute('aria-expanded',String(open));if(open)unread.hidden=true;}
  function finish(){
    completed=true;
    byId('petTaskState').textContent='CatPaw · 待你确认';
    byId('petTaskTitle').textContent='季度复盘初稿已完成';
    byId('petTaskMessage').textContent='5 页已整理好，华东区域的原因说明还需要你确认。';
    byId('petTaskProgress').textContent='已完成 3/3';
    byId('petSummaryProgress').textContent='5 页已整理好，图表口径与页面版式已统一。';
    byId('petStatusDot').classList.add('is-ready');
    unread.hidden=false;
  }
  function stop(){active=false;generation++;clearTimeout(timer);timer=null;document.documentElement.classList.add('pet-demo-paused');}
  function reset(){
    stop();completed=false;
    byId('petTaskState').textContent='CatPaw · 正在处理';
    byId('petTaskTitle').textContent='季度复盘 PPT 正在整理';
    byId('petTaskMessage').textContent='我在统一图表和版式，你可以先继续开会。';
    byId('petTaskProgress').textContent='已完成 2/3';
    byId('petSummaryProgress').textContent='正在统一图表口径与页面版式。';
    byId('petStatusDot').classList.remove('is-ready');
    byId('petTaskSummary').hidden=true;
    byId('petTaskDetails').setAttribute('aria-expanded','false');
    byId('petTaskDetails').innerHTML='查看进展 <span aria-hidden="true">→</span>';
    byId('meetingPopover').hidden=true;
    document.querySelectorAll('[data-meeting-panel]').forEach(button=>button.setAttribute('aria-expanded','false'));
    for(const [id,label] of [['meetingMic','解除静音'],['meetingCamera','开启视频']]){
      const button=byId(id);button.setAttribute('aria-pressed','false');button.querySelector('span').textContent=label;
    }
    byId('meetingSelfState').textContent='摄像头已关闭';
    byId('meetingSelf').querySelector('.meeting-name').classList.add('is-muted');
    setBubble(true);unread.hidden=true;
  }
  function prepare(play){
    reset();
    const token=generation;
    if(play){active=true;document.documentElement.classList.remove('pet-demo-paused');timer=setTimeout(()=>{if(!active||token!==generation)return;timer=null;finish();},6500);}
    requestAnimationFrame(()=>requestAnimationFrame(()=>{if(token===generation)announce('catpaw:scene-prepared');}));
  }
  cat.addEventListener('click',()=>setBubble(bubble.hidden));
  byId('petBubbleDismiss').addEventListener('click',()=>{setBubble(false);unread.hidden= !completed;cat.focus();});
  byId('petTaskDetails').addEventListener('click',()=>{
    const summary=byId('petTaskSummary'),open=summary.hidden;
    summary.hidden=!open;byId('petTaskDetails').setAttribute('aria-expanded',String(open));
    byId('petTaskDetails').innerHTML=open?'收起进展 <span aria-hidden="true">↑</span>':'查看进展 <span aria-hidden="true">→</span>';
  });
  for(const [id,on,off] of [['meetingMic','静音','解除静音'],['meetingCamera','关闭视频','开启视频']])byId(id).addEventListener('click',()=>{
    const button=byId(id),enabled=button.getAttribute('aria-pressed')!=='true';
    button.setAttribute('aria-pressed',String(enabled));button.querySelector('span').textContent=enabled?on:off;
    if(id==='meetingCamera')byId('meetingSelfState').textContent=enabled?'视频已开启（模拟）':'摄像头已关闭';
    if(id==='meetingMic')byId('meetingSelf').querySelector('.meeting-name').classList.toggle('is-muted',!enabled);
  });
  const panels={
    participants:['参会者 · 6','陈晓 · 主持人\n林悦 · 产品\n周宁 · 数据分析\n许晨 · 研发\n王敏 · 业务\n我'],
    chat:['会议聊天','陈晓 16:47\n我们先看本季度经营变化，再确认下阶段行动。'],
    share:['共享屏幕','当前为会议场景示意，不会访问或共享你的屏幕。'],
    more:['更多','会议场景用于展示：用户在其他应用工作时，CatPaw 仍可轻量提醒。'],
    leave:['离开会议','这是本地会议模拟。你可以继续查看右下角的桌宠与任务提示。'],
  };
  document.querySelectorAll('[data-meeting-panel]').forEach(button=>button.addEventListener('click',()=>{
    const open=button.getAttribute('aria-expanded')!=='true';
    document.querySelectorAll('[data-meeting-panel]').forEach(item=>item.setAttribute('aria-expanded','false'));
    byId('meetingPopover').hidden=!open;
    button.setAttribute('aria-expanded',String(open));
    if(open){const [title,text]=panels[button.dataset.meetingPanel];byId('meetingPopoverTitle').textContent=title;byId('meetingPopoverText').textContent=text;}
  }));
  byId('meetingPopoverClose').addEventListener('click',()=>{byId('meetingPopover').hidden=true;document.querySelectorAll('[data-meeting-panel]').forEach(button=>button.setAttribute('aria-expanded','false'));});
  window.addEventListener('message',event=>{
    if(event.source!==window.parent||event.data?.scene!==scene)return;
    if(event.data.type==='catpaw:scene-activate')prepare(true);
    if(event.data.type==='catpaw:scene-preview')prepare(false);
    if(event.data.type==='catpaw:scene-deactivate')stop();
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){byId('meetingPopoverClose').click();return;}
    if(!active||window.parent===window||!['ArrowRight','ArrowDown','PageDown',' ','ArrowLeft','ArrowUp','PageUp','Home','End'].includes(event.key))return;
    event.preventDefault();window.parent.postMessage({type:'catpaw:scene-key',scene,key:event.key},'*');
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  window.addEventListener('pagehide',stop);
  reset();announce('catpaw:scene-ready');
  if(window.parent===window)prepare(true);
})();
