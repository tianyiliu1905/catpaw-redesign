const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup() {
  const source = fs.readFileSync('app.js', 'utf8');
  const tags = {offsetWidth:0};
  let wrapped, indent;
  const input = {clientWidth:0, parentElement:{
    querySelector:() => tags,
    classList:{toggle:(_, value) => { wrapped = value; }},
    style:{setProperty:(_, value) => { indent = value; }},
  }};
  const context = {conversationPrompt:input};
  vm.runInNewContext(source.slice(source.indexOf('  function syncComposerTags(input)'), source.indexOf('  function renderSkillTags(input)')), context);
  return {input, tags, measure() { context.syncComposerTags(input); return {wrapped, indent}; }};
}

test('empty tags never reserve a row while hidden or in a narrow composer', () => {
  const h = setup();
  assert.deepEqual(h.measure(), {wrapped:false, indent:'0px'});
  h.input.clientWidth = 60;
  assert.deepEqual(h.measure(), {wrapped:false, indent:'0px'});
});

test('tag layout updates when a hidden composer becomes visible and changes width', () => {
  const h = setup();
  h.tags.offsetWidth = 160;
  assert.equal(h.measure().wrapped, false);
  h.input.clientWidth = 220;
  assert.deepEqual(h.measure(), {wrapped:true, indent:'0px'});
  h.input.clientWidth = 700;
  assert.deepEqual(h.measure(), {wrapped:false, indent:'164px'});
  h.tags.offsetWidth = 0;
  assert.deepEqual(h.measure(), {wrapped:false, indent:'0px'});
});
