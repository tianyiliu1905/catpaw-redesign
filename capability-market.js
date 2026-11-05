/* Local capability marketplace demo, using source assets from Figma 4943:60580. */
(function(root){
  'use strict';
  const base='assets/capability-market/';
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const description='帮您一键领取美团优惠券，搜索附近团购美食并下单，探索今日活动。';
  const experts=[
    ['美团本地生活','rabbit.png','生活服务','限免',true,['UI 组件','界面规范']],
    ['企业微信助手','b8aa3.png','开发工具','试用将到期 12.15',false,['UI 组件','组件库','界面规范']],
    ['小红书运营专家','d5596.png','内容创作','付费使用',false,['UI 组件','组件库','界面规范']],
    ['爆款选题策划专家','6b2cb.png','内容创作','付费使用',false,[]],
    ['营销分析专家','bf247.png','投资理财','付费使用',true,['UI 组件','组件库','界面规范']],
    ['内容创作专家','1ce70.png','内容创作','已付费',false,[]],
    ['财务管家','c7637.png','投资理财','已付费',false,['UI 组件','组件库','界面规范','组件库']],
    ['客户支持专家','91aa4.png','生活服务','已付费',false,[]],
    ['营销文案审核专家','b8aa3.png','内容创作','已付费',false,['UI 组件','组件库','界面规范']],
    ['PPT 制作专家','d5596.png','内容创作','已付费',false,['UI 组件','组件库','界面规范']],
    ['流量分析专家','6d732.png','信息资讯','订阅将到期 12.15',false,['组件库','界面规范']],
  ].map(([name,image,category,status,auth,tags])=>({kind:'expert',name,image,category,status,auth,tags,description:name==='企业微信助手'?'消息、邮件、文档、表格、待办、日程、会议、微盘、通讯录，企业微信一站式 AI 办公':description,example:'帮我领美团优惠券'}));
  function filterItems(items,{query='',category='全部',owned=false},names=[]){
    const needle=query.trim().toLocaleLowerCase();
    return items.filter(item=>(!owned||names.includes(item.name))&&(category==='全部'||item.category===category)&&(!needle||`${item.name} ${item.description} ${(item.tags||[]).join(' ')}`.toLocaleLowerCase().includes(needle)));
  }
  function create({host,onOpen=()=>{},onUse=()=>{},getOwned=()=>[],onInstall=()=>{},getOtherItems=()=>[]}){
    const state={kind:'expert',owned:false,category:'全部',query:''};
    let custom=[];try{custom=JSON.parse(localStorage.getItem('catpaw-market-custom')||'[]').filter(x=>x&&typeof x.name==='string'&&['expert','skill','mcp'].includes(x.kind)).slice(0,100);}catch(_){}
    const page=document.createElement('section');page.className='capability-market';page.hidden=true;page.setAttribute('aria-label','专家、技能和连接器广场');host.appendChild(page);
    const nav=document.getElementById('capabilityPageNav');
    const label=()=>({expert:'专家',skill:'技能',mcp:'连接器'}[state.kind]);
    const image=(file,cls='',alt='')=>`<img class="${cls}" src="${base+file}" alt="${escape(alt)}">`;
    const toolbarIcon=(file)=>image(file,'market-control-icon');
    page.innerHTML=`<header class="market-toolbar"><div class="market-kinds" role="tablist" aria-label="能力类型">${[['expert','专家'],['skill','技能'],['mcp','连接器']].map(([kind,text])=>`<button type="button" role="tab" data-market-kind="${kind}">${text}</button>`).join('')}</div><div class="market-tools"><button type="button" data-market-refresh>${toolbarIcon('5c90d.svg')}刷新</button><label class="market-search">${toolbarIcon('04bee.svg')}<input type="search" aria-label="搜索专家" placeholder="搜索专家"></label><i class="market-tool-divider"></i><button class="market-upload" type="button" data-market-import aria-label="导入专家">${toolbarIcon('2c710.svg')}</button><button type="button" class="market-create" data-market-create>${toolbarIcon('b04d2.svg')}<span>创建专家</span></button></div></header><div class="market-scroll"><section class="market-featured"><div class="market-featured-heading"><h2>${image('34864.svg','market-wheat')}精选专家${image('7a46a.svg','market-wheat market-wheat-right')}</h2><div><button type="button" data-market-prev aria-label="上一组精选专家">${toolbarIcon('e3240.svg')}</button><button type="button" data-market-next aria-label="下一组精选专家">${toolbarIcon('f03b1.svg')}</button></div></div><div class="market-featured-viewport"><div class="market-featured-track"></div></div></section><div class="market-ownership" role="tablist" aria-label="市场与我的"><button type="button" role="tab" data-market-owned="false">市场</button><button type="button" role="tab" data-market-owned="true">我的</button></div><div class="market-categories" role="group" aria-label="分类筛选"></div><div class="market-cards"></div></div><p class="market-feedback" role="status" hidden></p>`;
    const search=page.querySelector('input'),cards=page.querySelector('.market-cards'),featured=page.querySelector('.market-featured-track');
    let feedbackTimer;
    function feedback(text){const el=page.querySelector('.market-feedback');clearTimeout(feedbackTimer);el.textContent=text;el.hidden=false;feedbackTimer=setTimeout(()=>{el.hidden=true},2500);}
    function allItems(){
      const items=state.kind==='expert'?experts:getOtherItems(state.kind);
      const list=[...items,...custom.filter(x=>x.kind===state.kind)];
      if(state.owned)for(const name of getOwned(state.kind))if(!list.some(x=>x.name===name))list.push({kind:state.kind,name,description:'已添加，可在对话中选择使用。',category:'全部',tags:[],status:'已添加'});
      return list;
    }
    function avatar(item,size=''){
      return item.image?image(item.image,`market-avatar ${size}`):`<span class="market-avatar market-avatar-existing ${size}">${item.avatar||escape(item.name.slice(0,1))}</span>`;
    }
    function badges(item){
      const type=item.status==='限免'?'free':/到期/.test(item.status)?'expiring':item.status==='付费使用'?'paid':'';
      return `<span class="market-badge ${type}">${type==='free'?image('a2aec.svg','market-badge-icon'):''}${escape(item.status||'可添加')}</span>${item.auth?`<span class="market-badge">${image('4a050.svg','market-badge-icon')}需授权</span>`:''}${item.tags?.length?image('16ed0.svg','market-badge-divider'):''}${(item.tags||[]).map(t=>`<span class="market-badge">${escape(t)}</span>`).join('')}`;
    }
    function render(){
      page.querySelectorAll('[data-market-kind]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.marketKind===state.kind)));
      page.querySelectorAll('[data-market-owned]').forEach(b=>b.setAttribute('aria-selected',String((b.dataset.marketOwned==='true')===state.owned)));
      search.placeholder=`搜索${label()}`;search.setAttribute('aria-label',search.placeholder);
      page.querySelector('[data-market-create] span').textContent=`创建${label()}`;page.querySelector('[data-market-import]').setAttribute('aria-label',`导入${label()}`);
      page.querySelector('.market-featured').hidden=state.kind!=='expert'||state.owned;
      const categories=['全部','生活服务','开发工具','网站部署','内容创作','投资理财','信息资讯'];
      page.querySelector('.market-categories').innerHTML=categories.map(c=>`<button type="button" data-market-category="${c}" aria-pressed="${state.category===c}">${c}</button>`).join('');
      const owned=getOwned(state.kind),items=filterItems(allItems(),state,owned);
      cards.innerHTML=items.length?items.map(item=>`<article class="market-card" data-market-item="${escape(item.name)}"><div class="market-card-head">${avatar(item)}<div class="market-card-info"><h3>${escape(item.name)}</h3><div class="market-badges">${badges(item)}</div></div><button type="button" class="market-install" data-market-install="${escape(item.name)}">${owned.includes(item.name)?'使用':'安装'}</button></div><p>${escape(item.description||description)}</p></article>`).join(''):'<p class="market-empty">'+(state.query?'没有找到匹配的'+label():state.owned?'还没有添加'+label():'暂无'+label())+'</p>';
      featured.innerHTML=['66ce2.png','1ce70.png','29196.png','6d732.png'].map((file,index)=>`<article class="market-feature-card"><div class="market-feature-intro">${avatar({image:file},'market-avatar-large')}<div><h3>UI 设计师</h3><p>${description}</p></div></div><div class="market-badges">${badges({status:'限免',tags:['UI 组件','组件库','界面规范']})}</div><button type="button" data-market-try="${index}">${image('e9ff6.svg','market-feature-divider')}${image('802e1.svg','market-control-icon')}<span>试试这样问：“帮我领美团优惠券”</span>${image('ba448.svg','market-control-icon')}</button></article>`).join('');
    }
    function open(){onOpen();page.hidden=false;host.classList.add('capability-view');document.querySelectorAll('.sidebar-rail [aria-current]').forEach(el=>el.removeAttribute('aria-current'));nav.setAttribute('aria-current','page');render();}
    function close(){page.hidden=true;host.classList.remove('capability-view');nav.removeAttribute('aria-current');}
    nav.addEventListener('click',event=>{event.preventDefault();open()});
    document.querySelector('.sidebar-rail').addEventListener('click',event=>{if(!event.target.closest('#capabilityPageNav'))close()},true);
    search.addEventListener('input',()=>{state.query=search.value;render()});
    function persist(){try{localStorage.setItem('catpaw-market-custom',JSON.stringify(custom));}catch(_){} }
    const editor=document.createElement('dialog');editor.className='market-editor';host.appendChild(editor);
    page.addEventListener('click',event=>{
      const kind=event.target.closest('[data-market-kind]');if(kind){state.kind=kind.dataset.marketKind;state.category='全部';state.query='';search.value='';render();return;}
      const owner=event.target.closest('[data-market-owned]');if(owner){state.owned=owner.dataset.marketOwned==='true';render();return;}
      const category=event.target.closest('[data-market-category]');if(category){state.category=category.dataset.marketCategory;render();return;}
      if(event.target.closest('[data-market-refresh]')){render();feedback('已刷新');return;}
      const prev=event.target.closest('[data-market-prev]'),next=event.target.closest('[data-market-next]');if(prev||next){featured.scrollBy({left:(next?1:-1)*362.5,behavior:'smooth'});return;}
      const install=event.target.closest('[data-market-install]');if(install){const item=allItems().find(x=>x.name===install.dataset.marketInstall);if(!item)return;if(getOwned(state.kind).includes(item.name)){close();onUse(item);}else{onInstall(item);render();feedback(`已添加${item.name}`);}return;}
      if(event.target.closest('[data-market-try]')){const item={kind:'expert',name:'UI 设计师',example:'帮我领美团优惠券'};onInstall(item);close();onUse(item);return;}
      if(event.target.closest('[data-market-create]')){
        editor.innerHTML=`<form><h2>创建${label()}</h2><label>名称<input name="name" required maxlength="50" autocomplete="off"></label><label>描述<textarea name="description" rows="3" required maxlength="300"></textarea></label><div><button type="button" data-market-cancel>取消</button><button type="submit">创建</button></div></form>`;
        editor.querySelector('[data-market-cancel]').onclick=()=>editor.close();editor.querySelector('form').onsubmit=event=>{event.preventDefault();const form=event.currentTarget,name=form.elements.name.value.trim(),desc=form.elements.description.value.trim();if(!name||!desc)return;if(allItems().some(x=>x.name===name)){form.elements.name.setCustomValidity('该名称已存在');form.elements.name.reportValidity();form.elements.name.oninput=()=>form.elements.name.setCustomValidity('');return;}const item={kind:state.kind,name,description:desc,category:'全部',tags:[],status:'已创建'};custom.push(item);persist();onInstall(item);editor.close();state.owned=true;state.query='';search.value='';state.category='全部';render();};editor.showModal();return;
      }
      if(event.target.closest('[data-market-import]')){
        const picker=document.createElement('input');picker.type='file';picker.accept='application/json,.json';picker.onchange=async()=>{try{const file=picker.files[0];if(!file)return;const raw=JSON.parse(await file.text());if(typeof raw.name!=='string'||!raw.name.trim()||typeof raw.description!=='string')throw Error();const item={kind:state.kind,name:raw.name.trim().slice(0,50),description:raw.description.slice(0,300),category:'全部',tags:[],status:'已导入'};if(allItems().some(x=>x.name===item.name))throw Error();custom.push(item);persist();onInstall(item);render();feedback('已导入');}catch(_){feedback('请导入包含 name 和 description 的有效 JSON 文件，名称不可重复。')}};picker.click();
      }
    });
    return {open,close};
  }
  root.CatPawCapabilityMarket={create,filterItems,experts};
})(typeof globalThis!=='undefined'?globalThis:this);
