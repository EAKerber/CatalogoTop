(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const { Core, Composition } = NS;
  if (!Core || !Composition) return;

  const $ = selector => document.querySelector(selector);
  const markedIds = new Set();
  let mode = 'browse';

  function state() { return Core.getState(); }

  function blockMemberIds(current = state()) {
    const ids = new Set();
    (current.catalog?.presentation?.blocks || []).forEach(block => {
      (Array.isArray(block?.memberIds) ? block.memberIds : []).forEach(id => ids.add(String(id)));
    });
    return ids;
  }

  function selectedSet(current = state()) {
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

  function reconcileMarked() {
    const current = state();
    const selected = selectedSet(current);
    const membership = blockMemberIds(current);
    const byId = productMap(current);
    Array.from(markedIds).forEach(id => {
      if (!selected.has(id) || membership.has(id) || !byId.has(id)) markedIds.delete(id);
    });
    if (mode !== 'grouping') markedIds.clear();
  }

  function orderedMarked(current = state(), values = markedIds) {
    const marked = new Set(Array.from(values).map(String));
    return effectiveIds(current).filter(id => marked.has(id));
  }

  function isContiguousSameCategory(ids, current = state()) {
    if (!ids.length) return false;
    const byId = productMap(current);
    const category = categoryOf(byId.get(ids[0]));
    if (ids.some(id => categoryOf(byId.get(id)) !== category)) return false;
    const categoryIds = effectiveIds(current).filter(id => categoryOf(byId.get(id)) === category);
    const positions = ids.map(id => categoryIds.indexOf(id));
    return positions.every((position, index) => position >= 0 && (index === 0 || position === positions[index - 1] + 1));
  }

  function candidateIds(maxMembers = Number.POSITIVE_INFINITY) {
    reconcileMarked();
    const current = state();
    const selected = selectedSet(current);
    const membership = blockMemberIds(current);
    const ids = orderedMarked(current).filter(id => selected.has(id) && !membership.has(id));
    if (ids.length < 2 || ids.length > maxMembers || ids.length !== markedIds.size) return [];
    return isContiguousSameCategory(ids, current) ? ids : [];
  }

  function canAdd(productId) {
    const id = String(productId || '');
    if (!id) return false;
    reconcileMarked();
    if (markedIds.has(id)) return true;
    const current = state();
    if (!selectedSet(current).has(id) || blockMemberIds(current).has(id)) return false;
    if (!markedIds.size) return true;
    if (markedIds.size >= 30) return false;
    const byId = productMap(current);
    const first = byId.get(orderedMarked(current)[0]);
    if (categoryOf(byId.get(id)) !== categoryOf(first)) return false;
    const next = new Set(markedIds);
    next.add(id);
    return isContiguousSameCategory(orderedMarked(current, next), current);
  }

  function ids() {
    reconcileMarked();
    return Array.from(markedIds);
  }

  function emit() {
    window.dispatchEvent(new CustomEvent('catalogotop:grouping-selection-changed', {
      detail: { mode, ids: ids() }
    }));
  }

  function clear(refresh = true) {
    const changed = markedIds.size > 0;
    markedIds.clear();
    if (refresh) refreshUi();
    if (changed) emit();
  }

  function toggle(productId) {
    const id = String(productId || '');
    if (mode !== 'grouping' || !id) return false;
    if (markedIds.has(id)) markedIds.delete(id);
    else {
      if (!canAdd(id)) return false;
      markedIds.add(id);
    }
    refreshUi();
    emit();
    return true;
  }

  function setMode(next) {
    mode = next === 'grouping' ? 'grouping' : 'browse';
    if (mode === 'browse') markedIds.clear();
  }

  function enter() {
    if (mode === 'grouping') return;
    NS.ComposerSelection?.clear?.();
    setMode('grouping');
    refreshUi();
    emit();
  }

  function exit({ render = true } = {}) {
    const changed = mode !== 'browse' || markedIds.size > 0;
    setMode('browse');
    if (render && NS.App?.renderSelection) NS.App.renderSelection();
    else refreshUi();
    if (changed) emit();
  }

  function refreshRows() {
    reconcileMarked();
    const active = mode === 'grouping';
    const panel = $('.selection-panel');
    const list = $('#selectableProducts');
    panel?.classList.toggle('is-grouping', active);
    list?.classList.toggle('is-grouping', active);

    document.querySelectorAll('#selectableProducts [data-product-row]').forEach(row => {
      const id = String(row.dataset.productRow || '');
      const marked = markedIds.has(id);
      const eligible = active && canAdd(id);
      row.classList.toggle('grouping-marked', active && marked);
      row.classList.toggle('grouping-eligible', active && eligible);
      row.classList.toggle('grouping-ineligible', active && !eligible && !marked);
      if (active && (eligible || marked)) {
        row.setAttribute('tabindex', '0');
        row.setAttribute('aria-selected', marked ? 'true' : 'false');
      } else {
        row.removeAttribute('tabindex');
        row.removeAttribute('aria-selected');
      }
      const checkbox = row.querySelector('[data-select-product]');
      if (checkbox) checkbox.disabled = active;
      const handle = row.querySelector('[data-order-handle]');
      if (handle && active) {
        handle.disabled = true;
        handle.draggable = false;
      }
    });
  }

  function refreshToolbar() {
    const active = mode === 'grouping';
    const browse = $('#selectionBrowseActions');
    const grouping = $('#groupingActions');
    if (browse) browse.hidden = active;
    if (grouping) grouping.hidden = !active;
    const status = $('#blockSelectionStatus');
    if (status) {
      const count = ids().length;
      status.textContent = count ? `${count} ${count === 1 ? 'marcado' : 'marcados'}` : 'Selecione um trecho contíguo';
    }
    NS.CollectionControls?.refreshButton?.();
    NS.TableControls?.refreshButton?.();
  }

  function refreshUi() {
    refreshRows();
    refreshToolbar();
  }

  function handleRowActivation(target) {
    const row = target.closest?.('[data-product-row]');
    if (!row) return false;
    return toggle(row.dataset.productRow);
  }

  function bind() {
    $('#btnEnterGrouping')?.addEventListener('click', enter);
    $('#btnCancelGrouping')?.addEventListener('click', () => exit());

    const list = $('#selectableProducts');
    if (list) {
      list.addEventListener('click', event => {
        if (mode !== 'grouping') return;
        if (event.target.closest('[data-select-product],[data-order-handle],button,select,input,a')) return;
        if (!event.target.closest('[data-product-row]')) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        handleRowActivation(event.target);
      });
      list.addEventListener('keydown', event => {
        if (mode !== 'grouping' || !['Enter', ' '].includes(event.key)) return;
        const row = event.target.closest('[data-product-row]');
        if (!row) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        toggle(row.dataset.productRow);
      });
    }

    $('#searchSelection')?.addEventListener('input', () => {
      if (mode === 'grouping') clear();
    });
    $('#selectionCategory')?.addEventListener('change', () => {
      if (mode === 'grouping') clear();
    });

    window.addEventListener('catalogotop:selection-rendered', refreshUi);
    window.addEventListener('catalogotop:products-updated', () => {
      reconcileMarked();
      refreshUi();
    });
  }

  NS.BlockSelection = { ids, clear, toggle, refresh: refreshUi };
  NS.GroupingControls = {
    mode: () => mode,
    enter,
    exit,
    clear,
    toggle,
    ids,
    candidateIds,
    canAdd,
    refresh: refreshUi
  };

  bind();
  refreshUi();
})();