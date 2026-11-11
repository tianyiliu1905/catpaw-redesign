/* Restores the pending-message queue from 4cf8710 for a dedicated intervention demo. */
(function(root){
  'use strict';
  const draft='先只看华东区域，按门店整理问题，尚未核实的原因单独标出来。';
  const output='我正在把本季度经营情况整理成复盘。先对齐各区域的营收、履约率和异常记录，再区分已经核实的问题与需要补充材料的部分。\n\n整体营收有所增长，但不同区域的履约表现存在差异。接下来会逐一梳理门店的问题、影响范围和跟进建议，把缺少原始记录的原因保留为待核实项。\n\n整理完成后，将形成经营概览、区域对比和下一步行动三个部分，方便继续核对和调整。';
  const escape=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const icons={send:'figma-queue-guide.svg',edit:'figma-queue-edit.svg',remove:'figma-queue-delete.svg'};
  function createModel(){
    let serial=0;
    const state={running:true,paused:false,prompts:[]};
    return {state,
      enqueue(message){
        if(!state.running||state.paused)return false;
        const text=String(message.text??'').trim(),attachments=[...(message.attachments||[])],references=[...(message.references||[])];
        if(!text&&!attachments.length&&!references.length)return false;
        state.prompts.push({id:++serial,text,rawText:message.rawText??text,skills:[...(message.skills||[])],knowledge:[...(message.knowledge||[])],connectors:[...(message.connectors||[])],attachments,references});return true;
      },
      take(id){const index=state.prompts.findIndex(p=>p.id===id);return index<0?null:state.prompts.splice(index,1)[0];},
      move(id,targetId,after=false){
        const from=state.prompts.findIndex(p=>p.id===id);
        if(from<0||id===targetId||!state.prompts.some(p=>p.id===targetId))return false;
        const [message]=state.prompts.splice(from,1);
        const to=state.prompts.findIndex(p=>p.id===targetId);
        state.prompts.splice(to+Number(after),0,message);
        return true;
      },
      pause(){if(!state.running||state.paused)return false;state.paused=true;return true;},
      resume(){if(!state.paused)return false;state.paused=false;return true;},
      restart(){state.running=true;state.paused=false;},
      finish(){state.running=false;state.paused=false;},
    };
  }
  function createController({container,thread,onResume=()=>{},onEdit=()=>false,onChange=()=>{},now=Date.now,setTimer=setInterval,clearTimer=clearInterval,characterInterval=220}){
    let model=createModel(),active=false,timer=null,generation=0,startedAt=null,finishedAt=null,shown=42,draggingId=null;
    let content=output,pausedAt=null,pausedDuration=0,segmentStarted=0,thinkingFor=0,initialShown=42;
    const current=selector=>Array.from(thread.querySelectorAll(selector)).at(-1);
    const elapsed=()=>Math.max(0,(finishedAt??pausedAt??now())-(startedAt??now())-pausedDuration);
    const label=message=>[message.text,...message.attachments.map(a=>`@${a.node?.name||''}`),...message.references.map(r=>`${r.fileName} · ${r.label}`)].filter(Boolean).join(' ');
    function render(){
      const {state}=model;
      container.hidden=!active||!state.prompts.length;
      container.innerHTML=`<div id="conversationQueueItems">${state.prompts.map(message=>`<div class="conversation-queue-item" data-queue-row="${message.id}"><button class="conversation-queue-handle" type="button" draggable="true" data-queue-drag="${message.id}" aria-label="调整消息顺序，按上下方向键移动" title="拖动排序"><img src="assets/figma-queue-grip.svg" alt="" width="18" height="18" draggable="false"></button><span class="conversation-queue-text" title="${escape(label(message))}">${escape(label(message))}</span><div class="conversation-queue-actions">${['send','edit','remove'].map(action=>`<button type="button" data-queue-action="${action}" data-queue-id="${message.id}" aria-label="${({send:'引导当前任务',remove:'移除消息',edit:'编辑消息'})[action]}" title="${({send:'引导当前任务',remove:'删除',edit:'编辑'})[action]}"><img src="assets/${icons[action]}" alt="" width="18" height="18" draggable="false"></button>`).join('')}</div></div>`).join('')}</div>`;
    }
    function initial(){return `<section class="queue-demo-output" aria-label="任务执行状态"><div class="queue-demo-status"><span class="global-status-paw" aria-hidden="true"></span><span data-queue-agent-label role="status">${thinkingFor?'思考中':'生成中'}</span><span data-queue-agent-time>0秒</span></div>${thinkingFor?'<p class="queue-demo-thinking-copy" data-queue-agent-thinking>正在回顾已有内容，确认接下来的执行方向</p>':''}<p data-queue-agent-body>${escape(content.slice(0,shown))}</p></section>`;}
    function renderOutput(){
      const body=current('[data-queue-agent-body]');if(!body)return;
      body.textContent=content.slice(0,shown);
      const {running,paused}=model.state;
      const label=current('[data-queue-agent-label]');
      const thinking=running&&elapsed()<thinkingFor;
      const status=paused?'已暂停':thinking?'思考中':running?'生成中':'已完成';
      if(label&&label.textContent!==status)label.textContent=status;
      const thought=current('[data-queue-agent-thinking]');if(thought)thought.hidden=!thinking;
      const time=current('[data-queue-agent-time]');
      const seconds=Math.floor(elapsed()/1000);
      if(time)time.textContent=seconds<60?`${seconds}秒`:`${Math.floor(seconds/60)}分${seconds%60}秒`;
      const section=body.closest('.queue-demo-output');
      section?.classList.toggle('is-complete',!running);
      section?.classList.toggle('is-paused',paused);
      onChange();
    }
    function stop(){generation++;if(timer!==null)clearTimer(timer);timer=null;}
    function finish(){if(finishedAt===null)finishedAt=pausedAt??now();model.finish();shown=content.length;stop();renderOutput();render();}
    function activate(enabled){
      stop();active=enabled;render();if(!active)return;
      if(startedAt===null)startedAt=now();
      renderOutput();if(!model.state.running||model.state.paused)return;
      const token=generation;
      timer=setTimer(()=>{
        if(!active||generation!==token||model.state.paused)return;
        shown=Math.max(shown,Math.min(content.length,initialShown+Math.floor(Math.max(0,elapsed()-segmentStarted-thinkingFor)/characterInterval)));
        if(shown>=content.length){finish();return;}
        renderOutput();
      },characterInterval);
    }
    function pause(){
      if(!active||!model.pause())return false;
      pausedAt=now();stop();renderOutput();return true;
    }
    function resume(message){
      if(!active||!model.state.paused)return false;
      return startNextRound(message);
    }
    function guide(message){
      if(!active||!message)return false;
      return startNextRound(message);
    }
    function startNextRound(message){
      stop();
      // Continue always starts a new round and keeps the paused partial reply as history.
      const section=current('[data-queue-agent-body]')?.closest('.queue-demo-output');
      section?.classList.remove('is-paused');section?.classList.add('is-complete');
      const label=current('[data-queue-agent-label]');if(label)label.textContent=message?'已调整':'已暂停';
      if(message){
        const text=message.rawText??message.text;
        content=(text?`明白，接下来按你的补充要求调整：${text}\n\n`:'明白，我会结合补充的资料调整后续工作。\n\n')+'已完成的核对结果会保留。我会按新要求重新梳理分析范围和后续步骤，尚未核实的原因继续单列。';
      }else{
        content='我会沿用前面已经核对的资料，继续整理各区域的表现和门店问题，把尚未核实的原因保留为待确认项。\n\n接下来补齐影响范围与跟进建议，整理成经营概览、区域对比和下一步行动，方便继续核对与调整。';
      }
      startedAt=now();finishedAt=null;pausedDuration=0;pausedAt=null;segmentStarted=0;shown=0;initialShown=0;thinkingFor=1800;
      model.restart();
      onResume(message||null);
      activate(true);return true;
    }
    function enqueue(message){const added=model.enqueue(message);if(added)render();return added;}
    container.addEventListener('click',event=>{
      const button=event.target.closest('[data-queue-action]');if(!active||!button)return;
      const id=Number(button.dataset.queueId),action=button.dataset.queueAction;
      if(action==='edit'){
        const message=model.state.prompts.find(item=>item.id===id);
        if(!message||onEdit(message)===false)return;
        model.take(id);render();return;
      }
      const message=model.take(id);if(!message)return;
      if(action==='send')guide(message);
      render();
    });
    container.addEventListener('keydown',event=>{
      const handle=event.target.closest?.('[data-queue-drag]');
      if(!active||!handle||!['ArrowUp','ArrowDown'].includes(event.key))return;
      const id=Number(handle.dataset.queueDrag),prompts=model.state.prompts;
      const index=prompts.findIndex(item=>item.id===id);
      const next=index+(event.key==='ArrowUp'?-1:1);
      if(next<0||next>=prompts.length)return;
      event.preventDefault();
      model.move(id,prompts[next].id,event.key==='ArrowDown');
      render();
      container.querySelector?.(`[data-queue-drag="${id}"]`)?.focus();
    });
    container.addEventListener('dragstart',event=>{
      const handle=event.target.closest?.('[data-queue-drag]');
      if(!active||!handle)return;
      draggingId=Number(handle.dataset.queueDrag);
      event.dataTransfer?.setData('text/plain',String(draggingId));
      if(event.dataTransfer)event.dataTransfer.effectAllowed='move';
      handle.closest('[data-queue-row]')?.classList.add('is-dragging');
    });
    container.addEventListener('dragover',event=>{
      const row=event.target.closest?.('[data-queue-row]');
      if(!active||draggingId===null||!row)return;
      event.preventDefault();
      container.querySelectorAll?.('.is-drop-target').forEach(item=>item.classList.remove('is-drop-target'));
      if(Number(row.dataset.queueRow)!==draggingId)row.classList.add('is-drop-target');
    });
    container.addEventListener('drop',event=>{
      const row=event.target.closest?.('[data-queue-row]');
      if(!active||draggingId===null||!row)return;
      event.preventDefault();
      const after=event.clientY>row.getBoundingClientRect().top+row.getBoundingClientRect().height/2;
      model.move(draggingId,Number(row.dataset.queueRow),after);
      draggingId=null;
      render();
    });
    container.addEventListener('dragend',()=>{
      draggingId=null;
      container.querySelectorAll?.('.is-dragging,.is-drop-target').forEach(item=>item.classList.remove('is-dragging','is-drop-target'));
    });
    return {initial,enqueue,activate,stop,finish,pause,resume,guide,reset(){stop();active=false;model=createModel();startedAt=null;finishedAt=null;shown=42;content=output;pausedAt=null;pausedDuration=0;segmentStarted=0;thinkingFor=0;initialShown=42;render();},get state(){return model.state;}};
  }
  const api={draft,output,createModel,createController};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.CatPawQueueDemo=api;
})(typeof window==='object'?window:globalThis);
