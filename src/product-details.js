(function () {
  'use strict';

  const NS = window.CatalogoTop;
  const Core = NS?.Core;
  const form = document.getElementById('productForm');
  const variantsField = document.getElementById('variants');
  const tableRowsField = document.getElementById('commercialRows');
  if (!Core || !form || !variantsField || !tableRowsField) return;

  let pendingDetails = null;
  const normalizeProduct = Core.normalizeProduct;

  Core.normalizeProduct = product => {
    const normalized = normalizeProduct(product);
    if (!pendingDetails) return normalized;
    const productId = String(product?.id || normalized.id || '');
    if (pendingDetails.id && pendingDetails.id !== productId) return normalized;
    normalized.variants = pendingDetails.variants;
    normalized.tableRows = pendingDetails.tableRows;
    pendingDetails = null;
    return normalized;
  };

  function clearDetails() {
    variantsField.value = '';
    tableRowsField.value = '';
  }

  function loadDetails() {
    const id = document.getElementById('productId')?.value || '';
    const product = Core.getState().products.find(item => item.id === id);
    if (!product) {
      clearDetails();
      return;
    }
    variantsField.value = Core.variantsToText(product.variants);
    tableRowsField.value = Core.tableRowsToText(product.tableRows);
  }

  form.addEventListener('submit', () => {
    pendingDetails = {
      id: document.getElementById('productId')?.value || '',
      variants: Core.parseVariantsText(variantsField.value),
      tableRows: Core.parseTableRowsText(tableRowsField.value)
    };
  }, true);

  document.getElementById('productRows')?.addEventListener('click', event => {
    if (!event.target.closest('[data-edit-product]')) return;
    queueMicrotask(loadDetails);
  });

  ['btnNewProduct', 'btnCancelEdit'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => queueMicrotask(clearDetails));
  });
})();
