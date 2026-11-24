/* Motion for the catalog only. The SVG that is displayed at rest and exported stays intact. */
(() => {
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const easeOut = 'cubic-bezier(.23, 1, .32, 1)';
  const midpoint = .38;
  const track = (target, action, { delay = 0, origin = '12px 12px', duration = 250 } = {}) => ({
    target, action, delay, origin, duration
  });
  const move = (target, x, y, options) => track(target, `translate(${x}px, ${y}px)`, options);
  const turn = (target, angle, options) => track(target, `rotate(${angle}deg)`, options);
  const scale = (target, x, y, options) => track(target, `scale(${x}, ${y})`, options);
  const marks = (target, options) => scale(target, .75, .75, options);
  const openPages = [move(1, 0, -2.6)];
  const split = (index, ...paths) => ({ index, paths });
  const terminal = [scale(1, .76, 1, { origin: '7px 12px' })];
  const addMark = [marks(1, { origin: '12px 11.5px' })];
  const splitArrows = [
    split(0, 'm14 10 7-7m-7 0h7v7', 'M10 14l-7 7m0-7v7h7')
  ];
  const splitClose = [
    split(1, 'M15 3v18', 'M10 13l-2-2 2-2')
  ];
  const splitOpen = [
    split(1, 'M15 3v18', 'M8 13l2-2-2-2')
  ];

  const motions = {
    'new-task': addMark,
    'scheduled-task': [turn(1, 40, { origin: '12px 12.4px' })],
    'experts-skills-connectors': [turn(1, -12, { origin: '12px 16px' })],
    library: [track(2, [
      { transform: 'scaleX(1) skewY(0deg)', opacity: 0, easing: 'ease-in-out' },
      { transform: 'scaleX(.78) skewY(-15deg)', opacity: 1, offset: .23 },
      { transform: 'scaleX(.06) skewY(-18deg)', opacity: 1, offset: .49 },
      { transform: 'scaleX(-.72) skewY(-11deg)', opacity: 1, offset: .76, easing: 'ease-out' },
      { transform: 'scaleX(-1) skewY(0deg)', opacity: 0 }
    ], { origin: '12px 12px', duration: 480 })],
    'design-resources': [move(1, .7, -1.5), scale(2, 1, .72, { origin: '12px 16px', delay: 48 })],
    folder: [move(1, 0, 2)],
    'open-folder': [
      scale([1, 2], 1, .70, { origin: '12px 21px' }),
      track(3, [
        { transform: 'scaleY(0)', easing: easeOut },
        { transform: 'scaleY(1)', offset: midpoint, easing: 'ease-in-out' },
        { transform: 'scaleY(0)' }
      ], { origin: '12px 11.2px' })
    ],
    'new-folder': [marks(1, { origin: '12px 13.5px' })],
    'website-nocode': [scale(1, 1, .14, { origin: '12px 11.5px' })],

    'request-user-input': [move([1, 2], 0, -2)],
    home: [scale(0, 1, .83, { origin: '12px 21px' }), move(1, 0, 1.3)],
    apps: [scale(0, .70, .70, { origin: '6.5px 6.5px' }), scale(1, .70, .70, { origin: '17.5px 6.5px', delay: 35 }),
      scale(2, .70, .70, { origin: '6.5px 17.5px', delay: 70 }), scale(3, .70, .70, { origin: '17.5px 17.5px', delay: 105 })],
    'design-system': [scale(1, 1, .72, { origin: '12px 21px' })],
    settings: [turn(0, 60, { duration: 300 })],
    check: [marks('glyph', { origin: '9.5px 16.5px' })],
    'status-complete': [marks(1)],
    'status-incomplete': [scale(0, .78, .78)],
    'status-in-progress': [{ ...turn('glyph', 360, { duration: 580 }), onceAround: true }],
    target: [scale(0, .88, .88), scale(1, 1.35, 1.35, { delay: 52 }), scale(2, .91, .91)],
    pet: [scale(1, 1, .26, { origin: '12px 14px' })],
    'task-list': [marks(1, { origin: '8.5px 10px' })],
    subagent: [move(1, -1.2, 1.2, { delay: 55 }), move(2, 1.2, 1.2, { delay: 105 })],

    'collapse-all': [move(0, 0, 2.2), move(1, 0, -2.2)],
    'expand-all': [move(0, 0, -2.2), move(1, 0, 2.2)],
    sort: [move(0, 0, 2), move(1, 0, -2)],
    'project-view': [move([0, 2], 0, -1.4), move([1, 3], 0, 1.4, { delay: 45 })],
    'list-view': [scale(0, .8, 1, { origin: '4px 12px' })],
    updated: [turn('glyph', -24)],
    layers: [move(0, 0, -1.8), move(1, 0, -1, { delay: 44 })],

    conversation: [scale('glyph', .9, .86, { origin: '5px 19px' })],
    'add-to-conversation': addMark,
    plus: [marks('glyph')],
    shortcuts: terminal,
    close: [track('glyph', 'rotate(18deg) scale(.78)')],
    delete: [turn(0, -17, { origin: '4px 7.5px' })],
    pause: [move(0, 1.4, 0), move(1, -1.4, 0)],
    play: [move('glyph', 2.6, 0)],
    send: [move('glyph', 0, -2.8)],
    'chevron-right': [move('glyph', 2.7, 0)],
    'chevron-down': [move('glyph', 0, 2.6)],
    more: [move(0, 0, -2, { duration: 180 }), move(1, 0, -2, { duration: 180, delay: 55 }), move(2, 0, -2, { duration: 180, delay: 110 })],
    copy: [move(1, 2, 2)],
    attachment: [turn('glyph', 15, { origin: '18px 9px' })],
    upload: [move(0, 0, -2.3), move(1, 0, .65, { delay: 65, duration: 180 })],
    download: [move(0, 0, 2.1), move(1, 0, .85, { delay: 80, duration: 180 })],
    'thumbs-up': [turn('glyph', -16, { origin: '6px 17px' })],
    'thumbs-down': [turn('glyph', -16, { origin: '18px 7px' })],
    info: [move(1, 0, -1.8)],
    'access-full': [turn(1, 19, { origin: '8px 10px' })],
    'safe-house': [marks(1)],
    branch: [move(2, 0, -1.8), marks(1, { delay: 85, origin: '6px 18px' })],
    avatar: [scale(2, 1, .16, { origin: '12px 13.5px' })],

    'panel-left': [move(1, -3.5, 0)],
    'panel-right': [move(1, 3.5, 0)],
    'panel-close': [move(2, -2.5, 0)],
    'panel-open': [move(2, 2.5, 0)],
    maximize: [move(0, 1.35, -1.35), move(1, -1.35, 1.35)],
    minimize: [move(0, 2.2, 2.2), move(1, -2.2, -2.2)],
    file: [scale(1, .63, .76, { origin: '14px 3.5px' })],
    mcp: [move(0, -1, -.7), move(2, 1, .7, { delay: 35 })],
    link: [move(0, 1.65, 0), move(1, -1.65, 0)],
    connector: [move('glyph', 1.55, -1.55)],
    expert: [scale(1, .83, .88, { delay: 30 })],
    browser: [scale(2, .35, 1)],
    terminal,
    search: [track('glyph', 'translate(1.7px, -1.1px) rotate(-12deg)', { origin: '10.5px 10.5px' })],
    back: [move('glyph', -2.5, 0)],
    forward: [move('glyph', 2.5, 0)],
    undo: [turn('glyph', -20)],
    redo: [turn('glyph', 20)],
    'toolbox-closed': [move(0, 0, -1.7), marks(3, { delay: 60, origin: '12px 13px' })],
    'toolbox-open': [move(0, 0, -1.5)],
    'slide-transition': [move(2, 2.1, 0), scale(1, 1.10, 1.06, { origin: '18px 12px', delay: 85 })],
    refresh: [{ ...turn('glyph', -360, { duration: 520 }), onceAround: true }],

    'web-development': [scale(2, .68, 1, { origin: '7px 15px' }), move(3, .85, 0, { delay: 50 })],
    dashboard: [scale(1, 1, .48, { origin: '9px 16.4px' }), scale(2, 1, .48, { origin: '13px 16.4px', delay: 48 }),
      scale(3, 1, .48, { origin: '17px 16.4px', delay: 96 })],
    'organize-files': [move(1, 0, 1.5)],
    slides: [scale(2, .68, 1, { origin: '7px 8px' }), scale(3, .68, 1, { origin: '7px 12px', delay: 48 })],
    write: [track(1, [
      { transform: 'none' },
      { transform: 'translate(0, 1.5px) rotate(3deg)', offset: .22 },
      { transform: 'translate(2.5px, 1.4px) rotate(-5deg)', offset: .59 },
      { transform: 'translate(1.5px, -.8px) rotate(-8deg)', offset: .78, easing: easeOut },
      { transform: 'none' }
    ], { origin: '5px 18px', duration: 280 })],
    phone: [turn('glyph', -9, { origin: '12px 20px' }), move(1, 0, -.8, { delay: 48 })],
    sun: [turn(1, 45, { duration: 290 })],
    moon: [turn('glyph', 18)],
    'app-store': [turn(1, -26, { origin: '13px 6px' })],
    android: [turn(2, -16, { origin: '4px 12px' }), turn(3, 17, { origin: '20px 12px', delay: 45 })]
  };

  // Separate connected drawing commands only where the animated parts need independent geometry.
  const separations = {
    'collapse-all': [split(0, 'm7 5 5 5 5-5', 'M7 19l5-5 5 5')],
    'expand-all': [split(0, 'm7 10 5-5 5 5', 'M7 14l5 5 5-5')],
    sort: [split(0, 'M7 4v16m-3-3 3 3 3-3', 'M17 20V4m-3 3 3-3 3 3')],
    'project-view': [split(2, 'M7 7h5', 'M7 17.5h5')],
    layers: [split(0, 'M4.1 7.3 11.1 3.4q.9-.5 1.8 0l7 3.9q1.2.7 0 1.4l-7 3.9q-.9.5-1.8 0l-7-3.9q-1.2-.7 0-1.4Z', 'M3.8 12.5l7.3 4.1q.9.5 1.8 0l7.3-4.1', 'M3.8 17l7.3 4.1q.9.5 1.8 0l7.3-4.1')],
    delete: [split(0, 'M4 7.5h16M9 7.5V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2.5', 'M5.5 7.5l.8 11.3A2.4 2.4 0 0 0 8.7 21h6.6a2.4 2.4 0 0 0 2.4-2.2l.8-11.3M10 11.5v6M14 11.5v6')],
    more: [split(0, 'children')],
    'access-full': [split(1, 'M8 10V7a4 4 0 0 1 7.7-1.5', 'M12 14.5v2')],
    'panel-close': splitClose,
    'panel-open': splitOpen,
    maximize: splitArrows,
    minimize: [split(0, 'M3 3l7 7M5 10h5V5', 'M21 21l-7-7m5 0h-5v5')],
    link: [split(0, 'M10.2 6H8.5a6 6 0 0 0 0 12h1.7', 'M13.8 6h1.7a6 6 0 0 1 0 12h-1.7', 'M8 12h8')],
    browser: [split(1, 'M3 12h18', 'M12 3c-2.5 2.5-3.8 5.5-3.8 9s1.3 6.5 3.8 9c2.5-2.5 3.8-5.5 3.8-9S14.5 5.5 12 3Z')],
    'web-development': [split(1, 'M3 9h18', 'M7 13.5h10M7 16.5h6.5')],
    dashboard: [split(0, 'M3 5v12a3 3 0 0 0 3 3h15', 'M9 16.4v-5', 'M13 16.4v-10', 'M17 16.4v-8')],
    slides: [split(1, 'M12 17v4m-5 0h10', 'M7 8h10', 'M7 12h6')],
    write: [split(0, 'M5 21h14', 'M6 14l9.5-9.5a2.1 2.1 0 0 1 3 3L9 17l-4 1 1-4Z')],
    'app-store': [split(0, 'children')],
    android: [split(0, 'children')]
  };

  const movingPaths = {
    // The side edges extend by the same 2.94 grid units that the front edge lowers.
    'open-folder': { d: 'M3 11.2v2.94M21 11.2v2.94', 'stroke-linecap': 'butt' },
    // The turning sheet follows the right page at rest and pivots around the spine.
    library: { d: 'M12 20.5c2.1-1.4 4.8-1.8 7.6-1.1.7.2 1.4-.3 1.4-1V7.2a2.1 2.1 0 0 0-1.6-2.1c-2.7-.6-5.3-.3-7.4 1.2' }
  };

  let previewId = 0;
  function makePreview(svg) {
    const preview = svg.cloneNode(true);
    preview.setAttribute('aria-hidden', 'true');
    preview.removeAttribute('role');
    preview.removeAttribute('aria-label');
    preview.classList.add('motion-layer');
    const suffix = `-animated-${++previewId}`;
    for (const node of preview.querySelectorAll('[id]')) {
      const oldId = node.id;
      node.id += suffix;
      for (const reference of preview.querySelectorAll('*')) {
        for (const attribute of reference.attributes) {
          if (attribute.value === `url(#${oldId})`) attribute.value = `url(#${node.id})`;
        }
      }
    }
    return preview;
  }

  function separateParts(glyph, filename) {
    for (const { index, paths } of separations[filename] ?? []) {
      const part = glyph.children[index];
      // Keep the source group itself when its children inherit fill or stroke.
      if (paths[0] === 'children') {
        const pieces = [...part.children].map(child => {
          const piece = part.cloneNode(false);
          piece.append(child);
          return piece;
        });
        part.replaceWith(...pieces);
        continue;
      }
      if (filename === 'dashboard') {
        part.replaceWith(...paths.map(d => {
          const piece = document.createElementNS(svgNamespace, 'path');
          piece.setAttribute('d', d);
          return piece;
        }));
        continue;
      }
      part.replaceWith(...paths.map(d => {
        const piece = part.cloneNode(false);
        piece.setAttribute('d', d);
        return piece;
      }));
    }
  }

  function buildMotion(svg, filename) {
    const name = filename.replace(/\.svg$/, '');
    const recipes = motions[name] ?? (/^open-pages-(?:[1-9]|9-plus)$/.test(name) ? openPages : null);
    if (!recipes) throw new Error(`Missing preview motion for ${filename}`);
    const preview = makePreview(svg);
    const glyph = document.createElementNS(svgNamespace, 'g');
    glyph.append(...Array.from(preview.children).filter(part => part.localName !== 'defs'));
    preview.append(glyph);
    separateParts(glyph, name);
    if (Object.hasOwn(movingPaths, name)) {
      const path = document.createElementNS(svgNamespace, 'path');
      for (const [attribute, value] of Object.entries(movingPaths[name])) path.setAttribute(attribute, value);
      glyph.append(path);
    }
    const parts = Array.from(glyph.children);

    const tracks = recipes.map(recipe => {
      if (recipe.target === 'glyph') return { ...recipe, layer: glyph };
      const indices = Array.isArray(recipe.target) ? recipe.target : [recipe.target];
      const layer = document.createElementNS(svgNamespace, 'g');
      parts[indices[0]].before(layer);
      for (const index of indices) layer.append(parts[index]);
      return { ...recipe, layer };
    });
    return { preview, tracks };
  }

  window.playIconPreview = (svg, filename) => {
    const { preview, tracks } = buildMotion(svg, filename);
    svg.after(preview);
    const animations = tracks.map(({ layer, action, delay, duration, origin, onceAround }) => {
      layer.style.transformOrigin = origin;
      const customFrames = Array.isArray(action);
      const frames = customFrames ? action : onceAround
        ? [{ transform: 'none' }, { transform: action }]
        : [
            { transform: 'none', easing: easeOut },
            { transform: action, offset: midpoint, easing: 'ease-in-out' },
            { transform: 'none' }
          ];
      return layer.animate(frames, { duration, delay, fill: customFrames ? 'both' : 'none' });
    });
    const finished = Promise.allSettled(animations.map(animation => animation.finished));
    const stop = () => {
      animations.forEach(animation => animation.cancel());
      preview.remove();
    };
    finished.then(stop);
    return { finished, stop };
  };
})();
