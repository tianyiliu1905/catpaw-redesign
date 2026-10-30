const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const api = require('../supplier-conversation-demo.js');

test('procurement constraints reject missing, fractional quantities and non-finite amounts', () => {
  assert.equal(api.validateConditions({ quantity:'400', budget:'50000', deadline:'14' }).valid, true);
  for (const [key, invalid] of [['quantity',''], ['quantity','1.2'], ['quantity','10001'], ['budget','0'], ['budget','Infinity'], ['deadline','-2'], ['deadline','121']]) {
    const checked = api.validateConditions({ ...api.defaults, [key]:invalid });
    assert.equal(checked.valid, false, `${key}: ${invalid}`);
    assert.ok(checked.errors[key]);
  }
});

test('changing purchase constraints recalculates which suppliers qualify', () => {
  const initial = api.evaluateSuppliers(api.defaults);
  assert.deepEqual(initial.filter(item => item.eligible).map(item => item.id), ['a']);
  assert.equal(initial.find(item => item.id === 'c').overBudget, 400);
  assert.equal(initial.find(item => item.id === 'b').late, 4);
  const express = api.evaluateSuppliers({ quantity:400, budget:52000, deadline:10 });
  assert.deepEqual(express.filter(item => item.eligible).map(item => item.id), ['c']);
  const small = api.evaluateSuppliers({ quantity:100, budget:50000, deadline:20 });
  assert.equal(small.every(item => item.eligible), true);
  const none = api.makeSession('none', { quantity:1000, budget:10000, deadline:2 });
  assert.match(api.conclusion(none), /没有同时满足/);
});

test('session conditions are snapshots, not references to a later edited form', () => {
  const values = { ...api.defaults };
  const session = api.makeSession('one', values);
  values.budget = 1;
  assert.equal(session.conditions.budget, 50000);
  assert.throws(() => api.makeSession('bad', { ...api.defaults, quantity:0 }));
});

test('selection, follow-ups and visual format change the generated report', () => {
  const session = api.makeSession('one', api.defaults);
  assert.throws(() => api.generateReport(session), /先选择/);
  api.updateSession(session, { type:'supplier', value:'c' });
  api.updateSession(session, { type:'follow-up', value:'delivery', checked:true });
  api.updateSession(session, { type:'follow-up', value:'delivery', checked:true });
  api.updateSession(session, { type:'format', value:'schedule' });
  const report = api.generateReport(session);
  assert.match(report.text, /立衡工厂/);
  assert.match(report.text, /50,400 元/);
  assert.match(report.text, /超出预算 400 元/);
  assert.match(report.text, /跟进事项：书面确认交期/);
  assert.equal(session.followUps.length, 1);
  assert.match(report.html, /quote-timeline/);
  assert.match(report.prompt, /交付排期/);
  api.updateSession(session, { type:'follow-up', value:'delivery', checked:false });
  api.updateSession(session, { type:'format', value:'compare' });
  assert.doesNotMatch(api.generateReport(session).text, /跟进事项/);
  assert.match(api.generateReport(session).html, /quote-comparison/);
  api.updateSession(session, { type:'format', value:'brief' });
  assert.match(api.generateReport(session).html, /quote-report-metrics/);
});

test('late supplier timeline puts the required deadline before its later arrival', () => {
  const session = api.makeSession('late', api.defaults);
  api.updateSession(session, { type:'supplier', value:'b' });
  api.updateSession(session, { type:'format', value:'schedule' });
  const report = api.generateReport(session);
  assert.ok(report.html.indexOf('<span>第 14 天</span>') < report.html.indexOf('<span>第 18 天</span>'));
  assert.match(report.text, /晚于要求 4 天/);
});

test('chart switches use different data without changing report content or losing selections', () => {
  const session = api.makeSession('one', api.defaults);
  api.updateSession(session, { type:'supplier', value:'a' });
  const revision = session.revision;
  const originalReport = api.generateReport(session).text;
  api.updateSession(session, { type:'metric', value:'delivery' });
  assert.match(api.renderResults(session), /交货周期对比/);
  api.updateSession(session, { type:'metric', value:'trend' });
  assert.match(api.renderResults(session), /从90%到96%/);
  assert.match(api.renderResults(session), /value="a" data-quote-choice="supplier" checked/);
  assert.equal(session.revision, revision);
  assert.equal(api.generateReport(session).text, originalReport);
});

test('notes are retained as plain text and escaped in rendered UI', () => {
  const session = api.makeSession('one', api.defaults);
  api.updateSession(session, { type:'supplier', value:'a' });
  const note = '<img src=x onerror="alert(1)"> & 需要验收';
  api.updateSession(session, { type:'note', value:note });
  const report = api.generateReport(session);
  assert.ok(report.text.includes(note));
  for (const html of [report.html, api.renderResults(session), api.renderConditions('safe', { ...api.defaults, quantity:note })]) {
    assert.doesNotMatch(html, /<img/);
    assert.match(html, /&lt;img/);
  }
  const before = JSON.stringify(session);
  for (const action of [{ type:'supplier', value:'unknown' }, { type:'format', value:'<script>' }, { type:'metric', value:'unknown' }, { type:'follow-up', value:'unknown', checked:true }]) {
    assert.equal(api.updateSession(session, action), false);
  }
  assert.equal(JSON.stringify(session), before);
});

function controllerHarness() {
  const source = fs.readFileSync(path.join(__dirname, '../supplier-conversation-demo.js'), 'utf8');
  const context = { module:{ exports:{} }, FormData:class { constructor(form) { return Object.entries(form.values); } } };
  vm.runInNewContext(source, context);
  const events = {};
  const turns = [];
  let active = true;
  let persisted = 0;
  const area = { dataset:{ quoteConditions:'quote-conditions-1' }, outerHTML:'' };
  const result = { dataset:{ quoteSession:'quote-result-2' }, outerHTML:'', querySelector:() => null };
  const container = { addEventListener:(name,fn) => { events[name] = fn; }, querySelector:selector => selector === '[data-quote-session="quote-result-2"]' ? result : null };
  const controller = context.module.exports.createController({ container, isActive:() => active, appendTurn:(prompt,html) => turns.push({ prompt,html }), persist:() => persisted++ });
  controller.initial();
  const submit = (kind, values) => {
    const form = { dataset:{ quoteForm:kind }, values, closest:selector => selector === '[data-quote-form]' ? form : kind === 'conditions' ? area : result, querySelector:() => ({ textContent:'', classList:{ add() {} }, focus() {} }) };
    events.submit({ target:form, preventDefault() {} });
  };
  const choose = (type,value,checked = true) => {
    const input = { dataset:{ quoteChoice:type }, value, checked, closest:selector => selector === '[data-quote-choice]' ? input : result };
    events.change({ target:input });
  };
  const click = async dataset => {
    const button = { dataset, closest:() => button };
    await events.click({ target:button });
  };
  return { events, turns, area, result, submit, choose, click, controller, get persisted() { return persisted; }, setActive(value) { active = value; } };
}

test('controller completes confirmation → selection → report and ignores another active conversation', () => {
  const flow = controllerHarness();
  flow.controller.replyToText('需要先看样品');
  flow.submit('conditions', { ...api.defaults });
  assert.match(flow.area.outerHTML, /已按 400 件/);
  assert.match(flow.turns[0].html, /需要先看样品/);
  flow.choose('supplier','a');
  flow.choose('follow-up','sample');
  flow.choose('format','compare');
  assert.match(flow.result.outerHTML, /value="a" data-quote-choice="supplier" checked/);
  assert.match(flow.result.outerHTML, /value="sample" data-quote-choice="follow-up" checked/);
  flow.submit('result');
  assert.equal(flow.turns.length, 2);
  assert.match(flow.turns[1].prompt, /恒川制造.*数据对照.*确认样品/);
  assert.match(flow.turns[1].html, /quote-report/);
  const oldReport = flow.turns[1].html;
  flow.choose('supplier','b');
  flow.submit('result');
  assert.equal(flow.turns.length, 3);
  assert.match(flow.turns[2].html, /晚于要求 4 天/);
  assert.equal(flow.turns[1].html, oldReport, 'previous reply remains a snapshot');
  flow.setActive(false);
  const saved = flow.persisted;
  flow.choose('supplier','c');
  flow.submit('conditions', { ...api.defaults, budget:52000 });
  assert.equal(flow.persisted, saved);
  assert.equal(flow.turns.length, 3);
});

test('controller validates form data and prevents report creation without a selection', () => {
  const flow = controllerHarness();
  flow.submit('conditions', { ...api.defaults, quantity:'' });
  assert.match(flow.area.outerHTML, /aria-invalid="true"/);
  assert.equal(flow.turns.length, 0);
  flow.submit('conditions', { ...api.defaults });
  flow.submit('result');
  assert.equal(flow.turns.length, 1);
});

test('adjusting conditions creates a recalculated reply and keeps previous comparison intact', async () => {
  const flow = controllerHarness();
  flow.submit('conditions', { ...api.defaults });
  const original = flow.turns[0].html;
  await flow.click({ quoteAdjust:'quote-result-2' });
  assert.match(flow.turns[1].html, /quote-conditions-3/);
  flow.area.dataset.quoteConditions = 'quote-conditions-3';
  flow.submit('conditions', { quantity:400, budget:52000, deadline:10 });
  assert.match(flow.turns[2].html, /立衡工厂是其中总价最低/);
  assert.equal(flow.turns[0].html, original);
});

test('free text can update a report while switching charts cannot duplicate it', async () => {
  const flow = controllerHarness();
  flow.submit('conditions', { ...api.defaults });
  flow.choose('supplier','a');
  flow.submit('result');
  flow.choose('metric','trend');
  flow.submit('result');
  assert.equal(flow.turns.length, 2);
  const receipt = flow.controller.replyToText('请附上样品的验收标准');
  assert.match(receipt, /data-quote-generate="quote-result-2"/);
  await flow.click({ quoteGenerate:'quote-result-2' });
  assert.equal(flow.turns.length, 3);
  assert.match(flow.turns[2].html, /请附上样品的验收标准/);
  assert.doesNotMatch(flow.turns[1].html, /请附上样品的验收标准/);
});

test('replaying a presentation clears prior supplier choices and notes without registering duplicate handlers', () => {
  const flow=controllerHarness();
  flow.submit('conditions',{...api.defaults});
  flow.choose('supplier','a');
  flow.controller.replyToText('上一轮的备注');
  flow.submit('result');
  flow.controller.reset();
  const initial=flow.controller.initial();
  assert.match(initial,/quote-conditions-1/);
  flow.submit('conditions',{...api.defaults});
  const latest=flow.turns.at(-1).html;
  assert.doesNotMatch(latest,/上一轮的备注/);
  assert.doesNotMatch(latest,/value="a" data-quote-choice="supplier" checked/);
  const count=flow.turns.length;
  flow.submit('result');
  assert.equal(flow.turns.length,count,'a replay must require a fresh choice');
});
