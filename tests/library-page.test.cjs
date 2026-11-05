const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const nodes=[],children={};function node(){return {hidden:false,value:'',innerHTML:'',attrs:{},style:{},listeners:{},offsetHeight:150,classList:{add(){},remove(){}},setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},addEventListener(k,v){this.listeners[k]=v},appendChild(){},focus(){},querySelectorAll:()=>[],querySelector:s=>children[s]||(children[s]=node()),getBoundingClientRect:()=>({left:0,top:0,width:900,height:700})}}
 const nav=node(),rail=node(),host=node();let opened=0;const ctx={localStorage:{getItem:()=>null,setItem(){}},setTimeout(){return 1},clearTimeout(){},document:{getElementById:()=>nav,querySelector:()=>rail,querySelectorAll:()=>[],createElement(){const n=node();nodes.push(n);return n}}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('library-page.js','utf8'),ctx);const api=ctx.CatPawLibraryPage.create({host,onOpen(){opened++}}),page=nodes[0];
 function click(selector,dataset){page.listeners.click({target:{closest:s=>s===selector?{dataset,setAttribute(){},getBoundingClientRect:()=>({right:150,bottom:90})}:null}})}
 return {ctx,api,page,nav,children,click,get opened(){return opened}};
}
test('fourth book entry displays five design rows and searchable empty state',()=>{
 const h=setup();h.api.open();assert.equal(h.page.hidden,false);assert.equal(h.opened,1);assert.equal(h.nav.attrs['aria-current'],'page');assert.equal((h.children.tbody.innerHTML.match(/<tr>/g)||[]).length,5);
 h.children.input.value='.html';h.children.input.listeners.input();assert.equal((h.children.tbody.innerHTML.match(/<tr>/g)||[]).length,1);
 h.children.input.value='不存在';h.children.input.listeners.input();assert.equal(h.children['.library-empty'].hidden,false);
 h.api.close();assert.equal(h.page.hidden,true);
});
test('favorites, shared and recent-view filters preserve underlying files',()=>{
 const h=setup();h.api.open();h.click('[data-library-more]',{libraryMore:'file-0'});h.click('[data-library-action]',{libraryAction:'favorite'});h.click('[data-library-tab]',{libraryTab:'favorites'});assert.equal((h.children.tbody.innerHTML.match(/<tr>/g)||[]).length,1);
 h.click('[data-library-tab]',{libraryTab:'shared'});assert.equal(h.children.tbody.innerHTML,'');
 const result=h.ctx.CatPawLibraryPage.filterItems([{name:'a',visited:4,updated:1},{name:'b',visited:6,updated:2},{name:'c',visited:0,updated:3}],'viewed');assert.deepEqual(Array.from(result,x=>x.name),['b','a']);
});
test('remove supports restoring the same file',()=>{
 const h=setup();h.api.open();h.click('[data-library-more]',{libraryMore:'file-0'});h.click('[data-library-action]',{libraryAction:'remove'});assert.equal((h.children.tbody.innerHTML.match(/<tr>/g)||[]).length,4);h.children.button.onclick();assert.equal((h.children.tbody.innerHTML.match(/<tr>/g)||[]).length,5);
});
test('all three full pages retain distinct rail targets and local design assets',()=>{
 const html=fs.readFileSync('index.html','utf8');for(const id of ['capabilityPageNav','libraryPageNav','nocodePageNav'])assert.ok(html.includes('id="'+id+'"'));
 const source=fs.readFileSync('library-page.js','utf8');for(const name of new Set([...source.matchAll(/['"]([a-z0-9]+\.svg)['"]/g)].map(x=>x[1])))assert.ok(fs.statSync('assets/library-page/'+name).size>0,name);
 assert.ok(!source.includes('figma.com/api'));
});
