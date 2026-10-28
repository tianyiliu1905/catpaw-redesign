const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup(){
 const context={window:{}};vm.createContext(context);vm.runInContext(fs.readFileSync('ppt-workbar.js','utf8'),context);
 const api=context.window.PptWorkbench,item={node:{preview:{kind:'ppt',referenceDemo:true}},referenceSlide:0};
 const seeds=[{title:'第一页',subtitle:'概览',lines:['初始内容']},{title:'第二页',subtitle:'数据',lines:['华东 480']}];
 api.model(item,seeds);return {api,item,seeds};
}
test('mode changes reuse the same deck and preserve slide and selection',()=>{
 const {api,item,seeds}=setup();item.referenceSlide=1;item.pptSelection=api.current(item).elements[0].id;
 const deck=api.model(item),id=item.pptSelection;
 item.pptMode='edit';assert.match(api.render(item,seeds),/data-ppt-tab="insert"/);
 item.pptMode='ai';assert.doesNotMatch(api.render(item,seeds),/补充资料/);
 assert.equal(api.model(item),deck);assert.equal(item.referenceSlide,1);assert.equal(item.pptSelection,id);
});
test('text edit updates main SVG and thumbnail source; undo/redo restore values',()=>{
 const {api,item}=setup(),element=api.current(item).elements[0];
 const original=api.image(item,0);
 api.commit(item,()=>element.text='改为管理层汇报');
 assert.match(api.svg(item),/改为管理层汇报/);assert.notEqual(api.image(item,0),original);
 api.undo(item);assert.equal(api.image(item,0),original);
 api.undo(item,true);assert.match(api.text(item),/改为管理层汇报/);
 api.undo(item);api.commit(item,()=>api.current(item).notes='新的修改');assert.equal(item.node.preview.history.future.length,0);
});
test('duplicate gets unique page/element ids and reorder preserves identity',()=>{
 const {api,item}=setup(),original=api.current(item);api.pageAction(item,'duplicate');
 const duplicate=api.current(item);assert.notEqual(duplicate.id,original.id);assert.notEqual(duplicate.elements[0].id,original.elements[0].id);
 api.pageAction(item,'move',0);assert.equal(api.current(item).id,duplicate.id);
 api.undo(item);assert.equal(api.model(item)[1].id,duplicate.id);
});
test('cannot delete last page and delete is undoable',()=>{
 const {api,item}=setup();const before=api.model(item)[0].id;api.pageAction(item,'delete');assert.equal(api.model(item).length,1);
 api.pageAction(item,'delete');assert.equal(api.model(item).length,1);
 api.undo(item);assert.equal(api.model(item).length,2);assert.equal(api.model(item)[0].id,before);
});
test('all inserted element types render safely in the same SVG snapshot',()=>{
 const {api,item}=setup();api.commit(item,()=>api.current(item).elements.push(
 {id:'text',type:'text',x:10,y:10,w:300,h:60,text:'<script>安全</script>',size:20,color:'#000000'},
 {id:'table',type:'table',x:10,y:100,w:200,h:120,rows:[['区域','营收'],['华东','480']]},
 {id:'chart',type:'chart',x:250,y:100,w:300,h:240,rows:[['华东',480],['华南',420]]},
 {id:'image',type:'image',x:600,y:100,w:200,h:100,src:'data:image/png;base64,a',fit:'cover'}));
 const svg=api.svg(item);assert(!svg.includes('<script>'));assert.match(svg,/&lt;script&gt;/);assert.match(svg,/<image /);assert.match(svg,/xMidYMid slice/);assert.match(svg,/华东/);
});
test('selected text exposes reference and formatting tools; formatting changes the slide image',()=>{
 const {api,item}=setup();item.pptSelection=api.current(item).elements[0].id;
 const toolbar=api.render(item,[]);
 assert.match(toolbar,/class="ppt-selection-tools ppt-selection-tools-text"/);
 assert.match(toolbar,/data-ppt-action="reference-element"/);
 assert.match(toolbar,/ppt-text-toolbar\/underline\.svg/);
 assert.doesNotMatch(toolbar,/data-ppt-action="(?:format-brush|line-spacing)"/);
 api.commit(item,()=>Object.assign(api.selected(item),{underline:true,strike:true,highlight:'#ffee88',fontFamily:'Georgia',list:'bullet'}));
 const slide=api.svg(item);
 assert.match(slide,/text-decoration="underline line-through"/);
 assert.match(slide,/fill="#ffee88"/);
 assert.match(slide,/font-family="Georgia"/);
 assert.match(slide,/• /);
});
