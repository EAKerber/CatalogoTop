(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};

  function ensureTemplateSurface() {
    const library = document.getElementById('library');
    const switcher = library?.querySelector('.library-provider-switch');
    if (!library || !switcher) return;
    if (!switcher.querySelector('[data-library-provider="templates"]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', 'false');
      button.dataset.libraryProvider = 'templates';
      button.tabIndex = -1;
      button.textContent = 'Templates';
      switcher.appendChild(button);
    }
    if (!library.querySelector('[data-library-provider-panel="templates"]')) {
      const panel = document.createElement('div');
      panel.dataset.libraryProviderPanel = 'templates';
      panel.hidden = true;
      panel.innerHTML = '<div id="templateLibraryRoot"></div>';
      library.appendChild(panel);
    }
    const description = library.querySelector('.section-heading .muted');
    if (description) description.textContent = 'Produtos, catálogos, imagens e templates compartilham a superfície, mas mantêm providers e revisões independentes.';
    if (!document.querySelector('link[data-template-library-style]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'template-library.css';
      link.dataset.templateLibraryStyle = 'true';
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-template-library-script]')) {
      const script = document.createElement('script');
      script.src = 'src/template-library.js';
      script.dataset.templateLibraryScript = 'true';
      document.body.appendChild(script);
    }
  }

  ensureTemplateSurface();
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
