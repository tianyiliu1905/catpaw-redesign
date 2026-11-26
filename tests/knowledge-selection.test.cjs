const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('app.js', 'utf8');
const names = ['产品知识库', '项目知识库', '团队知识库'];

function setup() {
  const input = {knowledgeMode: 'off', knowledgeBases: []};
  const ctx = {installedAddItems: {knowledge: names}, renderKnowledgeTags() {}};
  vm.createContext(ctx);
  vm.runInContext(source.slice(source.indexOf('  function setKnowledgeSelection('), source.indexOf('  function renderKnowledgeTags(')), ctx);
  return {
    state: () => [input.knowledgeMode, [...input.knowledgeBases]],
    toggle: () => ctx.toggleEnterpriseKnowledge(input),
    specify: name => ctx.specifyKnowledge(input, name),
    remove: index => ctx.removeSpecifiedKnowledge(input, index),
    clear: () => ctx.clearKnowledgeSelection(input),
    restore: message => ctx.restoreKnowledgeSelection(input, message),
  };
}

test('方案 3：开启使用全部，第一次指定替换全部，后续累加且去重', () => {
  const draft = setup();
  assert.deepEqual(draft.state(), ['off', []]);
  draft.toggle();
  assert.deepEqual(draft.state(), ['all', names]);
  draft.specify(names[1]);
  assert.deepEqual(draft.state(), ['specified', [names[1]]]);
  draft.specify(names[0]);
  draft.specify(names[1]);
  assert.deepEqual(draft.state(), ['specified', names.slice(0, 2)]);
  draft.specify(names[2]);
  assert.deepEqual(draft.state(), ['specified', names], '逐个指定全部仍保留独立标签');
});

test('删完指定项恢复全部，关闭开关清空，再次开启使用全部', () => {
  const draft = setup();
  draft.toggle();
  draft.specify(names[0]);
  draft.specify(names[1]);
  draft.remove(0);
  assert.deepEqual(draft.state(), ['specified', [names[1]]]);
  draft.remove(0);
  assert.deepEqual(draft.state(), ['all', names]);
  draft.specify(names[2]);
  draft.toggle();
  assert.deepEqual(draft.state(), ['off', []]);
  draft.toggle();
  assert.deepEqual(draft.state(), ['all', names]);
  draft.clear();
  assert.deepEqual(draft.state(), ['off', []]);
});

test('编辑待发送消息保留使用全部与逐项指定的区别', () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('conversation-queue-demo.js', 'utf8'), context);
  const queue = context.CatPawQueueDemo.createModel();
  const draft = setup();
  for (const mode of ['all', 'specified']) {
    queue.enqueue({text: '整理资料', knowledge: names, knowledgeMode: mode});
    draft.restore(queue.take(queue.state.prompts[0].id));
    assert.deepEqual(draft.state(), [mode, names]);
    draft.clear();
  }
});
