const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const created=[],nav={attrs:{},listeners:{},setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},addEventListener(k,v){this.listeners[k]=v}};
 function node(){return {hidden:false,value:'',innerHTML:'',attrs:{},listeners:{},classList:{add(){},remove(){}},setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},addEventListener(k,v){this.listeners[k]=v},appendChild(){},scrollBy(){}}}
 const rail=node(),children={};const host=node();let opened=0,used=null;const owned=[];
 const ctx={localStorage:{getItem:()=>null,setItem(){}},clearTimeout(){},setTimeout(){return 1},document:{getElementById:()=>nav,querySelector:()=>rail,querySelectorAll:()=>[],createElement(){const n=node();n.querySelector=selector=>children[selector]||(children[selector]=node());n.querySelectorAll=()=>[];created.push(n);return n}}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('capability-market.js','utf8'),ctx);
 const app=ctx.CatPawCapabilityMarket.create({host,onOpen(){opened++},getOwned:()=>owned,onInstall:item=>owned.push(item.name),onUse:item=>used=item,getOtherItems:()=>[]});
 const page=created[0];
 function click(selector,dataset){page.listeners.click({target:{closest:s=>s===selector?{dataset}:null}})}
 return {ctx,app,page,children,nav,owned,click,get opened(){return opened},get used(){return used}};
}
test('third-entry page opens with original marketplace cards and closes without losing its owned list',()=>{
 const h=setup();h.app.open();assert.equal(h.opened,1);assert.equal(h.page.hidden,false);assert.equal(h.nav.attrs['aria-current'],'page');
 assert.equal((h.children['.market-cards'].innerHTML.match(/class="market-card"/g)||[]).length,11);
 h.click('[data-market-install]',{marketInstall:'企业微信助手'});assert.ok(h.owned.includes('企业微信助手'));
 h.click('[data-market-owned]',{marketOwned:'true'});assert.equal((h.children['.market-cards'].innerHTML.match(/class="market-card"/g)||[]).length,1);
 h.click('[data-market-install]',{marketInstall:'企业微信助手'});assert.equal(h.used.name,'企业微信助手');assert.equal(h.page.hidden,true);
});
test('search, category filtering and empty states are functional',()=>{
 const h=setup();h.app.open();const search=h.children.input;
 search.value='PPT';search.listeners.input();assert.ok(h.children['.market-cards'].innerHTML.includes('PPT 制作专家'));assert.ok(!h.children['.market-cards'].innerHTML.includes('企业微信助手'));
 search.value='不存在';search.listeners.input();assert.ok(h.children['.market-cards'].innerHTML.includes('没有找到匹配的专家'));
 search.value='';search.listeners.input();h.click('[data-market-category]',{marketCategory:'投资理财'});assert.equal((h.children['.market-cards'].innerHTML.match(/class="market-card"/g)||[]).length,2);
 h.click('[data-market-kind]',{marketKind:'skill'});assert.equal(search.placeholder,'搜索技能');assert.equal(h.children['.market-featured'].hidden,true);
});
test('every referenced Figma source asset is local and nonempty',()=>{
 const source=fs.readFileSync('capability-market.js','utf8');
 const names=new Set([...source.matchAll(/['"]([a-z0-9]+\.(?:svg|png))['"]/g)].map(m=>m[1]));
 for(const name of names)assert.ok(fs.statSync('assets/capability-market/'+name).size>0,name);
 assert.ok(!source.includes('figma.com/api'));
});
