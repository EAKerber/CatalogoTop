(function () {
  'use strict';
  const NS = window.CatalogoTop = window.CatalogoTop || {};
  // Compatibilidade v0.8.x: o renderer canônico agora consome CatalogDocument
  // diretamente em src/catalog-renderer.js; não há mais wrapping de renderCatalog.
  NS.RenderDocumentAdapter = {
    documentFor(state) {
      return NS.CatalogDocument?.build?.(state) || null;
    }
  };
})();
