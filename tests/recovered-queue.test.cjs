const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function resultHarness(){
 const source=fs.readFileSync('app.js','utf8');
 const node={name:'门店履约异常明细.xlsx',preview:{sheets:[{rows:[['d','低','','100','2'],['d','高','','100','20']]},{rows:[['不变']]}]}};
 let callback;const status={textContent:''};const output={outerHTML:''};
 const panel={dataset:{stageFrame:'10'},querySelector:s=>s==='.stage-result'?output:status};
 const task={};const context={esc:String,disclosureMode:'work',conversationTask:task,activeConversationTask:task,
  conversationExamples:{get:()=>({folderId:'demo',files:[node.name]})},FOLDERS:[{id:'demo',files:[node]}],
  renderConversationArtifact:()=>'<span>产物</span>',structuredClone,
  conversationThread:{innerHTML:'',addEventListener:(name,fn)=>callback=fn},
  currentFileWorkspace:()=>null,conversationThreads:new Map()};
 vm.createContext(context);
 const start=source.indexOf('  const conversationStageFrames = [');
 vm.runInContext(source.slice(start,source.indexOf('  function renderConversationStage(entering',start))+';globalThis.render=renderConversationStageBody;',context);
 const a=source.indexOf("  conversationThread.addEventListener('click', event => {\n    const sort");
 const b=source.indexOf("  conversationThread.addEventListener('click', (event) => {\n    const toggle",a);
 vm.runInContext(source.slice(a,b),context);
 return {node,status,output,render:context.render,click(action){callback({target:{closest:s=>s===`[data-stage-${action}]`?{}:s==='.conversation-stage-demo'?panel:null}})}};
}
test('completion nests its finished plan in global details and exposes artifact changes',()=>{
 const h=resultHarness(),html=h.render(10);
 const details=html.indexOf('stage-thinking-details-inner'),plan=html.indexOf('class="stage-plan"'),history=html.indexOf('class="stage-completed"');
 assert.ok(details<plan&&plan<history);
 assert.equal((html.match(/class="stage-plan"/g)||[]).length,1);
 assert.ok(html.includes('本轮变化'));assert.ok(html.includes('版本 1'));
 assert.ok(html.indexOf('stage-result')>history);
});
test('sorting updates the actual artifact preview and undo restores the previous rows and other sheets',()=>{
 const h=resultHarness(),before=structuredClone(h.node.preview.sheets);
 h.click('sort');assert.equal(h.node.preview.sheets[0].rows[0][1],'高');
 assert.deepEqual(h.node.preview.sheets[1],before[1]);assert.ok(h.output.outerHTML.includes('撤回本轮修改'));assert.ok(h.output.outerHTML.includes('版本 2'));
 h.click('undo');assert.equal(JSON.stringify(h.node.preview.sheets),JSON.stringify(before));assert.ok(h.status.textContent.includes('恢复上一版'));assert.ok(h.output.outerHTML.includes('版本 1'));
 h.click('sort');h.click('undo');assert.equal(JSON.stringify(h.node.preview.sheets),JSON.stringify(before));
});
test('opening a selector focuses the dialog itself rather than its search box',()=>{
 const source=fs.readFileSync('app.js','utf8');const a=source.indexOf('  function openAddDialog(page)');const b=source.indexOf('  function returnFromAddDialog()',a);
 let focused=0;const context={addMenu:{},addSubmenu:{},renderAddDialog(){},addDialog:{showModal(){},focus(){focused++},querySelector(){throw Error('search must not be focused')}}};
 vm.createContext(context);vm.runInContext(source.slice(a,b)+';globalThis.open=openAddDialog;',context);
 for(const page of ['expert','skill','mcp'])context.open(page);assert.equal(focused,3);
});
