const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup() {
  const source = fs.readFileSync('app.js', 'utf8');
  const start = source.indexOf('  function handleComposerTagDelete(event)');
  const end = source.indexOf('  [prompt, conversationPrompt].forEach(input => input.addEventListener', start);
  const context = {}; vm.createContext(context); vm.runInContext(source.slice(start, end), context);
  const removed = [], buttons = [];
  for (const name of ['prompt', 'knowledge', 'skill', 'connector']) {
    buttons.push({getClientRects:() => [1], click() { removed.push(name); buttons.splice(buttons.indexOf(this), 1); }});
  }
  const input = { value:'', selectionStart:0, selectionEnd:0, focus(){}, parentElement:{querySelector:() => ({querySelectorAll:() => buttons})} };
  function key(key, options = {}) { const event = {key,currentTarget:input,preventDefault(){this.prevented=true},...options}; context.handleComposerTagDelete(event); return event; }
  return {input, buttons, removed, key};
}
test('backspace removes visible tags from the right and delete works in an empty composer', () => {
  const h = setup();
  for (let i=0;i<3;i++) assert.equal(h.key('Backspace').prevented,true);
  assert.equal(h.key('Delete').prevented,true);
  assert.deepEqual(h.removed,['connector','skill','knowledge','prompt']);
  assert.equal(h.key('Backspace').prevented,undefined);
});
test('text, selections, composition and word deletion keep native editing behavior', () => {
  const h = setup();
  h.input.value='文字'; h.input.selectionStart=h.input.selectionEnd=1;
  h.key('Backspace'); h.input.selectionStart=0;h.input.selectionEnd=1;h.key('Backspace');
  h.input.selectionEnd=0; h.key('Delete');h.key('Backspace',{isComposing:true});h.key('Backspace',{keyCode:229});
  for(const modifier of ['ctrlKey','altKey','metaKey'])h.key('Backspace',{[modifier]:true});
  assert.deepEqual(h.removed,[]);
  assert.equal(h.key('Backspace').prevented,true);
  assert.equal(h.input.value,'文字');
});
test('hidden and disabled tag controls are skipped', () => {
  const h = setup();
  h.buttons.at(-1).getClientRects=()=>[];h.buttons.at(-2).disabled=true;
  h.key('Backspace');assert.deepEqual(h.removed,['knowledge']);
});
