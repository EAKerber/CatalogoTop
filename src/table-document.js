(function () {
  'use strict';
  const NS = window.CatalogoTop = window.CatalogoTop || {};
  if (!NS.CatalogDocument) return;
  // Compatibilidade v0.10.x: Table deixou de substituir CatalogDocument.build.
  NS.TableDocument = {
    build: NS.CatalogDocument.build,
    resolveBlocks: NS.CatalogDocument.resolveBlocks,
    buildFlowNodes: NS.CatalogDocument.buildFlowNodes,
    materializePageItems: NS.CatalogDocument.materializePageItems
  };
})();
