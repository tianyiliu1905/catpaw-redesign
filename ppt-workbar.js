/* PPT 工作条：两个模式共用文稿和撤销栈，修改仅保留在本次会话。 */
(() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const copy = value => JSON.parse(JSON.stringify(value));
  let serial=0;
  const uid = () => `ppt-${++serial}`;
  function model(item, seeds=[]) {
    const preview=item.node.preview;
    if(!preview.deck) preview.deck=seeds.map((s,index)=>({id:uid(),title:s.title,background:index===0?'#183f42':'#f8faf9',notes:s.subtitle,elements:[
      {id:uid(),type:'text',x:56,y:70,w:848,h:64,text:s.title,size:38,bold:true,color:index===0?'#ffffff':'#183f42'},
      {id:uid(),type:'text',x:56,y:139,w:848,h:36,text:s.subtitle,size:19,color:index===0?'#c3d9d4':'#647570'},
      ...s.lines.flatMap((text,i)=>[
        {id:uid(),type:'shape',x:56,y:212+i*75,w:848,h:57,color:index===0?'#245154':'#eaf1ed'},
        {id:uid(),type:'text',x:78,y:224+i*75,w:804,h:36,text,size:23,color:index===0?'#ffffff':'#27463d'},
      ]),
    ]}));
    preview.history ||= {past:[],future:[]};
    item.referenceSlide=Math.max(0,Math.min(item.referenceSlide||0,preview.deck.length-1));
    return preview.deck;
  }
  const current = item => model(item)[item.referenceSlide||0];
  const selected = item => current(item).elements.find(e=>e.id===item.pptSelection);
  function commit(item,mutate) {
    const before=copy(model(item));mutate(item.node.preview.deck);
    if(JSON.stringify(before)===JSON.stringify(item.node.preview.deck))return;
    const history=item.node.preview.history;history.past.push(before);if(history.past.length>40)history.past.shift();history.future=[];
    item.node.preview.revision=(item.node.preview.revision||0)+1;model(item);
  }
  function undo(item,redo=false) {
    const h=item.node.preview.history;const from=redo?h.future:h.past,to=redo?h.past:h.future;
    if(!from.length)return;to.push(copy(model(item)));item.node.preview.deck=from.pop();item.pptSelection=null;model(item);
  }
  function pageAction(item,action,target) {
    commit(item,deck=>{
      const index=item.referenceSlide||0;
      if(action==='new') {deck.splice(index+1,0,{id:uid(),title:'新页面',background:'#f8faf9',notes:'',elements:[{id:uid(),type:'text',x:56,y:70,w:848,h:64,text:'新页面',size:38,bold:true,color:'#183f42'}]});item.referenceSlide=index+1;}
      if(action==='duplicate'){const page=copy(deck[index]);page.id=uid();page.elements.forEach(e=>e.id=uid());deck.splice(index+1,0,page);item.referenceSlide=index+1;}
      if(action==='delete'&&deck.length>1){deck.splice(index,1);item.referenceSlide=Math.min(index,deck.length-1);}
      if(action==='move'&&target>=0&&target<deck.length){const [page]=deck.splice(index,1);deck.splice(target,0,page);item.referenceSlide=target;}
    });item.pptSelection=null;
  }
  function fitLines(text,width,size) {
    const lines=[];for(const line of String(text).split('\n')) {let part='',used=0;for(const c of line){const units=/[\x00-\x7f]/.test(c)?.56:1;if(used+units>Math.max(1,width/size)){lines.push(part);part='';used=0;}part+=c;used+=units;}lines.push(part);}return lines;
  }
  function elementSvg(e) {
    const {x,y,w,h}=e;
    if(e.type==='shape')return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${e.radius??10}" fill="${e.color}"/>`;
    if(e.type==='image')return `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${esc(e.src)}" preserveAspectRatio="${e.fit==='cover'?'xMidYMid slice':'xMidYMid meet'}"/>`;
    if(e.type==='text'){
      const size=e.size||24,align=e.align||'left',lineHeight=e.lineHeight||1.25;
      const lines=fitLines(e.text,w,size).slice(0,Math.max(1,Math.floor(h/(size*lineHeight))));
      const decoration=[e.underline?'underline':'',e.strike?'line-through':''].filter(Boolean).join(' ')||'none';
      return `${e.highlight?`<rect x="${x}" y="${y}" width="${w}" height="${Math.min(h,lines.length*size*lineHeight)}" rx="3" fill="${e.highlight}"/>`:''}<text font-family="${esc(e.fontFamily||'PingFang SC, Microsoft YaHei, sans-serif')}" font-size="${size}" font-weight="${e.bold?'600':'400'}" font-style="${e.italic?'italic':'normal'}" text-decoration="${decoration}" fill="${e.color||'#183f42'}" text-anchor="${align==='center'?'middle':align==='right'?'end':'start'}">${lines.map((line,i)=>`<tspan x="${x+(align==='center'?w/2:align==='right'?w:0)}" y="${y+size+(i*size*lineHeight)}">${i===0&&e.list==='bullet'?'• ':i===0&&e.list==='number'?'1. ':''}${esc(line)}</tspan>`).join('')}</text>`;
    }
    if(e.type==='table'){
      const rows=e.rows,cols=Math.max(...rows.map(r=>r.length)),ch=h/rows.length,cw=w/cols;
      return rows.map((row,r)=>row.map((value,c)=>`<rect x="${x+c*cw}" y="${y+r*ch}" width="${cw}" height="${ch}" fill="${r===0?'#dcece3':'#ffffff'}" stroke="#cad9d1"/><text x="${x+c*cw+8}" y="${y+r*ch+ch/2+6}" font-size="18" fill="#183f42">${esc(String(value).slice(0,12))}</text>`).join('')).join('');
    }
    if(e.type==='chart'){
      const max=Math.max(1,...e.rows.map(r=>Number(r[1]))),cw=w/e.rows.length;
      return e.rows.map((row,i)=>{const bh=(h-38)*Number(row[1])/max;return `<rect x="${x+i*cw+12}" y="${y+h-28-bh}" width="${cw-24}" height="${bh}" rx="4" fill="#4bcc7a"/><text x="${x+(i+.5)*cw}" y="${y+h-5}" text-anchor="middle" font-size="16" fill="#183f42">${esc(row[0])}</text><text x="${x+(i+.5)*cw}" y="${y+h-36-bh}" text-anchor="middle" font-size="16" fill="#183f42">${row[1]}</text>`;}).join('');
    }return '';
  }
  function svg(item,index=item.referenceSlide||0){const deck=model(item),p=deck[index];return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><rect width="960" height="540" fill="${p.background}"/><g font-family="PingFang SC, Microsoft YaHei, sans-serif">${p.elements.map(elementSvg).join('')}<text x="56" y="518" font-size="12" fill="#789087">CATPAW · 季度复盘 / 示例数据</text></g></svg>`;}
  const image=(item,index)=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg(item,index));
  const text=(item,index=item.referenceSlide||0)=>model(item)[index].elements.map(e=>e.text||e.rows?.map(r=>r.join(' / ')).join('；')||'').filter(Boolean).join('；');
  const button=(action,label,disabled=false,title=label)=>`<button type="button" data-ppt-action="${action}" ${disabled?'disabled':''} title="${title}" aria-label="${title}">${label}</button>`;
  const historyIcon=action=>`<svg class="ppt-history-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${action==='undo'?'m8 7-4 3 4 3M4 10h10a5.5 5.5 0 1 1-1 10.9':'m16 7 4 3-4 3M20 10H10a5.5 5.5 0 1 0 1 10.9'}"/></svg>`;
  const editToolbarTabs=[['text','文字'],['image','图片'],['shape','图形'],['table','表格'],['chart','图表'],['layout','对齐'],['format','格式'],['design','设计'],['animation','动画']];
  const editToolbarIcon=tab=>{
    const path='assets/figma-edit-toolbar/';
    if(tab==='text'||tab==='layout')return `<span class="ppt-edit-tab-icon ppt-edit-tab-icon-${tab}" aria-hidden="true"><img src="${path}${tab==='text'?'textFill':'alignFill'}.svg" alt=""></span>`;
    return `<span class="ppt-edit-tab-icon ppt-edit-tab-icon-${tab}" aria-hidden="true"><img src="${path}${tab}.svg" alt=""></span>`;
  };
  function panel(item) {
    const tab=editToolbarTabs.some(([name])=>name===item.pptTab)?item.pptTab:'text',e=selected(item),isText=e?.type==='text';
    if(tab==='text')return button('insert-text','插入文本框')+button('edit-text','编辑文字',!isText);
    if(tab==='shape')return button('insert-shape','插入图形')+button('delete-element','删除图形',e?.type!=='shape');
    if(tab==='layout')return button('left','左对齐',!e)+button('center','水平居中',!e)+button('top','顶部对齐',!e)+button('front','置于顶层',!e)+button('back','置于底层',!e)+button('copy-element','复制元素',!e)+button('delete-element','删除元素',!e);
    if(tab==='image')return button('insert-image','插入图片')+button('replace-image','替换图片',e?.type!=='image')+button('image-contain','完整显示',e?.type!=='image')+button('image-cover','填满裁剪',e?.type!=='image');
    if(tab==='table'||tab==='chart')return button('insert-'+tab,tab==='table'?'插入表格':'插入图表')+button('edit-data','编辑数据',e?.type!==tab);
    if(tab==='design')return `<label>页面背景 <input data-ppt-page-property="background" type="color" value="${current(item).background}"></label>`;
    if(tab==='animation')return button('preview-animation','预览动画');
    return button('edit-text','编辑文字',!isText)+button('bold','B',!isText,'加粗')+button('italic','I',!isText,'斜体')+`<label>字号 <input data-ppt-property="size" type="number" min="10" max="96" value="${e?.size||24}" ${!isText?'disabled':''}></label><label>颜色 <input data-ppt-property="color" type="color" value="${e?.color||'#183f42'}" ${!e||!['text','shape'].includes(e.type)?'disabled':''}></label>`+button('text-left','左对齐',!isText)+button('text-center','居中',!isText);
  }
  const textIcon=name=>`<img src="assets/ppt-text-toolbar/${name}.svg" alt="">`;
  const textTool=(action,icon,title,pressed=false)=>`<button type="button" class="ppt-text-tool" data-ppt-action="${action}" title="${title}" aria-label="${title}" ${pressed?'aria-pressed="true"':''}>${textIcon(icon)}</button>`;
  function textMenu(kind,label,icon,items){
    return `<div class="ppt-text-menu-wrap"><button type="button" class="ppt-text-tool ppt-text-menu-trigger" data-ppt-text-menu="${kind}" aria-label="${label}" aria-haspopup="menu" aria-expanded="false" title="${label}">${icon?textIcon(icon):`<span>${label}</span>`}${textIcon('down')}</button><div class="ppt-text-menu" role="menu" aria-label="${label}" hidden>${items.map(([value,name])=>`<button type="button" role="menuitem" data-ppt-text-choice="${kind}" data-value="${esc(value)}">${esc(name)}</button>`).join('')}</div></div>`;
  }
  function contextTools(item) {
    const e=selected(item);if(!e)return '';
    if(e.type!=='text')return `<div class="ppt-selection-tools ppt-selection-tools-simple"><span>${{image:'图片',shape:'形状',table:'表格',chart:'图表'}[e.type]}</span>${e.type==='image'?button('replace-image','替换图片'):['table','chart'].includes(e.type)?button('edit-data','编辑数据'):''}${button('delete-element','删除')}${button('reference-element','添加到对话')}</div>`;
    const color=(name,title,value)=>`<label class="ppt-text-tool ppt-text-color-tool" title="${title}">${textIcon(name)}<input type="color" data-ppt-property="${name==='text-color'?'color':'highlight'}" value="${value}" aria-label="${title}"></label>`;
    return `<div class="ppt-selection-tools ppt-selection-tools-text" role="toolbar" aria-label="所选文字操作"><button type="button" class="ppt-add-reference" data-ppt-action="reference-element">添加到对话</button><span class="ppt-text-divider">${textIcon('divider')}</span><div class="ppt-text-actions">${textMenu('preset','文字样式','style',[['title','标题'],['body','正文'],['note','注释']])}${color('text-color','文字颜色',e.color||'#183f42')}${color('highlight','文字背景',e.highlight||'#ffff99')}${textMenu('more','更多操作','more',[['edit-text','修改文字'],['copy-element','复制文本框'],['delete-element','删除文本框']])}<span class="ppt-text-divider">${textIcon('divider')}</span>${textMenu('font','字体',null,[['PingFang SC','苹方'],['Arial','Arial'],['Georgia','Georgia']])}${textMenu('size',String(e.size||24),null,[16,18,20,24,28,32,38,48].map(n=>[String(n),String(n)]))}${textMenu('align','对齐','align',[['left','左对齐'],['center','居中'],['right','右对齐']])}${textMenu('list','列表','list',[['none','无列表'],['bullet','项目符号'],['number','编号']])}${textTool('bold','bold','加粗',e.bold)}${textTool('italic','italic','斜体',e.italic)}${textTool('underline','underline','下划线',e.underline)}${textTool('strike','strike','删除线',e.strike)}</div></div>`;
  }
  function render(item,seeds) {
    const deck=model(item,seeds),index=item.referenceSlide||0,p=deck[index],h=item.node.preview.history;
    const expanded=!!item.pptToolsExpanded,panelOpen=expanded&&!!item.pptToolPanelOpen,activeTab=editToolbarTabs.some(([name])=>name===item.pptTab)?item.pptTab:'text';
    const editDrawer=`<div class="ppt-edit-drawer" id="ppt-edit-drawer" data-open="${expanded}" aria-hidden="${!expanded}" ${expanded?'':'inert'}><div class="ppt-edit-drawer-inner"><div class="ppt-edit-tabs" role="tablist" aria-label="编辑工具">${editToolbarTabs.map(([tab,label],i)=>`${i===6?'<img class="ppt-edit-tab-divider" src="assets/figma-edit-toolbar/divider.svg" alt="" aria-hidden="true">':''}<button type="button" role="tab" data-ppt-tab="${tab}" aria-selected="${panelOpen&&activeTab===tab}">${editToolbarIcon(tab)}<span>${label}</span></button>`).join('')}</div><div class="ppt-edit-panel"${panelOpen?'':' hidden'}>${panel(item)}</div></div></div>`;
    const workbar=`<div class="ppt-workbar" role="toolbar" aria-label="PPT 工作条"><div class="ppt-workbar-controls"><div class="ppt-workbar-group">${button('undo',historyIcon('undo'),!h.past.length,'撤销')}${button('redo',historyIcon('redo'),!h.future.length,'重做')}</div><div class="ppt-tools-combo" data-open="${expanded}"><button type="button" class="ppt-tools-toggle" data-ppt-action="toggle-tools" aria-expanded="${expanded}" aria-controls="ppt-edit-drawer" aria-label="编辑工具" title="编辑工具"><svg class="ppt-tools-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7"/><rect x="3" y="7" width="18" height="14" rx="2.5"/><path d="M3 12.5c2.7 1.8 5.7 2.7 9 2.7s6.3-.9 9-2.7M10 14.5v1.5a2 2 0 0 0 4 0v-1.5"/></svg></button>${editDrawer}</div></div></div>`;
    const contextual=`<div class="ppt-selection-slot">${contextTools(item)}</div>`;
    return `<div class="reference-ppt" aria-label="季度经营复盘演示文稿">${workbar}<div class="reference-ppt-layout"><aside class="ppt-page-sidebar" id="ppt-page-preview"><nav class="reference-ppt-pages" aria-label="幻灯片页面">${deck.map((page,i)=>`<button type="button" draggable="true" data-reference-slide="${i}" aria-label="第 ${i+1} 页：${esc(page.title)}" aria-current="${i===index?'page':'false'}"><img src="${image(item,i)}" alt="${esc(page.title)}" draggable="false"><span class="ppt-page-number" aria-hidden="true">${i+1}</span></button>`).join('')}</nav></aside><div class="reference-ppt-canvas">${contextual}<div class="reference-slide" tabindex="0" role="group" aria-label="选择第 ${index+1} 页"><img src="${image(item,index)}" alt="${esc(p.title)}" draggable="false">${p.elements.map(el=>`<div class="ppt-element-hit ${el.id===item.pptSelection?'is-selected':''}" role="button" tabindex="0" aria-label="${esc(el.text||({image:'图片',shape:'形状',table:'表格',chart:'图表'}[el.type]))}" data-ppt-element="${el.id}" style="left:${el.x/9.6}%;top:${el.y/5.4}%;width:${el.w/9.6}%;height:${el.h/5.4}%">${el.id===item.pptSelection?'<button class="ppt-resize-handle" data-ppt-resize aria-label="拖动调整大小" tabindex="-1"></button>':''}</div>`).join('')}<div class="reference-crop-box" hidden></div></div></div></div></div>`;
  }
  function install(options) {
    const {root,getWorkspace}=options;let gesture=null,suppressClick=false;
    const dialog=document.createElement('dialog');dialog.className='ppt-editor-dialog';document.body.append(dialog);
    let acceptEdit=null,dialogTrigger=null;
    dialog.addEventListener('close',()=>{dialogTrigger?.focus();});
    dialog.addEventListener('submit',event=>{event.preventDefault();const text=dialog.querySelector('textarea').value;if(acceptEdit(text)!==false)dialog.close();});
    dialog.addEventListener('click',event=>{if(event.target.closest('[data-dialog-cancel]'))dialog.close();});
    function ask(title,value,apply,hint='') {dialogTrigger=document.activeElement;acceptEdit=apply;dialog.innerHTML=`<form><h3>${title}</h3>${hint?`<p>${hint}</p>`:''}<textarea aria-label="${title}" rows="6"></textarea><p class="ppt-dialog-error" role="alert"></p><footer><button type="button" data-dialog-cancel>取消</button><button type="submit">应用</button></footer></form>`;dialog.querySelector('textarea').value=value;dialog.showModal();dialog.querySelector('textarea').focus();}
    const active=()=>{const item=getWorkspace();return item?.node?.preview?.referenceDemo&&item.node.preview.kind==='ppt'?item:null;};
    // 顶层预览独立于编辑画布，退出时保留编辑页、缩放和选中元素。
    const presentation=document.createElement('dialog');
    presentation.className='ppt-preview-window';
    presentation.setAttribute('aria-label','PPT 全窗口预览');
    presentation.innerHTML='<img class="ppt-preview-image" draggable="false"><div class="ppt-preview-controls"><button type="button" data-preview="previous" aria-label="上一页" title="上一页"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m11 5-7 7 7 7M4 12h16"/></svg></button><span aria-live="polite"></span><button type="button" data-preview="next" aria-label="下一页" title="下一页"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 5 7 7-7 7M20 12H4"/></svg></button><button type="button" data-preview="exit">退出预览 <kbd>Esc</kbd></button></div>';
    document.body.append(presentation);
    let previewItem=null,previewIndex=0,previewTrigger=null,previewTimer=null;
    function revealPreviewControls(){
      clearTimeout(previewTimer);
      presentation.classList.add('controls-visible');
      previewTimer=setTimeout(()=>{
        const controls=presentation.querySelector('.ppt-preview-controls');
        if(controls.matches(':hover')||controls.querySelector(':focus-visible'))return;
        presentation.classList.remove('controls-visible');
      },1800);
    }
    function paintPreview(){
      const pages=model(previewItem),img=presentation.querySelector('img');
      img.src=image(previewItem,previewIndex);img.alt=pages[previewIndex].title;
      presentation.querySelector('span').textContent=`${previewIndex+1} / ${pages.length}`;
      presentation.querySelector('[data-preview="previous"]').disabled=previewIndex===0;
      presentation.querySelector('[data-preview="next"]').disabled=previewIndex===pages.length-1;
    }
    function stepPreview(direction){
      previewIndex=Math.max(0,Math.min(model(previewItem).length-1,previewIndex+direction));
      paintPreview();revealPreviewControls();
    }
    function openPreview(item){
      options.cancelSelection();previewTrigger=document.activeElement;previewItem=item;
      previewIndex=item.referenceSlide||0;item.pptPresent=true;
      paintPreview();presentation.showModal();presentation.focus();revealPreviewControls();
    }
    presentation.tabIndex=-1;
    presentation.addEventListener('close',()=>{
      clearTimeout(previewTimer);
      if(previewItem)previewItem.pptPresent=false;
      previewItem=null;presentation.classList.remove('controls-visible');
      if(previewTrigger?.isConnected)previewTrigger.focus({preventScroll:true});
    });
    presentation.addEventListener('pointermove',revealPreviewControls);
    presentation.addEventListener('pointerdown',revealPreviewControls);
    presentation.querySelector('.ppt-preview-controls').addEventListener('pointerleave',revealPreviewControls);
    presentation.addEventListener('focusin',revealPreviewControls);
    presentation.addEventListener('focusout',revealPreviewControls);
    presentation.addEventListener('click',event=>{
      const command=event.target.closest('[data-preview]')?.dataset.preview;
      if(command==='exit')presentation.close();
      else if(command)stepPreview(command==='next'?1:-1);
    });
    presentation.addEventListener('keydown',event=>{
      event.stopPropagation();
      if(['ArrowRight','ArrowLeft','PageDown','PageUp'].includes(event.key)){
        event.preventDefault();event.stopPropagation();stepPreview(['ArrowRight','PageDown'].includes(event.key)?1:-1);
      }
      if(event.key==='Tab')revealPreviewControls();
    });
    function refresh(item){options.cancelSelection();options.renderWorkspace(item);}
    function positionSelectionTools(){
      const toolbar=root.querySelector('.ppt-selection-tools'),hit=root.querySelector('.ppt-element-hit.is-selected');
      if(!toolbar||!hit)return;
      const bounds=root.getBoundingClientRect(),rect=hit.getBoundingClientRect();
      const available=Math.max(260,Math.min(820,bounds.width-24));
      toolbar.style.maxWidth=`${available}px`;
      const width=toolbar.getBoundingClientRect().width,height=toolbar.getBoundingClientRect().height;
      const left=Math.max(bounds.left+12,Math.min(rect.left+rect.width/2-width/2,bounds.right-width-12));
      const above=rect.top-height-10,below=rect.bottom+10;
      toolbar.style.left=`${Math.round(left)}px`;
      toolbar.style.top=`${Math.round(above>=bounds.top+12?above:Math.min(below,window.innerHeight-height-12))}px`;
    }
    let toolbarFrame=0;
    function scheduleToolbar(){cancelAnimationFrame(toolbarFrame);toolbarFrame=requestAnimationFrame(positionSelectionTools);}
    new MutationObserver(scheduleToolbar).observe(root,{subtree:true,childList:true});
    root.addEventListener('scroll',scheduleToolbar,true);
    window.addEventListener('resize',scheduleToolbar);
    function closeTextMenus(){
      root.querySelectorAll('.ppt-text-menu:not([hidden])').forEach(menu=>{
        menu.hidden=true;menu.previousElementSibling.setAttribute('aria-expanded','false');
      });
    }
    document.addEventListener('pointerdown',event=>{
      if(!event.target.closest('.ppt-text-menu-wrap'))closeTextMenus();
    },true);
    function syncSelection(item){
      root.querySelectorAll('[data-ppt-element]').forEach(el=>{const on=el.dataset.pptElement===item.pptSelection;el.classList.toggle('is-selected',on);el.querySelector('[data-ppt-resize]')?.remove();if(on)el.insertAdjacentHTML('beforeend','<button class="ppt-resize-handle" data-ppt-resize aria-label="拖动调整大小" tabindex="-1"></button>');});
      const slot=root.querySelector('.ppt-selection-slot');if(slot)slot.innerHTML=contextTools(item);
      const tools=root.querySelector('.ppt-edit-panel');if(tools)tools.innerHTML=panel(item);
      scheduleToolbar();
    }
    const mutate=(item,fn)=>{commit(item,fn);refresh(item);};
    function editText(item,e){if(e?.type!=='text')return;ask('编辑文字',e.text,value=>{mutate(item,()=>{e.text=value;if(current(item).elements.find(el=>el.type==='text')===e)current(item).title=value||'未命名页面';});},'支持换行；文本框太小时可拖动右下角放大。');}
    function editData(item,e,kind) {ask(kind==='table'?'编辑表格数据':'编辑图表数据',e?.rows?.map(row=>row.join('\t')).join('\n')||(kind==='table'?'区域\t营收\n华东\t480\n华南\t420':'华东\t480\n华南\t420\n华北\t340'),value=>{
      const rows=value.trim().split('\n').map(line=>line.split(/\t|，|,/).map(s=>s.trim()));
      if(!value.trim()||rows.length>12||rows.some(row=>row.length>6)||kind==='chart'&&rows.some(row=>row.length!==2||!row[0]||!Number.isFinite(Number(row[1]))||Number(row[1])<0)) {dialog.querySelector('.ppt-dialog-error').textContent='请检查数据：最多 12 行、6 列；图表每行需为名称和非负数值。';return false;}
      mutate(item,()=>{if(e)e.rows=rows;else {const el={id:uid(),type:kind,x:100,y:180,w:740,h:260,rows};current(item).elements.push(el);item.pptSelection=el.id;}});
    },'每行一条数据，用 Tab 或逗号分隔列。图表格式：名称，数值。');}
    const imageInput=document.createElement('input');imageInput.type='file';imageInput.accept='image/png,image/jpeg,image/webp';imageInput.hidden=true;document.body.append(imageInput);
    let imageTarget=null;
    imageInput.addEventListener('change',async()=>{const file=imageInput.files[0],target=imageTarget;imageInput.value='';if(!file||!target)return;
      if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>15*1024*1024){options.feedback('请选择不超过 15 MB 的 PNG、JPEG 或 WebP 图片。');return;}
      try {const src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
        const img=new Image();img.src=src;await img.decode();
        const page=model(target.item).find(p=>p.id===target.pageId);if(!page)return;
        commit(target.item,()=>{const old=page.elements.find(e=>e.id===target.elementId);if(target.elementId&&!old)return;const el=old||{id:uid(),type:'image',x:200,y:180,w:480,h:270};el.src=src;el.fit='contain';if(!old)page.elements.push(el);target.item.pptSelection=el.id;});if(active()===target.item)refresh(target.item);
      }catch{options.feedback('图片无法读取，请换一张图片。');}
    });
    function action(item,name) {
      const e=selected(item);
      if(name==='toggle-tools'){
        item.pptToolsExpanded=!item.pptToolsExpanded;
        item.pptToolPanelOpen=false;
        const drawer=root.querySelector('.ppt-edit-drawer');
        const combo=root.querySelector('.ppt-tools-combo');
        const toggle=root.querySelector('[data-ppt-action="toggle-tools"]');
        const panel=root.querySelector('.ppt-edit-panel');
        if(drawer){
          drawer.dataset.open=String(item.pptToolsExpanded);
          drawer.setAttribute('aria-hidden',String(!item.pptToolsExpanded));
          drawer.inert=!item.pptToolsExpanded;
        }
        if(panel)panel.hidden=true;
        root.querySelectorAll('[data-ppt-tab]').forEach(tab=>tab.setAttribute('aria-selected','false'));
        if(combo)combo.dataset.open=String(item.pptToolsExpanded);
        toggle?.setAttribute('aria-expanded',String(item.pptToolsExpanded));
        return;
      }
      if(name==='undo'||name==='redo'){undo(item,name==='redo');refresh(item);return;}
      if(name==='reference-element'){options.reference(item,e);return;}
      if(name==='present'){openPreview(item);return;}
      if(name==='preview-animation'){root.querySelector('.reference-slide>img')?.animate([{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:500,easing:'ease-out'});return;}
      if(['previous','next'].includes(name)){item.referenceSlide=Math.max(0,Math.min(model(item).length-1,item.referenceSlide+(name==='next'?1:-1)));refresh(item);return;}
      if(name==='edit-text'){editText(item,e);return;}
      if(name==='insert-image'||name==='replace-image'){imageTarget={item,pageId:current(item).id,elementId:name==='replace-image'?e?.id:null};imageInput.click();return;}
      if(['insert-table','insert-chart','edit-data'].includes(name)){const kind=name==='edit-data'?e?.type:name.slice(7);if(['table','chart'].includes(kind))editData(item,name==='edit-data'?e:null,kind);return;}
      mutate(item,()=>{
        const elements=current(item).elements;
        if(name==='insert-text'||name==='insert-shape'){const type=name.slice(7),el={id:uid(),type,x:160,y:160,w:320,h:100,text:type==='text'?'双击修改文字':undefined,size:26,color:type==='text'?'#183f42':'#b7e4c6'};elements.push(el);item.pptSelection=el.id;return;}
        if(!e)return;
        if(name==='bold')e.bold=!e.bold;if(name==='italic')e.italic=!e.italic;
        if(name==='underline')e.underline=!e.underline;if(name==='strike')e.strike=!e.strike;
        if(name==='delete-element'){elements.splice(elements.indexOf(e),1);item.pptSelection=null;}
        if(name==='copy-element'){const el={...copy(e),id:uid(),x:Math.min(960-e.w,e.x+16),y:Math.min(540-e.h,e.y+16)};elements.push(el);item.pptSelection=el.id;}
        if(name==='left')e.x=56;if(name==='center')e.x=(960-e.w)/2;if(name==='top')e.y=56;
        if(name==='front'){elements.splice(elements.indexOf(e),1);elements.push(e);}if(name==='back'){elements.splice(elements.indexOf(e),1);elements.unshift(e);}
        if(name.startsWith('text-'))e.align=name.slice(5);if(name.startsWith('image-'))e.fit=name.slice(6);
      });
    }
    root.addEventListener('click',event=>{
      const item=active();if(!item)return;
      if(suppressClick){event.preventDefault();event.stopImmediatePropagation();suppressClick=false;return;}
      const tab=event.target.closest('[data-ppt-tab]'),button=event.target.closest('[data-ppt-action]'),hit=event.target.closest('[data-ppt-element]'),textTrigger=event.target.closest('[data-ppt-text-menu]'),textChoice=event.target.closest('[data-ppt-text-choice]');
      if(tab||button||textTrigger||textChoice||hit&&!root.classList.contains('reference-cropping')){event.stopImmediatePropagation();
        if(textTrigger){
          const menu=textTrigger.nextElementSibling,open=menu.hidden;
          closeTextMenus();menu.hidden=!open;textTrigger.setAttribute('aria-expanded',String(open));
        }
        else if(textChoice){
          const selectedText=selected(item),kind=textChoice.dataset.pptTextChoice,value=textChoice.dataset.value;
          closeTextMenus();
          if(selectedText?.type==='text'){
            if(kind==='more')action(item,value);
            else mutate(item,()=>{
              if(kind==='preset'){
                const preset={title:{size:38,bold:true},body:{size:24,bold:false},note:{size:18,bold:false}}[value];
                Object.assign(selectedText,preset);
              }
              if(kind==='font')selectedText.fontFamily=value;
              if(kind==='size')selectedText.size=Number(value);
              if(kind==='align')selectedText.align=value;
              if(kind==='list')selectedText.list=value;
            });
          }
        }
        else if(tab){item.pptToolPanelOpen=tab.dataset.pptTab!==item.pptTab||!item.pptToolPanelOpen;item.pptTab=tab.dataset.pptTab;refresh(item);}else if(button&&!button.disabled)action(item,button.dataset.pptAction);
        else if(hit){if(suppressClick){suppressClick=false;return;}item.pptSelection=hit.dataset.pptElement;options.cancelSelection();syncSelection(item);}
      }
    },true);
    root.addEventListener('dblclick',event=>{const item=active(),hit=event.target.closest('[data-ppt-element]');if(!item||!hit||root.classList.contains('reference-cropping'))return;event.stopImmediatePropagation();editText(item,selected(item));},true);
    root.addEventListener('change',event=>{
      const item=active();if(!item)return;const t=event.target;
      if(t.matches('[data-ppt-page-property]')){mutate(item,()=>{current(item)[t.dataset.pptPageProperty]=t.value;});return;}
      if(t.matches('[data-ppt-property]')){const e=selected(item);if(e)mutate(item,()=>{e[t.dataset.pptProperty]=t.dataset.pptProperty==='size'?Math.max(10,Math.min(96,Number(t.value)||24)):t.value;});}
    });
    root.addEventListener('pointerdown',event=>{
      const item=active(),hit=event.target.closest('[data-ppt-element]');if(!item||!hit||event.button!==0||root.classList.contains('reference-cropping')||item.pptPresent)return;
      event.stopImmediatePropagation();event.preventDefault();hit.focus({preventScroll:true});const e=current(item).elements.find(e=>e.id===hit.dataset.pptElement),rect=root.querySelector('.reference-slide').getBoundingClientRect();
      gesture={item,e,hit,rect,startX:event.clientX,startY:event.clientY,before:copy(model(item)),original:copy(e),resize:!!event.target.closest('[data-ppt-resize]'),moved:false};
    },true);
    document.addEventListener('pointermove',event=>{
      if(!gesture)return;const g=gesture,dx=(event.clientX-g.startX)*960/g.rect.width,dy=(event.clientY-g.startY)*540/g.rect.height;
      if(Math.abs(dx)+Math.abs(dy)<3)return;g.moved=true;
      const snap=n=>Math.round(n/4)*4;
      if(g.resize){g.e.w=Math.max(32,Math.min(960-g.e.x,snap(g.original.w+dx)));g.e.h=Math.max(24,Math.min(540-g.e.y,snap(g.original.h+dy)));}
      else {g.e.x=Math.max(0,Math.min(960-g.e.w,snap(g.original.x+dx)));g.e.y=Math.max(0,Math.min(540-g.e.h,snap(g.original.y+dy)));}
      g.hit.style.left=`${g.e.x/9.6}%`;g.hit.style.top=`${g.e.y/5.4}%`;g.hit.style.width=`${g.e.w/9.6}%`;g.hit.style.height=`${g.e.h/5.4}%`;
      root.querySelector('.reference-slide>img').src=image(g.item);
    });
    function finish(cancel=false){if(!gesture)return;const g=gesture;gesture=null;
      if(cancel)g.item.node.preview.deck=g.before;
      else if(g.moved){const h=g.item.node.preview.history;h.past.push(g.before);if(h.past.length>40)h.past.shift();h.future=[];g.item.node.preview.revision=(g.item.node.preview.revision||0)+1;}
      g.item.pptSelection=g.e.id;suppressClick=g.moved;if(g.moved)setTimeout(()=>suppressClick=false,0);if(active()===g.item){if(g.moved||cancel)refresh(g.item);else syncSelection(g.item);}
    }
    document.addEventListener('pointerup',()=>finish());document.addEventListener('pointercancel',()=>finish(true));window.addEventListener('blur',()=>finish(true));
    root.addEventListener('keydown',event=>{
      const item=active();if(!item||event.target.matches('input,textarea,select')||event.target.isContentEditable)return;
      const textMenuTrigger=event.target.closest('[data-ppt-text-menu]'),textMenuOption=event.target.closest('[data-ppt-text-choice]');
      if(textMenuTrigger&&['ArrowDown','Enter',' '].includes(event.key)){
        event.preventDefault();if(textMenuTrigger.nextElementSibling.hidden)textMenuTrigger.click();
        textMenuTrigger.nextElementSibling.querySelector('button')?.focus({preventScroll:true});return;
      }
      if(textMenuOption&&['ArrowDown','ArrowUp'].includes(event.key)){
        event.preventDefault();const options=Array.from(textMenuOption.parentElement.querySelectorAll('button'));
        options[(options.indexOf(textMenuOption)+(event.key==='ArrowDown'?1:options.length-1))%options.length].focus({preventScroll:true});return;
      }
      if(event.key==='Escape'&&root.querySelector('.ppt-text-menu:not([hidden])')){
        event.preventDefault();const trigger=root.querySelector('.ppt-text-menu:not([hidden])')?.previousElementSibling;
        closeTextMenus();trigger?.focus({preventScroll:true});return;
      }
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'){event.preventDefault();action(item,event.shiftKey?'redo':'undo');}
      if((event.key==='Delete'||event.key==='Backspace')&&selected(item)){event.preventDefault();action(item,'delete-element');}
      if(event.key==='Enter'&&event.target.matches('[data-ppt-element]')){event.preventDefault();item.pptSelection=event.target.dataset.pptElement;editText(item,selected(item));}
      if(event.key==='Escape'){if(gesture)finish(true);else {item.pptSelection=null;refresh(item);}}
    });
    let draggingPage=null;
    root.addEventListener('dragstart',event=>{const thumb=event.target.closest('[data-reference-slide]');if(!thumb||!active())return;draggingPage=Number(thumb.dataset.referenceSlide);event.dataTransfer.setData('text/plain',String(draggingPage));event.dataTransfer.effectAllowed='move';});
    root.addEventListener('dragover',event=>{if(draggingPage!==null&&event.target.closest('[data-reference-slide]'))event.preventDefault();});
    root.addEventListener('drop',event=>{const thumb=event.target.closest('[data-reference-slide]'),item=active();if(!thumb||!item||draggingPage===null)return;event.preventDefault();item.referenceSlide=draggingPage;pageAction(item,'move',Number(thumb.dataset.referenceSlide));draggingPage=null;refresh(item);});
    root.addEventListener('dragend',()=>draggingPage=null);
    return {action,cancel:()=>{if(gesture)finish(true);}};
  }
  window.PptWorkbench={model,current,selected,commit,undo,pageAction,svg,image,text,render,install};
})();
