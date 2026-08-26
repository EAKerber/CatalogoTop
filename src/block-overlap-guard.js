(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const root = document.getElementById('selectableProducts');
  if (!root || !NS.Core) return;

  function visibleSelectedIds() {
    return Array.from(root.querySelectorAll(':scope > .select-product'))
      .map(label => label.querySelector('[data-select-product]'))
      .filter(checkbox => checkbox?.checked)
      .map(checkbox => String(checkbox.dataset.selectProduct));
  }

  function tableMembers() {
    const blocks = NS.Core.getState().catalog?.presentation?.blocks;
    const ids = new Set();
    (Array.isArray(blocks) ? blocks : []).filter(block => block?.type === 'table').forEach(block => {
      (Array.isArray(block.memberIds) ? block.memberIds : []).forEach(id => ids.add(String(id)));
    });
    return ids;
  }

  function hasVisibleTableMember() {
    const members = tableMembers();
    return visibleSelectedIds().some(id => members.has(id));
  }

  function applyGuard() {
    const button = document.getElementById('btnCreateCollection');
    if (!button || !hasVisibleTableMember()) return;
    button.disabled = true;
    button.title = 'Produtos já usados em uma tabela não podem entrar também em uma coleção. Filtre ou desagrupe antes.';
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('#btnCreateCollection');
    if (!button || !hasVisibleTableMember()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.alert?.('Um produto não pode pertencer simultaneamente a Collection e Table. Filtre os membros da tabela ou desagrupe antes de criar a coleção.');
  }, true);

  new MutationObserver(() => queueMicrotask(applyGuard)).observe(root, { childList: true, subtree: true });
  window.addEventListener('catalogotop:products-updated', () => queueMicrotask(applyGuard));
  root.addEventListener('change', () => queueMicrotask(applyGuard));
  applyGuard();
})();