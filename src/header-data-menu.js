(function () {
  'use strict';

  const menu = document.getElementById('headerDataMenu');
  if (!menu) return;

  const trigger = menu.querySelector('summary');
  const close = () => menu.removeAttribute('open');

  document.addEventListener('pointerdown', event => {
    if (menu.open && !menu.contains(event.target)) close();
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !menu.open) return;
    close();
    trigger?.focus();
  });

  menu.addEventListener('click', event => {
    if (!event.target.closest('[data-header-menu-close]')) return;
    queueMicrotask(close);
  });

  ['importProductsFile', 'backupFile'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', close);
  });
})();
