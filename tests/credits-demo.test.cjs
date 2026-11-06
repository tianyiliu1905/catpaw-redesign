const test=require('node:test'),assert=require('node:assert/strict');
const {derive,warnings,paginate,sample,balanceHTML,usageHTML,nextRefresh}=require(process.env.CREDITS_MODULE||'../credits-demo.js');
test('normal quota balance and usage match client records to the cent',()=>{
 const data=sample(),state=derive(data);assert.equal(state.balance,98280.55);assert.equal(state.used,1719.45);assert.equal(state.state,'normal');assert.equal(data.records.reduce((s,r)=>s+Math.round(r.cost*100),0),171945);assert.ok(data.records.every(row=>row.cost>0));
});
test('enterprise and department exhaustion lock the personal balance without erasing it',()=>{
 for(const scope of ['enterprise','department']){const data=sample({status:scope}),state=derive(data);assert.equal(state.balance,98280.55);assert.equal(state.locked,true);assert.equal(state.state,scope);const html=balanceHTML(data);assert.match(html,/不可用/);assert.match(html,/98,280.55/);assert.match(html,/个人积分暂不可使用/);assert.ok(!html.includes('1,000,000'));}
});
test('personal exhaustion shows zero and a full usage bar, not a locked balance',()=>{
 const data=sample({status:'personal'}),state=derive(data);assert.equal(state.balance,0);assert.equal(state.percentage,100);assert.equal(state.locked,false);assert.match(balanceHTML(data),/个人积分已耗尽/);assert.match(balanceHTML(data),/width:100%/);
});
test('unlimited users have no personal balance or quota view and retain usage history',()=>{
 const data=sample({unlimited:true});assert.equal(derive(data).limited,false);assert.equal(derive(data).balance,null);assert.equal(balanceHTML(data),'');assert.equal(paginate(data.records,1).rows.length,20);assert.match(usageHTML(data,1),/消息内容/);
});
test('low credit warnings apply below 10%, including users with no personal limit',()=>{
 const data=sample({unlimited:true});data.enterpriseRemaining=data.enterpriseTotal*.1;assert.deepEqual(warnings(data),[]);data.enterpriseRemaining-=1;assert.deepEqual(warnings(data),['enterprise']);data.departmentRemaining=data.departmentTotal*.09;assert.deepEqual(warnings(data),['enterprise','department']);data.enterpriseRemaining=0;assert.deepEqual(warnings(data),['department']);
});
test('usage is paged by 20, clamps invalid pages, and has a usable empty state',()=>{
 const data=sample();assert.equal(paginate(data.records,1).rows.length,20);assert.equal(paginate(data.records,2).rows.length,4);assert.equal(paginate(data.records,999).page,2);assert.equal(paginate(data.records,-3).page,1);assert.equal(paginate([],1).pages,1);assert.match(usageHTML({...data,records:[]},1),/暂无积分使用记录/);assert.match(usageHTML(data,2),/共 24 条/);
});
test('usage excludes backend Agent billing and safely escapes full message tooltips',()=>{
 const data=sample();data.records=[{message:'<script>长消息</script>',cost:3.5,model:'GLM',updated:'2026-11-06',channel:'client'},{message:'后台定制 Agent',cost:2,channel:'backend'}];const html=usageHTML(data,1);assert.match(html,/3.50/);assert.match(html,/&lt;script&gt;/);assert.ok(!html.includes('<script>'));assert.ok(!html.includes('后台定制 Agent'));assert.match(html,/共 1 条/);assert.ok(!html.includes('来源产品'));
});
test('monthly refresh dates roll into the next year correctly',()=>{
 assert.equal(nextRefresh(new Date(2026,10,6)),'2026-12-01 00:00:00');assert.equal(nextRefresh(new Date(2026,11,31)),'2027-01-01 00:00:00');
});

test('account menu, balance/usage tabs, unlimited mode and refresh use isolated UI events',async()=>{
 const fs=require('node:fs'),vm=require('node:vm');const timers=[];let doc;
 class Element{
  constructor(dataset={}){this.dataset=dataset;this.listeners={};this.attrs={};this.style={setProperty(k,v){this[k]=v}};this.hidden=false;this.disabled=false;this.innerHTML='';this.children=[];this.value='';}
  setAttribute(k,v){this.attrs[k]=v}removeAttribute(k){delete this.attrs[k]}hasAttribute(k){return Object.hasOwn(this.attrs,k)}
  addEventListener(type,fn,capture){(this.listeners[type]||=[]).push({fn,capture})}
  fire(type,event={}){for(const {fn} of this.listeners[type]||[])fn(event)}
  append(...nodes){this.children.push(...nodes)}contains(node){return this===node||this.children.includes(node)}
  focus(){doc.activeElement=this}getBoundingClientRect(){return{left:20,top:700}}
  showModal(){this.open=true}close(){this.open=false;this.fire('close')}
  closest(selector){return selector.split(',').some(s=>this.selectors?.includes(s.trim()))?this:null}
 }
 const trigger=new Element(),menu=new Element(),dialog=new Element(),warning=new Element(),settings=new Element(),product=new Element();
 product.getBoundingClientRect=()=>({left:100,top:60,width:1000,height:720});
 const open=new Element(),settingsButton=new Element();open.selectors=['[data-credits-open]'];settingsButton.selectors=['[data-credits-settings]'];
 const balance=new Element(),usage=new Element(),error=new Element(),refresh=new Element(),refreshText=new Element();refresh.selectors=['[data-credits-refresh]'];refresh.attrs['data-credits-refresh']='';refresh.querySelector=()=>refreshText;
 const tabs=['balance','usage'].map(value=>{const el=new Element({creditsTab:value});el.selectors=['[data-credits-tab]'];return el});
 const configs=['unlimited','status','warning'].map(value=>{const el=new Element({creditsConfig:value});el.querySelector=()=>new Element();return el});
 const close=new Element();
 dialog.querySelector=selector=>({'#creditsBalancePanel':balance,'#creditsUsagePanel':usage,'.credits-load-error':error,'[data-credits-refresh]':refresh,'[data-credits-close]':close}[selector]);
 dialog.querySelectorAll=selector=>selector==='[data-credits-tab]'?tabs:selector==='[data-credits-config]'?configs:[];
 menu.querySelector=()=>open;menu.querySelectorAll=()=>[open,settingsButton];menu.offsetWidth=300;menu.offsetHeight=200;
 const created=[menu,dialog,warning];doc={body:new Element(),querySelector:()=>trigger,createElement:()=>created.shift(),getElementById:id=>id==='window'?product:settings,addEventListener(){},activeElement:null};
 const window={addEventListener(){}};
 const ctx={document:doc,window,getComputedStyle:()=>({borderRadius:'24px'}),innerWidth:1200,localStorage:{getItem:()=>null,setItem(){}},clearTimeout(){},setTimeout:fn=>{timers.push(fn);return 1}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(require.resolve(process.env.CREDITS_MODULE||'../credits-demo.js'),'utf8'),ctx);
 assert.equal(doc.body.children.length,3);assert.equal(trigger.listeners.click[0].capture,true);
 let stopped=false;trigger.fire('click',{preventDefault(){},stopImmediatePropagation(){stopped=true}});assert.equal(stopped,true);assert.equal(menu.hidden,false);assert.match(menu.innerHTML,/98,280.55/);
 menu.fire('click',{target:open});assert.equal(dialog.open,true);assert.equal(dialog.style['--credits-product-left'],'100px');assert.equal(dialog.style['--credits-product-top'],'60px');assert.equal(dialog.style['--credits-product-width'],'1000px');assert.equal(dialog.style['--credits-product-height'],'720px');assert.equal(dialog.style['--credits-product-radius'],'24px');assert.equal(balance.hidden,false);assert.equal(usage.hidden,true);
 dialog.fire('click',{target:tabs[1]});assert.equal(usage.hidden,false);assert.match(usage.innerHTML,/共 24 条/);
 configs[0].value='true';dialog.fire('change',{target:configs[0]});assert.equal(balance.hidden,true);assert.equal(tabs[0].hidden,true);assert.match(menu.innerHTML,/积分明细/);assert.ok(!menu.innerHTML.includes('98,280.55'));
 dialog.fire('click',{target:refresh});assert.equal(refresh.disabled,true);assert.equal(refreshText.textContent,'刷新中');timers.shift()();await Promise.resolve();await Promise.resolve();assert.equal(refresh.disabled,false);
 const classes=new Set();const scroller={matches:selector=>selector==='.credits-table-scroll',classList:{add:value=>classes.add(value),remove:value=>classes.delete(value)}};dialog.fire('scroll',{target:scroller});assert.ok(classes.has('is-scrolling'));timers.shift()();assert.ok(!classes.has('is-scrolling'));
 configs[2].value='enterprise';dialog.fire('change',{target:configs[2]});assert.equal(warning.hidden,false);assert.match(warning.innerHTML,/企业积分即将耗尽/);
});

test('balance and usage stay separate without repeating the balance or total limit',()=>{
 const html=balanceHTML(sample());assert.equal((html.match(/98,280\.55/g)||[]).length,1);assert.equal((html.match(/100,000\.00/g)||[]).length,1);assert.match(html,/aria-label="个人积分余额"/);assert.match(html,/aria-label="个人积分使用情况"/);assert.ok(!html.includes('剩余可用额度'));assert.ok(!html.includes('当前可使用积分'));assert.ok(!html.includes('积分限额'));assert.match(html,/下次积分刷新时间/);
});

test('usage percentage is visible and agrees with the progress bar across quota states',()=>{
 const normal=balanceHTML(sample());assert.match(normal,/credits-usage-percentage [^>]*>1\.72<small>%/);assert.match(normal,/aria-valuenow="1\.72"/);const exhausted=balanceHTML(sample({status:'personal'}));assert.match(exhausted,/100\.00<small>%/);assert.match(exhausted,/aria-valuenow="100\.00"/);
});

test('personal exhaustion stays neutral while enterprise and department locking keep their warning style',()=>{
 const personal=balanceHTML(sample({status:'personal'}));assert.match(personal,/credits-personal-empty/);assert.match(personal,/credits-notice-neutral/);assert.match(personal,/credits-progress-neutral/);assert.ok(!personal.includes('credits-error'));assert.ok(!personal.includes('credits-progress-error'));assert.match(personal,/100\.00<small>%/);for(const status of ['enterprise','department']){const html=balanceHTML(sample({status}));assert.match(html,/credits-error/);assert.match(html,/不可用/);}
});
