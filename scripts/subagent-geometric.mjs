// Two-scale geometric compositions. Shape choice is independent of layout.
export function geometricBody(random, color) {
  const themes = ['斜向 / Diagonal', '平衡 / Balance', '层叠 / Layers', '节奏 / Rhythm'];
  const themeIndex = Math.floor(random() * themes.length);
  const layouts = [
    [[66,69,-15],[101,101,15],[113,39,-30]],
    [[70,87,0],[103,53,15],[39,37,0]],
    [[74,73,15],[91,99,-15],[42,114,30]],
    [[61,79,-15],[109,76,-15],[112,121,-15]],
  ];
  const kinds = ['circle','rectangle','triangle','star'];
  // Different primitives, shuffled per seed; the circle is optional, never a fixed ornament.
  const first = Math.floor(random()*kinds.length);
  const types = [first, (first+1+Math.floor(random()*(kinds.length-1)))%kinds.length];
  if (random()<.5) types.forEach((type,i) => { if(type===0) types[i]=1; }); // Some studies contain no circle at all.
  const sizes = [88,63];
  const fills = [color.body,color.deep];
  const shapes = layouts[themeIndex].slice(0,2).map(([x,y,angle],i) => {
    const type=kinds[types[i]], size=sizes[i], fill=fills[i];
    let body;
    if(type==='circle') body=`<circle r="${size/2}" fill="${fill}"/>`;
    else if(type==='rectangle') body=`<rect x="${-size/2}" y="${-size*.4}" width="${size}" height="${size*.8}" rx="${size*.14}" fill="${fill}"/>`;
    else if(type==='star') {
      const points = Array.from({length:8},(_,j) => {
        const a = -Math.PI/2+j*Math.PI/4, r = size*(j%2 ? .24 : .5);
        return [Math.cos(a)*r,Math.sin(a)*r];
      });
      const mix = (a,b) => a.map((v,k) => v*.84+b[k]*.16);
      const corners = points.map((p,j) => ({p, before:mix(p,points[(j+7)%8]), after:mix(p,points[(j+1)%8])}));
      const d = corners.map(({p,before,after},j) => `${j ? 'L' : 'M'} ${before.join(' ')} Q ${p.join(' ')} ${after.join(' ')}`).join(' ')+' Z';
      body=`<path data-shape="star" d="${d}" fill="${fill}"/>`;
    }
    else body=`<path d="M -4 -32 Q 0 -39 4 -32 L 34 24 Q 38 31 30 31 L -30 31 Q -38 31 -34 24 Z" fill="${fill}" transform="scale(${size/72})"/>`;
    return `<g opacity="${i === 0 ? 1 : .65}" data-size="${['large','small'][i]}" transform="translate(${x} ${y}) rotate(${angle})">${body}</g>`;
  });
  const rotation = [0,90,180,270][Math.floor(random()*4)];
  return {body:`<g transform="rotate(${rotation} 80 80)">${shapes.join('')}</g>`, theme:themes[themeIndex], shapeCount:2};
}
