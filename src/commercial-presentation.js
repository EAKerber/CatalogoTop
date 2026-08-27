(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const PRICE_CLASS_PREFIX = 'price-style-';

  function apply(root, state) {
    if (!root || !NS.Composition || !state) return root;
    const presentation = NS.Composition.normalizePresentation(state.catalog?.presentation);
    const allowed = new Set((NS.Composition.PRICE_STYLES || []).map(item => item.id));

    root.querySelectorAll('.catalog-card[data-product-id]').forEach(card => {
      const style = NS.Composition.styleFor(presentation, card.dataset.productId);
      const priceStyle = allowed.has(style.priceStyle) ? style.priceStyle : 'standard';
      Array.from(card.classList).filter(name => name.startsWith(PRICE_CLASS_PREFIX)).forEach(name => card.classList.remove(name));
      card.classList.add(`${PRICE_CLASS_PREFIX}${priceStyle}`);
      card.dataset.priceStyle = priceStyle;
    });
    return root;
  }

  NS.CommercialPresentation = { apply };
})();
