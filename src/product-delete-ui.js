(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  if (!NS.ProductActions?.deleteProduct) return;

  const rowsRoot = document.getElementById('productRows');
  const formDelete = document.getElementById('btnDeleteProduct');
  let patching = false;

  function patchRows() {
    if (!rowsRoot || patching) return;
    patching = true;
    try {
      rowsRoot.querySelectorAll('tr').forEach(row => {
        if (row.querySelector('[data-delete-product-direct]')) return;
        const edit = row.querySelector('[data-edit-product]');
        const id = String(edit?.dataset.editProduct || '');
        const cell = row.lastElementChild;
        if (!id || !cell) return;
        let actions = cell.querySelector('.product-row-actions');
        if (!actions) {
          actions = document.createElement('div');
          actions.className = 'product-row-actions';
          while (cell.firstChild) actions.appendChild(cell.firstChild);
          cell.appendChild(actions);
        }
        const button = document.createElement('button');
        button.className = 'icon-button danger-action';
        button.type = 'button';
        button.dataset.deleteProductDirect = id;
        button.title = 'Excluir produto';
        button.setAttribute('aria-label', 'Excluir produto');
        button.textContent = '×';
        actions.appendChild(button);
      });
    } finally {
      patching = false;
    }
  }

  async function handleDelete(id) {
    try {
      const deleted = await NS.ProductActions.deleteProduct(id);
      if (!deleted) return;
      if (String(document.getElementById('productId')?.value || '') === String(id)) {
        document.getElementById('btnNewProduct')?.click();
      }
    } catch (error) {
      window.alert?.(error.message || 'Não foi possível excluir o produto.');
    }
  }

  rowsRoot?.addEventListener('click', event => {
    const button = event.target.closest('[data-delete-product-direct]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    handleDelete(button.dataset.deleteProductDirect);
  });

  formDelete?.addEventListener('click', event => {
    const id = String(document.getElementById('productId')?.value || '');
    if (!id) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    handleDelete(id);
  }, true);

  if (rowsRoot) {
    new MutationObserver(patchRows).observe(rowsRoot, { childList: true, subtree: true });
    patchRows();
  }
})();