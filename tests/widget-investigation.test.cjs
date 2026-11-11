const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const choices = ['核对到店与出餐时间戳', '检查取消、退款及漏记记录', '按门店与时段比较差异'];
function setup() {
  const listeners = {}, timers = new Map(), roots = [];
  let timerId = 0;
  const buttons = ['widget', 'text'].map(value => ({dataset:{wvcFormat:value},setAttribute(){}}));
  const formatGroup = {};
  const controls = {setAttribute(){},querySelector:()=>formatGroup,querySelectorAll:()=>buttons,contains:node=>buttons.includes(node)};
  const document = {
    body:{appendChild(){}}, querySelectorAll:()=>roots,
    addEventListener:(type, handler)=>listeners[type]=handler,
    createElement:tag=>tag==='template' ? {content:{querySelector:()=>null}} : controls,
  };
  const context = {document,window:{},matchMedia:()=>({matches:true}),
    setTimeout:handler=>{timers.set(++timerId,handler);return timerId;},clearTimeout:id=>timers.delete(id)};
  vm.runInNewContext(fs.readFileSync('widget-value-cases.js','utf8'),context);
  function root(values) {
    const process = {querySelector:()=>null,querySelectorAll:()=>[],replaceChildren(){}};
    const answer = {innerHTML:''};
    const panels = ['widget','text'].map(value=>({dataset:{wvcFormatPanel:value}}));
    const node = {dataset:{wvcReply:'diagnose',wvcPhase:'0',wvcInvestigationItems:JSON.stringify(values)},isConnected:true,
      closest:()=>null,querySelector:selector=>selector==='[data-wvc-process]'?process:selector==='[data-wvc-answer]'?answer:null,
      querySelectorAll:()=>panels};
    roots.push(node);return {node,answer,panels};
  }
  function card(selected=[0,1], inConversation=true) {
    const inputs = choices.map((value,index)=>({value,checked:selected.includes(index),toggleAttribute(){}}));
    const plan = {hidden:true}, status = {};
    const card = {dataset:{},closest:selector=>selector==='#conversationThread'&&inConversation?{}:null,
      querySelectorAll:selector=>selector==='input:checked'?inputs.filter(input=>input.checked):inputs,
      querySelector:selector=>selector==='[data-wvc-investigation-plan]'?plan:status};
    const button = {closest:()=>card};
    return {card,inputs,plan,status,button,click:()=>listeners.click({target:{closest:selector=>selector==='[data-wvc-investigation-confirm]'?button:null}})};
  }
  return {api:context.window.CatPawWidgetCases,root,card,timers,buttons,formatGroup,
    flush(){while(timers.size){const [id,handler]=timers.entries().next().value;timers.delete(id);handler();}}};
}

test('confirmation sends only checked items to the conversation once and locks the source card',()=>{
  const s=setup(), source=s.card([0,2]);let calls=0,items;
  s.api.connectConversation({submitInvestigation:selected=>{calls++;items=selected;return true;}});
  source.click();source.click();
  assert.equal(calls,1);assert.deepEqual(Array.from(items),[choices[0],choices[2]]);
  assert(source.button.disabled);assert(source.inputs.every(input=>input.disabled));
  assert.equal(source.status.textContent,'已发送到对话');assert.equal(source.plan.hidden,true);
});

test('empty selection or an unavailable conversation does not falsely mark submission successful',()=>{
  const s=setup();let calls=0;
  s.api.connectConversation({submitInvestigation:()=>{calls++;return false;}});
  const empty=s.card([]);empty.click();assert.equal(calls,0);
  const source=s.card();source.click();assert.equal(calls,1);assert(!source.button.disabled);
  assert.notEqual(source.status.textContent,'已发送到对话');
});

test('the next reply progresses and generates the selected checklist without inventing investigation results',()=>{
  const s=setup(), reply=s.root([choices[1]]), phases=[],updates=[];
  s.api.connectConversation({replyChanged:root=>updates.push(root.dataset.wvcPhase)});
  s.api.playReply(reply.node,(_root,phase,description)=>{phases.push({phase,description});return '';});
  s.flush();
  assert.deepEqual(phases.map(item=>item.phase),[0,1,2,3]);
  assert.equal(phases[0].description.plainText,true);
  assert(reply.answer.innerHTML.includes('md conversation-reply'));
  assert(!reply.answer.innerHTML.includes('widget-card'));
  assert(!reply.answer.innerHTML.includes('data-wvc-format-panel'));
  assert(s.formatGroup.hidden);
  assert(reply.answer.innerHTML.includes(choices[1]));assert(!reply.answer.innerHTML.includes('<strong>'+choices[0]+'</strong>'));
  assert(reply.answer.innerHTML.includes('所需资料'));assert(reply.answer.innerHTML.includes('尚未提供订单明细'));
  assert.deepEqual(updates,['0','1','2','3']);
  assert.equal(s.api.renderInvestigationReply([choices[1],'<script>bad</script>']).includes('<script>'),false);
});

test('resuming a saved follow-up continues its phase and global controls target the latest reply',()=>{
  const s=setup();s.root([]);const reply=s.root([choices[2]]);
  reply.node.dataset.startedAt='1';reply.node.dataset.wvcPhase='1';
  s.api.syncControls();assert(s.buttons.every(button=>button.disabled));
  const phases=[];s.api.playReply(reply.node,(_root,phase)=>{phases.push(phase);return '';});s.flush();
  assert.deepEqual(phases,[2,3]);assert(s.formatGroup.hidden);
});

test('the app bridge appends a user turn and an assistant follow-up while preserving conversation navigation',()=>{
  const source=fs.readFileSync('app.js','utf8');let bridge,markup='',played=0,navigated=0,moved=0;
  const task={},card={},root={},saved=new Map();
  const thread={contains:node=>node===card||node===root,insertAdjacentHTML:(_where,html)=>markup+=html,
    querySelectorAll:()=>[root],get innerHTML(){return markup;}};
  const context={window:{CatPawWidgetCases:{connectConversation:value=>bridge=value,
    renderInvestigationReply:()=>'<section data-wvc-reply="diagnose"></section>',playReply:()=>played++}},
    widgetCases:new Map([[task,{id:'diagnose'}]]),activeConversationTask:task,conversationThread:thread,
    conversationThreads:saved,renderConversationTurnTime:()=>'',renderUserMessage:text=>'<user>'+text+'</user>',
    renderMessageMeta:()=>'',renderWidgetStage(){},stepMotion:{},moveConversationProgressToLatestTurn:()=>moved++,
    renderConversationTurnNav:()=>navigated++,requestAnimationFrame:fn=>fn(),conversationScroll:{scrollHeight:800}};
  const start=source.indexOf('  window.CatPawWidgetCases.connectConversation({');
  vm.runInNewContext(source.slice(start,source.indexOf('  function sendConversationMessage()',start)),context);
  assert.equal(bridge.submitInvestigation([choices[0]],card),true);
  assert(markup.includes('1. '+choices[0]));assert(markup.includes('assistant-message'));
  assert.equal(played,1);assert.equal(navigated,1);assert.equal(moved,1);assert.equal(saved.get(task),markup);
  assert.equal(bridge.submitInvestigation([choices[0]],{}),false);
});

test('plain follow-up progress contains no Widget tool calls',()=>{
  const source=fs.readFileSync('app.js','utf8');let rendered;
  const context={renderConversationStageBody:(...args)=>{rendered=args.at(-1);return '';}};
  const start=source.indexOf('  function renderWidgetStage(');
  vm.createContext(context);
  vm.runInContext(source.slice(start,source.indexOf('  function renderConversationStage(',start)),context);
  context.renderWidgetStage({dataset:{startedAt:String(Date.now())},querySelector:()=>null},2,
    {plainText:true,task:'整理核查事项',acknowledgement:'收到'});
  assert.equal(rendered.frames.length,4);
  assert(rendered.frames.every(frame=>!frame.call&&!frame.tool));
  assert.equal(rendered.planSteps.length,2);
});
