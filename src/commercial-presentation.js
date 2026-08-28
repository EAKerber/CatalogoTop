(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const PRICE_CLASS_PREFIX = 'price-style-';

  function quantityPrice(value) {
    return NS.Core?.normalizeQuantityPrice?.(value) || null;
  }

  function createQuantityBand(value) {
    const band = document.createElement('div');
    band.className = 'catalog-card-quantity-price';
    const condition = document.createElement('span');
    condition.textContent = `A partir de ${value.minQuantity} un.`;
    const price = document.createElement('strong');
    price.textContent = value.price;
    band.append(condition, price);
    return band;
  }

  function markInternalUnitPrice(table) {
    const headers = Array.from(table.querySelectorAll('thead th'));
    const priceIndex = headers.findIndex(node => node.textContent.trim() === 'Preço');
    if (priceIndex < 0) return;
    headers[priceIndex]?.classList.add('internal-unit-price-head');
    table.querySelectorAll('tbody tr').forEach(row => row.children[priceIndex]?.classList.add('internal-unit-price-cell'));
  }

  function scaleInternalColumns(table) {
    const colgroup = table.querySelector('colgroup');
    if (!colgroup) return;
    const original = Array.from(colgroup.children);
    original.forEach(col => {
      const width = parseFloat(col.style.width || '0');
      if (Number.isFinite(width) && width > 0) col.style.width = `${(width * 0.68).toFixed(2)}%`;
    });
    const minimum = document.createElement('col');
    minimum.style.width = '12%';
    minimum.className = 'quantity-min-col';
    const price = document.createElement('col');
    price.style.width = '20%';
    price.className = 'quantity-price-col';
    colgroup.append(minimum, price);
  }

  function augmentInternalTable(card, product) {
    const table = card.querySelector('.catalog-card-table');
    if (!table || table.dataset.quantityPriceAugmented === 'true') return false;
    const visibleRows = Array.from(table.querySelectorAll('tbody tr'));
    const sourceRows = Array.isArray(product.tableRows) ? product.tableRows.filter(Boolean).slice(0, visibleRows.length) : [];
    const hasQuantityRows = sourceRows.some(row => quantityPrice(row.quantityPrice));
    markInternalUnitPrice(table);
    if (!hasQuantityRows) return false;

    table.dataset.quantityPriceAugmented = 'true';
    table.classList.add('has-quantity-price-column');
    scaleInternalColumns(table);
    const headerRow = table.querySelector('thead tr');
    const minimumHeader = document.createElement('th');
    minimumHeader.className = 'internal-quantity-min-head';
    minimumHeader.textContent = 'Qtd. mín.';
    const quantityHeader = document.createElement('th');
    quantityHeader.className = 'internal-quantity-price-head';
    quantityHeader.textContent = 'Preço qtd.';
    headerRow?.append(minimumHeader, quantityHeader);

    visibleRows.forEach((row, index) => {
      const value = quantityPrice(sourceRows[index]?.quantityPrice);
      const minimumCell = document.createElement('td');
      minimumCell.className = 'internal-quantity-min-cell';
      minimumCell.textContent = value ? String(value.minQuantity) : '—';
      const quantityCell = document.createElement('td');
      quantityCell.className = 'internal-quantity-price-cell';
      quantityCell.textContent = value?.price || '—';
      row.append(minimumCell, quantityCell);
    });
    return true;
  }

  function augmentCardQuantityPrice(card, product, showPrices) {
    if (!showPrices) return;
    const value = quantityPrice(product.quantityPrice);
    const hasTable = Array.isArray(product.tableRows) && product.tableRows.length > 0;
    if (!hasTable) {
      const unitPrice = card.querySelector('.catalog-card-price');
      if (unitPrice && value) unitPrice.after(createQuantityBand(value));
      return;
    }

    const hasRowQuantity = augmentInternalTable(card, product);
    if (!hasRowQuantity && value) {
      const tableWrap = card.querySelector('.catalog-card-table-wrap');
      if (tableWrap) tableWrap.after(createQuantityBand(value));
    }
  }

  function apply(root, state) {
    if (!root || !NS.Composition || !state) return root;
    const presentation = NS.Composition.normalizePresentation(state.catalog?.presentation);
    const allowed = new Set((NS.Composition.PRICE_STYLES || []).map(item => item.id));
    const byId = new Map((state.products || []).map(product => [String(product.id), product]));

    root.querySelectorAll('.catalog-card[data-product-id]').forEach(card => {
      const style = NS.Composition.styleFor(presentation, card.dataset.productId);
      const priceStyle = allowed.has(style.priceStyle) ? style.priceStyle : 'standard';
      Array.from(card.classList).filter(name => name.startsWith(PRICE_CLASS_PREFIX)).forEach(name => card.classList.remove(name));
      card.classList.add(`${PRICE_CLASS_PREFIX}${priceStyle}`);
      card.dataset.priceStyle = priceStyle;
      const product = byId.get(String(card.dataset.productId));
      if (product) augmentCardQuantityPrice(card, product, state.catalog?.showPrices !== false);
    });
    return root;
  }

  NS.CommercialPresentation = { apply };
})();