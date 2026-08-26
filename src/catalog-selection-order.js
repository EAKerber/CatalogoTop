(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  let applying = false;
  let observer = null;

  function effectiveOrderMap() {
    const state = NS.Core?.getState?.();
    if (!state || !NS.CatalogDocument?.build) return new Map();
    const doc = NS.CatalogDocument.build(state);
    return new Map(doc.orderedIds.map((id, index) => [String(id), index + 1]));
  }

  function applyEffectiveOrder() {
    if (applying) return;
    const root = document.getElementById('selectableProducts');
    if (!root) return;

    const orderMap = effectiveOrderMap();
    const entries = Array.from(root.querySelectorAll(':scope > .select-product')).map((element, domIndex) => {
      const checkbox = element.querySelector('[data-select-product]');
      const id = String(checkbox?.dataset.selectProduct || '');
      const selected = Boolean(checkbox?.checked);
      return {
        element,
        id,
        selected,
        effectiveOrder: orderMap.get(id) || Number.POSITIVE_INFINITY,
        domIndex
      };
    });

    entries.sort((left, right) => {
      if (left.selected !== right.selected) return left.selected ? -1 : 1;
      if (left.selected && right.selected) return left.effectiveOrder - right.effectiveOrder || left.domIndex - right.domIndex;
      return left.domIndex - right.domIndex;
    });

    applying = true;
    observer?.disconnect();
    entries.forEach(entry => {
      if (entry.selected && Number.isFinite(entry.effectiveOrder)) {
        let badge = entry.element.querySelector('.selection-order');
        if (!badge) {
          badge = document.createElement('b');
          badge.className = 'selection-order';
          entry.element.insertBefore(badge, entry.element.querySelector('.selection-presentation-controls'));
        }
        badge.textContent = String(entry.effectiveOrder);
        badge.title = 'Ordem efetiva no catálogo';
        entry.element.dataset.effectiveOrder = String(entry.effectiveOrder);
      }
      root.appendChild(entry.element);
    });
    applying = false;
    observer?.observe(root, { childList: true, subtree: true });
  }

  function init() {
    const root = document.getElementById('selectableProducts');
    if (!root || !NS.Core || !NS.CatalogDocument) return;
    observer = new MutationObserver(() => queueMicrotask(applyEffectiveOrder));
    observer.observe(root, { childList: true, subtree: true });
    window.addEventListener('catalogotop:products-updated', () => queueMicrotask(applyEffectiveOrder));
    root.addEventListener('change', () => queueMicrotask(applyEffectiveOrder));
    applyEffectiveOrder();
  }

  init();
})();
