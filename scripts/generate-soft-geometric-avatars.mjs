import {mkdir,writeFile,readFile,rm,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const out=resolve('assets/subagent-soft-geometric');
await mkdir(out,{recursive:true});
const designSystem=JSON.parse(await readFile('widget-guidelines-audit/style-lab/design-system.json','utf8'));
const families=['success','link','purple','warning','danger'];
const familyNames={success:'绿',link:'蓝',purple:'紫',warning:'橙',danger:'红'};
// Use one shared gradient field across every primitive in a glyph.
const mixHex=(a,b,t)=>{
 const channels=hex=>hex.slice(1).match(/../g).map(v=>parseInt(v,16));
 const start=channels(a),end=channels(b);
 return '#'+start.map((v,i)=>Math.round(v*(1-t)+end[i]*t).toString(16).padStart(2,'0')).join('').toUpperCase();
};
const subjectColor=palette=>{const ramp=designSystem.functionalLightPalette[palette];return mixHex(ramp[1],ramp[2],.35)};
// Round both convex and concave vertices; no needle tips or square inner corners.
function rounded(points,r=12){
 const v=points.map((p,i)=>{const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length];const len=q=>Math.hypot(q[0]-p[0],q[1]-p[1]);const d=Math.min(r,len(a)*.42,len(b)*.42);const inset=q=>p.map((n,k)=>n+(q[k]-n)*d/len(q));return {p,a:inset(a),b:inset(b)};});
 return `<path d="M${v[0].b} ${v.slice(1).concat(v[0]).map(v=>`L${v.a} Q${v.p} ${v.b}`).join(' ')}Z"/>`;
}
const rect=(x,y,w,h,r=16)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`;
const circle=(x,y,r)=>`<circle cx="${x}" cy="${y}" r="${r}"/>`;
const stroke=d=>`<path d="${d}" fill="none" stroke="currentColor" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>`;
const shapes=[
 ['圆角方块',rect(28,28,104,104,20)],
 ['等臂十字',rounded([[64,24],[96,24],[96,64],[136,64],[136,96],[96,96],[96,136],[64,136],[64,96],[24,96],[24,64],[64,64]],8)],
 ['半圆拱',stroke('M40 124V76A40 40 0 0 1 120 76V124')],
 ['等距双拱',stroke('M32 124V60A24 24 0 0 1 80 60V124M80 60A24 24 0 0 1 128 60V124')],
 ['开口圆环',`<path d="M110.1 49.9 A42.5 42.5 0 1 0 110.1 110.1" fill="none" stroke="currentColor" stroke-width="24" stroke-linecap="round"/>`],
 ['四十五度胶囊',`<g transform="rotate(-45 80 80)">${rect(24,56,112,48,24)}</g>`],
 ['四宫格',rect(28,28,48,48,12)+rect(84,28,48,48,12)+rect(28,84,48,48,12)+rect(84,84,48,48,12)],
 ['等宽圆环',`<circle cx="80" cy="80" r="42" fill="none" stroke="currentColor" stroke-width="24"/>`],
 ['圆角菱形',`<g transform="rotate(45 80 80)">${rect(40,40,80,80,12)}</g>`],
 ['平行双杠',`<g transform="rotate(-45 80 80)">${rect(28,44,104,28,14)+rect(28,88,104,28,14)}</g>`],
 ['正三圆',`<g transform="translate(0 4)">${circle(80,49,24)+circle(53.15,95.5,24)+circle(106.85,95.5,24)}</g>`],
 ['等阶折线',stroke('M32 124H64V92H96V60H128V36')],
 ['对称双窗',`<path fill-rule="evenodd" d="M44 28h72a16 16 0 0 1 16 16v72a16 16 0 0 1-16 16H44a16 16 0 0 1-16-16V44a16 16 0 0 1 16-16Zm12 24a8 8 0 0 0-8 8v40a8 8 0 0 0 8 8h4a8 8 0 0 0 8-8V60a8 8 0 0 0-8-8Zm44 0a8 8 0 0 0-8 8v40a8 8 0 0 0 8 8h4a8 8 0 0 0 8-8V60a8 8 0 0 0-8-8Z"/>`],
 ['横向双圆',circle(56,80,32)+circle(104,80,32)],
 ['正六边形',rounded(Array.from({length:6},(_,i)=>{const a=i*Math.PI/3;return [80+56*Math.cos(a),80+56*Math.sin(a)]}),10)],
 ['圆弧折返',stroke('M32 40H108A20 20 0 0 1 108 80H52A20 20 0 0 0 52 120H128')],
 ['圆角方环',`<rect x="38" y="38" width="84" height="84" rx="16" fill="none" stroke="currentColor" stroke-width="24"/>`],
 ['等距错位',rect(28,32,72,40,12)+rect(60,88,72,40,12)],
 ['四向圆瓣',circle(80,52,25)+circle(108,80,25)+circle(80,108,25)+circle(52,80,25)+circle(80,80,18)],
 ['正三角形',`<g transform="translate(0 6)">${rounded([[80,22],[130.23,109],[29.77,109]],12)}</g>`],
];
const removedIds=new Set([1,2,3,4,5,6,8,10,12,13,16,17,18]);
await Promise.all((await readdir(out)).filter(file=>/^\d{2}(?:-[a-z]+)?\.svg$/.test(file)&&removedIds.has(Number(file.slice(0,2)))).map(file=>rm(`${out}/${file}`)));
const manifest=shapes.flatMap(([name,body],i)=>{
 const id=i+1;
 if(removedIds.has(id))return [];
 const level=2;
 return families.map(palette=>({id,name,body,palette,level,
  color:subjectColor(palette),
  gradient:{start:mixHex(designSystem.functionalLightPalette[palette][1],designSystem.functionalLightPalette[palette][2],.15),middle:subjectColor(palette),end:mixHex(designSystem.functionalLightPalette[palette][1],designSystem.functionalLightPalette[palette][2],.7)},
  background:designSystem.functionalLightPalette[palette][2],
  backgroundOpacity:0.14,
  file:`${String(id).padStart(2,'0')}${palette===families[i%5]?'':'-'+palette}.svg`}));
});
const svgFor=(s)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160" role="img" aria-label="${s.name}"><defs><linearGradient id="subject" gradientUnits="userSpaceOnUse" x1="28" y1="28" x2="132" y2="132"><stop offset="0" stop-color="${s.gradient.start}"/><stop offset=".45" stop-color="${s.gradient.middle}"/><stop offset="1" stop-color="${s.gradient.end}"/></linearGradient></defs><rect width="160" height="160" fill="${s.background}" fill-opacity="${s.backgroundOpacity}"/><g fill="url(#subject)">${s.body}</g></svg>`;

await Promise.all(manifest.map(s=>writeFile(`${out}/${s.file}`,svgFor(s))));
await writeFile(`${out}/manifest.json`,JSON.stringify(manifest.map(({body,...s})=>s),null,2));
const tiles=manifest.map(s=>`<figure><img class="hero" src="${s.file}" alt="${s.name}"/><figcaption><span>${String(s.id).padStart(2,'0')}</span>${s.name} · ${familyNames[s.palette]}</figcaption><div class="sizes">${[48,32,24].map(n=>`<img src="${s.file}" width="${n}" height="${n}" alt="${n} 像素预览"/>`).join('')}</div></figure>`).join('');
await writeFile(`${out}/index.html`,`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>柔角几何头像 · CatPaw</title><style>
*{box-sizing:border-box}body{margin:0;background:#f7f7f5;color:#282826;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}main{max-width:1280px;margin:auto;padding:48px 40px}header{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;padding-bottom:28px;border-bottom:1px solid #ddd}h1{font-size:28px;font-weight:550;letter-spacing:-.8px;margin:6px 0 10px}p{font-size:14px;color:#777;margin:0;line-height:1.7}.eyebrow{font-size:11px;letter-spacing:2px;color:#888}button{font:inherit;font-size:13px;padding:9px 15px;background:transparent;border:1px solid #ccc;border-radius:8px;color:inherit;cursor:pointer}button:focus-visible{outline:2px solid #7899dc;outline-offset:3px}.grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:0;margin-top:16px}figure{margin:0;padding:22px 12px 20px;text-align:center;border-bottom:1px solid #e5e5e2}.hero{width:118px;height:118px;display:block;margin:0 auto 14px}figcaption{display:flex;justify-content:center;gap:12px;align-items:center;font-size:13px;color:#666}figcaption span{font-size:10px;font-variant-numeric:tabular-nums;color:#999}.sizes{display:flex;height:52px;align-items:center;justify-content:center;gap:16px;margin-top:12px}.dark{background:#202321;color:#eee}.dark p,.dark figcaption{color:#b5b9b5}.dark header,.dark figure{border-color:#3c403c}.dark button{border-color:#555}footer{padding-top:24px;font-size:12px;color:#888}@media(max-width:800px){main{padding:28px 20px}.grid{grid-template-columns:repeat(3,1fr)}.hero{width:96px;height:96px}}@media(max-width:480px){.grid{grid-template-columns:repeat(2,1fr)}header{align-items:start}h1{font-size:24px}}
</style><main><header><div><div class="eyebrow">CATPAW / SHAPE STUDY 03</div><h1>柔角几何头像</h1><p>7 个图形 × 5 种配色 · 柔和渐变主体 · 半透明方底 · 48 / 32 / 24 px</p></div><button id="theme" aria-pressed="false">查看深色底</button></header><div class="grid">${tiles}</div><footer>配色来源：Widget 调整版 functionalLightPalette，所有主体采用统一方向的同色系渐变，以第 2 / 3 阶色值混合，方形背景采用同色系第 3 阶色值，底色不透明度为 14%。</footer></main><script>document.querySelector('#theme').onclick=function(){const dark=document.body.classList.toggle('dark');this.setAttribute('aria-pressed',dark);this.textContent=dark?'查看浅色底':'查看深色底'};</script></html>`);
console.log(`Wrote ${manifest.length} SVG avatars and preview to ${out}`);
