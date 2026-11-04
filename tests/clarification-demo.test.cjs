const test=require('node:test');
const assert=require('node:assert/strict');
const {createModel,createController}=require('../clarification-demo.js');
const {scenes}=require('../strategy-scenes.js');

test('required direction, optional details and range, explicit confirmation',()=>{
 const m=createModel();assert.equal(m.act('next'),false);assert.equal(m.act('skip'),false);
 m.act('pick-1');m.act('next');m.type('暂不含海鲜');m.act('next');
 m.type('200','min');m.type('100','max');assert.equal(m.canNext,false);assert.match(m.error,/下限/);
 m.type('300','max');assert.equal(m.canNext,true);m.act('next');assert.equal(m.phase,'asking');
 m.act('edit-1');assert.equal(m.custom,'暂不含海鲜');m.type('周末可用，暂不含海鲜');m.act('next');assert.equal(m.range.max,'300');m.act('next');
 assert.equal(m.act('next'),false);m.act('confirm');assert.equal(m.phase,'done');assert.equal(m.answers[1],'周末可用，暂不含海鲜');
});
test('empty, negative, nonfinite and reversed budgets cannot continue; skips remain unknown',()=>{
 const m=createModel();m.act('pick-0');m.act('next');m.act('skip');
 for(const [min,max] of [['','200'],['-1','200'],['2','Infinity'],['200','100'],['1','10001']]){m.type(min,'min');m.type(max,'max');assert.equal(m.act('next'),false);}
 m.act('skip');assert.deepEqual(m.answers,['吸引新客到店',null,null]);m.act('confirm');assert.equal(m.phase,'done');
});
test('slide exercises all four input modes with cursor preceding each fill',()=>{
 const m=createModel();let previous;
 for(const step of scenes['2.3']){
  if(step.action==='recovery-act')assert.equal(m.act(step.target),true,step.target);
  if(step.action==='recovery-fill'){assert.equal(previous.action,'recovery-pointer');assert.equal(previous.field,step.field);assert.equal(m.type(step.value,step.field),true);}
  previous=step;
 }
 assert.equal(m.phase,'done');assert.deepEqual(m.answers,['提升客单价与连带销售','主推招牌烤鸡，搭配两份小食和两杯饮品；周末可用，暂不含海鲜。','128–168 元／套']);
});
function fixture(){let html='',inputListener;const classes=new Set();const buttons=[{disabled:true},{disabled:true}];const host={hidden:true,innerHTML:'',addEventListener(type,fn){if(type==='input')inputListener=fn;},querySelectorAll:sel=>sel.includes('next')?buttons:[],querySelector:()=>null};const c=createController({host,thread:{addEventListener(){},querySelector:()=>({set outerHTML(v){html=v;}})},composer:{closest:()=>({classList:{toggle(n,on){if(on)classes.add(n);else classes.delete(n);}}})}});return {c,host,classes,buttons,get html(){return html;},input(value){inputListener({target:{dataset:{clarifyField:'text'},value}});}};}
test('card activation and close preserve answers; only confirmation restores composer with final summary',()=>{
 const f=fixture();f.c.activate(true);assert.equal(f.host.hidden,false);assert.ok(f.classes.has('has-clarification'));
 f.c.act('pick-2');f.c.activate(false);assert.equal(f.host.hidden,true);assert.equal(f.classes.size,0);f.c.activate(true);assert.match(f.host.innerHTML,/aria-pressed="true"/);
 f.c.act('close');assert.match(f.html,/继续补充要求/);f.c.act('reopen');f.c.act('next');f.c.act('skip');f.c.act('skip');
 assert.equal(f.host.hidden,false);assert.match(f.host.innerHTML,/确认并继续/);f.c.act('confirm');assert.equal(f.host.hidden,true);assert.equal(f.classes.size,0);assert.match(f.html,/未补充/);
 f.c.reset();assert.match(f.host.innerHTML,/1 \/ 4/);assert.doesNotMatch(f.host.innerHTML,/aria-pressed="true"/);
});
test('input updates both next buttons without replacing textarea and escapes markup on review',()=>{
 const f=fixture();f.c.activate(true);f.c.act('pick-0');f.c.act('next');const before=f.host.innerHTML;
 f.input('<img src=x onerror=alert(1)>');assert.equal(f.host.innerHTML,before);assert.ok(f.buttons.every(b=>!b.disabled));
 f.c.act('next');f.c.act('skip');assert.match(f.host.innerHTML,/&lt;img/);assert.doesNotMatch(f.host.innerHTML,/<img src=x/);f.c.act('confirm');assert.match(f.html,/&lt;img/);
});
