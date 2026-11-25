window.createBrowserControlDemo = function ({thread, onComplete, syncProgress, preserveConversationScrollRange, renderStageAcknowledgement, replaceStageContent}) {
  const pip = document.getElementById('browserPip');
  const summaryEntry=document.getElementById('summaryBrowserSection');
  const sessions=new Map();
  let task=null;
  const dialog=document.getElementById('browserTakeover');
  const page=dialog.querySelector('.browser-takeover-viewport');
  const controlButton=dialog.querySelector('.browser-take-control');
  const modeLabel=dialog.querySelector('[data-view-mode]');
  const loginForm = dialog.querySelector('form');
  let manualBrowsing=false;
  const stages = {
    understanding:['理解任务','我会在门店管理后台找到湖滨店，分别核对周六和周日的营业时间，再把结果告诉你。'],
    browsing:['Agent 正在使用浏览器','正在打开门店管理后台，查找湖滨店的营业时间。'],
    asking:['等待你接管','门店管理后台需要登录后才能查看营业时间。'],
    login:['你正在控制浏览器','请在浏览器窗口使用演示账号登录。'],
    signed:['你正在控制浏览器','已登录。交还浏览器后，我会继续查找湖滨店。'],
    reading:['Agent 正在使用浏览器','已接回浏览器，正在核对营业时间。'],
    done:['浏览器任务已完成','湖滨店周六和周日都是 09:00 开门，21:00 打烊。我在门店管理后台逐日核对过，两天的营业时段相同，每天营业 12 小时。']
  };
  const order=['understanding','browsing','asking','login','reading','done'];
  const nextLabels=['开始浏览','请求接管','接管浏览器','登录并交还','查看结果','重播演示'];
  let stage = 'understanding', active = false;
  function currentStepIndex() {
    return order.indexOf(stage==='signed'?'login':stage);
  }
  const takeoverCard = step => `<div class="browser-takeover-card">
    <span class="conversation-artifact-icon"><img class="browser-control-monitor" src="./assets/browser-control-monitor.svg" alt=""></span>
    <div><strong>您可以选择接管浏览器以完成操作</strong><small class="browser-takeover-description">或者以后使用您自己的浏览器</small></div>
    <button type="button" class="browser-takeover-card-action catpaw-primary-regular" data-browser-step="${step}" aria-controls="browserTakeover" aria-haspopup="dialog">接管</button>
  </div>`;
  function browserCardPreview(address) {
    const reading=['reading','signed','done'].includes(stage);
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
    const presentation=task?.dataset.browserPresentation;
    summaryEntry.hidden=!active || presentation!=='summary';
    pip.hidden = !active || presentation!=='pip' || stage==='understanding' || stage==='done';
    const card = stage==='asking' ? takeoverCard('take-control') : stage==='login' ? takeoverCard('view') : '';
    const needsUser = Boolean(card) || stage==='signed';
    if (!active) return;
    const [status, reply] = manualBrowsing ? ['你正在控制浏览器','你正在查看门店管理后台，归还控制后妙手会继续查询。'] : stages[stage];
    const panel = thread.querySelector('[data-browser-reply]');
    if (panel) {
      const initial=stage==='understanding', done=stage==='done';
      const state=initial?'planning':done?'done':needsUser?'waiting':'reading';
      const elapsed=Math.max(0,Math.floor((Date.now()-Number(panel.dataset.startedAt))/1000));
      const statusLine=`<div class="stage-thinking" data-browser-stage="${stage}" data-global-state="${state}"><div class="stage-thinking-status"><span class="global-status-paw" aria-hidden="true"></span><strong class="stage-global-label" role="status">${done?'已完成':status}</strong><span class="stage-elapsed">${elapsed}秒</span></div></div>`;
      const replyText=presentation==='summary' && stage==='asking' ? reply+' 打开摘要里的「妙手的电脑」即可接管。' : reply;
      const text=initial?`<article class="md conversation-reply stage-acknowledgement"><p>${renderStageAcknowledgement(reply)}</p></article>`:`<section class="${done?'stage-result':'stage-current'}"><p>${replyText}</p>${presentation==='summary'?'':card}</section>`;
      if(!initial)panel.classList.remove('is-entering');
      const entering = panel.classList.contains('is-entering') && !panel.hasChildNodes();
      replaceStageContent(panel,statusLine+text,panel.hasChildNodes() && !startBrowsing);
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
    const preview=browserCardPreview(address);
    if(!summaryEntry.hidden){
      summaryEntry.querySelector('[data-browser-summary-preview]').innerHTML=preview;
      summaryEntry.querySelector('[data-browser-summary-status]').textContent=stage==='understanding'?'理解任务':controlLabel;
    }
    if(!pip.hidden){
      pip.innerHTML=preview;
      pip.setAttribute('aria-label',`查看妙手的浏览器，${controlLabel}`);
    }
    task.querySelector('.task-state').innerHTML=needsUser?'<em class="tag-await">待接管</em>':'';
  }
  function userHasControl() {
    return manualBrowsing || stage==='login' || stage==='signed';
  }
  function updateBrowser() {
    const watching=(stage==='browsing'&&!manualBrowsing)||stage==='reading';
    const waiting=stage==='asking';
    const userControls=userHasControl();
    controlButton.hidden=!(watching||waiting||userControls);
    modeLabel.parentElement.classList.toggle('is-controlling',userControls);
    controlButton.dataset.browserStep=userControls?'give-back':'take-control';
    const actionLabel=userControls?'停止':'取得控制权';
    controlButton.querySelector('[data-control-label]').textContent=actionLabel;
    modeLabel.textContent=userControls?'你正在控制':'仅观看';
    controlButton.setAttribute('aria-label',actionLabel);
    const monitor=page.querySelector('[data-browser-monitor]');
    const loginPage=waiting||stage==='login';
    monitor.hidden=loginPage;
    if(!loginPage){
      const reading=['reading','signed','done'].includes(stage);
      monitor.querySelector('h2').textContent=reading?'湖滨店 · 营业时间':'门店管理后台';
      monitor.querySelector('[data-store-search]').hidden=reading;
      monitor.querySelector('[data-store-hours]').hidden=!reading;
      monitor.querySelector('[data-browser-step="open-login"]').inert=!userControls;
    }
    loginForm.parentElement.hidden=!loginPage;
    loginForm.inert=!userControls;
    page.querySelector('[data-browser-instruction]').textContent='输入任意演示用户名和密码即可登录。';

  }
  function openBrowser() {
    if(!dialog.open)dialog.showModal();
    updateBrowser();
    requestAnimationFrame(()=>{
      const target=stage==='login'?loginForm.querySelector('input'):controlButton;
      target.focus({preventScroll:true});
    });
  }
  function go(next) {
    const toUser=next==='login'||next==='signed';
    const firstTransition=stage==='understanding' && next==='browsing';
    const animate=firstTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(firstTransition)preserveConversationScrollRange();
    manualBrowsing=false;
    if (!['asking','login'].includes(next)) loginForm.reset();
    stage=next;
    render(animate);
    if(dialog.open && ['done','understanding'].includes(stage))dialog.close();
    if(dialog.open)updateBrowser();
    else if(toUser)openBrowser();
    if(stage==='done')onComplete();
    syncProgress();
  }
  function click(event) {
    const key=event.target.closest('[data-browser-step]')?.dataset.browserStep;
    if(!active||!key)return;
    if(stage==='browsing' && key==='take-control'){
      manualBrowsing=true;
      render();
      updateBrowser();
    }
    if(key==='open-login' && manualBrowsing)go('login');
    if(key==='take-control' && ['asking','reading'].includes(stage))go(stage==='reading'?'signed':'login');
    if(key==='give-back')returnControl();
    if(key==='close')closeBrowser();
    if(key==='view')openBrowser();
  }
  function returnControl(){
    if(userHasControl())go(stage==='signed'?'reading':manualBrowsing?'browsing':'asking');
  }
  function closeBrowser(){
    returnControl();
    dialog.close();
  }
  dialog.addEventListener('cancel',event=>{
    event.preventDefault();
    closeBrowser();
  });
  loginForm.addEventListener('submit', event => {
    event.preventDefault();
    if (active && stage === 'login') go('signed');
  });
  for(const host of [pip,summaryEntry,thread,dialog])host.addEventListener('click',click);
  return {
    get acceptsQueuedMessages(){return active && stage!=='understanding' && stage!=='done';},
    get progress(){
      const index=currentStepIndex();
      return {first:index===0,label:`${index+1}/${order.length} · ${stage==='signed'?'交还并继续':nextLabels[index]} ${stage==='done'?'↺':'→'}`};
    },
    step(delta){
      if(active)go(order[Math.max(0,currentStepIndex()+delta)%order.length]);
    },
    initial:(entering=false)=>`<section data-browser-reply data-started-at="${Date.now()}" class="browser-control-reply${entering?' is-entering':''}"></section>`,
    activate(nextTask){
      if(task!==nextTask){
        if(task)sessions.set(task,{stage,manualBrowsing});
        if(dialog.open)dialog.close();
        loginForm.reset();
        task=nextTask;
        const saved=sessions.get(task);
        stage=saved?.stage ?? 'understanding';
        manualBrowsing=saved?.manualBrowsing ?? false;
      }
      active=Boolean(task);
      render();
    }
  };
};
