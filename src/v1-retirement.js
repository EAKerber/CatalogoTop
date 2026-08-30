(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};

  function isExternalVariation(entry) {
    return String(entry?.provenance?.kind || '') === 'external-variation';
  }

  function cleanPresentation(value) {
    const source = value && typeof value === 'object' ? value : {};
    const rawVariants = source.imageVariants && typeof source.imageVariants === 'object' && !Array.isArray(source.imageVariants)
      ? source.imageVariants
      : {};
    const rawSelections = source.imageSelections && typeof source.imageSelections === 'object' && !Array.isArray(source.imageSelections)
      ? source.imageSelections
      : {};

    const imageVariants = {};
    const removedByProduct = new Map();

    Object.entries(rawVariants).forEach(([productId, entries]) => {
      const kept = [];
      const removed = new Set();
      (Array.isArray(entries) ? entries : []).forEach(entry => {
        const id = String(entry?.id || '').trim();
        if (isExternalVariation(entry)) {
          if (id) removed.add(id);
          return;
        }
        kept.push(entry);
      });
      if (kept.length) imageVariants[String(productId)] = kept;
      if (removed.size) removedByProduct.set(String(productId), removed);
    });

    const imageSelections = {};
    Object.entries(rawSelections).forEach(([productId, selection]) => {
      const id = String(productId);
      if (!selection || typeof selection !== 'object' || Array.isArray(selection)) return;
      if (selection.source !== 'catalog') {
        imageSelections[id] = selection;
        return;
      }
      const remaining = Array.isArray(imageVariants[id]) ? imageVariants[id] : [];
      if (remaining.some(entry => String(entry?.id || '') === String(selection.id || ''))) imageSelections[id] = selection;
    });

    return {
      ...source,
      imageVariants,
      imageSelections
    };
  }

  NS.V1Retirement = Object.freeze({
    EXTERNAL_IMAGE_VARIATION_FLOW_ENABLED: false,
    isExternalVariation,
    cleanPresentation
  });
})();
