/* Fifth rail entry — website gallery from Figma 4943:60844. */
(function(root){
 'use strict';
 const base='assets/nocode-page/';
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const initial=['68077.png','eadf3.png','5aa78.png','68077.png','382e0.png','7a1d3.png','035e8.png'].map((image,index)=>({id:'site-'+index,name:'智能对话助手',type:'网站/应用',updated:0,image}));
 function filterItems(items,query='',type='全部类型',sort='updated'){
  const needle=query.trim().toLocaleLowerCase();
  return items.filter(item=>!item.deleted&&(!needle||item.name.toLocaleLowerCase().includes(needle))&&(type==='全部类型'||item.type.includes(type)))
   .sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'zh-CN'):b.updated-a.updated);
 }
 function create({host,onOpen=()=>{},onCreate=()=>{}}){
  let items=initial.map(x=>({...x}));try{const saved=JSON.parse(localStorage.getItem('catpaw-nocode-items'));if(Array.isArray(saved))items=saved.filter(x=>typeof x.id==='string'&&typeof x.name==='string'&&typeof x.type==='string'&&Number.isFinite(x.updated));}catch(_){}
  const state={query:'',type:'全部类型',sort:'updated'};
  const page=document.createElement('section');page.className='nocode-page';page.hidden=true;page.setAttribute('aria-label','网站 NoCode');host.appendChild(page);
  const nav=document.getElementById('nocodePageNav'),icon=file=>`<img class="nocode-control-icon" src="${base+file}" alt="">`;
  page.innerHTML=`<header class="nocode-toolbar"><h1>网站 NoCode</h1><div class="nocode-tools"><button type="button" data-nocode-notifications aria-label="通知">${icon('0bbc2.svg')}</button><label class="nocode-search">${icon('33c2b.svg')}<input type="search" placeholder="搜索" aria-label="搜索网站与应用"></label><i></i><button class="nocode-import" type="button" data-nocode-import aria-label="导入网站">${icon('bd52f.svg')}</button><button class="nocode-create" type="button" data-nocode-create>${icon('97bb6.svg')}创建</button></div></header><div class="nocode-scroll"><div class="nocode-filters"><label><select aria-label="类型筛选"><option>全部类型</option><option>网站</option><option>应用</option></select>${icon('f567d.svg')}</label><label><select aria-label="排序"><option value="updated">按更新</option><option value="name">按名称</option></select>${icon('f567d.svg')}</label></div><div class="nocode-grid"></div></div><div class="nocode-feedback" role="status" hidden></div><div class="nocode-card-menu" role="menu" hidden></div>`;
  const grid=page.querySelector('.nocode-grid'),menu=page.querySelector('.nocode-card-menu'),search=page.querySelector('input');
  const preview=document.createElement('dialog');preview.className='nocode-preview';host.appendChild(preview);
  const rename=document.createElement('dialog');rename.className='nocode-rename';host.appendChild(rename);
  let menuId=null,feedbackTimer;
  function save(){try{localStorage.setItem('catpaw-nocode-items',JSON.stringify(items));}catch(_){} }
  function feedback(text,undo){const el=page.querySelector('.nocode-feedback');clearTimeout(feedbackTimer);el.innerHTML=`<span>${escape(text)}</span>${undo?'<button type="button" data-nocode-undo>撤销</button>':''}`;el.hidden=false;if(undo)el.querySelector('button').onclick=()=>{undo();el.hidden=true};feedbackTimer=setTimeout(()=>{el.hidden=true},5000);}
  function render(){
   const visible=filterItems(items,state.query,state.type,state.sort);
   grid.innerHTML=visible.length?visible.map(item=>`<article class="nocode-card"><button class="nocode-thumbnail" type="button" data-nocode-open="${escape(item.id)}" aria-label="预览 ${escape(item.name)}"><img src="${base+escape(initial.some(x=>x.image===item.image)?item.image:'68077.png')}" alt="${escape(item.name)}网站预览"></button><div class="nocode-card-bottom"><div class="nocode-card-info"><div><h2>${escape(item.name)}</h2><span>${escape(item.type)}</span></div><p>${item.updated?'更新于 刚刚':'更新于 8个月前'}</p></div><button type="button" class="nocode-more" data-nocode-more="${escape(item.id)}" aria-label="${escape(item.name)}的更多操作" aria-haspopup="menu" aria-expanded="false">${icon('41d80.svg')}</button></div></article>`).join(''):`<p class="nocode-empty">${state.query?'没有找到匹配的网站或应用':'暂无网站或应用'}</p>`;
  }
  function closeMenu(){menu.hidden=true;menuId=null;page.querySelectorAll('[data-nocode-more]').forEach(b=>b.setAttribute('aria-expanded','false'));}
  function open(){onOpen();page.hidden=false;host.classList.add('nocode-view');document.querySelectorAll('.sidebar-rail [aria-current]').forEach(el=>el.removeAttribute('aria-current'));nav.setAttribute('aria-current','page');render();}
  function close(){page.hidden=true;host.classList.remove('nocode-view');nav.removeAttribute('aria-current');closeMenu();}
  nav.addEventListener('click',event=>{event.preventDefault();open()});
  document.querySelector('.sidebar-rail').addEventListener('click',event=>{if(!event.target.closest('#nocodePageNav'))close()},true);
  search.addEventListener('input',()=>{state.query=search.value;closeMenu();render()});
  page.querySelector('[aria-label="类型筛选"]').addEventListener('change',event=>{state.type=event.target.value;closeMenu();render()});
  page.querySelector('[aria-label="排序"]').addEventListener('change',event=>{state.sort=event.target.value;closeMenu();render()});
  page.querySelector('.nocode-scroll').addEventListener('scroll',closeMenu);
  page.addEventListener('keydown',event=>{if(event.key==='Escape'){closeMenu();search.focus()}});
  page.addEventListener('click',event=>{
   if(event.target.closest('[data-nocode-create]')){close();onCreate();return;}
   if(event.target.closest('[data-nocode-notifications]')){closeMenu();feedback('暂无新通知');return;}
   const more=event.target.closest('[data-nocode-more]');
   if(more){const id=more.dataset.nocodeMore;if(menuId===id&&!menu.hidden){closeMenu();return;}closeMenu();menuId=id;menu.innerHTML='<button type="button" role="menuitem" data-nocode-action="rename">重命名</button><button type="button" role="menuitem" data-nocode-action="duplicate">创建副本</button><button type="button" role="menuitem" data-nocode-action="remove">移至回收站</button>';menu.hidden=false;more.setAttribute('aria-expanded','true');const bounds=page.getBoundingClientRect(),anchor=more.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(anchor.right-bounds.left-140,bounds.width-148))+'px';menu.style.top=(anchor.bottom-bounds.top+4+menu.offsetHeight>bounds.height?anchor.top-bounds.top-menu.offsetHeight-4:anchor.bottom-bounds.top+4)+'px';menu.querySelector('button').focus();return;}
   const action=event.target.closest('[data-nocode-action]');
   if(action){const item=items.find(x=>x.id===menuId);closeMenu();if(!item)return;
    if(action.dataset.nocodeAction==='duplicate'){items.unshift({...item,id:'site-'+crypto.randomUUID(),name:item.name+'（副本）',updated:Date.now()});save();render();feedback('已创建副本');}
    if(action.dataset.nocodeAction==='remove'){item.deleted=true;save();render();feedback('已移至回收站',()=>{item.deleted=false;save();render()});}
    if(action.dataset.nocodeAction==='rename'){rename.innerHTML=`<form><h2>重命名</h2><input aria-label="名称" name="name" maxlength="80" required value="${escape(item.name)}"><div><button type="button" data-nocode-cancel>取消</button><button type="submit">保存</button></div></form>`;rename.querySelector('[data-nocode-cancel]').onclick=()=>rename.close();rename.querySelector('form').onsubmit=event=>{event.preventDefault();const name=event.currentTarget.elements.name.value.trim();if(!name)return;item.name=name;item.updated=Date.now();save();render();rename.close()};rename.showModal();}
    return;
   }
   closeMenu();
   const button=event.target.closest('[data-nocode-open]');
   if(button){const item=items.find(x=>x.id===button.dataset.nocodeOpen);if(!item)return;preview.innerHTML=`<header><h2>${escape(item.name)}</h2><button type="button" aria-label="关闭预览">关闭</button></header>${item.html?'<iframe sandbox title="网站预览"></iframe>':`<img class="nocode-preview-image" src="${base+escape(initial.some(x=>x.image===item.image)?item.image:'68077.png')}" alt="${escape(item.name)}预览">`}`;if(item.html)preview.querySelector('iframe').srcdoc=item.html;preview.querySelector('button').onclick=()=>preview.close();preview.showModal();return;}
   if(event.target.closest('[data-nocode-import]')){const picker=document.createElement('input');picker.type='file';picker.accept='.html,.htm,text/html';picker.onchange=async()=>{const file=picker.files[0];if(!file)return;if(file.size>1000000){feedback('请选择小于 1 MB 的 HTML 文件');return;}const html=await file.text();items.unshift({id:'site-'+crypto.randomUUID(),name:file.name.replace(/\.html?$/i,''),type:'网站',updated:Date.now(),image:'68077.png',html});save();state.query='';search.value='';state.type='全部类型';page.querySelector('[aria-label="类型筛选"]').value='全部类型';render();feedback('已导入网站');};picker.click();}
  });
  return {open,close};
 }
 root.CatPawNoCodePage={create,filterItems,initial};
})(typeof globalThis!=='undefined'?globalThis:this);
