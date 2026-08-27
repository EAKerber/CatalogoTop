(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};

  function effectiveOrderMap(state) {
    const current = state || NS.Core?.getState?.();
    if (!current) return new Map();
    const ids = NS.CatalogOrder?.effectiveIds ? NS.CatalogOrder.effectiveIds(current) : (current.selectedIds || []).map(String);
    return new Map(ids.map((id, index) => [String(id), index + 1]));
  }

  function compareProducts(left, right, orderMap) {
    const leftOrder = orderMap.get(String(left.id)) || Number.POSITIVE_INFINITY;
    const rightOrder = orderMap.get(String(right.id)) || Number.POSITIVE_INFINITY;
    return leftOrder - rightOrder;
  }

  NS.SelectionOrder = { effectiveOrderMap, compareProducts };
})();