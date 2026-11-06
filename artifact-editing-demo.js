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
    let nextId = 0, pending = null, drag = null, cropMode = false, activeCropButton = null, generation = 0;
    const menu = document.createElement('div');
    menu.className = 'artifact-selection-menu';
    menu.setAttribute('role','dialog'); menu.setAttribute('aria-label','引用所选内容'); menu.hidden = true;
    menu.innerHTML = '<div class="artifact-selection-toolbar"><span class="artifact-selection-label"></span><button type="button" data-selection-comment aria-expanded="false" aria-controls="artifactCommentEditor"><svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M7 9h10M7 13h7"/></svg>添加批注</button><button type="button" data-selection-add><svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M12 3C7 3 3 6.8 3 11.5c0 1.5.42 2.92 1.15 4.15L3.57 19q-.27 1.55 1.16 1.13l3.97-.71c1.04.38 2.15.58 3.3.58 5 0 9-3.8 9-8.5S17 3 12 3Z"/><path d="M12 8.5v6M9 11.5h6"/></svg>添加到对话</button></div><div class="artifact-annotation" hidden><div class="artifact-annotation-tools" role="toolbar" aria-label="截图标注工具"><button type="button" data-annotation-tool="circle" aria-label="画圆形" title="画圆形"><svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><circle cx="12" cy="12" r="7"/></svg></button><button type="button" data-annotation-tool="rect" aria-label="画矩形" title="画矩形"><svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="1"/></svg></button><button type="button" data-annotation-tool="line" aria-label="画直线" title="画直线"><svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M4 19 20 5"/></svg></button><button type="button" data-annotation-tool="arrow" aria-label="画箭头" title="画箭头"><svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M4 19 20 5m-7 0h7v7"/></svg></button><button type="button" data-annotation-tool="pen" aria-label="画笔" title="画笔"><svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="m4 20 4.5-1 10-10-3.5-3.5-10 10L4 20Zm9-13 3.5 3.5M4 20l5-1"/></svg></button><button type="button" data-annotation-tool="text" aria-label="文本" title="文本"><svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M4 6h16M12 6v13m-4 0h8"/></svg></button></div><input class="artifact-annotation-text" type="text" aria-label="标注文字" placeholder="输入文字，再点击原位置放置" hidden><div class="artifact-annotation-preview"><canvas class="artifact-annotation-canvas" aria-label="原产物选区，可使用上方工具标注"></canvas></div></div><div class="artifact-comment-editor" id="artifactCommentEditor" hidden><textarea rows="3" aria-label="所选内容的批注" placeholder="这块内容希望怎么改？"></textarea><div class="artifact-comment-footer"><span>批注会随选区一起带入对话</span><button type="button" data-comment-cancel>取消批注</button></div></div>';
    document.body.append(menu);
    const commentButton=menu.querySelector('[data-selection-comment]');
    const addButton=menu.querySelector('[data-selection-add]');
    const commentEditor=menu.querySelector('.artifact-comment-editor');
    const commentInput=menu.querySelector('textarea');
    const annotationPanel=menu.querySelector('.artifact-annotation');
    const annotationCanvas=menu.querySelector('.artifact-annotation-canvas');
    const annotationText=menu.querySelector('.artifact-annotation-text');
    let annotationBase=null,annotationShapes=[],annotationDraft=null,annotationTool='pen',annotationPointer=null;
    let selectionRect=null;
    const draftContainers = [document.getElementById('conversationReferences'),document.getElementById('fullscreenReferences')];
    const entries = () => drafts.get(getTask()) || [];
    function clearHighlights() {
      root.querySelectorAll('.reference-cell-selected,.reference-page-selected').forEach(el=>el.classList.remove('reference-cell-selected','reference-page-selected'));
      if (window.CSS?.highlights) CSS.highlights.delete('artifact-word-selection');
      root.querySelectorAll('.reference-crop-box').forEach(el=>el.hidden=true);
    }
    function hide(clear = false) {generation++;menu.hidden=true;menu.classList.remove('artifact-annotation-inline');pending=null; selectionRect=null;commentInput.value='';commentEditor.hidden=true;commentButton.setAttribute('aria-expanded','false');annotationBase=null;annotationShapes=[];annotationDraft=null;annotationPointer=null;annotationCanvas?.remove();if(annotationPanel)annotationPanel.hidden=true;if(clear) clearHighlights();}
    function cancel() {
      const previous=activeCropButton;
      hide(true);drag=null;cropMode=false;activeCropButton=null;root.classList.remove('reference-cropping');
      [...new Set([options.pptCropButton,options.wordCropButton,options.htmlCropButton,previous].filter(Boolean))].forEach(button=>{
        button.setAttribute('aria-pressed','false');
        const label=button.querySelector('.file-ppt-action-label');
        if(label)label.textContent='标注区域';else button.textContent='标注区域';
        button.title='标注区域';
      });
    }
    function toggleCrop(crop){
      const next=activeCropButton!==crop||!cropMode;
      hide(true);
      [...new Set([options.pptCropButton,options.wordCropButton,options.htmlCropButton,activeCropButton].filter(Boolean))].forEach(button=>{
        button.setAttribute('aria-pressed','false');
        const label=button.querySelector('.file-ppt-action-label');
        if(label)label.textContent='标注区域';
        button.title='标注区域';
      });
      cropMode=next;activeCropButton=next?crop:null;
      crop.setAttribute('aria-pressed',String(cropMode));
      const label=crop.querySelector('.file-ppt-action-label');
      if(label)label.textContent=cropMode?'取消框选':'标注区域';else crop.textContent=cropMode?'取消框选':'标注区域';
      crop.title=cropMode?'取消框选':'标注区域';
      root.classList.toggle('reference-cropping',cropMode);
    }
    function base(item,kind,label) { return {id:`selection-${++nextId}`,node:item.node,chain:item.chain.slice(),task:options.taskForArtifact(item.chain) || getTask(),kind,label,fileName:item.node.name}; }
    function positionMenu() {
      if(!selectionRect)return;
      const rect=annotationBase&&pending?.annotationScreenshot?annotationCanvas.getBoundingClientRect():selectionRect;
      const width=menu.offsetWidth,height=menu.offsetHeight;
      menu.style.left=`${Math.max(8,Math.min(rect.left,innerWidth-width-8))}px`;
      menu.style.top=`${rect.bottom+height+12<innerHeight ? rect.bottom+7 : Math.max(8,rect.top-height-7)}px`;
    }
    if(typeof ResizeObserver!=='undefined')new ResizeObserver(positionMenu).observe(menu);
    function show(ref, rect) {
      pending=ref;selectionRect=rect;commentInput.value=ref.comment||'';commentEditor.hidden=!ref.comment;
      commentButton.setAttribute('aria-expanded',String(!commentEditor.hidden));
      menu.classList.toggle('artifact-annotation-inline',Boolean(ref.annotationScreenshot&&annotationPanel));
      if(annotationPanel)annotationPanel.hidden=!ref.annotationScreenshot;
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
      if(!list.some(entry=>entry.node===ref.node&&entry.label===ref.label&&entry.text===ref.text&&(entry.comment||'')===ref.comment&&JSON.stringify(entry.box)===JSON.stringify(ref.box)&&entry.image===ref.image)){list.push(ref);registry.set(ref.id,ref);}
      drafts.set(getTask(),list);hide();renderDrafts();focusComposer();
    }
    menu.addEventListener('pointerdown',event=>{if(event.target!==commentInput&&event.target!==annotationText)event.preventDefault();});
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
    function drawAnnotation(shape,ctx,width,height) {
      const a=shape.start,b=shape.end||a;
      const x=a.x*width,y=a.y*height,dx=(b.x-a.x)*width,dy=(b.y-a.y)*height;
      ctx.save();ctx.strokeStyle='#ef4444';ctx.fillStyle='#ef4444';ctx.lineWidth=Math.max(2,Math.min(width,height)/180);ctx.lineCap='round';ctx.lineJoin='round';
      if(shape.tool==='text'){
        ctx.font=`600 ${Math.max(16,Math.round(Math.min(width,height)/18))}px sans-serif`;
        ctx.textBaseline='top';ctx.fillText(shape.text,x,y);
      }else if(shape.tool==='circle'){
        ctx.beginPath();ctx.ellipse(x+dx/2,y+dy/2,Math.max(1,Math.abs(dx)/2),Math.max(1,Math.abs(dy)/2),0,0,Math.PI*2);ctx.stroke();
      }else if(shape.tool==='rect'){
        ctx.strokeRect(x,y,dx,dy);
      }else if(shape.tool==='pen'){
        const points=shape.points||[a];ctx.beginPath();ctx.moveTo(points[0].x*width,points[0].y*height);
        if(points.length===1)ctx.lineTo(points[0].x*width+.1,points[0].y*height+.1);
        else points.slice(1).forEach(p=>ctx.lineTo(p.x*width,p.y*height));
        ctx.stroke();
      }else{
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+dx,y+dy);ctx.stroke();
        if(shape.tool==='arrow'){
          const angle=Math.atan2(dy,dx),head=Math.max(10,Math.min(width,height)/24);
          ctx.beginPath();ctx.moveTo(x+dx-head*Math.cos(angle-.55),y+dy-head*Math.sin(angle-.55));ctx.lineTo(x+dx,y+dy);ctx.lineTo(x+dx-head*Math.cos(angle+.55),y+dy-head*Math.sin(angle+.55));ctx.stroke();
        }
      }
      ctx.restore();
    }
    function renderAnnotation() {
      if(!annotationCanvas||!annotationBase)return;
      const ctx=annotationCanvas.getContext('2d');if(!ctx)return;
      ctx.clearRect(0,0,annotationCanvas.width,annotationCanvas.height);
      ctx.drawImage(annotationBase,0,0,annotationCanvas.width,annotationCanvas.height);
      annotationShapes.forEach(shape=>drawAnnotation(shape,ctx,annotationCanvas.width,annotationCanvas.height));
      if(annotationDraft)drawAnnotation(annotationDraft,ctx,annotationCanvas.width,annotationCanvas.height);
    }
    function startAnnotation(snapshot) {
      if(!annotationCanvas||!annotationPanel)return;
      const host=root.querySelector(pending?.kind==='html-region'?'.reference-html':pending?.kind==='word-region'?'.word-page':'.reference-slide');
      if(!host||!pending?.box)return;
      annotationBase=snapshot;annotationShapes=[];annotationDraft=null;annotationTool='pen';annotationPointer=null;
      annotationCanvas.width=snapshot.width;annotationCanvas.height=snapshot.height;
      annotationCanvas.style.left=`${pending.box.x*100}%`;
      annotationCanvas.style.top=`${pending.box.y*100}%`;
      annotationCanvas.style.width=`${pending.box.w*100}%`;
      annotationCanvas.style.height=`${pending.box.h*100}%`;
      host.append(annotationCanvas);
      if(annotationText){annotationText.value='';annotationText.hidden=true;}
      annotationPanel.querySelectorAll('[data-annotation-tool]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.annotationTool==='pen')));
      renderAnnotation();positionMenu();
    }
    function annotationPoint(event) {return point(event,annotationCanvas.getBoundingClientRect());}
    if(annotationPanel&&annotationCanvas){
      annotationPanel.addEventListener('click',event=>{
        const button=event.target.closest('[data-annotation-tool]');if(!button)return;
        annotationTool=button.dataset.annotationTool;annotationDraft=null;
        annotationPanel.querySelectorAll('[data-annotation-tool]').forEach(tool=>tool.setAttribute('aria-pressed',String(tool===button)));
        annotationText.hidden=annotationTool!=='text';
        if(annotationTool==='text')annotationText.focus({preventScroll:true});
        renderAnnotation();positionMenu();
      });
      annotationCanvas.addEventListener('pointerdown',event=>{
        if(event.button!==0||!annotationBase)return;
        event.preventDefault();const start=annotationPoint(event);
        if(annotationTool==='text'){
          const text=annotationText.value.trim();if(!text){annotationText.focus({preventScroll:true});return;}
          annotationShapes.push({tool:'text',start,text});annotationText.value='';renderAnnotation();pending.image=annotationCanvas.toDataURL('image/png');annotationText.focus({preventScroll:true});return;
        }
        annotationPointer=event.pointerId;
        annotationDraft={tool:annotationTool,start,end:start,points:annotationTool==='pen'?[start]:undefined};
        if(event.isTrusted)annotationCanvas.setPointerCapture?.(event.pointerId);
      });
      annotationCanvas.addEventListener('pointermove',event=>{
        if(!annotationDraft||event.pointerId!==annotationPointer)return;
        const end=annotationPoint(event);annotationDraft.end=end;
        if(annotationDraft.tool==='pen')annotationDraft.points.push(end);
        renderAnnotation();
      });
      const finishAnnotation=event=>{
        if(!annotationDraft||event.pointerId!==annotationPointer)return;
        const shape=annotationDraft;annotationDraft=null;annotationPointer=null;
        if(shape.tool==='pen'||Math.hypot((shape.end.x-shape.start.x)*annotationCanvas.width,(shape.end.y-shape.start.y)*annotationCanvas.height)>3){
          annotationShapes.push(shape);renderAnnotation();pending.image=annotationCanvas.toDataURL('image/png');
        }else renderAnnotation();
      };
      annotationCanvas.addEventListener('pointerup',finishAnnotation);
      annotationCanvas.addEventListener('pointercancel',event=>{if(event.pointerId===annotationPointer){annotationDraft=null;annotationPointer=null;renderAnnotation();}});
    }
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
        if(ref.kind==='html-region'){
          const host=root.querySelector('.reference-html'),frame=host?.querySelector('iframe');
          const restoreScroll=()=>frame?.contentWindow?.scrollTo(ref.scrollX||0,ref.scrollY||0);
          frame?.addEventListener('load',restoreScroll,{once:true});
          restoreScroll();
          if(host&&ref.box)drawBox(ref.box,host);
        }
        if(ref.kind==='word-region'){
          const page=root.querySelector('.word-page');
          page?.scrollIntoView({block:'center'});
          if(page&&ref.box)drawBox(ref.box,page);
        }
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
    function drawBox(box,host=root.querySelector('.reference-slide')) {
      if(!host)return;
      let el=host===root.querySelector('.reference-slide')
        ? root.querySelector('.reference-crop-box')
        : host.querySelector('.reference-crop-box');
      if(!el){el=document.createElement('div');el.className='reference-crop-box';host.append(el);}
      el.hidden=false;el.style.left=`${box.x*100}%`;el.style.top=`${box.y*100}%`;el.style.width=`${box.w*100}%`;el.style.height=`${box.h*100}%`;
    }
    async function captureWordRegion(page,box,viewport=null){
      const width=Math.round(viewport?.width||page.getBoundingClientRect().width),height=Math.round(viewport?.height||page.getBoundingClientRect().height);
      const source=page.cloneNode(true);
      const originals=[page,...page.querySelectorAll('*')],copies=[source,...source.querySelectorAll('*')];
      originals.forEach((node,index)=>{
        const style=page.ownerDocument?.defaultView?.getComputedStyle(node)||getComputedStyle(node),copy=copies[index];
        if(!copy)return;
        for(const key of style)copy.style.setProperty(key,style.getPropertyValue(key),style.getPropertyPriority(key));
      });
      source.querySelectorAll('.reference-crop-box,.artifact-annotation-canvas').forEach(node=>node.remove());
      source.style.margin='0';source.style.width=`${width}px`;if(!viewport)source.style.height=`${height}px`;
      source.setAttribute('xmlns','http://www.w3.org/1999/xhtml');
      const markup=new XMLSerializer().serializeToString(source);
      const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject x="${-(viewport?.scrollX||0)}" y="${-(viewport?.scrollY||0)}" width="${viewport?Math.max(width,page.scrollWidth):width}" height="${viewport?Math.max(height,page.scrollHeight):height}">${markup}</foreignObject></svg>`;
      const image=new Image();image.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;await image.decode();
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(box.w*width));canvas.height=Math.max(1,Math.round(box.h*height));
      canvas.getContext('2d').drawImage(image,box.x*width,box.y*height,box.w*width,box.h*height,0,0,canvas.width,canvas.height);
      return canvas;
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
    options.wordCropButton?.addEventListener('click',()=>{
      const item=getWorkspace();
      if(item?.node?.preview?.kind==='word'&&item.node.preview.referenceDemo)toggleCrop(options.wordCropButton);
    });
    options.htmlCropButton?.addEventListener('click',()=>{
      if(getWorkspace()?.node?.preview?.kind==='html')toggleCrop(options.htmlCropButton);
    });
    root.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;
      const item=getWorkspace();if(!item?.node?.preview?.referenceDemo&&item?.node?.preview?.kind!=='html')return;
      const cell=event.target.closest('td[data-excel-row]');
      if(cell){event.preventDefault();hide(true);const start={r:Number(cell.dataset.excelRow),c:Number(cell.dataset.excelColumn)};drag={kind:'excel',item,start,end:start,cell};markCells(start,start);return;}
      const html=event.target.closest('.reference-html');
      if(html&&cropMode&&event.target!==annotationCanvas){event.preventDefault();hide(true);const rect=html.getBoundingClientRect();drag={kind:'html-region',item,host:html,rect,start:point(event,rect)};return;}
      const slide=event.target.closest('.reference-slide');
      if(slide&&cropMode&&event.target!==annotationCanvas){event.preventDefault();hide(true);const rect=slide.getBoundingClientRect();drag={kind:'ppt',item,host:slide,rect,start:point(event,rect)};return;}
      const page=event.target.closest('.word-page');
      if(page&&cropMode&&item.node.preview.kind==='word'&&event.target!==annotationCanvas){event.preventDefault();hide(true);const rect=page.getBoundingClientRect();drag={kind:'word-region',item,host:page,rect,start:point(event,rect)};}
    });
    document.addEventListener('pointermove',event=>{
      if(!drag)return;
      if(drag.kind==='excel'){
        const cell=document.elementFromPoint(event.clientX,event.clientY)?.closest('td[data-excel-row]');
        if(cell&&root.contains(cell)){drag.end={r:Number(cell.dataset.excelRow),c:Number(cell.dataset.excelColumn)};drag.cell=cell;markCells(drag.start,drag.end);}
      } else {
        const p=point(event,drag.rect),a=drag.start;
        drag.box={x:Math.min(a.x,p.x),y:Math.min(a.y,p.y),w:Math.abs(a.x-p.x),h:Math.abs(a.y-p.y)};drawBox(drag.box,drag.host);
      }
    });
    document.addEventListener('pointerup',async event=>{
      if(!drag){if(root.contains(event.target))selectWord();return;}
      const selection=drag;drag=null;
      if(selection.kind==='excel'){excelReference(selection.item,selection.start,selection.end,selection.cell.getBoundingClientRect());return;}
      const {box,item,rect}=selection;
      const cropGeneration=generation;
      if(!box||box.w*rect.width<8||box.h*rect.height<8){hide(true);return;}
      if(selection.kind==='html-region'){
        try{
          const frame=selection.host.querySelector('iframe'),page=frame.contentDocument.documentElement;
          const scrollX=frame.contentWindow.scrollX,scrollY=frame.contentWindow.scrollY;
          const canvas=await captureWordRegion(page,box,{width:frame.clientWidth,height:frame.clientHeight,scrollX,scrollY});
          if(generation!==cropGeneration||getWorkspace()!==item)return;
          show({...base(item,'html-region','标注区域'),box,scrollX,scrollY,image:canvas.toDataURL('image/png'),annotationScreenshot:true,text:'网页局部截图'},{left:rect.left+box.x*rect.width,top:rect.top+box.y*rect.height,bottom:rect.top+(box.y+box.h)*rect.height});
          startAnnotation(canvas);
        }catch{options.feedback('截图未完成，请等待网页加载后重新框选。');}
        return;
      }
      if(selection.kind==='word-region'){
        try{
          const canvas=await captureWordRegion(selection.host,box);
          if(generation!==cropGeneration||getWorkspace()!==item)return;
          show({...base(item,'word-region','标注区域'),box,image:canvas.toDataURL('image/png'),annotationScreenshot:true,text:'文档局部截图'}, {left:rect.left+box.x*rect.width,top:rect.top+box.y*rect.height,bottom:rect.top+(box.y+box.h)*rect.height});
          startAnnotation(canvas);
        }catch{options.feedback('截图未完成，请重新框选。');}
        return;
      }
      const index=item.referenceSlide||0;
      const img=root.querySelector('.reference-slide img');
      try {
        await img.decode();
        if(generation!==cropGeneration||getWorkspace()!==item||(item.referenceSlide||0)!==index)return;
        const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(box.w*960));canvas.height=Math.max(1,Math.round(box.h*540));
        canvas.getContext('2d').drawImage(img,box.x*960,box.y*540,box.w*960,box.h*540,0,0,canvas.width,canvas.height);
        show({...base(item,'ppt',`第 ${index+1} 页 · 标注区域`),slide:index,slideId:deck(item)[index].id,box,image:canvas.toDataURL('image/png'),annotationScreenshot:true,text:deck(item)[index].title+'（局部截图）',pageText:slideText(index,item)},{left:rect.left+box.x*rect.width,top:rect.top+box.y*rect.height,bottom:rect.top+(box.y+box.h)*rect.height});
        startAnnotation(canvas);
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
    document.addEventListener('scroll',event=>{if(annotationBase&&pending?.annotationScreenshot)positionMenu();else if(!menu.contains(event.target))hide();},true);
    window.addEventListener('resize',()=>{if(annotationBase&&pending?.annotationScreenshot)positionMenu();else hide();});
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
    return {entries,renderSent,renderDrafts,cancel,
      commentWordSelection(){
        const item=getWorkspace();
        if(item?.node?.preview?.kind!=='word'||!item.node.preview.referenceDemo)return;
        selectWord();
        if(pending?.kind!=='word'||pending.node!==item.node){
          options.feedback('先划选文档中的文字，再点击批注。');
          return;
        }
        commentButton.click();
      },
      referencePptPage(){
        const item=getWorkspace();
        if(item?.node?.preview?.kind==='ppt'&&item.node.preview.referenceDemo&&!item.pptPresent)pptWorkbench.action(item,'reference');
      },
      previewPpt(){
        const item=getWorkspace();
        if(item?.node?.preview?.kind==='ppt'&&item.node.preview.referenceDemo&&!item.pptPresent)pptWorkbench.action(item,'present');
      },
      restoreDraft(refs){
        const list=entries().slice();
        for(const ref of refs){
          if(!list.some(entry=>entry.id===ref.id))list.push(ref);
          registry.set(ref.id,ref);
        }
        drafts.set(getTask(),list);renderDrafts();
      },
      clear(){drafts.delete(getTask());renderDrafts();},taskChanged(){cancel();renderDrafts();}};
  }
  window.ArtifactEditingDemo={files,renderPpt,create};
})();
