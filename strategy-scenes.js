/* Shared slide-to-Demo mapping. Only implemented interactions belong here. */
(function (root) {
  'use strict';
  const scenes = {
    '1.1': [
      { action: 'prompt-hover-ready', hold: 1200 },
      ...['develop', 'analyze', 'create', 'research'].flatMap(category=>[
        { action: 'prompt-hover-move', category, hold: 1200 },
        { action: 'prompt-hover', category, hold: 1800 },
      ]),
      { action: 'prompt-hover-end' },
    ],
    '1.2': [
      { action: 'prompt-hover-ready', hold: 1200 },
      { action: 'prompt-hover-move', category: 'analyze', hold: 1200 },
      { action: 'prompt-category-click', category: 'analyze', hold: 1000 },
      { action: 'prompt-hover-end' },
    ],
    '1.2-2': [{ action: 'case', focus: '#caseDialogVisual' }],
    '1.3': [
      { action: 'case', hold: 900 },
      { action: 'case-reuse-ready', hold: 350 },
      { action: 'case-reuse-pointer', target: '.case-dialog-skill-block', focus: '.case-dialog-skill-block', hold: 1700 },
      { action: 'case-reuse-pointer', target: '.case-dialog-prompt-box', focus: '.case-dialog-prompt-box', hold: 1900 },
      { action: 'case-reuse-pointer', target: '#caseDialogPrimary', hold: 1200 },
      { action: 'case-reuse-press', hold: 450 },
      { action: 'reuse', hold: 800 },
      { action: 'reuse-composer-pointer', focus: '#composerCard' },
    ],
    '1.3-2': [
      { action: 'greeting-ready', hold: 1200 },
      { action: 'greeting-pointer', hold: 1400 },
      { action: 'greeting-click' },
    ],
    '1.3-3': [
      { action: 'greeting-resume', hold: 1000 },
      { action: 'greeting-zoom-out', hold: 1000 },
      { action: 'prompt-hover-ready', hold: 1000 },
      { action: 'prompt-hover-move', category: 'create', hold: 1200 },
      { action: 'prompt-category-click', category: 'create', hold: 2200 },
      { action: 'prompt-secondary-pointer', index: 1, hold: 1200 },
      { action: 'prompt-secondary-click', index: 1, hold: 2200 },
      { action: 'prompt-hover-end' },
    ],
    '2.1': [
      { action: 'process', frame: 0, hold: 6500 },
      { action: 'process', frame: 1, hold: 2500 },
      { action: 'process', frame: 3, hold: 1200 },
      { action: 'process', frame: 4, hold: 2500 },
      { action: 'process', frame: 6, hold: 1200 },
      { action: 'process', frame: 7, hold: 2500 },
      { action: 'process', frame: 9, hold: 1200 },
      { action: 'process', frame: 10 },
    ],
    '2.1-2': [
      { action: 'process', frame: 0, focus: '.stage-thinking', hold: 1800 },
      { action: 'process-focus', focus: '.stage-acknowledgement', hold: 2200 },
      { action: 'process-focus', focus: '.stage-plan' },
    ],
    '2.1-3': [
      { action: 'process', frame: 1, focus: '.stage-thinking', hold: 2500 },
      { action: 'process-focus', focus: '.stage-tool-call', hold: 3500 },
      { action: 'process', frame: 2, focus: '.stage-current', hold: 4000 },
      { action: 'process', frame: 3, focus: '.stage-checkpoint', hold: 4000 },
      { action: 'process', frame: 4, focus: '.stage-current', hold: 5000 },
      { action: 'process', frame: 6, focus: '.stage-checkpoint:last-of-type', hold: 4000 },
      { action: 'process', frame: 7, focus: '.stage-current' },
    ],
    '2.1-4': [{ action: 'process', frame: 10, focus: '.stage-result' }],
    '2.1-5': [{ action: 'mode-settings', hold: 5000 }, { action: 'development', frame: 4 }],
    '2.3-3': [
      { action: 'supplier-start', focus: '.quote-conditions', hold: 3500 },
      { action: 'supplier-confirm', hold: 1200 },
      { action: 'supplier-pick', format: 'compare', focus: '.quote-formats', hold: 3500 },
      { action: 'supplier-follow-up', focus: '.quote-follow-ups', hold: 3000 },
      { action: 'supplier-generate', focus: '.assistant-message:last-child .quote-report', hold: 4000 },
      { action: 'supplier-note', focus: '.quote-follow-up', hold: 3000 },
      { action: 'supplier-update', focus: '.assistant-message:last-child .quote-report' },
    ],
    '3.1': [
      { action: 'artifact-conversation', frame: 0, hold: 5000 },
      { action: 'artifact-side', frame: 1, kind: 'ppt', hold: 6500 },
      { action: 'artifact-full', frame: 2, kind: 'ppt' },
    ],
    '3.2': [{ action: 'select-page', focus: '.reference-slide' }],
    '3.2-2': [{ action: 'reference-page', focus: '#fullscreenChat' }],
    '3.2-3': [{ action: 'reference-page', focus: '#fullscreenChat', hold: 4500 }, { action: 'reference-another', focus: '#fullscreenChat' }],
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
    async function run(index, token, preview = false, hold = false, initial = false, range = null) {
      if (!active || token !== generation) return;
      await present(steps[index]);
      if (!active || token !== generation) return;
      if (preview) { deactivate(); ready(); return; }
      if (initial) ready();
      if (!hold && index + 1 < steps.length && (!range || index<range.end)) {
        timer=setTimer(()=>run(index+1,token,false,false,false,range),steps[index].hold);
      } else if (!hold && range?.loop && index===range.end) {
        timer=setTimer(()=>{
          if(!active||token!==generation)return;
          reset({restartTask:range.start===0});
          return run(range.start,token,false,false,false,range);
        },steps[index].hold??3000);
      }
    }
    return {
      activate() {
        deactivate();
        active = true;
        reset({restartTask:true});
        return run(0, generation, false, false, true);
      },
      seek(frame, {endFrame=null,loop=false}={}) {
        const index=steps.findIndex(step=>step.frame===frame);
        const end=endFrame===null?null:steps.findIndex(step=>step.frame===endFrame);
        if(index<0 || (end!==null&&end<index))return false;
        deactivate();
        active=true;
        reset({restartTask:false});
        return run(index,generation,false,end===null,true,end===null?null:{start:index,end,loop});
      },
      preview() {
        deactivate();
        active = true;
        reset({restartTask:true});
        return run(0, generation, true, false, true);
      },
      deactivate,
    };
  }
  function processPhaseForFrame(frame) {
    if (!Number.isInteger(frame) || !scenes['2.1'].some(step=>step.frame===frame)) return null;
    return frame===0?'before':frame===10?'after':'working';
  }
  function completedToolTransfer(previous, frameIndex, completed) {
    if (!previous?.current) return null;
    const sequence=scenes['2.1'];
    const previousIndex=sequence.findIndex(step=>step.frame===previous.frame);
    if(previousIndex<0||sequence[previousIndex+1]?.frame!==frameIndex)return null;
    return completed.find(item=>item.id===previous.current.id)||null;
  }
  function spotlightBounds(rect, viewport, clip = null, padding = 8) {
    if (!rect || ![rect.left,rect.top,rect.right,rect.bottom,viewport.width,viewport.height].every(Number.isFinite)) return null;
    const left=Math.max(0,clip?.left??0,rect.left-padding);
    const top=Math.max(0,clip?.top??0,rect.top-padding);
    const right=Math.min(viewport.width,clip?.right??viewport.width,rect.right+padding);
    const bottom=Math.min(viewport.height,clip?.bottom??viewport.height,rect.bottom+padding);
    return right>left&&bottom>top?{left,top,width:right-left,height:bottom-top}:null;
  }
  // A single viewport-sized fill avoids oversized shadow textures inside scaled iframes.
  function spotlightPath(viewport, bounds = null, radius = 8) {
    const { width, height } = viewport;
    if (![width,height].every(value=>Number.isFinite(value)&&value>0)) return '';
    const outside = `M0 0H${width}V${height}H0Z`;
    if (!bounds) return outside;
    const hole = spotlightBounds({left:bounds.left,top:bounds.top,right:bounds.left+bounds.width,bottom:bounds.top+bounds.height},viewport,null,0);
    if (!hole) return outside;
    const { left:x, top:y, width:w, height:h } = hole;
    const r = Math.max(0,Math.min(Number.isFinite(radius)?radius:8,w/2,h/2));
    return `${outside} M${x+r} ${y}H${x+w-r}Q${x+w} ${y} ${x+w} ${y+r}V${y+h-r}Q${x+w} ${y+h} ${x+w-r} ${y+h}H${x+r}Q${x} ${y+h} ${x} ${y+h-r}V${y+r}Q${x} ${y} ${x+r} ${y}Z`;
  }
  const api = { scenes, createPlayer, processPhaseForFrame, spotlightBounds, spotlightPath, completedToolTransfer };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CatPawStrategyScenes = api;
})(typeof window !== 'undefined' ? window : globalThis);
