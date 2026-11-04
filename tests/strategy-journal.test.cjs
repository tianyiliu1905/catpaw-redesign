const test=require('node:test');
const assert=require('node:assert/strict');
const {create}=require('../strategy-journal.js');
function harness({initialIndex=0,reduced=false,demoRects=null,headings=false,pointGroups=[],staticDiagram=false}={}){
  const changes=[],layouts=[],nodes=[],raf=[],timers=new Map();let timerId=0;
  class Element{
    constructor(tag){this.tagName=tag;this.children=[];this.attrs={};this.events={};this.style={getPropertyValue:key=>this.style[key],setProperty:(key,value)=>{this.style[key]=value}};nodes.push(this)}
    append(child){this.children.push(child)}
    before(){} after(){}
    setAttribute(key,value){this.attrs[key]=value}
    getAttribute(key){return this.attrs[key]}
    removeAttribute(key){delete this.attrs[key]}
    addEventListener(key,fn){this.events[key]=fn}
    closest(){return null}
    matches(){return this.tagName==='h1'||['mainline','topline','story-kicker'].includes(this.className)}
    contains(node){return this===node||this.children.some(child=>child.contains(node))}
    querySelectorAll(selector){return this.children.flatMap(child=>child.isDemo&&(!child.isStatic||selector.split(',').some(part=>part.trim()==='.design-slot'))?[child]:child.querySelectorAll(selector))}
    getBoundingClientRect(){return this.rect}
    animate(frames,options){this.lastAnimation={frames,options};(this.animationHistory??=[]).push(this.lastAnimation);return {cancel(){}}}
  }
  const win={matchMedia:()=>({matches:reduced}),location:{href:'file:///demo/design-strategy-slides.html#p4'},requestAnimationFrame:fn=>(raf.push(fn),raf.length),cancelAnimationFrame(){},addEventListener(){},setTimeout(fn,ms){timers.set(++timerId,{fn,ms});return timerId},clearTimeout(id){timers.delete(id)}};
  const doc={defaultView:win,createElement:tag=>new Element(tag)};
  const stage=new Element('main');Object.assign(stage,{ownerDocument:doc,clientWidth:1400,clientHeight:700,scrollLeft:0});
  const canvas=new Element('div'),pages=Array.from({length:8},()=>new Element('section'));
  const demos=[],texts=[],titles=[];
  if(headings)pages.forEach(page=>{const title=new Element('h1'),label=new Element('div');label.className='mainline';page.append(label);page.append(title);titles.push([label,title]);});
  if(demoRects)demoRects.forEach((rect,i)=>{
    const body=new Element('div'),text=new Element('div'),demo=new Element('figure');demo.isDemo=true;demo.isStatic=staticDiagram;demo.rect=rect;
    body.append(text);body.append(demo);pages[i].append(body);demos.push(demo);texts.push(text);
  });
  const slides=pages.map((_,i)=>({no:`p${i}`,title:`内容${i}`}));
  const journal=create({stage,canvas,pages,slides,pointGroups,ranges:[{start:1,end:3},{start:3,end:6},{start:6,end:8}],initialIndex,onChange:index=>changes.push(index),onLayout(page){layouts.push(page)}});
  journal.fit();
  return {journal,stage,canvas,changes,layouts,pages,nodes,raf,demos,texts,titles,panels:nodes.filter(node=>node.className==='journal-panel'),flush(ms){for(const [id,timer] of [...timers])if(timer.ms<=ms){timers.delete(id);timer.fn()}}};
}
test('deep links display only their selected page',()=>{
  const h=harness({initialIndex:4});assert.deepEqual(h.changes,[4]);
  assert.deepEqual(h.panels.map((panel,i)=>!panel.hidden?i:null).filter(i=>i!==null),[4]);
  assert.equal(h.nodes.find(node=>node.tagName==='select').value,'4');
});
test('forward and backward turns slide from opposite sides, then hide the outgoing page',()=>{
  const h=harness();h.journal.seek(1);
  assert.equal(h.panels.filter(panel=>!panel.hidden).length,2);
  assert.equal(h.panels[1].lastAnimation.frames[0].transform,'translateX(1400px)');
  assert.equal(h.panels[0].lastAnimation.frames[1].transform,'translateX(-1400px)');
  h.flush(820);assert.equal(h.panels.filter(panel=>!panel.hidden).length,1);
  h.journal.seek(0);assert.equal(h.panels[0].lastAnimation.frames[0].transform,'translateX(-1400px)');
});
test('one wheel gesture including its momentum tail turns only one page',()=>{
  const h=harness();const event={deltaX:0,deltaY:60,deltaMode:0,ctrlKey:false,target:{closest:()=>null},preventDefault(){}};
  for(let i=0;i<8;i++)h.stage.events.wheel(event);
  assert.deepEqual(h.changes,[0,1]);h.flush(820);
  h.stage.events.wheel({...event,deltaX:70,deltaY:1});assert.deepEqual(h.changes,[0,1,2]);
  h.stage.events.wheel({...event,ctrlKey:true});assert.deepEqual(h.changes,[0,1,2]);
});
test('both vertical and horizontal touch swipes turn pages',()=>{
  const h=harness(),target={closest:()=>null};
  h.stage.events.touchstart({target,touches:[{clientX:200,clientY:300}]});
  h.stage.events.touchend({changedTouches:[{clientX:200,clientY:200}]});assert.equal(h.changes.at(-1),1);h.flush(820);
  h.stage.events.touchstart({target,touches:[{clientX:200,clientY:300}]});
  h.stage.events.touchend({changedTouches:[{clientX:300,clientY:300}]});assert.equal(h.changes.at(-1),0);
});
test('resize and chapter jumps retain a single page, reduced motion skips animation',()=>{
  const h=harness();h.journal.seek(6);assert.equal(h.changes.at(-1),6);assert.equal(h.panels.filter(panel=>!panel.hidden).length,1);
  const original=h.canvas.style['--journal-width'];h.stage.clientWidth=1000;h.journal.fit();assert.equal(h.changes.at(-1),6);assert.notEqual(h.canvas.style['--journal-width'],original);
  const reduced=harness({reduced:true});reduced.journal.seek(1);assert.equal(reduced.panels.filter(panel=>!panel.hidden).length,1);assert.equal(reduced.panels[1].lastAnimation,undefined);
  reduced.journal.seek(999);assert.equal(reduced.changes.at(-1),7);reduced.journal.seek(-9);assert.equal(reduced.changes.at(-1),0);
});

test('same-position Demo stays stationary while text slides, in both directions',()=>{
  const rect={left:450,top:150,width:800,height:550};
  const h=harness({demoRects:[rect,{...rect}]});h.journal.seek(1);
  for(const demo of h.demos){assert.ok(demo.lastAnimation);assert.ok(demo.lastAnimation.frames.every(frame=>!('transform' in frame)));}
  assert.ok(h.texts[0].lastAnimation.frames[1].transform.startsWith('translateX(-'));
  assert.equal(h.panels[0].lastAnimation,undefined,'the shared frame container never moves');
  h.flush(820);h.journal.seek(0);
  assert.ok(h.demos[0].lastAnimation.frames.every(frame=>!('transform' in frame)));
  assert.ok(h.texts[0].animationHistory.some(animation=>animation.frames[0].transform?.startsWith('translateX(-')));
  assert.equal(h.texts[0].lastAnimation.options.duration,820);
  assert.equal(h.demos[0].lastAnimation.options.duration,480);
});
test('different Demo geometry moves the Demo itself without transforming its containing block',()=>{
  const rect={left:450,top:150,width:800,height:550};
  const h=harness({demoRects:[rect,{...rect,left:600}]});h.journal.seek(1);
  assert.equal(h.panels[0].lastAnimation,undefined);
  assert.ok(h.demos[0].lastAnimation.frames[1].transform.startsWith('translateX(-'));
  for(const page of h.pages.slice(0,2))assert.equal(page.children[0].lastAnimation,undefined,'body remains the same positioning context');
  const before=h.layouts.length;h.flush(820);
  assert.equal(h.layouts.length,before+1);assert.equal(h.layouts.at(-1),h.pages[1],'fit against final geometry after animation cleanup');
});

test('titles and strategy labels switch in place while body copy moves',()=>{
  const rect={left:450,top:150,width:800,height:550};
  for(const demoRects of [[rect,{...rect}],[rect,{...rect,left:600}]]){
    const h=harness({demoRects,headings:true});h.journal.seek(1);
    for(const title of h.titles[0])assert.deepEqual(title.lastAnimation.frames,[{opacity:0},{opacity:0}]);
    for(const title of h.titles[1])assert.equal(title.lastAnimation,undefined);
    assert.equal(h.panels[1].lastAnimation,undefined,'no ancestor motion shifts the headings');
    h.flush(820);h.journal.seek(0);
    for(const title of h.titles[1])assert.deepEqual(title.lastAnimation.frames,[{opacity:0},{opacity:0}]);
  }
});

 test('entering or leaving a Demo page never animates its body container',()=>{
  const rect={left:450,top:150,width:800,height:550};
  const h=harness({demoRects:[rect],headings:true});
  h.journal.seek(1);
  const body=h.pages[0].children.at(-1);
  assert.equal(body.lastAnimation,undefined);
  assert.ok(h.demos[0].lastAnimation);
  h.flush(820);h.journal.seek(0);
  assert.equal(body.lastAnimation,undefined);
  assert.ok(h.demos[0].lastAnimation.frames[0].transform.startsWith('translateX(-'));
 });

test('strategy points follow the chapter, highlight their page range and navigate to its first page',()=>{
  const h=harness({pointGroups:[[{label:'能力可感',start:2,end:3}],[{label:'过程可懂',start:4,end:5},{label:'过程可控',start:5,end:6}],[{label:'布局可适',start:7,end:8}]]});
  const nav=h.nodes.find(node=>node.className==='journal-points');
  const buttons=h.nodes.filter(node=>node.className==='journal-point');
  assert.equal(nav.hidden,true);
  h.journal.seek(3);
  assert.equal(nav.hidden,false);
  assert.deepEqual(buttons.filter(button=>!button.hidden).map(button=>button.textContent),['能力可感','过程可懂','过程可控','布局可适']);
  assert.ok(buttons.every(button=>!button.getAttribute('aria-current')),'chapter overview has no selected point');
  buttons[1].events.click();assert.equal(h.changes.at(-1),4);
  assert.equal(buttons[1].getAttribute('aria-current'),'step');
  h.journal.seek(5);assert.equal(buttons[1].getAttribute('aria-current'),undefined);
  assert.equal(buttons[2].getAttribute('aria-current'),'step');
  h.journal.seek(7);assert.equal(buttons[2].hidden,false);assert.equal(buttons[2].getAttribute('aria-current'),undefined);assert.equal(buttons[3].getAttribute('aria-current'),'step');
});

test('static participation diagram enters without moving its absolute-position containing block',()=>{
  const rect={left:450,top:150,width:800,height:550};
  const h=harness({demoRects:[rect,{...rect}],headings:true,staticDiagram:true});
  h.journal.seek(1);
  for(const demo of h.demos){
    assert.ok(demo.lastAnimation,'static diagrams participate independently');
    assert.ok(demo.lastAnimation.frames.every(frame=>!('transform' in frame)),'matching diagrams stay in place');
  }
  for(const page of h.pages.slice(0,2))assert.equal(page.children.at(-1).lastAnimation,undefined,'body must not become a transformed containing block');
});
