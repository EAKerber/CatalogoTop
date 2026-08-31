(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const buttons = Array.from(document.querySelectorAll('[data-library-provider]'));
  const panels = Array.from(document.querySelectorAll('[data-library-provider-panel]'));
  if (!buttons.length || !panels.length) return;

  let activeProvider = buttons.find(button => button.classList.contains('active'))?.dataset.libraryProvider || 'products';

  function show(provider) {
    const next = buttons.some(button => button.dataset.libraryProvider === provider) ? provider : 'products';
    activeProvider = next;
    buttons.forEach(button => {
      const active = button.dataset.libraryProvider === next;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    panels.forEach(panel => {
      panel.hidden = panel.dataset.libraryProviderPanel !== next;
    });
    window.dispatchEvent(new CustomEvent('catalogotop:library-provider-changed', { detail: { provider: next } }));
  }

  buttons.forEach(button => button.addEventListener('click', () => show(button.dataset.libraryProvider)));
  window.addEventListener('catalogotop:tab-changed', event => {
    if (event.detail?.tabId === 'library') show(activeProvider);
  });

  NS.LibraryShell = Object.freeze({ show, getActiveProvider: () => activeProvider });
  show(activeProvider);
})();
