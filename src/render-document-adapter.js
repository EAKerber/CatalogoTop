(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  if (!NS.Render?.renderCatalog || !NS.CatalogDocument?.build) return;

  const originalRenderCatalog = NS.Render.renderCatalog.bind(NS.Render);

  NS.Render.renderCatalog = function renderCatalogFromDocument(root, state) {
    const documentModel = NS.CatalogDocument.build(state);
    const orderedState = NS.CatalogDocument.withEffectiveOrder(state, documentModel);
    const summary = originalRenderCatalog(root, orderedState) || {};
    const cards = Array.from(root.querySelectorAll('.catalog-card[data-product-id]'));
    const pages = Array.from(root.querySelectorAll('.catalog-page'));

    cards.forEach(card => {
      const id = String(card.dataset.productId || '');
      const effectiveOrder = documentModel.effectiveOrderById[id];
      if (effectiveOrder) card.dataset.effectiveOrder = String(effectiveOrder);
    });

    pages.forEach((page, index) => {
      page.dataset.documentPage = String(index + 1);
      page.dataset.documentPageTotal = String(documentModel.pageCount);
    });

    root.__catalogDocument = documentModel;
    return {
      ...summary,
      selectedCount: documentModel.selectedCount,
      pageCount: documentModel.pageCount,
      categoryCount: documentModel.categoryCount,
      document: documentModel
    };
  };
})();
