/* Shared slide-to-Demo mapping. Only implemented interactions belong here. */
(function (root) {
  'use strict';
  const scenes = {
    '1.1': [{ action: 'home', focus: '#primaryPrompts' }],
    '1.2': [{ action: 'category', category: 'analyze', focus: '#cases' }],
    '1.2-2': [{ action: 'case', focus: '#caseDialogVisual' }],
    '1.2-3': [{ action: 'case', focus: '.case-dialog-copy', hold: 6500 }, { action: 'reuse', focus: '#composerCard' }],
    '1.3': [{ action: 'greeting', focus: '#homeGreeting' }],
    '1.3-2': [{ action: 'category', category: 'create', focus: '#secondaryPrompts', hold: 3000 }, { action: 'suggestion', focus: '#homeGreeting' }],
    '1.3-3': [{ action: 'suggestion', focus: '#composerCard' }],
    '2.1': [
      { action: 'process', frame: 0, hold: 6500 },
      { action: 'process', frame: 1, hold: 5000 },
      { action: 'process', frame: 3, hold: 5000 },
      { action: 'process', frame: 5, hold: 5000 },
      { action: 'process', frame: 7 },
    ],
    '2.1-2': [{ action: 'mode-settings', hold: 5000 }, { action: 'development', frame: 3 }],
    '2.3': [{ action: 'process', frame: 7, hold: 5500 }, { action: 'result-file' }],
    '2.3-2': [{ action: 'process', frame: 7, thinking: true, hold: 6000 }, { action: 'result-file' }],
    '3.1': [{ action: 'artifact-conversation', focus: '.conversation-artifacts' }],
    '3.1-2': [{ action: 'artifact-side', kind: 'ppt', hold: 6500 }, { action: 'artifact-side', kind: 'word' }],
    '3.1-3': [{ action: 'artifact-full', kind: 'ppt' }],
    '3.2': [{ action: 'select-page', focus: '.reference-slide' }],
    '3.2-2': [{ action: 'reference-page', focus: '#conversationComposer' }],
    '3.2-3': [{ action: 'reference-page', focus: '#conversationComposer', hold: 4500 }, { action: 'reference-another', focus: '#conversationComposer' }],
  };

  // One player per iframe; leaving a slide invalidates every pending callback.
  function createPlayer({ scene, snapshotFrame = null, reset, present, stop, ready, setTimer = setTimeout, clearTimer = clearTimeout }) {
    const configured = scenes[scene];
    if (!configured) throw new Error(`Unknown strategy scene: ${scene}`);
    const steps = snapshotFrame === null ? configured : configured.filter(step => step.frame === snapshotFrame);
    if (!steps.length) throw new Error(`Unknown snapshot frame: ${scene}/${snapshotFrame}`);
    let generation = 0, timer = null, active = false;
    function deactivate() {
      active = false;
      generation++;
      clearTimer(timer);
      timer = null;
      stop();
    }
    async function run(index, token, preview = false) {
      if (!active || token !== generation) return;
      await present(steps[index]);
      if (!active || token !== generation) return;
      if (preview) { deactivate(); ready(); return; }
      if (index === 0) ready();
      if (index + 1 < steps.length) timer = setTimer(() => run(index + 1, token), steps[index].hold);
    }
    return {
      activate() {
        deactivate();
        active = true;
        reset();
        return run(0, generation);
      },
      preview() {
        deactivate();
        active = true;
        reset();
        return run(0, generation, true);
      },
      deactivate,
    };
  }
  const api = { scenes, createPlayer };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CatPawStrategyScenes = api;
})(typeof window !== 'undefined' ? window : globalThis);
