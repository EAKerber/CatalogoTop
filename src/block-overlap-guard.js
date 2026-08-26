(function () {
  'use strict';
  const NS = window.CatalogoTop = window.CatalogoTop || {};
  // Compatibilidade v0.10.2. A exclusão mútua entre Collection/Table passou a
  // ser calculada pelos candidatos de agrupamento e validada no CatalogDocument.
  NS.BlockOverlapGuard = {
    isClaimed(productId) {
      const blocks = NS.Core?.getState?.().catalog?.presentation?.blocks || [];
      return blocks.some(block => (block.memberIds || []).map(String).includes(String(productId)));
    }
  };
})();
