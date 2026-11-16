#!/usr/bin/env node
/** Dependency-free, deterministic SVG avatar generator. Node.js 18+. */
import { generateExpression } from './subagent-expressions.mjs';
import { geometricBody } from './subagent-geometric.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// A shared perceptual lightness/chroma envelope; only hue changes between agents.
const hues = [
  ['blue', 250], ['lavender', 295], ['green', 145], ['mint', 175],
  ['rose', 355], ['coral', 25], ['peach', 55], ['gold', 85],
  ['lime', 115], ['teal', 200], ['sky', 225], ['orchid', 325],
];
function linearRGB(lightness, chroma, hue) {
  const angle = hue * Math.PI / 180;
  const a = chroma * Math.cos(angle), b = chroma * Math.sin(angle);
  const l = (lightness + .3963377774 * a + .2158037573 * b) ** 3;
  const m = (lightness - .1055613458 * a - .0638541728 * b) ** 3;
  const v = (lightness - .0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621*l-3.3077115913*m+.2309699292*v,
    -1.2684380046*l+2.6097574011*m-.3413193965*v,
    -.0041960863*l-.7034186147*m+1.707614701*v];
}
const inGamut = values => values.every(value => value >= 0 && value <= 1);
function sharedChroma(lightness, target) {
  // Reduce chroma for the entire family, never clip one channel and shift its hue.
  let low = 0, high = target;
  for (let i = 0; i < 28; i++) {
    const middle = (low + high) / 2;
    if (hues.every(([, hue]) => inGamut(linearRGB(lightness, middle, hue)))) low = middle;
    else high = middle;
  }
  return Math.floor(low * 10000) / 10000;
}
function toHex(lightness, chroma, hue) {
  return '#' + linearRGB(lightness, chroma, hue).map(value => {
    const srgb = value <= .0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - .055;
    return Math.round(Math.max(0, Math.min(1, srgb)) * 255).toString(16).padStart(2, '0');
  }).join('').toUpperCase();
}
export const colorRules = {
  bodyLightness: .84, bodyChroma: sharedChroma(.84, .09),
  backgroundLightness: .97, backgroundChroma: sharedChroma(.97, .018),
  eyes: '#FFFFFF',
};
export const palettes = hues.map(([name, hue]) => ({
  name, hue,
  medium: toHex(.70, sharedChroma(.70, .10), hue),
  deep: toHex(.55, sharedChroma(.55, .10), hue),
  body: toHex(colorRules.bodyLightness, colorRules.bodyChroma, hue),
  background: toHex(colorRules.backgroundLightness, colorRules.backgroundChroma, hue),
  bodyOKLCH: `oklch(${colorRules.bodyLightness} ${colorRules.bodyChroma} ${hue})`,
  backgroundOKLCH: `oklch(${colorRules.backgroundLightness} ${colorRules.backgroundChroma} ${hue})`,
}));
function randomFrom(seed) {
  let state = 2166136261;
  for (const char of String(seed)) state = Math.imul(state ^ char.codePointAt(0), 16777619);
  return () => {
    state += 0x6D2B79F5;
    let n = Math.imul(state ^ state >>> 15, 1 | state);
    n ^= n + Math.imul(n ^ n >>> 7, 61 | n);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}
const num = value => Number(value.toFixed(2));
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function aspectRange(count) {
  return count <= 5 ? [.85, 1] : count <= 7 ? [.7, .85] : [.55, .7];
}
function ellipseBody(random, count) {
  const [minRatio, maxRatio] = aspectRange(count);
  const axes = () => {
    const rx = num(33 + random() * 8);
    return {rx, ry:num(rx * (minRatio + random() * (maxRatio - minRatio)))};
  };
  const phase = random() * Math.PI * 2;
  const pairs = Math.floor(count / 2);
  const ellipses = [];
  for (let i = 0; i < pairs; i++) {
    // Sample one half-turn; each partner is a 180-degree rotation about (80, 82).
    const angle = phase + (i + (random() - .5) * .22) * Math.PI / pairs;
    const distance = 20 + random() * 6;
    const ellipse = {
      cx:num(80 + Math.cos(angle) * distance), cy:num(82 + Math.sin(angle) * distance),
      ...axes(), rotation:num(angle * 180 / Math.PI),
    };
    ellipses.push(ellipse, {...ellipse, cx:num(160 - ellipse.cx), cy:num(164 - ellipse.cy)});
  }
  // An ellipse is itself centrally symmetric, regardless of its orientation.
  if (count % 2) ellipses.push({cx:80, cy:82, ...axes(), rotation:num(phase * 180 / Math.PI)});
  return ellipses;
}
function insideBody(x, y, ellipses) {
  return ellipses.some(e => {
    const angle = e.rotation * Math.PI / 180, dx = x - e.cx, dy = y - e.cy;
    const localX = dx * Math.cos(angle) + dy * Math.sin(angle);
    const localY = -dx * Math.sin(angle) + dy * Math.cos(angle);
    return (localX / (e.rx - 2)) ** 2 + (localY / (e.ry - 2)) ** 2 <= 1;
  });
}
function eyesFit(ellipses, eyeX, eyeY, eyeGap, tilt) {
  const angle = tilt * Math.PI / 180;
  for (const side of [-1, 1]) for (let i = 0; i < 40; i++) {
    const t = i / 40 * Math.PI * 2;
    const dx = side * eyeGap / 2 + 8.5 * Math.cos(t), dy = 11 * Math.sin(t);
    if (!insideBody(eyeX + dx * Math.cos(angle) - dy * Math.sin(angle),
      eyeY + dx * Math.sin(angle) + dy * Math.cos(angle), ellipses)) return false;
  }
  return true;
}

// Trace the exterior union only; smooth low-frequency deviations mimic a drawn contour.
function sketchContour(ellipses, random) {
  const phase = random()*Math.PI*2;
  const rotation = (18 + random() * 6) * Math.PI / 180;
  const dx = 3+random()*2, dy = -3-random()*2;
  const points = Array.from({length:144}, (_,i) => {
    const a=i/144*Math.PI*2;
    let radius=0;
    for(const e of ellipses) {
      const t=e.rotation*Math.PI/180, c=Math.cos(t), s=Math.sin(t);
      const ux=Math.cos(a)*c+Math.sin(a)*s, uy=-Math.cos(a)*s+Math.sin(a)*c;
      const ox=(80-e.cx)*c+(82-e.cy)*s, oy=-(80-e.cx)*s+(82-e.cy)*c;
      const A=ux*ux/e.rx**2+uy*uy/e.ry**2;
      const B=2*(ox*ux/e.rx**2+oy*uy/e.ry**2);
      const C=ox*ox/e.rx**2+oy*oy/e.ry**2-1;
      const d=B*B-4*A*C;
      if(d>=0) radius=Math.max(radius,(-B+Math.sqrt(d))/(2*A));
    }
    radius += .9*Math.sin(3*a+phase)+.55*Math.sin(7*a-phase);
    return [80+dx+radius*Math.cos(a+rotation),82+dy+radius*Math.sin(a+rotation)];
  });
  const pair=p=>p.map(num).join(' ');
  let path=`M ${pair(points[0])}`;
  for(let i=0;i<points.length;i++) {
    const p0=points[(i+points.length-1)%points.length], p1=points[i];
    const p2=points[(i+1)%points.length], p3=points[(i+2)%points.length];
    const c1=p1.map((v,k)=>v+(p2[k]-p0[k])/6);
    const c2=p2.map((v,k)=>v-(p3[k]-p1[k])/6);
    path+=` C ${pair(c1)} ${pair(c2)} ${pair(p2)}`;
  }
  return path+' Z';
}

export function generateAvatar({ seed = 'catpaw', palette, size = 160, transparent = false, style = 'soft' } = {}) {
  if (!Number.isInteger(size) || size < 16 || size > 4096) throw new Error('size must be an integer from 16 to 4096');
  const random = randomFrom(seed);
  const color = palette === undefined ? palettes[Math.floor(random() * palettes.length)] : palettes.find(p => p.name === palette);
  if (!color) throw new Error(`Unknown palette: ${palette}`);
  if (!['soft', 'geometric'].includes(style)) throw new Error(`Unknown style: ${style}`);
  if (style === 'geometric') {
    const geometry = geometricBody(random, color);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 160 160" role="img" aria-label="${escape(`Subagent ${seed}`)}">${transparent ? '' : `<rect width="160" height="160" rx="34" fill="${color.background}"/>`}${geometry.body}</svg>\n`;
    return {svg, seed:String(seed), palette:color.name, colors:color, style, theme:geometry.theme, shapeCount:geometry.shapeCount, size, transparent};
  }
  const eyeX = 80 + random() * 12 - 3;
  const eyeY = 73 + random() * 6;
  const eyeGap = 26 + random() * 3;
  const tilt = random() * 8 - 4;
  const ellipseCount = 4 + Math.floor(random() * 7);
  let ellipses;
  for (let attempt = 0; attempt < 64; attempt++) {
    ellipses = ellipseBody(random, ellipseCount);
    if (eyesFit(ellipses, eyeX, eyeY, eyeGap, tilt)) break;
  }
  if (!eyesFit(ellipses, eyeX, eyeY, eyeGap, tilt)) {
    // Keep the safety fallback paired too, so eye containment never breaks symmetry.
    const ry = num(41 * aspectRange(ellipseCount)[1]);
    ellipses[0] = {cx:72, cy:82, rx:41, ry, rotation:0};
    ellipses[1] = {cx:88, cy:82, rx:41, ry, rotation:0};
  }
  // Keep random silhouettes at a consistent visual size while leaving the face unchanged.
  const bounds = ellipses.map(e => {
    const angle = e.rotation * Math.PI / 180;
    return {x:Math.abs(e.cx-80)+Math.hypot(e.rx*Math.cos(angle), e.ry*Math.sin(angle)),
      y:Math.abs(e.cy-82)+Math.hypot(e.rx*Math.sin(angle), e.ry*Math.cos(angle))};
  });
  const bodyScale = 120 / (2 * Math.max(...bounds.flatMap(b => [b.x,b.y])));
  ellipses = ellipses.map(e => ({...e, cx:num(80+(e.cx-80)*bodyScale), cy:num(82+(e.cy-82)*bodyScale), rx:num(e.rx*bodyScale), ry:num(e.ry*bodyScale)}));
  const expression = generateExpression(random, color);
  const body = ellipses.map(e => `<ellipse cx="${e.cx}" cy="${e.cy}" rx="${e.rx}" ry="${e.ry}" transform="rotate(${e.rotation} ${e.cx} ${e.cy})"/>`).join('\n');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 160 160" role="img" aria-label="${escape(`Subagent ${seed}`)}">
${transparent ? '' : `<rect width="160" height="160" rx="34" fill="${color.background}"/>`}
<defs>
  <linearGradient id="edge-fade" gradientUnits="userSpaceOnUse" x1="28" y1="132" x2="100" y2="65"><stop offset="0" stop-color="white" stop-opacity="0"/><stop offset="1" stop-color="white"/></linearGradient>
  <linearGradient id="soft-fade" gradientUnits="userSpaceOnUse" x1="28" y1="132" x2="100" y2="65"><stop offset="0" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient>
  <mask id="sharp-edge" maskUnits="userSpaceOnUse" x="0" y="0" width="160" height="160"><rect width="160" height="160" fill="url(#edge-fade)"/></mask>
  <mask id="soft-edge" maskUnits="userSpaceOnUse" x="0" y="0" width="160" height="160"><rect width="160" height="160" fill="url(#soft-fade)"/></mask>
  <filter id="left-soft" filterUnits="userSpaceOnUse" x="0" y="0" width="160" height="160"><feGaussianBlur stdDeviation="3.2"/></filter>
</defs>
<!-- Enlarge the complete character together inside the unchanged tile. -->
<g transform="translate(80 80) scale(1.1) translate(-80 -80)">
<!-- Composite the solid union before filtering; facial features stay above both layers. -->
<g mask="url(#soft-edge)"><g fill="${color.body}" filter="url(#left-soft)">${body}</g></g>
<g mask="url(#sharp-edge)" data-body="ellipse-union"><g fill="${color.body}">${body}</g></g>
${expression.svg}
</g>
</svg>\n`;
  return { svg, seed: String(seed), palette: color.name, colors: color, ellipses, expression:{eyes:expression.eyes,mouth:expression.mouth}, size, transparent };
}

async function main(args) {
  if (args.includes('--help')) {
    console.log('node scripts/generate-subagent-avatars.mjs [--style soft|geometric] [--count 24] [--seed catpaw] [--size 160] [--palette blue|lavender|green|mint|rose|coral|peach|gold|lime|teal|sky|orchid] [--out assets/generated-subagents] [--transparent]');
    return;
  }
  const options = { count: 24, seed: 'catpaw', size: 160, out: resolve(dirname(fileURLToPath(import.meta.url)), '../assets/generated-subagents') };
  for (let i = 0; i < args.length; i++) {
    const key = args[i].replace(/^--/, '');
    if (key === 'transparent') { options.transparent = true; continue; }
    if (!['count', 'seed', 'size', 'palette', 'out', 'style'].includes(key) || !args[i].startsWith('--') || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Invalid option: ${args[i]}`);
    options[key] = ['count', 'size'].includes(key) ? Number(args[++i]) : args[++i];
  }
  if (!Number.isInteger(options.count) || options.count < 1 || options.count > 500) throw new Error('count must be 1–500');
  const output = resolve(options.out);
  const records = Array.from({ length: options.count }, (_, i) => {
    // Lead the default soft set with the selected lavender character; keep its seed intact.
    const sourceIndex = options.seed === 'catpaw' && (!options.style || options.style === 'soft') && options.count > 1
      ? (i === 0 ? 1 : i === 1 ? 0 : i) : i;
    const avatar = generateAvatar({ ...options, seed: `${options.seed}-${sourceIndex + 1}`, palette: options.palette || palettes[sourceIndex % palettes.length].name });
    return { ...avatar, file: `subagent-${String(i + 1).padStart(3, '0')}.svg` };
  });
  await mkdir(output, { recursive: true });
  for (const item of records) await writeFile(join(output, item.file), item.svg);
  await writeFile(join(output, 'palette.json'), JSON.stringify({rules:colorRules, palettes}, null, 2) + '\n');
  await writeFile(join(output, 'manifest.json'), JSON.stringify(records.map(({svg, ...item}) => item), null, 2) + '\n');
  await writeFile(join(output, 'index.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Subagent 形象预览</title><style>*{box-sizing:border-box}body{margin:0;padding:56px 32px;background:#fafafa;color:#282828;font-family:system-ui,"PingFang SC",sans-serif}main{max-width:960px;margin:auto}h1{font-size:26px;margin:0 0 12px}p{color:#777;font-size:14px;line-height:1.8}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:32px 28px;margin-top:40px}figure{margin:0}img{width:150px;height:150px;display:block}figcaption{font-size:12px;color:#777;margin-top:12px;line-height:1.8}.sizes{display:flex;align-items:center;gap:16px;margin-top:12px}.sizes img:nth-child(1){width:24px;height:24px}.sizes img:nth-child(2){width:32px;height:32px}.sizes img:nth-child(3){width:40px;height:40px}code{font-size:12px}</style><main><h1>Subagent / ${options.style === 'geometric' ? '几何构成实验' : '淡彩表情形象'}</h1><p>${options.style === 'geometric' ? '无五官 · 每图 2 个几何元素 · 圆形非必选 · 同色系透叠 · 主元素浅色 / 次元素较深色、65% 不透明度 · 交叠处透出下层 · 圆角与留白<br>' : '随机 4–10 个椭圆 · 数量越多越扁 · 长轴径向排列 · 对角对称 · 5 种眼形 × 4 种嘴形随机组合 · 无外描线 · 12 个受控色相 · 身体明度 84% · 底色明度 97%<br>身体彩度 ' + colorRules.bodyChroma + ' · 底色彩度 ' + colorRules.backgroundChroma + ' · 同色相配对<br>'}Seed：<code>${escape(options.seed)}</code> · 相同 seed 与参数生成相同形象。</p><div class="grid">${records.map(item => `<figure><img src="${item.file}" alt="${escape(item.seed)}"><figcaption>${escape(item.seed)} / ${item.palette} / ${item.theme || `${item.ellipses.length} 个椭圆`}</figcaption><div class="sizes" aria-label="24、32、40 像素预览"><img src="${item.file}" alt="24px"><img src="${item.file}" alt="32px"><img src="${item.file}" alt="40px"></div></figure>`).join('')}</div></main></html>`);
  console.log(`Generated ${records.length} avatars: ${output}\nPreview: ${join(output, 'index.html')}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
