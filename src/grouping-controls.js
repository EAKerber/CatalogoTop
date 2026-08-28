(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const Core = NS.Core;
  if (!Core) return;
  const $ = selector => document.querySelector(selector);

  function state() { return Core.getState(); }

  function blockMemberIds(current = state()) {
    const ids = new Set();
    (current.catalog?.presentation?.blocks || []).forEach(block => {
      (Array.isArray(block?.memberIds) ? block.memberIds : []).forEach(id => ids.add(String(id)));
    });
    return ids;
  }

  function includedSet(current = state()) {
    return new Set((current.selectedIds || []).map(String));
  }

  function effectiveIds(current = state()) {
    return NS.CatalogOrder?.effectiveIds ? NS.CatalogOrder.effectiveIds(current) : (current.selectedIds || []).map(String);
  }

  function productMap(current = state()) {
    return new Map((current.products || []).map(product => [String(product.id), product]));
  }

  function categoryOf(product) {
    return String(product?.category || '').trim() || 'Sem categoria';
  }

  function editorialIds() {
    return NS.ComposerSelection?.ids?.().map(String) || [];
  }

  function orderedEditorial(current = state()) {
    const selected = new Set(editorialIds());
    return effectiveIds(current).filter(id => selected.has(String(id))).map(String);
  }

  function isContiguousSameCategory(ids, current = state()) {
    if (!ids.length) return false;
    const byId = productMap(current);
    const category = categoryOf(byId.get(ids[0]));
    if (ids.some(id => categoryOf(byId.get(id)) !== category)) return false;
    const categoryIds = effectiveIds(current).filter(id => categoryOf(byId.get(id)) === category).map(String);
    const positions = ids.map(id => categoryIds.indexOf(String(id)));
    return positions.every((position, index) => position >= 0 && (index === 0 || position === positions[index - 1] + 1));
  }

  function candidateIds(maxMembers = Number.POSITIVE_INFINITY) {
    const current = state();
    const raw = editorialIds();
    if (raw.length < 2 || raw.length > maxMembers) return [];
    const included = includedSet(current);
    const occupied = blockMemberIds(current);
    const byId = productMap(current);
    if (raw.some(id => !included.has(id) || occupied.has(id) || !byId.has(id))) return [];
    const ids = orderedEditorial(current);
    if (ids.length !== raw.length || !isContiguousSameCategory(ids, current)) return [];
    return ids;
  }

  function refreshToolbar() {
    const selected = editorialIds();
    const valid = candidateIds(Number.POSITIVE_INFINITY);
    const context = $('#groupingActions');
    if (context) context.hidden = selected.length < 2;
    const status = $('#blockSelectionStatus');
    if (status) {
      if (valid.length) status.textContent = `${valid.length} produtos contíguos selecionados`;
      else if (selected.length >= 2) status.textContent = `${selected.length} selecionados · agrupamento indisponível`;
      else status.textContent = '';
    }
    NS.CollectionControls?.refreshButton?.();
    NS.TableControls?.refreshButton?.();
  }

  function emit() {
    window.dispatchEvent(new CustomEvent('catalogotop:grouping-selection-changed', {
      detail: { ids: editorialIds(), candidates: candidateIds(Number.POSITIVE_INFINITY) }
    }));
  }

  function refreshAndEmit() {
    refreshToolbar();
    emit();
  }

  function bind() {
    window.addEventListener('catalogotop:editor-selection-changed', refreshAndEmit);
    window.addEventListener('catalogotop:selection-rendered', refreshToolbar);
    window.addEventListener('catalogotop:products-updated', refreshToolbar);
  }

  NS.GroupingControls = {
    ids: editorialIds,
    candidateIds,
    isContiguousSameCategory,
    refresh: refreshToolbar
  };

  bind();
  refreshToolbar();
})();
