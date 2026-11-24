(() => {
  const workspace = document.querySelector('.background-workspace');
  const field = workspace.querySelector('.matrix-field');
  const matrix = workspace.querySelector('.matrix-pattern');
  const play = document.getElementById('background-play');
  const replay = document.getElementById('background-replay');
  const speed = document.getElementById('background-speed');
  const strength = document.getElementById('background-strength');
  const strengthValue = document.getElementById('background-strength-value');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let playing = !reducedMotion.matches;

  const codeRows = [
    'const frame = scene.sample(time);',
    'for (const point of grid) {',
    '  const { x, y } = point;',
    '  const phase = (x + y) % 16;',
    '  const weight = Math.sin(phase);',
    '  layer.set(x, y, weight);',
    '}',
    'view.draw(layer, frame);'
  ];

  // Points and code glyphs share the same fixed grid and brightness phases.
  function renderMatrix(pattern) {
    const bands = Array.from({ length: 16 }, () => []);
    const usesCode = pattern === 'code';
    for (let row = 0; row < 24; row++) {
      const code = codeRows[row % codeRows.length].padStart(36 + row % 5, ' ');
      for (let column = 0; column < 48; column++) {
        let phase = column + Math.floor(row / 2);
        let radius = (column + row * 7) % 11 === 0 ? 2 : 1.35;
        if (pattern === 'rings') {
          phase = Math.floor(Math.hypot(column - 23.5, row - 11.5) * 1.5);
          radius = phase % 8 < 2 ? 2.1 : 1.15;
        } else if (pattern === 'checker') {
          const square = (Math.floor(column / 4) + Math.floor(row / 4)) % 2;
          phase = square * 8;
          radius = square === 0 ? 1.9 : 1.3;
        }
        const x = 9 + 18 * column;
        const y = 9 + 18 * row;
        const band = bands[phase % bands.length];
        if (usesCode) {
          const character = code[column];
          if (character && character !== ' ') band.push({ x, y, character });
          continue;
        }
        band.push(`M${x - radius} ${y}a${radius} ${radius} 0 1 0 ${2 * radius} 0a${radius} ${radius} 0 1 0 ${-2 * radius} 0Z`);
      }
    }

    const layers = bands.flatMap((cells, phase) => {
      if (!cells.length) return [];
      const layer = document.createElementNS('http://www.w3.org/2000/svg', usesCode ? 'text' : 'path');
      layer.classList.add('matrix-band');
      if (usesCode) {
        layer.setAttribute('x', cells.map(cell => cell.x).join(' '));
        layer.setAttribute('y', cells.map(cell => cell.y).join(' '));
        layer.textContent = cells.map(cell => cell.character).join('');
      } else {
        layer.setAttribute('d', cells.join(''));
      }
      layer.style.animationDelay = `${(phase - bands.length) * 400}ms`;
      return layer;
    });
    field.dataset.pattern = pattern;
    matrix.replaceChildren(...layers);
  }

  function syncPlayback({ reset = false } = {}) {
    const shouldPlay = playing && !document.hidden && !reducedMotion.matches;
    const rate = Number(speed.value);
    for (const animation of workspace.getAnimations({ subtree: true })) {
      if (reset) animation.currentTime = 0;
      if (animation.playbackRate !== rate) animation.updatePlaybackRate(rate);
      if (shouldPlay && animation.playState === 'paused') animation.play();
      else if (!shouldPlay && animation.playState === 'running') animation.pause();
    }
    play.textContent = reducedMotion.matches ? '系统已减少动态效果' : playing ? '暂停' : '播放';
    play.disabled = replay.disabled = speed.disabled = reducedMotion.matches;
  }

  workspace.querySelector('.motion-pattern-selector').addEventListener('change', event => {
    renderMatrix(event.target.value);
    syncPlayback();
  });
  play.addEventListener('click', () => {
    playing = !playing;
    syncPlayback();
  });
  replay.addEventListener('click', () => {
    playing = true;
    syncPlayback({ reset: true });
  });
  speed.addEventListener('change', () => syncPlayback());
  strength.addEventListener('input', () => {
    workspace.style.setProperty('--texture-strength', Number(strength.value) / 100);
    strengthValue.value = `${strength.value}%`;
  });
  reducedMotion.addEventListener('change', () => {
    playing = false;
    syncPlayback();
  });
  document.addEventListener('visibilitychange', () => syncPlayback());

  renderMatrix(workspace.querySelector('[name="matrix-pattern"]:checked').value);
  syncPlayback();
})();
