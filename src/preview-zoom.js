(function () {
  'use strict';

  const A4_WIDTH_CSS_PX = 210 * 96 / 25.4;
  const MIN_SCALE = 0.24;
  const DESKTOP_MAX_SCALE = 0.8;
  const MOBILE_MAX_SCALE = 1;
  const STEP_RATIO = 0.12;

  const root = document.getElementById('catalogPreview');
  const viewport = document.getElementById('catalogPreviewViewport');
  const value = document.getElementById('previewZoomValue');
  const fitButton = document.getElementById('btnPreviewFit');
  const outButton = document.getElementById('btnPreviewZoomOut');
  const inButton = document.getElementById('btnPreviewZoomIn');

  if (!root || !viewport || !value || !fitButton || !outButton || !inButton) return;

  const desktop = window.matchMedia('(min-width: 1180px)');
  let mode = desktop.matches ? 'actual' : 'fit';
  let scale = desktop.matches ? DESKTOP_MAX_SCALE : 1;

  function clamp(number, min, max) {
    return Math.min(max, Math.max(min, number));
  }

  function maxScale() {
    return desktop.matches ? DESKTOP_MAX_SCALE : MOBILE_MAX_SCALE;
  }

  function displayPercent(nextScale = scale) {
    const reference = maxScale();
    return Math.round((nextScale / reference) * 100);
  }

  function fitScale() {
    const available = Math.max(1, viewport.clientWidth - 8);
    return clamp(Math.min(maxScale(), available / A4_WIDTH_CSS_PX), MIN_SCALE, maxScale());
  }

  function apply(nextScale) {
    scale = clamp(nextScale, MIN_SCALE, maxScale());
    root.style.setProperty('--preview-scale', scale.toFixed(4));
    value.textContent = `${displayPercent(scale)}%`;
    fitButton.classList.toggle('active', mode === 'fit');
    fitButton.setAttribute('aria-pressed', mode === 'fit' ? 'true' : 'false');
    outButton.disabled = scale <= MIN_SCALE + .001;
    inButton.disabled = scale >= maxScale() - .001;
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

  function stepSize() {
    return maxScale() * STEP_RATIO;
  }

  outButton.addEventListener('click', () => setManual(scale - stepSize()));
  inButton.addEventListener('click', () => setManual(scale + stepSize()));
  fitButton.addEventListener('click', fit);

  const resizeObserver = new ResizeObserver(() => {
    if (mode === 'fit') fit();
  });
  resizeObserver.observe(viewport);

  const mutationObserver = new MutationObserver(() => {
    if (mode === 'fit') requestAnimationFrame(fit);
  });
  mutationObserver.observe(root, { childList: true });

  desktop.addEventListener?.('change', event => {
    if (event.matches) {
      mode = 'actual';
      apply(DESKTOP_MAX_SCALE);
      viewport.scrollLeft = 0;
    } else {
      fit();
    }
  });

  window.addEventListener('catalogotop:preview-fit', fit);

  if (mode === 'fit') requestAnimationFrame(fit);
  else apply(DESKTOP_MAX_SCALE);

  window.CatalogoTop = window.CatalogoTop || {};
  window.CatalogoTop.PreviewZoom = {
    fit,
    getScale: () => scale,
    getMode: () => mode,
    getDisplayPercent: () => displayPercent(scale),
    getMaxScale: maxScale
  };
})();