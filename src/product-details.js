(function () {
  'use strict';

  const NS = window.CatalogoTop;
  const Core = NS?.Core;
  const Money = NS?.Money;
  const form = document.getElementById('productForm');
  const priceField = document.getElementById('price');
  const variantsField = document.getElementById('variants');
  const tableRowsField = document.getElementById('commercialRows');
  if (!Core || !form || !priceField || !variantsField || !tableRowsField) return;

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
    priceField.setCustomValidity('');
    tableRowsField.setCustomValidity('');
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
    priceField.setCustomValidity('');
    tableRowsField.setCustomValidity('');
  }

  function normalizeSinglePriceField() {
    if (!Money) return true;
    const parsed = Money.parse(priceField.value);
    if (!parsed.ok) {
      priceField.setCustomValidity('Informe um valor monetário válido, por exemplo R$ 54,90.');
      return false;
    }
    priceField.setCustomValidity('');
    priceField.value = parsed.canonical;
    return true;
  }

  function commercialPriceIssue(text) {
    if (!Money) return null;
    const lines = String(text || '').split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index].trim();
      if (!line) continue;
      const parts = line.split('|').map(part => part.trim());
      const price = parts[3] || '';
      if (price && !Money.parse(price).ok) return { line: index + 1, price };
    }
    return null;
  }

  function normalizeCommercialRowsField() {
    const issue = commercialPriceIssue(tableRowsField.value);
    if (issue) {
      tableRowsField.setCustomValidity(`Preço inválido na linha ${issue.line}: ${issue.price}`);
      return issue;
    }
    tableRowsField.setCustomValidity('');
    tableRowsField.value = Core.tableRowsToText(Core.parseTableRowsText(tableRowsField.value));
    return null;
  }

  priceField.addEventListener('input', () => priceField.setCustomValidity(''));
  priceField.addEventListener('blur', () => {
    if (normalizeSinglePriceField()) return;
    priceField.setCustomValidity('Informe um valor monetário válido, por exemplo R$ 54,90.');
  });
  tableRowsField.addEventListener('input', () => tableRowsField.setCustomValidity(''));
  tableRowsField.addEventListener('blur', normalizeCommercialRowsField);

  form.addEventListener('submit', event => {
    pendingDetails = null;
    if (!normalizeSinglePriceField()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      document.querySelector('[data-form-step-target="2"]')?.click();
      priceField.reportValidity();
      priceField.focus();
      return;
    }

    const issue = normalizeCommercialRowsField();
    if (issue) {
      event.preventDefault();
      event.stopImmediatePropagation();
      document.querySelector('[data-form-step-target="3"]')?.click();
      tableRowsField.reportValidity();
      tableRowsField.focus();
      return;
    }

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
