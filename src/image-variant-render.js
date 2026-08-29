(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};

  function primaryImageForNode(node) {
    if (node.matches('.catalog-card[data-product-id]')) return node.querySelector('.catalog-card-visuals.single > img');
    if (node.matches('.catalog-collection-item[data-product-id]')) return node.querySelector('.catalog-collection-image > img');
    return null;
  }

  function applyImageSelections(root, state) {
    if (!root?.querySelectorAll || !state || !NS.ImageVariants || !NS.Composition) return;
    const presentation = NS.Composition.normalizePresentation(state.catalog?.presentation);
    const byId = new Map((Array.isArray(state.products) ? state.products : []).map(product => [String(product.id), product]));

    root.querySelectorAll('.catalog-card[data-product-id],.catalog-collection-item[data-product-id]').forEach(node => {
      const productId = String(node.dataset.productId || '');
      const product = byId.get(productId);
      const image = primaryImageForNode(node);
      if (!product || !image) return;

      const resolved = NS.ImageVariants.resolveImage(product, presentation);
      if (!resolved.image) return;
      image.src = resolved.image;
      image.dataset.imageVariantSource = resolved.source;
      image.dataset.imageVariantId = resolved.id;
      image.dataset.imageVariantFallback = String(Boolean(resolved.isFallback));
    });
  }

  NS.ImageVariantRender = Object.freeze({
    primaryImageForNode,
    applyImageSelections
  });
})();