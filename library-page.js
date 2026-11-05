/* Fourth rail entry — Figma 4943:59135 library. All file changes are local. */
(function(root){
 'use strict';
 const base='assets/library-page/';
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const initial=['未命名文档.md','8月商家数据分析.pdf','interactive-dashboard.html','未命名文档.md','8月商家数据分析.pdf'].map((name,index)=>({id:'file-'+index,name,size:1200,updated:0,visited:0,favorite:false,shared:false,content:name.endsWith('.md')?'# 未命名文档\n':name.endsWith('.html')?'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Interactive dashboard</title><body style="font-family:system-ui;padding:40px"><h1>Interactive dashboard</h1><p>数据看板</p></body></html>':''}));
 function filterItems(items,tab='edited',query=''){
  const needle=query.trim().toLocaleLowerCase();
  return items.filter(x=>!x.deleted&&(!needle||x.name.toLocaleLowerCase().includes(needle))&&(tab!=='viewed'||x.visited>0)&&(tab!=='shared'||x.shared)&&(tab!=='favorites'||x.favorite)).sort((a,b)=>tab==='viewed'?b.visited-a.visited:b.updated-a.updated);
 }
 function create({host,onOpen=()=>{}}){
  let items=initial.map(x=>({...x}));try{const saved=JSON.parse(localStorage.getItem('catpaw-library-files'));if(Array.isArray(saved))items=saved.filter(x=>x&&typeof x.id==='string'&&typeof x.name==='string'&&typeof x.content==='string'&&Number.isFinite(x.updated));}catch(_){}
  const state={tab:'edited',query:''};const icon=file=>`<img src="${base+file}" alt="" class="library-control-icon">`;
  const page=document.createElement('section');page.className='library-page';page.hidden=true;page.setAttribute('aria-label','资料库');host.appendChild(page);
  const nav=document.getElementById('libraryPageNav');
  page.innerHTML=`<header class="nocode-toolbar"><h1>资料库</h1><div class="nocode-tools"><button type="button" data-library-notifications aria-label="通知">${icon('0bbc2.svg')}</button><label class="nocode-search">${icon('33c2b.svg')}<input type="search" placeholder="搜索" aria-label="搜索资料库"></label><i></i><button type="button" class="nocode-import" data-library-upload aria-label="上传文件">${icon('bd52f.svg')}</button><button type="button" class="nocode-create" data-library-create>${icon('97bb6.svg')}创建</button></div></header><div class="library-scroll"><div class="library-tabs" role="tablist" aria-label="资料库分类">${[['edited','最近编辑'],['viewed','最近浏览'],['shared','我分享的'],['favorites','我收藏的']].map(([id,name])=>`<button type="button" role="tab" data-library-tab="${id}">${name}</button>`).join('')}</div><table class="library-table"><thead><tr><th scope="col">名称</th><th scope="col">修改时间</th><th scope="col">大小</th><th scope="col"><span class="library-visually-hidden">操作</span></th></tr></thead><tbody></tbody></table><p class="library-empty" hidden></p></div><div class="library-menu" role="menu" hidden></div><p class="library-feedback" role="status" hidden></p>`;
  const body=page.querySelector('tbody'),menu=page.querySelector('.library-menu'),search=page.querySelector('input');
  const editor=document.createElement('dialog');editor.className='library-preview';host.appendChild(editor);
  const rename=document.createElement('dialog');rename.className='nocode-rename';host.appendChild(rename);
  let menuId=null,feedbackTimer;
  function save(){try{localStorage.setItem('catpaw-library-files',JSON.stringify(items));}catch(_){} }
  function feedback(message,undo){const el=page.querySelector('.library-feedback');clearTimeout(feedbackTimer);el.innerHTML=`<span>${escape(message)}</span>${undo?'<button type="button">撤销</button>':''}`;el.hidden=false;if(undo)el.querySelector('button').onclick=()=>{undo();el.hidden=true};feedbackTimer=setTimeout(()=>el.hidden=true,5000);}
  function formatSize(size){return size>=1000000?(size/1000000).toFixed(1)+' MB':size>=1000?(size/1000).toFixed(1)+'kb':size+' B'}
  function render(){
   page.querySelectorAll('[data-library-tab]').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.libraryTab===state.tab)));
   const list=filterItems(items,state.tab,state.query);
   body.innerHTML=list.map(file=>{const ext=file.name.split('.').pop().toLowerCase(),art=ext==='pdf'?'e4605.svg':ext==='html'||ext==='htm'?'2a917.svg':'5eca5.svg';return `<tr><td><button type="button" class="library-file" data-library-open="${escape(file.id)}"><img class="library-file-icon" src="${base+art}" alt=""><span>${escape(file.name)}</span></button></td><td><time>${file.updated?'刚刚':'—'}</time></td><td>${formatSize(file.size)}</td><td><button type="button" class="library-more" data-library-more="${escape(file.id)}" aria-label="${escape(file.name)}的更多操作" aria-haspopup="menu" aria-expanded="false">${icon('d8037.svg')}</button></td></tr>`}).join('');
   const empty=page.querySelector('.library-empty');empty.hidden=Boolean(list.length);empty.textContent=state.query?'没有找到匹配的文件':({edited:'暂无文件',viewed:'暂无最近浏览的文件',shared:'暂无分享的文件',favorites:'暂无收藏的文件'}[state.tab]);
  }
  function closeMenu(){menu.hidden=true;menuId=null;page.querySelectorAll('[data-library-more]').forEach(x=>x.setAttribute('aria-expanded','false'));}
  function open(){onOpen();page.hidden=false;host.classList.add('library-view');document.querySelectorAll('.sidebar-rail [aria-current]').forEach(el=>el.removeAttribute('aria-current'));nav.setAttribute('aria-current','page');render();}
  function close(){page.hidden=true;host.classList.remove('library-view');nav.removeAttribute('aria-current');closeMenu();}
  nav.addEventListener('click',event=>{event.preventDefault();open()});
  document.querySelector('.sidebar-rail').addEventListener('click',event=>{if(!event.target.closest('#libraryPageNav'))close()},true);
  search.addEventListener('input',()=>{state.query=search.value;closeMenu();render()});
  page.querySelector('.library-scroll').addEventListener('scroll',closeMenu);
  page.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu()});
  function nameDialog(title,value,submit){rename.innerHTML=`<form><h2>${title}</h2><input name="name" aria-label="文件名称" value="${escape(value)}" maxlength="120" required><div><button type="button" data-library-cancel>取消</button><button type="submit">保存</button></div></form>`;rename.querySelector('[data-library-cancel]').onclick=()=>rename.close();rename.querySelector('form').onsubmit=event=>{event.preventDefault();const name=event.currentTarget.elements.name.value.trim();if(!name)return;submit(name);save();render();rename.close()};rename.showModal();}
  function openFile(file){
   file.visited=Date.now();save();const html=/\.html?$/i.test(file.name),pdf=/\.pdf$/i.test(file.name),editable=!html&&!pdf;
   editor.innerHTML=`<header><h2>${escape(file.name)}</h2><div>${editable?'<button type="button" data-library-save>保存</button>':''}<button type="button" data-library-close>关闭</button></div></header>${html?'<iframe title="网页文件预览" sandbox></iframe>':pdf?'<div class="library-pdf-info"><p>PDF 文档</p><button type="button" data-library-download>下载文件</button></div>':'<textarea aria-label="文档内容" spellcheck="false"></textarea>'}`;
   editor.querySelector('[data-library-close]').onclick=()=>editor.close();
   if(html)editor.querySelector('iframe').srcdoc=file.content;
   if(editable){editor.querySelector('textarea').value=file.content;editor.querySelector('[data-library-save]').onclick=()=>{file.content=editor.querySelector('textarea').value;file.size=new TextEncoder().encode(file.content).length;file.updated=Date.now();save();render();feedback('已保存');};}
   if(pdf){const download=editor.querySelector('[data-library-download]');download.disabled=!file.data;download.onclick=()=>downloadFile(file);}
   render();editor.showModal();
  }
  function downloadFile(file){if(/\.pdf$/i.test(file.name)&&!file.data){feedback('此示例文件尚未上传原件');return;}const url=file.data||URL.createObjectURL(new Blob([file.content],{type:/\.html?$/i.test(file.name)?'text/html':'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=file.name;a.click();if(!file.data)URL.revokeObjectURL(url);}
  page.addEventListener('click',event=>{
   const tab=event.target.closest('[data-library-tab]');if(tab){state.tab=tab.dataset.libraryTab;closeMenu();render();return;}
   const more=event.target.closest('[data-library-more]');if(more){const id=more.dataset.libraryMore;if(menuId===id&&!menu.hidden){closeMenu();return;}closeMenu();menuId=id;const file=items.find(x=>x.id===id);menu.innerHTML=`<button type="button" role="menuitem" data-library-action="favorite">${file.favorite?'取消收藏':'收藏'}</button><button type="button" role="menuitem" data-library-action="rename">重命名</button><button type="button" role="menuitem" data-library-action="download">下载</button><button type="button" role="menuitem" data-library-action="remove">移至回收站</button>`;menu.hidden=false;more.setAttribute('aria-expanded','true');const p=page.getBoundingClientRect(),b=more.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(b.right-p.left-140,p.width-148))+'px';menu.style.top=Math.max(8,Math.min(b.bottom-p.top+4,p.height-menu.offsetHeight-8))+'px';menu.querySelector('button').focus();return;}
   const action=event.target.closest('[data-library-action]');if(action){const file=items.find(x=>x.id===menuId);closeMenu();if(!file)return;
    switch(action.dataset.libraryAction){case 'favorite':file.favorite=!file.favorite;save();render();break;case 'rename':nameDialog('重命名',file.name,name=>{file.name=name;file.updated=Date.now()});break;case 'download':downloadFile(file);break;case 'remove':file.deleted=true;save();render();feedback('已移至回收站',()=>{file.deleted=false;save();render()});break;}return;}
   closeMenu();
   const fileButton=event.target.closest('[data-library-open]');if(fileButton){const file=items.find(x=>x.id===fileButton.dataset.libraryOpen);if(file)openFile(file);return;}
   if(event.target.closest('[data-library-notifications]')){feedback('暂无新通知');return;}
   if(event.target.closest('[data-library-create]')){nameDialog('创建文档','未命名文档.md',name=>{items.unshift({id:'file-'+crypto.randomUUID(),name,size:0,updated:Date.now(),visited:0,shared:false,favorite:false,content:''});state.tab='edited';state.query='';search.value=''});return;}
   if(event.target.closest('[data-library-upload]')){const picker=document.createElement('input');picker.type='file';picker.multiple=true;picker.accept='.md,.txt,.html,.htm,.pdf';picker.onchange=async()=>{for(const file of Array.from(picker.files||[])){if(file.size>1000000){feedback('请选择小于 1 MB 的文件');continue;}const pdf=/\.pdf$/i.test(file.name),content=pdf?'':await file.text();let data='';if(pdf)data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});items.unshift({id:'file-'+crypto.randomUUID(),name:file.name,size:file.size,updated:Date.now(),visited:0,shared:false,favorite:false,content,data});}state.tab='edited';state.query='';search.value='';save();render();};picker.click();}
  });
  return {open,close};
 }
 root.CatPawLibraryPage={create,filterItems,initial};
})(typeof globalThis!=='undefined'?globalThis:this);
