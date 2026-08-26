(function () {
  'use strict';
  const NS = window.CatalogoTop = window.CatalogoTop || {};
  // Compatibilidade v0.10.2: a biblioteca agora renderiza a ação de exclusão
  // diretamente em src/app.js e reutiliza ProductActions.deleteProduct.
  NS.ProductDeleteUI = {
    deleteProduct: NS.ProductActions?.deleteProduct || null
  };
})();
