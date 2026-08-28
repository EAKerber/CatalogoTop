(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};

  function cardLineBudget(card) {
    const width = card?.dataset.cardWidth || 'simple';
    let lines = width === 'full' ? 5 : width === 'wide' ? 4 : 3;
    if (card?.closest('.template-showcase')) lines = Math.max(lines, 4);
    return lines;
  }

  function collectionLineBudget(item) {
    const width = item?.dataset.memberWidth || 'simple';
    if (width === 'full') return 5;
    if (width === 'wide') return 4;
    const collection = item?.closest?.('.catalog-collection');
    const columns = Number(collection?.style?.getPropertyValue('--collection-cols')) || 0;
    return columns >= 4 ? 4 : 3;
  }

  function lineBudgetFor(element) {
    const card = element?.closest?.('.catalog-card[data-product-id]');
    if (card) return cardLineBudget(card);
    const collectionItem = element?.closest?.('.catalog-collection-item[data-product-id]');
    if (collectionItem) return collectionLineBudget(collectionItem);
    return 3;
  }

  function prepareForMeasurement(element) {
    element.style.display = 'block';
    element.style.webkitLineClamp = 'unset';
    element.style.webkitBoxOrient = 'initial';
    element.style.textOverflow = 'clip';
    element.style.overflowWrap = 'anywhere';
  }

  function lineHeightPx(element) {
    const view = element?.ownerDocument?.defaultView || window;
    const computed = view.getComputedStyle(element);
    const explicit = Number.parseFloat(computed.lineHeight);
    if (Number.isFinite(explicit)) return explicit;
    const fontSize = Number.parseFloat(computed.fontSize) || 12;
    return fontSize * 1.12;
  }

  function fitsWithinLines(element, text, maxLines) {
    element.textContent = text;
    element.style.maxHeight = 'none';
    element.style.overflow = 'visible';
    const lineHeight = lineHeightPx(element);
    const allowedHeight = lineHeight * Math.max(1, maxLines) + 1;
    return { fits: element.scrollHeight <= allowedHeight, lineHeight, allowedHeight };
  }

  function fitText(element, maxLines = lineBudgetFor(element)) {
    if (!element) return null;
    const full = String(element.dataset.fullDescription || element.textContent || '').trim().replace(/\s+/g, ' ');
    if (!full) return null;
    element.dataset.fullDescription = full;
    element.title = full;
    prepareForMeasurement(element);

    if (element.getBoundingClientRect().width <= 0) {
      element.textContent = full;
      element.dataset.fitLines = String(maxLines);
      element.dataset.visibleWords = String(full.split(' ').filter(Boolean).length);
      element.dataset.descriptionTruncated = 'false';
      return { full, visible: full, truncated: false, lines: maxLines };
    }

    const words = full.split(' ').filter(Boolean);
    let visible = full;
    let measurement = fitsWithinLines(element, full, maxLines);

    if (!measurement.fits && words.length > 1) {
      let low = 1;
      let high = words.length;
      let best = 1;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        const candidate = words.slice(0, middle).join(' ');
        const result = fitsWithinLines(element, candidate, maxLines);
        measurement = result;
        if (result.fits) {
          best = middle;
          low = middle + 1;
        } else high = middle - 1;
      }
      visible = words.slice(0, best).join(' ');
      measurement = fitsWithinLines(element, visible, maxLines);
    }

    element.textContent = visible;
    element.style.maxHeight = `${measurement.lineHeight * Math.max(1, maxLines) + 1}px`;
    element.style.overflow = 'hidden';
    element.dataset.fitLines = String(maxLines);
    element.dataset.visibleWords = String(visible.split(' ').filter(Boolean).length);
    element.dataset.descriptionTruncated = String(visible !== full);
    return { full, visible, truncated: visible !== full, lines: maxLines };
  }

  function fitHeading(element, maxLines) {
    return fitText(element, maxLines || lineBudgetFor(element));
  }

  function fitCatalogAtCurrentGeometry(root) {
    if (!root?.querySelectorAll) return [];
    const targets = [
      ...root.querySelectorAll('.catalog-card[data-product-id] h3'),
      ...root.querySelectorAll('.catalog-collection-item[data-product-id] .catalog-collection-copy b')
    ];
    return targets.map(element => fitText(element, lineBudgetFor(element))).filter(Boolean);
  }

  function fitCatalog(root) {
    if (!root?.style) return fitCatalogAtCurrentGeometry(root);
    const previous = root.style.getPropertyValue('--preview-scale');
    const priority = root.style.getPropertyPriority('--preview-scale');
    root.style.setProperty('--preview-scale', '1');
    void root.offsetWidth;
    try {
      return fitCatalogAtCurrentGeometry(root);
    } finally {
      if (previous) root.style.setProperty('--preview-scale', previous, priority);
      else root.style.removeProperty('--preview-scale');
    }
  }

  NS.TextFit = {
    cardLineBudget,
    collectionLineBudget,
    lineBudgetFor,
    fitText,
    fitHeading,
    fitCatalog
  };
})();
