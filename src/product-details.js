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

  const priceGrid = priceField.closest('.field-grid');
  const quantityEditor = document.createElement('div');
  quantityEditor.className = 'quantity-price-editor';
  quantityEditor.innerHTML = `
    <label class="quantity-price-toggle"><input id="hasQuantityPrice" type="checkbox" /><span>Preço por quantidade</span></label>
    <div class="quantity-price-fields hidden" id="quantityPriceFields">
      <label>Qtd. mín.<input id="quantityMin" type="number" min="2" step="1" inputmode="numeric" placeholder="Ex.: 10" /></label>
      <label>Preço em quantidade<input id="quantityPrice" inputmode="decimal" placeholder="Ex.: R$ 49,90" /></label>
    </div>`;
  priceGrid?.after(quantityEditor);

  const quantityToggle = document.getElementById('hasQuantityPrice');
  const quantityFields = document.getElementById('quantityPriceFields');
  const quantityMinField = document.getElementById('quantityMin');
  const quantityPriceField = document.getElementById('quantityPrice');

  let pendingDetails = null;
  const normalizeProduct = Core.normalizeProduct;

  Core.normalizeProduct = product => {
    const normalized = normalizeProduct(product);
    if (!pendingDetails) return normalized;
    const productId = String(product?.id || normalized.id || '');
    if (pendingDetails.id && pendingDetails.id !== productId) return normalized;
    normalized.quantityPrice = pendingDetails.quantityPrice;
    normalized.variants = pendingDetails.variants;
    normalized.tableRows = pendingDetails.tableRows;
    pendingDetails = null;
    return normalized;
  };

  function setQuantityEnabled(enabled) {
    const active = Boolean(enabled);
    quantityToggle.checked = active;
    quantityFields.classList.toggle('hidden', !active);
    quantityMinField.disabled = !active;
    quantityPriceField.disabled = !active;
    quantityMinField.required = active;
    quantityPriceField.required = active;
    if (!active) {
      quantityMinField.setCustomValidity('');
      quantityPriceField.setCustomValidity('');
    }
  }

  function clearDetails() {
    variantsField.value = '';
    tableRowsField.value = '';
    priceField.setCustomValidity('');
    tableRowsField.setCustomValidity('');
    quantityMinField.value = '';
    quantityPriceField.value = '';
    setQuantityEnabled(false);
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
    const quantityPrice = Core.normalizeQuantityPrice(product.quantityPrice);
    quantityMinField.value = quantityPrice?.minQuantity || '';
    quantityPriceField.value = quantityPrice?.price || '';
    setQuantityEnabled(Boolean(quantityPrice));
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

  function normalizeQuantityPriceFields() {
    if (!quantityToggle.checked) {
      quantityMinField.setCustomValidity('');
      quantityPriceField.setCustomValidity('');
      return { ok: true, value: null };
    }
    const minQuantity = Number(quantityMinField.value);
    if (!Number.isSafeInteger(minQuantity) || minQuantity < 2) {
      quantityMinField.setCustomValidity('Informe uma quantidade mínima inteira a partir de 2.');
      quantityPriceField.setCustomValidity('');
      return { ok: false, field: quantityMinField, value: null };
    }
    const parsed = Money?.parse(quantityPriceField.value);
    if (!parsed?.ok || parsed.empty) {
      quantityMinField.setCustomValidity('');
      quantityPriceField.setCustomValidity('Informe um preço em quantidade válido, por exemplo R$ 49,90.');
      return { ok: false, field: quantityPriceField, value: null };
    }
    quantityMinField.setCustomValidity('');
    quantityPriceField.setCustomValidity('');
    quantityPriceField.value = parsed.canonical;
    return { ok: true, value: { minQuantity, price: parsed.canonical } };
  }

  function commercialPriceIssue(text) {
    if (!Money) return null;
    const lines = String(text || '').split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index].trim();
      if (!line) continue;
      const parts = line.split('|').map(part => part.trim());
      const price = parts[3] || '';
      const minQuantity = parts[4] || '';
      const quantityPrice = parts[5] || '';
      if (price && !Money.parse(price).ok) return { line: index + 1, reason: `Preço inválido: ${price}` };
      if (Boolean(minQuantity) !== Boolean(quantityPrice)) return { line: index + 1, reason: 'Qtd. mín. e preço em quantidade devem ser informados juntos.' };
      if (minQuantity) {
        const minimum = Number(minQuantity);
        if (!Number.isSafeInteger(minimum) || minimum < 2) return { line: index + 1, reason: `Qtd. mín. inválida: ${minQuantity}` };
        const parsed = Money.parse(quantityPrice);
        if (!parsed.ok || parsed.empty) return { line: index + 1, reason: `Preço em quantidade inválido: ${quantityPrice}` };
      }
    }
    return null;
  }

  function normalizeCommercialRowsField() {
    const issue = commercialPriceIssue(tableRowsField.value);
    if (issue) {
      tableRowsField.setCustomValidity(`Linha ${issue.line}: ${issue.reason}`);
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
  quantityToggle.addEventListener('change', () => setQuantityEnabled(quantityToggle.checked));
  quantityMinField.addEventListener('input', () => quantityMinField.setCustomValidity(''));
  quantityMinField.addEventListener('blur', () => {
    if (quantityToggle.checked) normalizeQuantityPriceFields();
  });
  quantityPriceField.addEventListener('input', () => quantityPriceField.setCustomValidity(''));
  quantityPriceField.addEventListener('blur', () => {
    if (quantityToggle.checked) normalizeQuantityPriceFields();
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

    const quantity = normalizeQuantityPriceFields();
    if (!quantity.ok) {
      event.preventDefault();
      event.stopImmediatePropagation();
      document.querySelector('[data-form-step-target="2"]')?.click();
      quantity.field.reportValidity();
      quantity.field.focus();
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
      quantityPrice: quantity.value,
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