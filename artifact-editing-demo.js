/* 产物选区引用：前端交互演示，不连接文件生成或修改服务。 */
(() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const slides = [
    {title:'季度经营复盘', subtitle:'2026 Q3 · 服务零售事业部', lines:['稳增长 · 提效率', '经营数据、区域表现与下一步行动']},
    {title:'核心经营指标', subtitle:'季度概览', lines:['营收 1,240 万元', '环比增长 18.4%', '平均履约率 92.6%']},
    {title:'区域业绩表现', subtitle:'华东区域履约率低于整体水平', lines:['华东　480 万元　履约率 89.2%', '华南　420 万元　履约率 94.1%', '华北　340 万元　履约率 94.2%']},
    {title:'门店优秀案例', subtitle:'先验证，再推广', lines:['静安寺店：高峰前置备货', '徐家汇店：出餐与配送交接复核', '下一步：验证相同措施在华东其他门店的效果']},
    {title:'下一步行动', subtitle:'把复盘结论转为跟进计划', lines:['华东：核对晚高峰履约明细', '门店：试行高峰交接检查表', '项目组：每周复核履约率与异常原因']},
  ];
  const deck = item => window.PptWorkbench.model(item,slides);
  const slideImage = (index,item) => {deck(item);return window.PptWorkbench.image(item,index);};
  const slideText = (index,item) => {deck(item);return window.PptWorkbench.text(item,index);};
  function files() {
    return [
      {name:'季度经营复盘.pptx',type:'ppt',artifact:true,preview:{kind:'ppt',referenceDemo:true}},
      {name:'季度经营数据.xlsx',type:'excel',artifact:true,preview:{kind:'excel',referenceDemo:true,sheets:[
        {name:'区域经营',columns:['区域','上季度营收（万元）','本季度营收（万元）','履约率'],rows:[['华东','410','480','89.2%'],['华南','350','420','94.1%'],['华北','287','340','94.2%']]},
        {name:'跟进计划',columns:['对象','行动','负责人','截止时间'],rows:[['华东区域','核对晚高峰履约明细','区域运营','10月30日'],['试点门店','试行交接检查表','门店经理','11月2日'],['项目组','复核履约率与异常原因','数据分析','每周一']]},
      ]}},
      {name:'季度经营复盘说明.docx',type:'word',artifact:true,preview:{kind:'word',referenceDemo:true,title:'季度经营复盘说明',subtitle:'2026 Q3 · 服务零售事业部 · 示例数据',sections:[
        {heading:'一、季度经营概况',paragraphs:['本季度营收 1,240 万元，较上季度增长约 18.4%，平均履约率为 92.6%。营收增长与履约改善需要分别评价，避免只根据整体增长判断各区域经营质量。']},
        {heading:'二、区域表现与原因分析',paragraphs:['华东区域本季度营收 480 万元，履约率为 89.2%，低于整体水平。当前材料尚不足以确认具体原因，建议结合晚高峰订单明细，核对出餐、到店与交接时间。','华南与华北区域履约率分别为 94.1% 和 94.2%。后续可以对比不同区域的高峰排班与交接流程，验证哪些措施适合推广。']},
        {heading:'三、下一步行动',paragraphs:['区域运营先核对华东晚高峰异常明细；试点门店使用交接检查表；项目组每周复核履约率变化。责任归属与改善目标应在明细核验后确认。']},
      ]}},
    ];
  }
  function renderPpt(preview,item) {return window.PptWorkbench.render(item,slides);}
  function create(options) {
    const {root, getWorkspace, getTask, focusComposer, openReference} = options;
    const drafts = new Map();
    const registry = new Map();
    let nextId = 0, pending = null, drag = null, cropMode = false, generation = 0;
    const menu = document.createElement('div');
    menu.className = 'artifact-selection-menu';
    menu.setAttribute('role','dialog'); menu.setAttribute('aria-label','引用所选内容'); menu.hidden = true;
    menu.innerHTML = '<div class="artifact-selection-toolbar"><span class="artifact-selection-label"></span><button type="button" data-selection-comment aria-expanded="false" aria-controls="artifactCommentEditor"><svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M7 9h10M7 13h7"/></svg>添加批注</button><button type="button" data-selection-add>添加到对话 <span aria-hidden="true">↵</span></button></div><div class="artifact-comment-editor" id="artifactCommentEditor" hidden><textarea rows="3" aria-label="所选内容的批注" placeholder="这块内容希望怎么改？"></textarea><div class="artifact-comment-footer"><span>批注会随选区一起带入对话</span><button type="button" data-comment-cancel>取消批注</button></div></div>';
    document.body.append(menu);
    const commentButton=menu.querySelector('[data-selection-comment]');
    const addButton=menu.querySelector('[data-selection-add]');
    const commentEditor=menu.querySelector('.artifact-comment-editor');
    const commentInput=menu.querySelector('textarea');
    let selectionRect=null;
    const draftContainers = [document.getElementById('conversationReferences'),document.getElementById('fullscreenReferences')];
    const entries = () => drafts.get(getTask()) || [];
    function clearHighlights() {
      root.querySelectorAll('.reference-cell-selected,.reference-page-selected').forEach(el=>el.classList.remove('reference-cell-selected','reference-page-selected'));
      if (window.CSS?.highlights) CSS.highlights.delete('artifact-word-selection');
      root.querySelectorAll('.reference-crop-box').forEach(el=>el.hidden=true);
    }
    function hide(clear = false) {generation++;menu.hidden=true; pending=null; selectionRect=null;commentInput.value='';commentEditor.hidden=true;commentButton.setAttribute('aria-expanded','false');if(clear) clearHighlights();}
    function cancel() {
      hide(true);drag=null;cropMode=false;root.classList.remove('reference-cropping');
      const button=options.pptCropButton||root.querySelector('[data-reference-crop]');
      if(button){
        button.setAttribute('aria-pressed','false');
        const label=button.querySelector('.file-ppt-action-label');
        if(label)label.textContent='框选区域';else button.textContent='框选区域';
        button.title='框选区域';
      }
    }
    function toggleCrop(crop){
      cropMode=!cropMode;
      hide(true);
      crop.setAttribute('aria-pressed',String(cropMode));
      const label=crop.querySelector('.file-ppt-action-label');
      if(label)label.textContent=cropMode?'取消框选':'框选区域';else crop.textContent=cropMode?'取消框选':'框选区域';
      crop.title=cropMode?'取消框选':'框选区域';
      root.classList.toggle('reference-cropping',cropMode);
    }
    function base(item,kind,label) { return {id:`selection-${++nextId}`,node:item.node,chain:item.chain.slice(),task:options.taskForArtifact(item.chain) || getTask(),kind,label,fileName:item.node.name}; }
    function positionMenu() {
      if(!selectionRect)return;
      const rect=selectionRect;
      const width=menu.offsetWidth,height=menu.offsetHeight;
      menu.style.left=`${Math.max(8,Math.min(rect.left,innerWidth-width-8))}px`;
      menu.style.top=`${rect.bottom+height+12<innerHeight ? rect.bottom+7 : Math.max(8,rect.top-height-7)}px`;
    }
    if(typeof ResizeObserver!=='undefined')new ResizeObserver(positionMenu).observe(menu);
    function show(ref, rect) {
      pending=ref;selectionRect=rect;commentInput.value=ref.comment||'';commentEditor.hidden=!ref.comment;
      commentButton.setAttribute('aria-expanded',String(!commentEditor.hidden));
      menu.querySelector('.artifact-selection-label').textContent=ref.label;menu.hidden=false;positionMenu();
    }
    function card(ref, removable) {
      return `<div class="artifact-reference-card"><button type="button" data-artifact-reference="${ref.id}" title="回到引用位置：${escape(ref.label)}">${ref.image ? `<img src="${ref.image}" alt="引用的页面或区域">` : `<span class="artifact-reference-type">${ref.kind==='excel'?'表格':ref.kind==='material'?'资料':'文字'}</span>`}<span class="artifact-reference-copy"><strong>${escape(ref.fileName)} · ${escape(ref.label)}</strong>${ref.comment ? `<span class="artifact-reference-comment">${escape(ref.comment)}</span>` : ''}<small>${escape(ref.text)}</small></span></button>${removable ? `<button class="artifact-reference-remove" type="button" data-artifact-reference-remove="${ref.id}" aria-label="移除引用：${escape(ref.label)}">×</button>`:''}</div>`;
    }
    function renderDrafts() {
      draftContainers.forEach(el=>{el.hidden=!entries().length;el.innerHTML=entries().map(ref=>card(ref,true)).join('');});
      options.referencesChanged?.();
    }
    function renderSent(refs = []) {return refs.length ? `<div class="artifact-sent-references">${refs.map(ref=>card(ref,false)).join('')}</div>`:'';}
    function add() {
      if(!pending) return;
      const ref={...pending,comment:commentInput.value.trim()};
      options.ensureTask(ref.task);
      const list=entries().slice();
      if(!list.some(entry=>entry.node===ref.node&&entry.label===ref.label&&entry.text===ref.text&&(entry.comment||'')===ref.comment&&JSON.stringify(entry.box)===JSON.stringify(ref.box))){list.push(ref);registry.set(ref.id,ref);}
      drafts.set(getTask(),list);hide();renderDrafts();focusComposer();
    }
    menu.addEventListener('pointerdown',event=>{if(event.target!==commentInput)event.preventDefault();});
    addButton.addEventListener('click',add);
    commentButton.addEventListener('click',()=>{
      commentEditor.hidden=false;commentButton.setAttribute('aria-expanded','true');positionMenu();commentInput.focus({preventScroll:true});
    });
    function dismissComment() {
      commentInput.value='';commentEditor.hidden=true;commentButton.setAttribute('aria-expanded','false');positionMenu();commentButton.focus({preventScroll:true});
    }
    menu.querySelector('[data-comment-cancel]').addEventListener('click',dismissComment);
    commentInput.addEventListener('keydown',event=>{
      if(event.isComposing)return;
      if(event.key==='Enter'&&(event.metaKey||event.ctrlKey)){event.preventDefault();event.stopPropagation();add();}
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();dismissComment();}
    });
    function pageReference(item,element) {
      clearHighlights();element.classList.add('reference-page-selected');
      const index=item.referenceSlide||0;
      show({...base(item,'ppt',`第 ${index+1} 页`),slide:index,slideId:deck(item)[index].id,image:slideImage(index,item),text:slideText(index,item)},element.getBoundingClientRect());
    }
    function markCells(start,end) {
      const r0=Math.min(start.r,end.r),r1=Math.max(start.r,end.r),c0=Math.min(start.c,end.c),c1=Math.max(start.c,end.c);
      root.querySelectorAll('td[data-excel-row]').forEach(cell=>{
        const r=Number(cell.dataset.excelRow),c=Number(cell.dataset.excelColumn);
        cell.classList.toggle('reference-cell-selected',r>=r0&&r<=r1&&c>=c0&&c<=c1);
      });
      return {r0,r1,c0,c1};
    }
    function excelReference(item,start,end,rect) {
      const bounds=markCells(start,end),{r0,r1,c0,c1}=bounds;
      const sheetIndex=item.officeSheet||0,sheet=item.node.preview.sheets[sheetIndex];
      const rowIndices=[...new Set([...root.querySelectorAll('td[data-excel-row]')].map(cell=>Number(cell.dataset.excelRow)))].filter(row=>row>=r0&&row<=r1).sort((a,b)=>a-b);
      const address=rowIndices.length===r1-r0+1
        ? `${String.fromCharCode(65+c0)}${r0+2}${r0===r1&&c0===c1?'':`:${String.fromCharCode(65+c1)}${r1+2}`}`
        : rowIndices.map(row=>`${String.fromCharCode(65+c0)}${row+2}${c0===c1?'':`:${String.fromCharCode(65+c1)}${row+2}`}`).join('、');
      const columns=sheet.columns.slice(c0,c1+1),rows=rowIndices.map(row=>sheet.rows[row].slice(c0,c1+1));
      const text=[columns.join(' / '),...rows.map(row=>row.join(' / '))].join('\n');
      show({...base(item,'excel',`${sheet.name} · ${address}`),sheet:sheetIndex,bounds,rowIndices,columns,rows,text},rect);
      root.querySelector('[data-excel-address]:not(td)').textContent=address;
      root.querySelector('[data-excel-value]').textContent=rows.map(row=>row.join(' / ')).join('；');
    }
    function selectWord() {
      const item=getWorkspace(),selection=window.getSelection();
      if(!item?.node?.preview?.referenceDemo||item.node.preview.kind!=='word'||!selection?.rangeCount||selection.isCollapsed) return;
      const range=selection.getRangeAt(0),page=root.querySelector('.word-page');
      if(!page?.contains(range.startContainer)||!page.contains(range.endContainer)) return;
      const text=selection.toString().trim();if(!text) return;
      const prefix=range.cloneRange();prefix.selectNodeContents(page);prefix.setEnd(range.startContainer,range.startOffset);
      const start=prefix.toString().length,end=start+range.toString().length;
      const parent=range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentElement;
      const section=parent.closest('.word-section');
      const label=section?.querySelector('h2')?.textContent||'所选文字';
      if(window.CSS?.highlights) CSS.highlights.set('artifact-word-selection',new Highlight(range.cloneRange()));
      show({...base(item,'word',label),text,start,end},range.getBoundingClientRect());
    }
    function restoreWord(ref) {
      const page=root.querySelector('.word-page');if(!page)return;
      const walker=document.createTreeWalker(page,NodeFilter.SHOW_TEXT);
      const range=document.createRange();let pos=0,start=false,node;
      while((node=walker.nextNode())){
        const next=pos+node.length;
        if(!start&&ref.start<=next){range.setStart(node,Math.max(0,ref.start-pos));start=true;}
        if(start&&ref.end<=next){range.setEnd(node,Math.max(0,ref.end-pos));break;} pos=next;
      }
      if(start){const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);if(window.CSS?.highlights)CSS.highlights.set('artifact-word-selection',new Highlight(range));range.startContainer.parentElement?.scrollIntoView({block:'center'});}
    }
    function locate(ref) {
      cancel();openReference(ref);
      const item=getWorkspace();
      if(ref.kind==='ppt'){
        const index=ref.slideId ? deck(item).findIndex(p=>p.id===ref.slideId) : ref.slide||0;
        if(index<0){options.feedback('引用的页面已删除，可撤销删除后再定位；消息中保留了原内容。');return;}
        item.referenceSlide=index;item.pptSelection=ref.elementId||null;options.renderWorkspace(item);
      }
      if(ref.kind==='excel'){item.officeSheet=ref.sheet;item.officeFilter='';options.renderWorkspace(item);}
      requestAnimationFrame(()=>{
        if(ref.kind==='word')restoreWord(ref);
        if(ref.kind==='excel'){
          markCells({r:ref.bounds.r0,c:ref.bounds.c0},{r:ref.bounds.r1,c:ref.bounds.c1});
          root.querySelectorAll('td[data-excel-row]').forEach(cell=>{if(!ref.rowIndices.includes(Number(cell.dataset.excelRow)))cell.classList.remove('reference-cell-selected');});
          root.querySelector(`[data-excel-row="${ref.bounds.r0}"][data-excel-column="${ref.bounds.c0}"]`)?.scrollIntoView({block:'center',inline:'center'});
        }
        if(ref.kind==='ppt'){
          root.querySelector('.reference-slide')?.classList.add('reference-page-selected');
          if(ref.elementId){
            const element=deck(item)[item.referenceSlide].elements.find(e=>e.id===ref.elementId);
            if(element)drawBox({x:element.x/960,y:element.y/540,w:element.w/960,h:element.h/540});
            else options.feedback('引用的元素已删除；消息中仍保留原内容。');
          }else if(ref.box)drawBox(ref.box);
        }
      });
    }
    function drawBox(box) {
      const el=root.querySelector('.reference-crop-box');if(!el)return;
      el.hidden=false;el.style.left=`${box.x*100}%`;el.style.top=`${box.y*100}%`;el.style.width=`${box.w*100}%`;el.style.height=`${box.h*100}%`;
    }
    function point(event,rect) {return {x:Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))};}
    root.addEventListener('click',event=>{
      const item=getWorkspace();if(!item?.node?.preview?.referenceDemo||item.pptPresent)return;
      const thumb=event.target.closest('[data-reference-slide]');
      if(thumb){cancel();item.referenceSlide=Number(thumb.dataset.referenceSlide);item.pptSelection=null;options.renderWorkspace(item);return;}
      const crop=event.target.closest('[data-reference-crop]');
      if(crop){toggleCrop(crop);return;}
      if(event.target.closest('.reference-slide')&&!cropMode)pageReference(item,root.querySelector('.reference-slide'));
    });
    options.pptCropButton?.addEventListener('click',()=>{
      const item=getWorkspace();
      if(item?.node?.preview?.kind==='ppt'&&item.node.preview.referenceDemo&&!item.pptPresent)toggleCrop(options.pptCropButton);
    });
    root.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;
      const item=getWorkspace();if(!item?.node?.preview?.referenceDemo)return;
      const cell=event.target.closest('td[data-excel-row]');
      if(cell){event.preventDefault();hide(true);const start={r:Number(cell.dataset.excelRow),c:Number(cell.dataset.excelColumn)};drag={kind:'excel',item,start,end:start,cell};markCells(start,start);return;}
      const slide=event.target.closest('.reference-slide');
      if(slide&&cropMode){event.preventDefault();hide(true);const rect=slide.getBoundingClientRect();drag={kind:'ppt',item,rect,start:point(event,rect)};}
    });
    document.addEventListener('pointermove',event=>{
      if(!drag)return;
      if(drag.kind==='excel'){
        const cell=document.elementFromPoint(event.clientX,event.clientY)?.closest('td[data-excel-row]');
        if(cell&&root.contains(cell)){drag.end={r:Number(cell.dataset.excelRow),c:Number(cell.dataset.excelColumn)};drag.cell=cell;markCells(drag.start,drag.end);}
      } else {
        const p=point(event,drag.rect),a=drag.start;
        drag.box={x:Math.min(a.x,p.x),y:Math.min(a.y,p.y),w:Math.abs(a.x-p.x),h:Math.abs(a.y-p.y)};drawBox(drag.box);
      }
    });
    document.addEventListener('pointerup',async event=>{
      if(!drag){if(root.contains(event.target))selectWord();return;}
      const selection=drag;drag=null;
      if(selection.kind==='excel'){excelReference(selection.item,selection.start,selection.end,selection.cell.getBoundingClientRect());return;}
      const {box,item,rect}=selection;
      const cropGeneration=generation;
      if(!box||box.w*rect.width<8||box.h*rect.height<8){hide(true);return;}
      const index=item.referenceSlide||0;
      const img=root.querySelector('.reference-slide img');
      try {
        await img.decode();
        if(generation!==cropGeneration||getWorkspace()!==item||(item.referenceSlide||0)!==index)return;
        const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(box.w*960));canvas.height=Math.max(1,Math.round(box.h*540));
        canvas.getContext('2d').drawImage(img,box.x*960,box.y*540,box.w*960,box.h*540,0,0,canvas.width,canvas.height);
        show({...base(item,'ppt',`第 ${index+1} 页 · 框选区域`),slide:index,slideId:deck(item)[index].id,box,image:canvas.toDataURL('image/png'),text:deck(item)[index].title+'（局部截图）',pageText:slideText(index,item)},{left:rect.left+box.x*rect.width,top:rect.top+box.y*rect.height,bottom:rect.top+(box.y+box.h)*rect.height});
      } catch {options.feedback('截图未完成，请重新框选，或选择整页添加到对话。');}
    });
    document.addEventListener('pointercancel',()=>cancel());
    root.addEventListener('keyup',event=>{if(event.key.startsWith('Arrow')||event.key==='Shift')selectWord();});
    root.addEventListener('keydown',event=>{
      if(!getWorkspace()?.pptPresent&&(event.key==='Enter'||event.key===' ')&&event.target.matches('.reference-slide')){event.preventDefault();pageReference(getWorkspace(),event.target);addButton.focus();}
      const cell=event.target.closest('td[data-excel-row]');
      if(cell&&event.key==='Enter'&&getWorkspace()?.node?.preview?.referenceDemo){event.preventDefault();const p={r:Number(cell.dataset.excelRow),c:Number(cell.dataset.excelColumn)};excelReference(getWorkspace(),p,p,cell.getBoundingClientRect());addButton.focus();}
    });
    document.addEventListener('pointerdown',event=>{if(!menu.contains(event.target)&&!root.contains(event.target))hide();},true);
    document.addEventListener('keydown',event=>{if(event.key==='Escape')cancel();});
    document.addEventListener('scroll',event=>{if(!menu.contains(event.target))hide();},true);
    window.addEventListener('resize',()=>hide());
    window.addEventListener('blur',()=>cancel());
    document.addEventListener('click',event=>{
      const remove=event.target.closest('[data-artifact-reference-remove]');
      if(remove){drafts.set(getTask(),entries().filter(ref=>ref.id!==remove.dataset.artifactReferenceRemove));renderDrafts();return;}
      const link=event.target.closest('[data-artifact-reference]');
      if(link){const ref=registry.get(link.dataset.artifactReference);if(ref)locate(ref);}
    });
    const pptWorkbench=window.PptWorkbench.install({root,getWorkspace,renderWorkspace:options.renderWorkspace,cancelSelection:cancel,feedback:options.feedback,
      reference:async(item,element)=>{
        cancel();const index=item.referenceSlide||0,page=deck(item)[index],rect=root.querySelector('.reference-slide').getBoundingClientRect();
        if(element){
          const box={x:element.x/960,y:element.y/540,w:element.w/960,h:element.h/540};
          const ref={...base(item,'ppt',`第 ${index+1} 页 · 所选元素`),slide:index,slideId:page.id,elementId:element.id,box,text:element.text||element.rows?.map(row=>row.join(' / ')).join('；')||'图片或形状',image:slideImage(index,item)};
          try {const source=new Image();source.src=ref.image;await source.decode();const c=document.createElement('canvas');c.width=Math.max(1,Math.round(box.w*960));c.height=Math.max(1,Math.round(box.h*540));c.getContext('2d').drawImage(source,box.x*960,box.y*540,box.w*960,box.h*540,0,0,c.width,c.height);ref.image=c.toDataURL('image/png');}catch{/* Keep full-page snapshot if crop cannot be decoded. */}
          if(getWorkspace()!==item||getTask()!==ref.task)return;show(ref,rect);
        }else pageReference(item,root.querySelector('.reference-slide'));
        add();
      },
    });
    options.pptReferenceButton?.addEventListener('click',()=>{
      const item=getWorkspace();
      if(item?.node?.preview?.kind==='ppt'&&item.node.preview.referenceDemo&&!item.pptPresent)pptWorkbench.action(item,'reference');
    });
    return {entries,renderSent,renderDrafts,cancel,
      previewPpt(){
        const item=getWorkspace();
        if(item?.node?.preview?.kind==='ppt'&&item.node.preview.referenceDemo&&!item.pptPresent)pptWorkbench.action(item,'present');
      },
      clear(){drafts.delete(getTask());renderDrafts();},taskChanged(){cancel();renderDrafts();}};
  }
  window.ArtifactEditingDemo={files,renderPpt,create};
})();
