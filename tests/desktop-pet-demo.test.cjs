const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

class Element {
  constructor(dataset={}){
    this.dataset=dataset;this.attributes={};this.hidden=false;this.textContent='';this.innerHTML='';this.listeners={};this.children={};this.classes=new Set();
    this.classList={add:value=>this.classes.add(value),remove:value=>this.classes.delete(value),toggle:(value,on)=>on?this.classes.add(value):this.classes.delete(value)};
  }
  addEventListener(type,callback){this.listeners[type]=callback;}
  setAttribute(name,value){this.attributes[name]=value;}
  getAttribute(name){return this.attributes[name];}
  querySelector(selector){return this.children[selector]||(this.children[selector]=new Element());}
  click(){this.listeners.click?.({target:this});}
  focus(){this.focused=true;}
}
function setup(){
  const html=fs.readFileSync('desktop-pet-demo.html','utf8');
  const elements=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(match=>[match[1],new Element()]));
  const panels=['participants','chat','share','more','leave'].map(name=>new Element({meetingPanel:name}));
  const messages=[],timers=new Map();
  let serial=0;
  const parent={postMessage:message=>messages.push(message)};
  const win=new Element();win.parent=parent;
  const doc=new Element();doc.documentElement=new Element();doc.hidden=false;
  doc.getElementById=id=>{assert.ok(elements.has(id),`missing element: ${id}`);return elements.get(id);};
  doc.querySelectorAll=selector=>selector==='[data-meeting-panel]'?panels:[];
  const context={window:win,document:doc,requestAnimationFrame:callback=>callback(),setTimeout:(callback,duration)=>{timers.set(++serial,{callback,duration});return serial;},clearTimeout:id=>timers.delete(id)};
  vm.runInNewContext(fs.readFileSync('desktop-pet-demo.js','utf8'),context);
  const message=(type,source=parent)=>win.listeners.message({source,data:{type,scene:'3.1-2'}});
  const complete=()=>{const [id,timer]=timers.entries().next().value;timers.delete(id);timer.callback();};
  return {elements,panels,messages,timers,win,doc,message,complete};
}

test('desktop scene embeds the shared wallpaper, a meeting and a separate bottom-right pet',()=>{
  const html=fs.readFileSync('desktop-pet-demo.html','utf8'),css=fs.readFileSync('desktop-pet-demo.css','utf8');
  const slides=fs.readFileSync('design-strategy-slides.html','utf8');
  assert.ok(css.includes("url('./assets/demo-wallpaper.png')"));
  assert.match(html,/模拟 Zoom 会议窗口/);
  assert.equal((html.match(/class="meeting-tile\b/g)||[]).length,6);
  assert.match(css,/\.meeting-window\{[^}]*left:50%/);
  assert.match(css,/\.desktop-pet-corner\{[^}]*right:28px;bottom:34px/);
  assert.ok(slides.includes('data-scene="3.1-2" src="./desktop-pet-demo.html"'));
  assert.doesNotMatch(slides,/桌面上的其他工作/);
  for(const asset of ['assets/desktop-cat.svg','assets/demo-wallpaper.png'])assert.ok(fs.existsSync(asset));
  for(const relative of [...html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)].map(match=>match[1]))assert.ok(fs.existsSync(path.resolve(relative)),relative);
});

test('embedded desktop waits for activation and progresses without opening a task panel',()=>{
  const s=setup();
  assert.equal(s.timers.size,0);
  assert.equal(s.messages.at(-1).type,'catpaw:scene-ready');
  s.message('catpaw:scene-activate',{});
  assert.equal(s.timers.size,0,'messages from unrelated windows cannot start the scene');
  s.message('catpaw:scene-activate');
  assert.equal(s.timers.size,1);
  assert.equal(s.timers.values().next().value.duration,6500);
  assert.equal(s.messages.at(-1).type,'catpaw:scene-prepared');
  assert.equal(s.elements.get('petTaskProgress').textContent,'已完成 2/3');
  s.complete();
  assert.equal(s.elements.get('petTaskProgress').textContent,'已完成 3/3');
  assert.match(s.elements.get('petTaskTitle').textContent,/初稿已完成/);
  assert.equal(s.elements.get('petTaskSummary').hidden,true,'completion does not interrupt the meeting with an expanded panel');
});

test('a dismissed reminder stays collapsed on completion and can be recalled from the pet',()=>{
  const s=setup();s.message('catpaw:scene-activate');
  s.elements.get('petBubbleDismiss').click();
  assert.equal(s.elements.get('petTaskBubble').hidden,true);
  s.complete();
  assert.equal(s.elements.get('petTaskBubble').hidden,true);
  assert.equal(s.elements.get('petUnread').hidden,false);
  s.elements.get('desktopCat').click();
  assert.equal(s.elements.get('petTaskBubble').hidden,false);
  assert.equal(s.elements.get('petUnread').hidden,true);
  s.elements.get('petTaskDetails').click();
  assert.equal(s.elements.get('petTaskSummary').hidden,false);
  assert.equal(s.elements.get('petTaskDetails').getAttribute('aria-expanded'),'true');
  s.elements.get('petTaskDetails').click();
  assert.equal(s.elements.get('petTaskSummary').hidden,true);
});

test('leaving cancels work, re-entry resets the task and stale timers cannot finish a new run',()=>{
  const s=setup();s.message('catpaw:scene-activate');
  const stale=s.timers.values().next().value.callback;
  s.message('catpaw:scene-deactivate');
  assert.equal(s.timers.size,0);
  assert.ok(s.doc.documentElement.classes.has('pet-demo-paused'));
  s.message('catpaw:scene-activate');
  stale();
  assert.equal(s.elements.get('petTaskProgress').textContent,'已完成 2/3');
  assert.equal(s.timers.size,1);
  s.message('catpaw:scene-deactivate');
  assert.equal(s.timers.size,0,'a stale callback must not lose the current timer handle');
  s.message('catpaw:scene-preview');
  assert.equal(s.timers.size,0,'inactive printable previews do not run the notification timer');
  assert.equal(s.elements.get('petTaskProgress').textContent,'已完成 2/3');
});

test('meeting controls only change local UI state and reset when the scene replays',()=>{
  const s=setup();s.message('catpaw:scene-activate');
  s.elements.get('meetingMic').click();
  assert.equal(s.elements.get('meetingMic').getAttribute('aria-pressed'),'true');
  assert.equal(s.elements.get('meetingMic').querySelector('span').textContent,'静音');
  s.elements.get('meetingCamera').click();
  assert.match(s.elements.get('meetingSelfState').textContent,/模拟/);
  s.panels[0].click();
  assert.equal(s.elements.get('meetingPopover').hidden,false);
  assert.equal(s.elements.get('meetingPopoverTitle').textContent,'参会者 · 6');
  s.elements.get('meetingPopoverClose').click();
  assert.equal(s.elements.get('meetingPopover').hidden,true);
  s.message('catpaw:scene-activate');
  assert.equal(s.elements.get('meetingMic').getAttribute('aria-pressed'),'false');
  assert.equal(s.elements.get('meetingCamera').getAttribute('aria-pressed'),'false');
  const source=fs.readFileSync('desktop-pet-demo.js','utf8');
  assert.doesNotMatch(source,/getUserMedia|getDisplayMedia|fetch\(|WebSocket|RTCPeerConnection/);
});

test('deck navigation keys forward only while active and visibility changes stop progress',()=>{
  const s=setup();
  const key={key:'ArrowRight',preventDefault(){this.prevented=true;}};
  s.doc.listeners.keydown(key);
  assert.ok(!s.messages.some(message=>message.type==='catpaw:scene-key'));
  s.message('catpaw:scene-activate');
  s.doc.listeners.keydown(key);
  assert.equal(key.prevented,true);
  assert.equal(s.messages.at(-1).key,'ArrowRight');
  s.doc.hidden=true;s.doc.listeners.visibilitychange();
  assert.equal(s.timers.size,0);
});
