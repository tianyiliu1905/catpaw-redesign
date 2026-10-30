const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// DOM doubles exercise selection and draft lifecycle without a browser session.
class Element {
  constructor(dataset = {}) {this.dataset=dataset;this.listeners={};this.style={};this.hidden=false;this.innerHTML='';this.textContent='';this.value='';this.attributes={};this.classes=new Set();this.classList={add:x=>this.classes.add(x),remove:x=>this.classes.delete(x),toggle:(x,on)=>on?this.classes.add(x):this.classes.delete(x)};}
  addEventListener(type,fn){(this.listeners[type] ||= []).push(fn);}
  async fire(type,event={}){for(const fn of this.listeners[type]||[])await fn(event);}
  setAttribute(name,value){this.attributes[name]=value;}
  focus(){this.focused=true;}
  getBoundingClientRect(){return {left:100,top:100,bottom:132,width:120,height:32};}
  closest(selector){return selector.includes('data-excel-row')&&this.dataset.excelRow!==undefined?this:null;}
  querySelector(){return null;}
  querySelectorAll(){return [];}
  contains(target){return target===this;}
  scrollIntoView(){}
}
function setup({pptHeader=false}={}) {
  const root=new Element(),doc=new Element(),label=new Element(),button=new Element();
  const pptCrop=new Element(),pptReference=new Element(),pptActions=[];
  const commentButton=new Element(),commentInput=new Element(),commentEditor=new Element(),commentCancel=new Element();
  const containers={conversationReferences:new Element(),fullscreenReferences:new Element()};
  const menu=new Element();menu.offsetWidth=260;menu.offsetHeight=44;
  menu.querySelector=selector=>({'button':button,'[data-selection-add]':button,'[data-selection-comment]':commentButton,'textarea':commentInput,'.artifact-comment-editor':commentEditor,'[data-comment-cancel]':commentCancel,'.artifact-selection-label':label}[selector]||null);
  menu.contains=el=>[menu,button,commentButton,commentInput,commentEditor,commentCancel].includes(el);
  doc.createElement=()=>menu;doc.body={append(){}};doc.getElementById=id=>containers[id];
  let activeTask='review';let workspace;let focused=0;let located;
  const window=new Element();window.getSelection=()=>null;
  const context={window,document:doc,innerWidth:1200,innerHeight:800,requestAnimationFrame:cb=>cb()};
  vm.createContext(context);vm.runInContext(fs.readFileSync('ppt-workbar.js','utf8'),context);window.PptWorkbench.install=()=>({action:(item,name)=>pptActions.push({item,name})});vm.runInContext(fs.readFileSync('artifact-editing-demo.js','utf8'),context);
  const api=window.ArtifactEditingDemo;
  const nodes=api.files();workspace={node:nodes[1],chain:[{id:'default'},nodes[1]],officeSheet:0};
  const cells=[];
  for(let r=0;r<3;r++)for(let c=0;c<4;c++)cells.push(new Element({excelRow:String(r),excelColumn:String(c)}));
  const address=new Element(),value=new Element();
  root.contains=el=>cells.includes(el);
  root.querySelectorAll=selector=>selector.includes('td[data-excel-row]')?cells:[];
  root.querySelector=selector=>selector.includes('data-excel-address')?address:selector.includes('data-excel-value')?value:null;
  const controller=api.create({root,pptCropButton:pptHeader?pptCrop:undefined,pptReferenceButton:pptHeader?pptReference:undefined,getWorkspace:()=>workspace,getTask:()=>activeTask,taskForArtifact:()=> 'review',ensureTask:task=>{activeTask=task;},focusComposer:()=>focused++,renderWorkspace(){},openReference:ref=>{located=ref;},feedback(){}});
  const select=async(start,end=start)=>{
    await root.fire('pointerdown',{button:0,target:start,preventDefault(){}});
    doc.elementFromPoint=()=>end;
    await doc.fire('pointermove',{clientX:120,clientY:120});
    await doc.fire('pointerup',{target:end});
  };
  return {api,controller,cells,select,button,commentButton,commentInput,commentEditor,commentCancel,menu,root,doc,window,containers,address,value,pptCrop,pptReference,pptActions,setWorkspace:item=>workspace=item,get focused(){return focused;},setTask:task=>activeTask=task,get located(){return located;}};
}
test('three linked artifacts, five distinct PPT pages and local inline thumbnails',()=>{
  const {api}=setup();const files=api.files();
  assert.deepEqual(Array.from(files,n=>n.preview.kind),['ppt','excel','word']);
  const first=api.renderPpt(files[0].preview,{node:files[0],referenceSlide:0});
  const third=api.renderPpt(files[0].preview,{node:files[0],referenceSlide:2});
  assert.equal((first.match(/data-reference-slide=/g)||[]).length,5);
  assert.match(third,/data-reference-slide="2" aria-label="第 3 页：[^"]+" aria-current="page"/);
  assert.doesNotMatch(third,/第 3 \/ 5 页/);assert.notEqual(first,third);
  assert.match(third,/data:image\/svg\+xml/);
});
test('PPT preview is available through the file menu action',()=>{
  const s=setup(),node=s.api.files()[0];
  s.controller.previewPpt();
  assert.equal(s.pptActions.length,0);
  const item={node,chain:[{id:'default'},node],referenceSlide:0};
  s.setWorkspace(item);
  s.controller.previewPpt();
  assert.equal(s.pptActions.length,1);
  assert.equal(s.pptActions[0].name,'present');
  assert.equal(s.pptActions[0].item,item);
  item.pptPresent=true;
  s.controller.previewPpt();
  assert.equal(s.pptActions.length,1);
});
test('Excel rectangle includes header, original range and exact selected values',async()=>{
  const s=setup();await s.select(s.cells[1],s.cells[10]);
  assert.equal(s.controller.entries().length,0,'selection does not automatically attach');
  assert.equal(s.menu.hidden,false);
  await s.button.fire('click');
  const ref=s.controller.entries()[0];
  assert.equal(ref.label,'区域经营 · B2:C4');
  assert.deepEqual(JSON.parse(JSON.stringify(ref.rows)),[['410','480'],['350','420'],['287','340']]);
  assert.equal(ref.columns.length,2);assert.equal(s.focused,1);
  assert.match(s.containers.conversationReferences.innerHTML,/B2:C4/);
  assert.equal(s.containers.conversationReferences.innerHTML,s.containers.fullscreenReferences.innerHTML);
});
test('reverse drag yields the same range and repeated selection is deduplicated',async()=>{
  const s=setup();await s.select(s.cells[10],s.cells[1]);await s.button.fire('click');
  await s.select(s.cells[1],s.cells[10]);await s.button.fire('click');
  assert.equal(s.controller.entries().length,1);assert.equal(s.controller.entries()[0].label,'区域经营 · B2:C4');
});
test('drafts stay with their conversation and selection snapshots survive clearing',async()=>{
  const s=setup();await s.select(s.cells[0]);await s.button.fire('click');
  const sent=s.controller.entries().slice();
  s.setTask('another');s.controller.taskChanged();assert.equal(s.controller.entries().length,0);assert(s.containers.conversationReferences.hidden);
  s.setTask('review');s.controller.taskChanged();assert.equal(s.controller.entries().length,1);
  s.controller.clear();assert.equal(s.controller.entries().length,0);
  assert.match(s.controller.renderSent(sent),/华东/);
  const target={closest:selector=>selector==='[data-artifact-reference]'?{dataset:{artifactReference:sent[0].id}}:null};
  await s.doc.fire('click',{target});assert.equal(s.located.id,sent[0].id);
});
test('Escape dismisses selection without adding a draft',async()=>{
  const s=setup();await s.select(s.cells[0]);await s.doc.fire('keydown',{key:'Escape'});
  assert(s.menu.hidden);await s.button.fire('click');assert.equal(s.controller.entries().length,0);
});
test('Word selection carries exact text and offsets, and escapes quoted content',async()=>{
  const s=setup(),node=s.api.files()[2];
  s.setWorkspace({node,chain:[{id:'default'},node]});
  const parent=new Element();parent.closest=()=>({querySelector:()=>({textContent:'二、原因分析'})});
  const textNode={nodeType:3,parentElement:parent};
  const text='原因尚未确认 <待核对>';
  const range={startContainer:textNode,endContainer:textNode,startOffset:0,toString:()=>text,getBoundingClientRect:()=>parent.getBoundingClientRect(),cloneRange:()=>({selectNodeContents(){},setEnd(){},toString:()=> '前面的内容。'})};
  s.root.contains=()=>true;s.root.querySelector=()=>({contains:()=>true});
  s.window.getSelection=()=>({rangeCount:1,isCollapsed:false,getRangeAt:()=>range,toString:()=>text});
  await s.doc.fire('pointerup',{target:parent});await s.button.fire('click');
  const ref=s.controller.entries()[0];
  assert.equal(ref.kind,'word');assert.equal(ref.text,text);assert.equal(ref.start,6);assert.equal(ref.end,6+text.length);
  assert.match(s.containers.conversationReferences.innerHTML,/&lt;待核对&gt;/);
});
test('PPT crop uses normalized slide coordinates and stores the actual image snapshot',async()=>{
  const s=setup(),node=s.api.files()[0],crop=new Element(),slide=new Element(),box=new Element();
  const item={node,chain:[{id:'default'},node],referenceSlide:2};s.setWorkspace(item);
  const img={decode:async()=>{}};let drawing;
  const canvas={getContext:()=>({drawImage:(...args)=>drawing=args}),toDataURL:()=> 'data:image/png;base64,cropped'};
  s.doc.createElement=()=>canvas;
  s.root.querySelector=selector=>selector==='.reference-slide img'?img:selector==='.reference-crop-box'?box:selector==='[data-reference-crop]'?crop:slide;
  const cropTarget={closest:selector=>selector==='[data-reference-crop]'?crop:null};
  await s.root.fire('click',{target:cropTarget});
  const slideTarget={closest:selector=>selector==='.reference-slide'?slide:null};
  await s.root.fire('pointerdown',{button:0,target:slideTarget,clientX:110,clientY:104,preventDefault(){}});
  await s.doc.fire('pointermove',{clientX:170,clientY:124});
  await s.doc.fire('pointerup',{target:slideTarget});
  await s.commentButton.fire('click');s.commentInput.value='标题缩短一些，保留季度与部门';
  await s.button.fire('click');
  const ref=s.controller.entries()[0];
  assert.equal(ref.slide,2);assert.equal(ref.image,'data:image/png;base64,cropped');assert.match(ref.label,/框选区域/);
  assert.equal(ref.comment,'标题缩短一些，保留季度与部门');
  assert.match(s.controller.renderSent([ref]),/标题缩短一些，保留季度与部门/);
  assert.equal(canvas.width,480);assert.equal(canvas.height,338);
  assert.equal(drawing[0],img);assert.equal(drawing[1],80);assert.equal(drawing[2],67.5);
});

test('PPT header crop and reference controls retain their original actions',async()=>{
  const s=setup({pptHeader:true}),node=s.api.files()[0],item={node,chain:[{id:'default'},node],referenceSlide:0};
  s.setWorkspace(item);
  await s.pptCrop.fire('click');
  assert.equal(s.pptCrop.attributes['aria-pressed'],'true');
  assert.equal(s.pptCrop.textContent,'取消框选');
  assert(s.root.classes.has('reference-cropping'));
  await s.pptCrop.fire('click');
  assert.equal(s.pptCrop.attributes['aria-pressed'],'false');
  assert(!s.root.classes.has('reference-cropping'));
  await s.pptReference.fire('click');
  assert.equal(s.pptActions.length,1);
  assert.equal(s.pptActions[0].item,item);
  assert.equal(s.pptActions[0].name,'reference');
});
test('crop label changes without replacing its icon',async()=>{
  const s=setup({pptHeader:true}),node=s.api.files()[0];
  s.setWorkspace({node,chain:[{id:'default'},node],referenceSlide:0});
  const label=new Element();
  s.pptCrop.querySelector=selector=>selector==='.file-ppt-action-label'?label:null;
  s.pptCrop.innerHTML='<svg class="ic"></svg><span class="file-ppt-action-label"></span>';
  await s.pptCrop.fire('click');
  assert.equal(label.textContent,'取消框选');
  assert.match(s.pptCrop.innerHTML,/<svg/);
  s.controller.cancel();
  assert.equal(label.textContent,'框选区域');
  assert.match(s.pptCrop.innerHTML,/<svg/);
});

test('annotation editor keeps selection until explicitly added and safely preserves multiline comments',async()=>{
  const s=setup();await s.select(s.cells[0],s.cells[5]);
  await s.commentButton.fire('click');
  assert.equal(s.commentEditor.hidden,false);assert.equal(s.commentInput.focused,true);
  assert.equal(s.controller.entries().length,0);
  s.commentInput.value='  保留原始数据\n突出 <华东>，不要推断原因  ';
  await s.commentInput.fire('keydown',{key:'Enter',ctrlKey:true,preventDefault(){},stopPropagation(){}});
  const ref=s.controller.entries()[0];
  assert.equal(ref.comment,'保留原始数据\n突出 <华东>，不要推断原因');
  assert.equal(ref.label,'区域经营 · A2:B3');
  assert.match(s.containers.conversationReferences.innerHTML,/突出 &lt;华东&gt;/);
  assert.equal(s.containers.conversationReferences.innerHTML,s.containers.fullscreenReferences.innerHTML);
  const sent=s.controller.entries().slice();s.controller.clear();
  assert.match(s.controller.renderSent(sent),/保留原始数据/);
});

test('different annotations on the same selection remain separate while duplicate notes are deduplicated',async()=>{
  const s=setup();
  for(const comment of ['补充统计口径','保留数据，调整格式','补充统计口径']){
    await s.select(s.cells[0]);await s.commentButton.fire('click');s.commentInput.value=comment;await s.button.fire('click');
  }
  assert.equal(s.controller.entries().length,2);
  assert.deepEqual(Array.from(s.controller.entries(),ref=>ref.comment),['补充统计口径','保留数据，调整格式']);
});

test('canceling an annotation keeps the reference available and does not leak text into the next selection',async()=>{
  const s=setup();await s.select(s.cells[0]);await s.commentButton.fire('click');s.commentInput.value='取消的意见';
  await s.commentInput.fire('keydown',{key:'Escape',preventDefault(){},stopPropagation(){}});
  assert.equal(s.menu.hidden,false);assert.equal(s.commentEditor.hidden,true);assert.equal(s.commentInput.value,'');
  await s.button.fire('click');assert.equal(s.controller.entries()[0].comment,'');
  await s.select(s.cells[1]);assert.equal(s.commentInput.value,'');
});

test('fullscreen conversation can send an annotated selection without requiring duplicate input text',async()=>{
  const s=setup();await s.select(s.cells[0]);await s.commentButton.fire('click');s.commentInput.value='补充华东区域的跟进建议';await s.button.fire('click');
  let message;
  const input={value:'',dispatchEvent(){},focus(){}};
  const context={fullscreenChatInput:input,currentFileWorkspace:()=>({node:{name:'季度经营数据.xlsx'},chain:[]}),artifactSelection:s.controller,
    taskForArtifact:()=> 'review',activeConversationTask:'review',conversationPage:{hidden:false},toolFilePreviewBody:{scrollTop:0},
    beginConversationTurn:received=>{message=received;},Event:class Event{}};
  const source=fs.readFileSync('app.js','utf8');
  const code=source.slice(source.indexOf('  function sendFullscreenFileRequest()'),source.indexOf('  function modifyArtifact('));
  vm.runInNewContext(code+';sendFullscreenFileRequest();',context);
  assert.equal(message.text,'');assert.equal(message.references[0].comment,'补充华东区域的跟进建议');
  assert.equal(message.attachments.length,0);assert.equal(s.controller.entries().length,0);
});
