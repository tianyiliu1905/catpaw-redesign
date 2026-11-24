const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const referencePlay = document.querySelector('#reference_copy_a');
const referenceReset = document.querySelector('#reference_copy_b');
const catpawPreview = document.querySelector('.copy-stage .copy-glyph');
const copyButton = document.querySelector('#copy-button');
const copyGlyph = copyButton.querySelector('svg');
const feedback = document.querySelector('#copy-feedback');

let previewPlaying = false;
let feedbackTimer;

document.querySelector('#replay').addEventListener('click', () => {
  if (previewPlaying) return;
  previewPlaying = true;
  if (!reducedMotion.matches && typeof referencePlay.beginElement === 'function') {
    referencePlay.beginElement();
    referenceReset.beginElementAt(0.68);
  }
  catpawPreview.setAttribute('data-copied', '');
  setTimeout(() => catpawPreview.removeAttribute('data-copied'), 680);
  setTimeout(() => { previewPlaying = false; }, 1020);
});

copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(document.querySelector('#sample-text').textContent);
    clearTimeout(feedbackTimer);
    copyGlyph.setAttribute('data-copied', '');
    feedback.textContent = '已复制';
    feedbackTimer = setTimeout(() => {
      copyGlyph.removeAttribute('data-copied');
      feedback.textContent = '';
    }, 1200);
  } catch {
    clearTimeout(feedbackTimer);
    copyGlyph.removeAttribute('data-copied');
    feedback.textContent = '复制失败，请检查剪贴板权限';
  }
});
