(function () {
  'use strict';

  const A4_WIDTH_CSS_PX = 210 * 96 / 25.4;
  const MIN_SCALE = 0.24;
  const MAX_SCALE = 1.6;
  const STEP = 0.12;

  const root = document.getElementById('catalogPreview');
  const viewport = document.getElementById('catalogPreviewViewport');
  const value = document.getElementById('previewZoomValue');
  const fitButton = document.getElementById('btnPreviewFit');
  const outButton = document.getElementById('btnPreviewZoomOut');
  const inButton = document.getElementById('btnPreviewZoomIn');

  if (!root || !viewport || !value || !fitButton || !outButton || !inButton) return;

  let mode = window.matchMedia('(max-width: 959px)').matches ? 'fit' : 'actual';
  let scale = 1;

  function clamp(number, min, max) {
    return Math.min(max, Math.max(min, number));
  }

  function fitScale() {
    const available = Math.max(1, viewport.clientWidth - 8);
    return clamp(Math.min(1, available / A4_WIDTH_CSS_PX), MIN_SCALE, 1);
  }

  function apply(nextScale) {
    scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    root.style.setProperty('--preview-scale', scale.toFixed(4));
    value.textContent = `${Math.round(scale * 100)}%`;
    fitButton.classList.toggle('active', mode === 'fit');
    fitButton.setAttribute('aria-pressed', mode === 'fit' ? 'true' : 'false');
    outButton.disabled = scale <= MIN_SCALE + .001;
    inButton.disabled = scale >= MAX_SCALE - .001;
  }

  function fit() {
    mode = 'fit';
    apply(fitScale());
    viewport.scrollLeft = 0;
  }

  function setManual(nextScale) {
    mode = 'manual';
    apply(nextScale);
  }

  outButton.addEventListener('click', () => setManual(scale - STEP));
  inButton.addEventListener('click', () => setManual(scale + STEP));
  fitButton.addEventListener('click', fit);

  const resizeObserver = new ResizeObserver(() => {
    if (mode === 'fit') fit();
  });
  resizeObserver.observe(viewport);

  const mutationObserver = new MutationObserver(() => {
    if (mode === 'fit') requestAnimationFrame(fit);
  });
  mutationObserver.observe(root, { childList: true });

  window.addEventListener('catalogotop:preview-fit', fit);

  if (mode === 'fit') requestAnimationFrame(fit);
  else apply(1);

  window.CatalogoTop = window.CatalogoTop || {};
  window.CatalogoTop.PreviewZoom = {
    fit,
    getScale: () => scale,
    getMode: () => mode
  };
})();
