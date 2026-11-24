window.createBrowserControlDemo = function ({thread, task, openDock, updateDockAddress, onComplete, syncProgress, preserveConversationScrollRange, renderStageAcknowledgement, replaceStageContent}) {
  const summary = document.getElementById('browserControlSummary');
  const dialog=document.getElementById('browserTakeover');
  const page=dialog.querySelector('.browser-takeover-viewport');
  const dock=document.getElementById('browserDockHost');
  const controlButton=dialog.querySelector('.browser-take-control');
  const dockButton=dialog.querySelector('[data-browser-step="dock"]');
  function undock(){
    dockButton.before(controlButton);
    dialog.append(page);
    dock.hidden=true;
    document.getElementById('urlInput').readOnly=false;
  }
  const loginForm = dialog.querySelector('form');
  let manualBrowsing=false;
  const stages = {
    understanding:['理解任务','我会在门店管理后台找到湖滨店，分别核对周六和周日的营业时间，再把结果告诉你。'],
    browsing:['Agent 正在使用浏览器','正在打开门店管理后台，查找湖滨店的营业时间。'],
    asking:['等待你接管','门店管理后台需要登录后才能查看营业时间。'],
    login:['你正在控制浏览器','请在浏览器窗口使用演示账号登录。'],
    signed:['你正在控制浏览器','已登录。交还浏览器后，我会继续查找湖滨店。'],
    reading:['Agent 正在使用浏览器','已接回浏览器，正在核对营业时间。'],
    done:['浏览器任务已完成','查到了，湖滨店周六、周日的营业时间都是 09:00–21:00。']
  };
  const order=Object.keys(stages);
  const nextLabels=['开始浏览','请求接管','接管浏览器','模拟登录','交还并继续','查看结果','重播演示'];
  let stage = 'understanding', active = false;
  const takeoverCards = {
    asking:['接管浏览器以完成登录','接管','take-control'],
    login:['门店管理后台登录','查看登录页','view'],
    signed:['归还浏览器控制权','打开浏览器','view'],
  };
  const takeoverCard = (title, label, step) => `<div class="browser-takeover-card">
    <span class="conversation-artifact-icon"><img class="browser-control-monitor" src="./assets/browser-control-monitor.svg" alt=""></span>
    <strong>${title}</strong>
    <button type="button" class="browser-takeover-card-action" data-browser-step="${step}" aria-haspopup="dialog" aria-controls="browserTakeover">${label}</button>
  </div>`;
  function browserCardPreview(address) {
    const reading=stage==='reading'||stage==='signed';
    const monitor=page.querySelector('[data-browser-monitor]');
    const content=['asking','login'].includes(stage)
      ? '<h2>门店管理后台</h2><p>登录门店管理后台</p><div class="browser-login-form"><i></i><i></i><b>登录</b></div>'
      : `<h2>${reading?'湖滨店 · 营业时间':'门店管理后台'}</h2>${monitor.querySelector(reading?'[data-store-hours]':'[data-store-search]').innerHTML.replace(/<button[^>]*>(.*?)<\/button>/g,'<b>$1</b>')}`;
    return `<div class="browser-thumbnail browser-page-mini" aria-hidden="true"><div class="browser-mini-viewport">
      <div class="browser-mini-address">${address}</div>
      <div class="browser-takeover-page"><div>${content}</div></div>
    </div></div>`;
  }
  function render(startBrowsing=false) {
    summary.dataset.browserStage=stage;
    summary.hidden = !active || !['browsing','asking','reading'].includes(stage);
    const card = takeoverCards[stage];
    const needsUser = Boolean(card);
    if (!active) return;
    const [status, reply] = manualBrowsing ? ['你正在控制浏览器','你正在查看门店管理后台，归还控制后妙手会继续查询。'] : stages[stage];
    const panel = thread.querySelector('[data-browser-reply]');
    if (panel) {
      const initial=stage==='understanding', done=stage==='done';
      const state=initial?'planning':done?'done':needsUser?'waiting':'reading';
      const elapsed=Math.max(0,Math.floor((Date.now()-Number(panel.dataset.startedAt))/1000));
      const statusLine=`<div class="stage-thinking" data-browser-stage="${stage}" data-global-state="${state}"><div class="stage-thinking-status"><span class="global-status-paw" aria-hidden="true"></span><strong class="stage-global-label" role="status">${done?'已完成':status}</strong><span class="stage-elapsed">${elapsed}秒</span></div></div>`;
      const text=initial?`<article class="md conversation-reply stage-acknowledgement"><p>${renderStageAcknowledgement(reply)}</p></article>`:`<section class="${done?'stage-result':'stage-current'}"><p>${reply}</p>${card?takeoverCard(...card):''}</section>`;
      if(!initial)panel.classList.remove('is-entering');
      const entering = panel.classList.contains('is-entering') && !panel.hasChildNodes();
      replaceStageContent(panel,statusLine+text+(done?'<button type="button" data-browser-step="restart">重新演示</button>':''),panel.hasChildNodes() && !startBrowsing);
      if(startBrowsing)panel.querySelector('.stage-current')?.animate([{opacity:0},{opacity:1}],{duration:180,easing:'ease-out'});
      if (entering) {
        const animations=panel.getAnimations({subtree:true}).filter(a=>a.effect.getTiming().iterations!==Infinity);
        Promise.allSettled(animations.map(a=>a.finished)).then(()=>{
          if(!panel.isConnected)return;
          panel.classList.remove('is-entering');
          syncProgress();
        });
      }
    }
    const loginPage = ['asking','login'].includes(stage);
    const address='https://store.example'+(loginPage?'/login':['signed','reading','done'].includes(stage)?'/hubin':'');
    const controlLabel=stage==='asking'?'等待你接管':manualBrowsing||['login','signed'].includes(stage)?'你正在控制':stage==='done'?'已完成':'妙手正在使用浏览器';
    summary.innerHTML = `<button type="button" class="conversation-queue-item browser-preview-row" data-browser-step="view" aria-haspopup="dialog" aria-controls="browserTakeover">
        ${browserCardPreview(address)}
        <strong class="browser-control-status">${controlLabel}</strong>
        <span class="conversation-queue-text" title="${address}">${address}</span>
      </button>`;
    task.querySelector('.task-state').innerHTML=needsUser?'<em class="tag-await">待接管</em>':'';
  }
  function openBrowser(inPanel=false) {
    const signed=stage==='signed';
    const watching=(stage==='browsing'&&!manualBrowsing)||stage==='reading';
    const waiting=stage==='asking';
    const userControls=manualBrowsing||stage==='login'||signed;
    page.toggleAttribute('data-agent-control', !userControls);
    controlButton.hidden=!(watching||waiting||userControls);
    controlButton.dataset.browserStep=userControls?'give-back':'take-control';
    controlButton.querySelector('[data-control-label]').textContent=userControls?'归还控制':'接管电脑';
    const close=dialog.querySelector('[data-browser-step="close"]');
    const monitor=page.querySelector('[data-browser-monitor]');
    dialog.querySelector('#browserTakeoverTitle .global-status-paw').hidden=!watching;
    dialog.querySelector('[data-control-title]').textContent=watching?'妙手正在控制':waiting?'等待你接管':'你正在控制';
    dialog.querySelector('[data-browser-address]').textContent=summary.querySelector('.conversation-queue-text').textContent;
    const loginPage=waiting||stage==='login';
    monitor.hidden=loginPage;
    if(!loginPage){
      const reading=signed||stage==='reading';
      monitor.querySelector('h2').textContent=reading?'湖滨店 · 营业时间':'门店管理后台';
      monitor.querySelector('[data-store-search]').hidden=reading;
      monitor.querySelector('[data-store-hours]').hidden=!reading;
      monitor.querySelector('[data-browser-step="open-login"]').inert=!userControls;
    }
    loginForm.parentElement.hidden=!loginPage;
    loginForm.inert=!userControls;
    page.querySelector('[data-browser-instruction]').textContent='输入任意演示用户名和密码即可登录。';
    if(inPanel){
      updateDockAddress(dialog.querySelector('[data-browser-address]').textContent);
      return;
    }
    if(page.parentElement===dock)undock();
    if (!dialog.open) dialog.showModal();
    (stage==='login' ? loginForm.querySelector('input') : watching ? close : controlButton).focus();
  }
  function animateHandoff(toUser) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!dialog.open && page.parentElement===dock && dock.getClientRects().length) return;
    const element=dialog.open
      ? dialog.querySelector('#browserTakeoverTitle')
      : summary.querySelector('.browser-preview-row');
    if (!element) return;
    element.getAnimations().filter(animation=>animation.id==='browser-handoff').forEach(animation=>animation.cancel());
    element.animate([
      {opacity:0,transform:`translateX(${toUser?16:-16}px) scale(.97)`},
      {opacity:1,transform:'translateX(0) scale(1)'}
    ], {id:'browser-handoff',duration:300,easing:'ease-out'});
  }
  function go(next) {
    const wasUser=stage==='login'||stage==='signed';
    const toUser=next==='login'||next==='signed';
    const firstTransition=stage==='understanding' && next==='browsing';
    const animate=firstTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(firstTransition)preserveConversationScrollRange();
    manualBrowsing=false;
    if (!['asking','login'].includes(next)) loginForm.reset();
    stage=next;
    render(animate);
    if(page.parentElement===dock && ['done','understanding'].includes(stage))undock();
    if(page.parentElement===dock && dock.getClientRects().length)openBrowser(true);
    else if(toUser || (dialog.open && wasUser && (stage==='asking'||stage==='reading')))openBrowser();
    else if(dialog.open)dialog.close();
    if(wasUser!==toUser)animateHandoff(toUser);
    if(stage==='done')onComplete();
    syncProgress();
  }
  function click(event) {
    const key=event.target.closest('[data-browser-step]')?.dataset.browserStep;
    if(!active||!key)return;
    if(key==='dock'){
      dialog.close();
      dock.append(page,controlButton);
      openDock(dialog.querySelector('[data-browser-address]').textContent);
      controlButton.focus({preventScroll:true});
    }
    if(stage==='browsing' && (key==='take-control'||key==='give-back')){
      manualBrowsing=key==='take-control';
      render();
      openBrowser(page.parentElement===dock);
      animateHandoff(manualBrowsing);
    }
    if(key==='open-login' && manualBrowsing)go('login');
    if(key==='take-control' && ['asking','reading'].includes(stage))go(stage==='reading'?'signed':'login');
    if(key==='give-back' && (stage==='login'||stage==='signed'))go(stage==='signed'?'reading':'asking');
    if(key==='view')openBrowser();
    if(key==='close')dialog.close();
    if(key==='restart'&&stage==='done'){go('understanding');}
  }
  loginForm.addEventListener('submit', event => {
    event.preventDefault();
    if (active && stage === 'login') go('signed');
  });
  for(const host of [summary,thread,dialog,dock])host.addEventListener('click',click);
  return {
    get acceptsQueuedMessages(){return active && stage!=='understanding' && stage!=='done';},
    get progress(){
      const index=order.indexOf(stage);
      return {first:index===0,label:`${index+1}/${order.length} · ${nextLabels[index]} ${stage==='done'?'↺':'→'}`};
    },
    step(delta){
      if(active)go(order[Math.max(0,order.indexOf(stage)+delta)%order.length]);
    },
    initial:(entering=false)=>`<section data-browser-reply data-started-at="${Date.now()}" class="browser-control-reply${entering?' is-entering':''}"></section>`,
    activate(enabled){
      if(!enabled){if(page.parentElement===dock)undock();loginForm.reset();if(dialog.open)dialog.close();}
      active=enabled;
      render();
    }
  };
};
