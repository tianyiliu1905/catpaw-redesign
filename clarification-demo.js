/* Local preset clarification interaction; no remote generation. */
(function(root){
  'use strict';
  const questions=[
    {title:'这次上线套餐，最希望达成什么目标？',kind:'choice',label:'经营目标',options:['吸引新客到店','提升客单价与连带销售','带动非高峰时段消费','推广新品或招牌菜']},
    {title:'套餐想包含哪些菜品？有什么使用限制？',kind:'text',label:'菜品与限制'},
    {title:'这份双人套餐，计划卖多少钱？',kind:'range',label:'套餐售价'},
    {title:'确认一下这份套餐的上线准备要求',kind:'confirm'},
  ];
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function createModel(){
    let phase,index,answers,custom,range;
    function reset(){phase='asking';index=0;answers=Array(3).fill(null);custom=['',''];range={min:'',max:''};}reset();
    function rangeError(){if(!range.min||!range.max)return '';const a=Number(range.min),b=Number(range.max);if(!Number.isFinite(a)||!Number.isFinite(b)||a<0||b>10000||a>b)return '请填写 0–10000 元范围内的售价，下限不能高于上限';return '';}
    return {get phase(){return phase;},get index(){return index;},get answers(){return [...answers];},get custom(){return custom[index]||'';},get range(){return {...range};},get error(){return index===2?rangeError():'';},get canNext(){return index===3||!!answers[index];},reset,
      type(value,field='text'){
        if(phase!=='asking')return false;
        if(index===2&&['min','max'].includes(field)){range[field]=String(value);answers[2]=range.min&&range.max&&!rangeError()?`${range.min}–${range.max} 元／套`:null;return true;}
        if(index>1)return false;
        custom[index]=String(value).slice(0,200);answers[index]=custom[index].trim()||null;return true;
      },
      act(action){
        if(action==='restart'){reset();return true;}
        if(action==='reopen'&&phase==='closed'){phase='asking';return true;}
        if(phase!=='asking')return false;
        if(action==='close'){phase='closed';return true;}
        if(action==='previous'&&index>0){index--;return true;}
        if(/^edit-[0-2]$/.test(action)&&index===3){index=Number(action.slice(-1));return true;}
        if(/^pick-[0-3]$/.test(action)&&index===0){answers[0]=questions[0].options[Number(action.slice(-1))];custom[0]='';return true;}
        if(action==='confirm'&&index===3){phase='done';return true;}
        if(action==='next'&&index<3&&answers[index]){index++;return true;}
        if(action==='skip'&&index>0&&index<3){answers[index]=null;if(index===1)custom[1]='';else range={min:'',max:''};index++;return true;}
        return false;
      },
    };
  }
  function createController({thread,host,composer,onChange=()=>{}}){
    const model=createModel();let active=false;
    const icon=name=>`<img src="./assets/clarification/${name}.svg" alt="" class="clarify-icon clarify-icon-${name}">`;
    function summary(editable){return `<dl class="clarify-answer-summary">${questions.slice(0,3).map((q,i)=>`<div><dt>${q.label}</dt><dd>${escape(model.answers[i]||'未补充')}</dd>${editable?`<button data-recovery-action="edit-${i}" aria-label="修改${q.label}">修改</button>`:''}</div>`).join('')}</dl>`;}
    const rangeHint=()=>model.range.min&&model.range.max?(model.error||'按一份双人套餐计算，可随时修改'):'';
    function card(){
      const q=questions[model.index],answer=model.answers[model.index];let body='';
      if(q.kind==='choice')body=`<div class="clarify-options" role="group" aria-labelledby="clarify-question">${q.options.map((option,i)=>`<button class="clarify-option ${!model.custom&&answer===option?'is-selected':''}" aria-pressed="${!model.custom&&answer===option}" data-recovery-action="pick-${i}"><span class="clarify-number">${i+1}</span><span>${option}</span></button>`).join('')}</div><label class="clarify-other"><span class="clarify-number">${icon('edit')}</span><input data-clarify-field="text" aria-label="输入其他答案" placeholder="输入其他答案" value="${escape(model.custom)}" maxlength="200"></label>`;
      if(q.kind==='text')body=`<div class="clarify-field"><textarea data-clarify-field="text" aria-label="菜品与限制" placeholder="例如：招牌烤鸡配小食和饮品，周末可用，暂不含海鲜" maxlength="200" rows="3">${escape(model.custom)}</textarea></div>`;
      if(q.kind==='range')body=`<div class="clarify-field"><div class="clarify-range">${['min','max'].map((field,i)=>`${i?'<span>至</span>':''}<label><span>${i?'最高售价':'最低售价'}</span><div><input type="number" data-clarify-field="${field}" aria-label="${i?'最高售价':'最低售价'}" min="0" max="10000" step="any" placeholder="${i?'168':'128'}" value="${escape(model.range[field])}"><span>元</span></div></label>`).join('')}</div><span class="clarify-hint" aria-live="polite" data-clarify-error ${rangeHint()?'':'hidden'}>${rangeHint()}</span></div>`;
      if(q.kind==='confirm')body=summary(true);
      return `<section class="clarify-card" aria-label="补充套餐上线要求"><header><strong id="clarify-question">${q.title}</strong><nav aria-label="问题导航"><button data-recovery-action="previous" aria-label="上一题" ${model.index===0?'disabled':''}>${icon('previous')}</button><span aria-live="polite">${model.index+1} / 4</span>${model.index<3?`<button data-recovery-action="next" aria-label="下一题" ${model.canNext?'':'disabled'}>${icon('next')}</button>`:''}<button data-recovery-action="close" aria-label="收起问题">${icon('close')}</button></nav></header>${body}<footer><span class="clarify-hint">${['','','明确范围 · 可跳过','核对理解'][model.index]}</span><div>${model.index>0&&model.index<3?'<button data-recovery-action="skip">跳过本题</button>':''}<button class="clarify-primary" data-recovery-action="${model.index===3?'confirm':'next'}" ${model.canNext?'':'disabled'}>${model.index===3?'确认并继续':'下一步'}</button></div></footer></section>`;
    }
    function initial(){
      let content='我会帮你准备双人套餐搭配和上架文案。先确认经营目标、可用菜品和售价范围，让方案更贴合门店经营。';
      let tail='<div class="clarify-status">正在提问</div>';
      if(model.phase==='closed')tail='<button class="clarify-reopen" data-recovery-action="reopen">继续补充要求</button>';
      if(model.phase==='done'){content='收到，我会按这些要求准备双人套餐搭配和上架文案，供你核对后使用。';tail=`${summary(false)}<p>未补充的条件保留为待确认；最终售价和使用规则由你核对，本次确认不会直接发布套餐。</p>`;}
      return `<section class="recovery-demo clarify-reply" data-recovery-stage="${model.phase}"><p>${content}</p>${tail}</section>`;
    }
    function render(){
      host.hidden=!(active&&model.phase==='asking');composer.closest('.conversation-composer-wrap').classList.toggle('has-clarification',!host.hidden);
      if(!active)return;host.innerHTML=host.hidden?'':card();const panel=thread.querySelector('.clarify-reply');if(panel)panel.outerHTML=initial();onChange(model.phase);
    }
    function act(action){if(!active||!model.act(action))return false;render();return true;}
    function updateInput(value,field){
      if(!active||!model.type(value,field))return false;
      host.querySelectorAll('.clarify-option').forEach(button=>{button.classList.remove('is-selected');button.setAttribute('aria-pressed','false');});
      host.querySelectorAll('[data-recovery-action="next"]').forEach(button=>button.disabled=!model.canNext);
      const error=host.querySelector('[data-clarify-error]');if(error){error.textContent=rangeHint();error.hidden=!error.textContent;}return true;
    }
    for(const area of [thread,host])area.addEventListener('click',event=>{const button=event.target.closest('[data-recovery-action]');if(button&&active)act(button.dataset.recoveryAction);});
    host.addEventListener('input',event=>{if(event.target.dataset.clarifyField)updateInput(event.target.value,event.target.dataset.clarifyField);});
    host.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing&&event.target.tagName==='INPUT'){event.preventDefault();act('next');}});
    return {initial,act,activate(value){active=value;render();},reset(){model.reset();render();},fill(field,value){const input=host.querySelector(`[data-clarify-field="${field}"]`);if(!active||!input)return false;input.focus({preventScroll:true});input.value=value;return updateInput(value,field);},get stage(){return model.phase;}};
  }
  const api={questions,createModel,createController};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CatPawClarificationDemo=api;
})(typeof window!=='undefined'?window:globalThis);
