(function () {
  'use strict';
  const NS = window.CatalogoTop = window.CatalogoTop || {};
  if (!NS.CatalogDocument) return;
  // Compatibilidade v0.10.x: Collection deixou de substituir CatalogDocument.build.
  // O documento canônico resolve Card/Collection/Table em src/catalog-document.js.
  NS.CollectionDocument = {
    build: NS.CatalogDocument.build,
    resolveBlocks: NS.CatalogDocument.resolveBlocks,
    buildFlowNodes: NS.CatalogDocument.buildFlowNodes
  };
})();
