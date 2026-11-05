const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const nodes=[],children={};
 function node(){return {hidden:false,value:'',innerHTML:'',style:{},attrs:{},listeners:{},offsetHeight:90,classList:{add(){},remove(){}},setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},addEventListener(k,v){this.listeners[k]=v},appendChild(){},focus(){},getBoundingClientRect:()=>({left:0,top:0,right:800,bottom:500,width:800,height:500}),querySelectorAll:()=>[],querySelector:s=>children[s]||(children[s]=node())}}
 const nav=node(),rail=node(),host=node();let opened=0,created=0;
 const ctx={localStorage:{getItem:()=>null,setItem(){}},clearTimeout(){},setTimeout(){return 1},crypto:{randomUUID:()=>String(nodes.length)},document:{getElementById:()=>nav,querySelector:()=>rail,querySelectorAll:()=>[],createElement(){const n=node();nodes.push(n);return n}}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('nocode-page.js','utf8'),ctx);
 const api=ctx.CatPawNoCodePage.create({host,onOpen(){opened++},onCreate(){created++}}),page=nodes[0];
 function click(selector,dataset){page.listeners.click({target:{closest:s=>s===selector?{dataset,setAttribute(){},getBoundingClientRect:()=>({left:0,top:0,right:100,bottom:40})}:null}})}
 return {ctx,api,page,nav,children,click,get opened(){return opened},get created(){return created}};
}
test('fifth entry renders seven original gallery cards and create returns to conversation flow',()=>{
 const h=setup();h.api.open();assert.equal(h.opened,1);assert.equal(h.nav.attrs['aria-current'],'page');assert.equal(h.page.hidden,false);
 assert.equal((h.children['.nocode-grid'].innerHTML.match(/class="nocode-card"/g)||[]).length,7);
 h.children.input.value='不存在';h.children.input.listeners.input();assert.ok(h.children['.nocode-grid'].innerHTML.includes('没有找到'));
 h.click('[data-nocode-create]',{});assert.equal(h.created,1);assert.equal(h.page.hidden,true);
});
test('more menu duplicates and recoverably removes entries',()=>{
 const h=setup();h.api.open();h.click('[data-nocode-more]',{nocodeMore:'site-0'});h.click('[data-nocode-action]',{nocodeAction:'duplicate'});
 assert.equal((h.children['.nocode-grid'].innerHTML.match(/class="nocode-card"/g)||[]).length,8);
 h.click('[data-nocode-more]',{nocodeMore:'site-0'});h.click('[data-nocode-action]',{nocodeAction:'remove'});
 assert.equal((h.children['.nocode-grid'].innerHTML.match(/class="nocode-card"/g)||[]).length,7);
 h.children.button.onclick();assert.equal((h.children['.nocode-grid'].innerHTML.match(/class="nocode-card"/g)||[]).length,8);
});
test('type, search and updated ordering preserve the gallery records',()=>{
 const h=setup();const items=[{name:'A',type:'网站',updated:1},{name:'B',type:'应用',updated:3},{name:'C',type:'网站/应用',updated:2},{name:'D',type:'网站',updated:5,deleted:true}];
 const result=h.ctx.CatPawNoCodePage.filterItems(items,'','网站');assert.deepEqual(Array.from(result,x=>x.name),['C','A']);assert.equal(items.length,4);
 assert.equal(h.ctx.CatPawNoCodePage.filterItems(items,'b').length,1);
});
test('design thumbnails and toolbar icons exist locally; no temporary URLs remain',()=>{
 const source=fs.readFileSync('nocode-page.js','utf8');for(const name of new Set([...source.matchAll(/['"]([a-z0-9]+\.(?:svg|png))['"]/g)].map(x=>x[1])))assert.ok(fs.statSync('assets/nocode-page/'+name).size>0,name);
 assert.ok(!source.includes('figma.com/api'));
 const html=fs.readFileSync('index.html','utf8');assert.ok(html.includes('id="nocodePageNav"'));assert.ok(html.indexOf('src="./nocode-page.js"')<html.indexOf('src="./app.js"'));
});
