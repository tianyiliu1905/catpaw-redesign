/* Enterprise personal credits demo. No billing requests or real account mutations. */
(() => {
  'use strict';
  const PAGE_SIZE = 20;
  const messages = {
    enterprise: '当前企业总积分已耗尽，个人积分暂不可使用，请联系企业管理员添加企业积分。',
    department: '企业内当前部门的积分已耗尽，个人积分暂不可使用，请联系企业管理员添加企业积分。',
    personal: '当前个人积分已耗尽，请联系企业管理员添加积分。'
  };
  const alerts = {
    enterprise: {title:'企业积分即将耗尽', text:'当前企业总积分即将耗尽，为保证正常使用，请及时联系企业管理员添加积分。'},
    department: {title:'企业内当前部门积分即将耗尽', text:'企业内当前部门的积分即将耗尽，为保证正常使用，请及时联系企业管理员添加积分。'}
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const money = value => Number(value).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  function derive(data) {
    const limited = Number.isFinite(data.personalLimit) && data.personalLimit >= 0;
    const used = Math.max(0, Number(data.personalUsed) || 0);
    const balance = limited ? Math.max(0, Math.round((data.personalLimit-used)*100)/100) : null;
    const state = data.enterpriseRemaining <= 0 ? 'enterprise' : data.departmentRemaining <= 0 ? 'department' : limited && balance === 0 ? 'personal' : 'normal';
    const locked = state === 'enterprise' || state === 'department';
    return {limited,used,balance,state,locked,error:state!=='normal',message:messages[state]||'',percentage:limited?(data.personalLimit===0?100:Math.min(100,used/data.personalLimit*100)):0};
  }
  function warnings(data) {
    return ['enterprise','department'].filter(scope => Number.isFinite(data[scope+'Total']) && data[scope+'Total']>0 && data[scope+'Remaining']>0 && data[scope+'Remaining']/data[scope+'Total']<.1);
  }
  function paginate(records,page) {
    const count=Math.max(1,Math.ceil(records.length/PAGE_SIZE));
    const current=Math.max(1,Math.min(count,Math.floor(Number(page)||1)));
    return {page:current,pages:count,total:records.length,rows:records.slice((current-1)*PAGE_SIZE,current*PAGE_SIZE)};
  }
  function nextRefresh(date=new Date()) {
    const next=new Date(date.getFullYear(),date.getMonth()+1,1);
    return `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-01 00:00:00`;
  }
  const names=['把这个音频文件识别为文本给我','你可以帮我把录音文件转成文字吗','对比三家供应商的报价与服务范围','整理本周门店履约异常明细','分析竞品在会员权益上的差异','把季度复盘要点汇总成幻灯片','逐张检查以下 10 张幻灯片渲染图，标注排版问题并给出修改建议','帮我做一个网页版小工具：输入订单编号后查询履约情况','整理经营月报','制作项目资料目录','核对供应商付款条件','汇总项目风险和待确认事项'];
  const costs=[8.79,10.67,218.73,29.25,9.87,329.32,15.03,62.41,18.59,41.60,20.70,52.36,89.20,126.80,39.54,107.75,64.44,21.85,39.22,98.47,63.28,28.82,112.43];
  costs.push((171945-costs.reduce((sum,n)=>sum+Math.round(n*100),0))/100);
  const records=costs.map((cost,index)=>({id:index+1,message:names[index%names.length],cost,model:index%5===2?'Kimi-K3':'GLM-5.3',updated:`2026-11-${String(6-Math.floor(index/5)).padStart(2,'0')} ${String(15-index%5).padStart(2,'0')}:${String(41-index%7).padStart(2,'0')}:53`,channel:'client'}));
  function sample(config={}) {
    const data={personalLimit:config.unlimited?null:100000,personalUsed:1719.45,enterpriseTotal:1000000,enterpriseRemaining:500000,departmentTotal:100000,departmentRemaining:50000,refreshAt:nextRefresh(),records};
    if(config.status==='enterprise')data.enterpriseRemaining=0;
    if(config.status==='department')data.departmentRemaining=0;
    if(config.status==='personal'&&!config.unlimited)data.personalUsed=data.personalLimit;
    if(config.warning==='enterprise'&&data.enterpriseRemaining>0)data.enterpriseRemaining=data.enterpriseTotal*.08;
    if(config.warning==='department'&&data.departmentRemaining>0)data.departmentRemaining=data.departmentTotal*.08;
    return data;
  }
  function balanceHTML(data) {
    const state=derive(data);
    if(!state.limited)return '';
    return `${state.message?`<div class="credits-notice${state.state==='personal'?' credits-notice-neutral':''}" role="status">${esc(state.message)}</div>`:''}<section class="credits-balance-card" aria-label="个人积分余额"><div class="credits-balance-top"><span>积分余额</span><strong class="${state.locked?'credits-error':state.state==='personal'?'credits-personal-empty':''}">${state.locked?'<small class="credits-unavailable">不可用</small>':''}${money(state.balance)}<small>积分</small></strong></div></section><section class="credits-usage-summary" aria-label="个人积分使用情况"><div class="credits-usage-heading"><span>积分使用情况</span><strong class="credits-usage-percentage ${state.locked?'credits-error':state.state==='personal'?'credits-personal-empty':''}">${state.percentage.toFixed(2)}<small>%</small></strong></div><div class="credits-usage-values"><b>${money(state.used)}</b> / <b>${money(data.personalLimit)}</b> 已用</div><div class="credits-progress" role="progressbar" aria-label="个人积分已使用比例" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${state.percentage.toFixed(2)}"><span class="${state.locked?'credits-progress-error':state.state==='personal'?'credits-progress-neutral':''}" style="width:${state.percentage}%"></span></div></section><div class="credits-usage-caption"><span>下次积分刷新时间：${esc(data.refreshAt)}</span></div>`;
  }

  function usageHTML(data,page) {
    const result=paginate((data.records||[]).filter(row=>row.channel==='client'),page);
    return `<div class="credits-table-frame"><div class="credits-table-scroll"><table class="credits-table"><thead><tr><th scope="col">消息内容</th><th scope="col">积分消耗</th><th scope="col">模型</th><th scope="col">更新时间</th></tr></thead><tbody>${result.rows.length?result.rows.map(row=>`<tr><td title="${esc(row.message)}"><span>${esc(row.message)}</span></td><td>${money(row.cost)}</td><td>${esc(row.model)}</td><td>${esc(row.updated)}</td></tr>`).join(''):'<tr><td colspan="4" class="credits-empty">暂无积分使用记录</td></tr>'}</tbody></table></div><footer class="credits-pagination"><span>第 ${result.page} 页（每页 20 条），共 ${result.total} 条</span><div><button type="button" data-credits-page="${result.page-1}" ${result.page===1?'disabled':''}>上一页</button><label>第 <select aria-label="跳转到页码" data-credits-page-select>${Array.from({length:result.pages},(_,i)=>`<option value="${i+1}" ${result.page===i+1?'selected':''}>${i+1}</option>`).join('')}</select> / ${result.pages} 页</label><button type="button" data-credits-page="${result.page+1}" ${result.page===result.pages?'disabled':''}>下一页</button></div></footer></div>`;
  }
  const model={derive,warnings,paginate,sample,balanceHTML,usageHTML,nextRefresh,money};
  if(typeof module!=='undefined'&&module.exports)module.exports=model;
  if(typeof document==='undefined')return;
  const trigger=document.querySelector('.settings-nav');
  if(!trigger)return;
  const coin='<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 5v14m4-11h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8"/></svg>';
  const chevron='<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
  const refreshIcon='<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M20 10a8 8 0 0 0-14-5L3 8m0-5v5h5M4 14a8 8 0 0 0 14 5l3-3m0 5v-5h-5"/></svg>';
  let config={status:'normal',warning:'none',unlimited:false};
  try{const saved=JSON.parse(localStorage.getItem('catpaw-credits-demo-v1')||'null');if(saved)config={...config,...saved};}catch{/* Preview storage is optional. */}
  let data=sample(config),tab=derive(data).limited?'balance':'usage',page=1,busy=false,loadGeneration=0;
  const shownWarnings=new Set();let warningQueue=[];
  const menu=document.createElement('div');menu.id='creditsAccountMenu';menu.className='credits-account-menu';menu.hidden=true;menu.setAttribute('role','menu');menu.setAttribute('aria-label','个人菜单');
  const dialog=document.createElement('dialog');dialog.className='credits-dialog';dialog.id='creditsDetailsDialog';dialog.setAttribute('aria-labelledby','creditsDialogTitle');
  dialog.innerHTML=`<header class="credits-dialog-head"><h2 id="creditsDialogTitle">积分明细</h2><button type="button" data-credits-close aria-label="关闭积分明细">×</button></header><div class="credits-tabs-row"><div role="tablist" aria-label="积分明细"><button type="button" id="creditsBalanceTab" role="tab" data-credits-tab="balance" aria-controls="creditsBalancePanel">积分余额</button><button type="button" id="creditsUsageTab" role="tab" data-credits-tab="usage" aria-controls="creditsUsagePanel">使用明细</button></div><button type="button" class="credits-refresh" data-credits-refresh>${refreshIcon}<span>刷新</span></button></div><div class="credits-panel" id="creditsBalancePanel" role="tabpanel" aria-labelledby="creditsBalanceTab"></div><div class="credits-panel" id="creditsUsagePanel" role="tabpanel" aria-labelledby="creditsUsageTab"></div><p class="credits-load-error" role="status" hidden></p><details class="credits-demo-config"><summary>演示状态</summary><div><label>个人限额<select data-credits-config="unlimited"><option value="false">有限额</option><option value="true">无限额</option></select></label><label>积分状态<select data-credits-config="status"><option value="normal">正常</option><option value="enterprise">企业积分已耗尽</option><option value="department">部门积分已耗尽</option><option value="personal">个人积分已耗尽</option></select></label><label>余额提醒<select data-credits-config="warning"><option value="none">不提醒</option><option value="enterprise">企业积分低于 10%</option><option value="department">部门积分低于 10%</option></select></label><span>本地演示数据</span></div></details>`;
  const warning=document.createElement('section');warning.className='credits-warning';warning.hidden=true;warning.setAttribute('role','status');warning.setAttribute('aria-live','polite');
  document.body.append(menu,dialog,warning);
  const balancePanel=dialog.querySelector('#creditsBalancePanel'),usagePanel=dialog.querySelector('#creditsUsagePanel');
  trigger.setAttribute('aria-controls',menu.id);trigger.setAttribute('aria-haspopup','menu');trigger.setAttribute('aria-expanded','false');trigger.title='个人菜单';trigger.setAttribute('aria-label','个人菜单');
  function renderMenu(){
    const state=derive(data);
    const errorIcon=state.locked?`<span class="credits-menu-error" title="${esc(state.message)}" aria-label="${esc(state.message)}">!</span>`:'';
    menu.innerHTML=`<header><strong>我的账户</strong><span>企业版</span></header><button type="button" role="menuitem" data-credits-open>${coin}<span>${state.limited?'积分余额':'积分明细'}</span>${state.limited?`<strong class="${state.locked?'credits-error':state.state==='personal'?'credits-personal-empty':''}">${errorIcon}${money(state.balance)}</strong>`:''}${chevron}</button><button type="button" role="menuitem" class="credits-admin" disabled title="当前 Demo 未接入企业管理后台"><svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 17v4m-4 0h8"/></svg><span>企业管理后台</span></button><button type="button" role="menuitem" data-credits-settings><svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg><span>设置</span></button>`;
  }
  function placeMenu(){const rect=trigger.getBoundingClientRect();menu.style.left=`${Math.max(12,Math.min(rect.left,innerWidth-menu.offsetWidth-12))}px`;menu.style.top=`${Math.max(12,rect.top-menu.offsetHeight-10)}px`;}
  function closeMenu(focus=false){menu.hidden=true;trigger.setAttribute('aria-expanded','false');if(focus)trigger.focus();}
  function render(){
    const state=derive(data);if(!state.limited)tab='usage';
    balancePanel.innerHTML=balanceHTML(data);usagePanel.innerHTML=usageHTML(data,page);balancePanel.hidden=tab!=='balance';usagePanel.hidden=tab!=='usage';
    const tabs=[...dialog.querySelectorAll('[data-credits-tab]')];tabs.forEach(button=>{const selected=button.dataset.creditsTab===tab;button.hidden=!state.limited&&button.dataset.creditsTab==='balance';button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;});
    dialog.querySelectorAll('[data-credits-config]').forEach(select=>{select.value=String(config[select.dataset.creditsConfig]);if(select.dataset.creditsConfig==='status')select.querySelector('[value="personal"]').disabled=config.unlimited;});
    renderMenu();
  }
  function showNextWarning(){
    if(!warning.hidden)return;
    const scope=warningQueue.shift();if(!scope)return;
    shownWarnings.add(`${data.refreshAt}:${scope}`);
    if(dialog.open)dialog.append(warning);else document.body.append(warning);
    warning.innerHTML=`<button type="button" data-credits-warning-close aria-label="关闭积分提醒">×</button><h3>${alerts[scope].title}</h3><p>${alerts[scope].text}</p><button type="button" data-credits-warning-close>我知道了</button>`;warning.hidden=false;
  }
  function checkWarnings(){
    const scopes=warnings(data).filter(scope=>!shownWarnings.has(`${data.refreshAt}:${scope}`));
    warningQueue=[...new Set([...warningQueue,...scopes])];showNextWarning();
  }
  async function reload(showBusy=false){
    if(busy)return;const generation=++loadGeneration;busy=true;
    const button=dialog.querySelector('[data-credits-refresh]');if(showBusy){button.disabled=true;button.querySelector('span').textContent='刷新中';button.setAttribute('aria-busy','true');}
    try{
      if(window.CatPawCreditsData?.load){const next=await window.CatPawCreditsData.load();if(!next||!Array.isArray(next.records))throw Error('积分数据格式不正确');if(generation===loadGeneration)data=next;}
      else if(showBusy)await new Promise(resolve=>setTimeout(resolve,450));
      if(generation!==loadGeneration)return;
      dialog.querySelector('.credits-load-error').hidden=true;render();checkWarnings();
    }catch{const error=dialog.querySelector('.credits-load-error');error.textContent='积分刷新失败，请稍后重试。';error.hidden=false;}
    finally{if(generation===loadGeneration){busy=false;button.disabled=false;button.querySelector('span').textContent='刷新';button.removeAttribute('aria-busy');}}
  }
  function openMenu(){if(!menu.hidden){closeMenu();return;}renderMenu();menu.hidden=false;trigger.setAttribute('aria-expanded','true');placeMenu();reload();menu.querySelector('[data-credits-open]').focus();}
  function syncProductMask(){
    const product=document.getElementById('window');
    if(!dialog.open||!product)return;
    const rect=product.getBoundingClientRect();
    if(!(rect.width>0&&rect.height>0))return;
    dialog.style.setProperty('--credits-product-left',`${rect.left}px`);
    dialog.style.setProperty('--credits-product-top',`${rect.top}px`);
    dialog.style.setProperty('--credits-product-width',`${rect.width}px`);
    dialog.style.setProperty('--credits-product-height',`${rect.height}px`);
    dialog.style.setProperty('--credits-product-radius',getComputedStyle(product).borderRadius);
  }
  function openDetails(){closeMenu();tab=derive(data).limited?'balance':'usage';page=1;render();dialog.showModal();syncProductMask();if(!warning.hidden)dialog.append(warning);reload();}
  trigger.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();openMenu();},true);
  menu.addEventListener('click',event=>{if(event.target.closest('[data-credits-open]'))openDetails();if(event.target.closest('[data-credits-settings]')){closeMenu();document.getElementById('disclosureSettings').showModal();reload();}});
  menu.addEventListener('keydown',event=>{const items=[...menu.querySelectorAll('button:not(:disabled)')];const index=items.indexOf(document.activeElement);if(event.key==='Escape'){event.preventDefault();closeMenu(true);}if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;items[next].focus();}});
  document.addEventListener('click',event=>{if(!menu.hidden&&!menu.contains(event.target)&&!trigger.contains(event.target))closeMenu();});
  window.addEventListener('resize',()=>{if(!menu.hidden)placeMenu();syncProductMask();});
  window.addEventListener('scroll',syncProductMask,true);
  const productWindow=document.getElementById('window');
  if(productWindow&&typeof ResizeObserver!=='undefined')new ResizeObserver(syncProductMask).observe(productWindow);
  dialog.querySelector('[data-credits-close]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{document.body.append(warning);trigger.focus();});
  const usageScrollTimers=new WeakMap();
  dialog.addEventListener('scroll',event=>{
    const area=event.target;
    if(!area.matches('.credits-table-scroll'))return;
    clearTimeout(usageScrollTimers.get(area));
    area.classList.add('is-scrolling');
    usageScrollTimers.set(area,setTimeout(()=>{area.classList.remove('is-scrolling');usageScrollTimers.delete(area);},650));
  },true);
  dialog.addEventListener('click',event=>{
    const button=event.target.closest('[data-credits-tab],[data-credits-page],[data-credits-refresh]');if(!button)return;
    if(button.dataset.creditsTab){tab=button.dataset.creditsTab;render();}
    if(button.dataset.creditsPage){page=Number(button.dataset.creditsPage);render();}
    if(button.hasAttribute('data-credits-refresh'))reload(true);
  });
  dialog.addEventListener('keydown',event=>{const selected=event.target.closest('[data-credits-tab]');if(!selected||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const visible=[...dialog.querySelectorAll('[data-credits-tab]')].filter(button=>!button.hidden);const index=visible.indexOf(selected);const next=event.key==='Home'?visible[0]:event.key==='End'?visible.at(-1):visible[(index+(event.key==='ArrowRight'?1:-1)+visible.length)%visible.length];tab=next.dataset.creditsTab;render();next.focus();});
  dialog.addEventListener('change',event=>{
    const key=event.target.dataset.creditsConfig;
    if(event.target.hasAttribute('data-credits-page-select')){page=Number(event.target.value);render();return;}
    if(!key)return;config[key]=key==='unlimited'?event.target.value==='true':event.target.value;if(config.unlimited&&config.status==='personal')config.status='normal';
    if(busy){loadGeneration++;busy=false;}data=sample(config);page=1;shownWarnings.clear();warningQueue=[];warning.hidden=true;
    try{localStorage.setItem('catpaw-credits-demo-v1',JSON.stringify(config));}catch{/* Keep state in memory. */}
    render();checkWarnings();
  });
  warning.addEventListener('click',event=>{if(event.target.closest('[data-credits-warning-close]')){warning.hidden=true;showNextWarning();}});
  document.addEventListener('focusin',event=>{if(event.target.matches('#prompt,#conversationPrompt,#fullscreenChatInput'))reload();});
  document.addEventListener('submit',event=>{if(event.target.matches('#conversationForm,#fullscreenChatForm')&&event.target.querySelector('textarea')?.value.trim()){warning.hidden=true;warningQueue=[];}},true);
  window.CatPawCredits={open:openDetails,openMenu,reload,model};
  render();
})();
