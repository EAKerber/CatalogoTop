(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const products = document.querySelector('#products');
  const workspace = products?.querySelector('.product-workspace');
  const tabs = Array.from(products?.querySelectorAll('[data-mobile-workspace-target]') || []);
  const panels = Array.from(products?.querySelectorAll('[data-mobile-workspace-panel]') || []);
  const mobile = window.matchMedia('(max-width: 639px)');

  if (!products || !workspace || tabs.length !== 2 || panels.length !== 2) return;

  let current = 'form';
  let gesture = null;

  function show(name) {
    if (!panels.some(panel => panel.dataset.mobileWorkspacePanel === name)) return;
    current = name;

    tabs.forEach(tab => {
      const active = tab.dataset.mobileWorkspaceTarget === name;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });

    panels.forEach(panel => {
      panel.classList.toggle('mobile-workspace-active', panel.dataset.mobileWorkspacePanel === name);
    });
  }

  function syncMode() {
    products.classList.toggle('mobile-workspace-enabled', mobile.matches);
    show(current);
  }

  tabs.forEach(tab => tab.addEventListener('click', () => show(tab.dataset.mobileWorkspaceTarget)));

  products.addEventListener('click', event => {
    if (!mobile.matches) return;
    if (event.target.closest('[data-edit-product], #btnNewProduct')) show('form');
  });

  workspace.addEventListener('touchstart', event => {
    if (!mobile.matches || event.touches.length !== 1) return;
    if (event.target.closest('input, textarea, select, button, a, [contenteditable="true"]')) return;
    const touch = event.touches[0];
    gesture = { x: touch.clientX, y: touch.clientY, time: performance.now() };
  }, { passive: true });

  workspace.addEventListener('touchend', event => {
    if (!gesture || !mobile.matches || event.changedTouches.length !== 1) {
      gesture = null;
      return;
    }

    const touch = event.changedTouches[0];
    const dx = touch.clientX - gesture.x;
    const dy = touch.clientY - gesture.y;
    const elapsed = performance.now() - gesture.time;
    gesture = null;

    if (elapsed > 700 || Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    if (dx < 0 && current === 'form') show('library');
    if (dx > 0 && current === 'library') show('form');
  }, { passive: true });

  if (typeof mobile.addEventListener === 'function') mobile.addEventListener('change', syncMode);
  else mobile.addListener(syncMode);

  NS.MobileWorkspace = { show, current: () => current };
  syncMode();
})();
