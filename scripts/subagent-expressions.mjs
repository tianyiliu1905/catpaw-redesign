// Small, readable facial primitives inspired by the reference's expression vocabulary.
export function generateExpression(random, color) {
  const eyes = ['dots','closed','happy','squint','wide'];
  const mouths = ['smile','flat','pout','surprised'];
  const eye = eyes[Math.floor(random()*eyes.length)];
  const mouth = mouths[Math.floor(random()*mouths.length)];
  const ink = color.deep;
  const path = (d, width = 3.6) => `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  random(); // Preserve the seeded sequence while all pupils look right.
  const gaze = 2.8;
  const eyeSVG = [-11,11].map((x,i) => {
    if(eye==='dots') return `<ellipse cx="${x}" cy="-5" rx="2.8" ry="3.7" fill="${ink}"/>`;
    if(eye==='closed') return path(`M ${x-4} -6 Q ${x} 0 ${x+4} -6`);
    if(eye==='happy') return path(`M ${x-4} -3 Q ${x} -10 ${x+4} -3`);
    if(eye==='squint') return path(i===0 ? `M ${x-3} -9 L ${x+2} -5 L ${x-3} -1` : `M ${x+3} -9 L ${x-2} -5 L ${x+3} -1`);
    return `<defs><clipPath id="eye-white-${i}"><ellipse cx="${x}" cy="-5" rx="6.7" ry="6.7"/></clipPath></defs><ellipse cx="${x}" cy="-5" rx="6.7" ry="6.7" fill="#FFFFFF"/><ellipse cx="${x+gaze+.5}" cy="-5" rx="3.9" ry="3.9" fill="${ink}" clip-path="url(#eye-white-${i})"/>`;
  }).join('');
  const mouthSVG = {
    smile:path('M -5 7 C -5 12.3 5 12.3 5 7', 3.2),
    flat:path('M -4 9 H 4', 3.2),
    pout:path('M 2 5 Q -5 5 -1 9 Q -5 13 2 13', 3.2),
    surprised:`<ellipse cx="0" cy="9" rx="3.9" ry="4.1" fill="none" stroke="${ink}" stroke-width="3"/>`,
  }[mouth];
  return {eyes:eye,mouth,svg:`<g data-face="${eye}-${mouth}" transform="translate(83 91) scale(1.8975)">${eyeSVG}<g transform="translate(0 9) scale(.85) translate(0 -9)">${mouthSVG}</g></g>`};
}
