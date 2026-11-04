const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup() {
  const source = fs.readFileSync('app.js', 'utf8');
  const code = source.slice(source.indexOf('  let conversationFollowLatest ='), source.indexOf("  const conversationSend = document.getElementById('conversationSend');"));
  const listeners = {}, frames = [], observed = [];
  let resize, top = 400;
  const scroll = {
    scrollHeight:1000, clientHeight:600,
    get scrollTop() { return top; },
    set scrollTop(value) { top = Math.max(0, Math.min(value, this.scrollHeight - this.clientHeight)); },
    addEventListener(type, handler) { listeners[type] = handler; },
  };
  vm.runInNewContext(code, {
    conversationScroll:scroll, conversationThread:{},
    conversationComposer:{closest:() => ({})},
    requestAnimationFrame:callback => { frames.push(callback); return frames.length; },
    ResizeObserver:class { constructor(callback) { resize = callback; } observe(node) { observed.push(node); } },
  });
  return { scroll, listeners, observed, resize:() => resize(), flush:() => { while(frames.length) frames.shift()(); } };
}

test('streaming growth and a taller composer keep the latest reply in view', () => {
  const s = setup();
  assert.equal(s.observed.length, 3);
  s.scroll.scrollHeight += 80;
  s.resize(); s.flush();
  assert.equal(s.scroll.scrollTop, 480);
  s.scroll.clientHeight -= 100;
  s.resize(); s.flush();
  assert.equal(s.scroll.scrollTop, 580);
});

test('scrolling back stops following; returning to the bottom resumes it', () => {
  const s = setup();
  s.listeners.wheel({deltaY:-20});
  s.scroll.scrollTop = 200;
  s.listeners.scroll();
  s.scroll.scrollHeight += 80;
  s.resize(); s.flush();
  assert.equal(s.scroll.scrollTop, 200);
  s.scroll.scrollTop = s.scroll.scrollHeight;
  s.listeners.scroll();
  s.scroll.scrollHeight += 80;
  s.resize(); s.flush();
  assert.equal(s.scroll.scrollTop, 560);
});

test('touch scrolling cancels an already scheduled follow', () => {
  const s = setup();
  s.scroll.scrollHeight += 80;
  s.resize();
  s.listeners.touchstart({touches:[{clientY:200}]});
  s.listeners.touchmove({touches:[{clientY:250}]});
  s.flush();
  assert.equal(s.scroll.scrollTop, 400);
});
