(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  let current = null;

  function normalize(target) {
    if (!target || typeof target !== 'object') return null;
    const kind = String(target.kind || '');
    if (kind === 'card' && target.productId) return { kind, productId: String(target.productId) };
    if (kind === 'collection' && target.blockId) return { kind, blockId: String(target.blockId) };
    if (kind === 'collection-member' && target.blockId && target.productId) {
      return { kind, blockId: String(target.blockId), productId: String(target.productId) };
    }
    if (kind === 'table' && target.blockId) return { kind, blockId: String(target.blockId) };
    return null;
  }

  function equal(left, right) {
    return JSON.stringify(left || null) === JSON.stringify(right || null);
  }

  function emit() {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('catalogotop:editor-selection-changed', { detail: current }));
  }

  function get() {
    return current ? { ...current } : null;
  }

  function select(target) {
    const next = normalize(target);
    if (equal(next, current)) return get();
    current = next;
    emit();
    return get();
  }

  function clear() {
    if (!current) return null;
    current = null;
    emit();
    return null;
  }

  function blockMembership(state) {
    const map = new Map();
    const blocks = Array.isArray(state?.catalog?.presentation?.blocks) ? state.catalog.presentation.blocks : [];
    blocks.forEach(block => {
      (Array.isArray(block?.memberIds) ? block.memberIds : []).forEach(id => {
        if (!map.has(String(id))) map.set(String(id), block);
      });
    });
    return map;
  }

  function targetForProduct(state, productId) {
    const id = String(productId || '');
    if (!id) return null;
    const membership = blockMembership(state);
    const block = membership.get(id);
    if (block?.type === 'collection') return { kind: 'collection-member', blockId: String(block.id), productId: id };
    if (block?.type === 'table') return { kind: 'table', blockId: String(block.id) };
    return { kind: 'card', productId: id };
  }

  function isValidTarget(state, target = current) {
    const normalized = normalize(target);
    if (!normalized) return false;
    const selected = new Set((Array.isArray(state?.selectedIds) ? state.selectedIds : []).map(String));
    const blocks = Array.isArray(state?.catalog?.presentation?.blocks) ? state.catalog.presentation.blocks : [];
    if (normalized.kind === 'card') {
      if (!selected.has(normalized.productId)) return false;
      return !blocks.some(block => (Array.isArray(block?.memberIds) ? block.memberIds : []).map(String).includes(normalized.productId));
    }
    const block = blocks.find(item => String(item?.id || '') === normalized.blockId);
    if (!block) return false;
    if (normalized.kind === 'collection') return block.type === 'collection';
    if (normalized.kind === 'table') return block.type === 'table';
    return block.type === 'collection'
      && selected.has(normalized.productId)
      && (Array.isArray(block.memberIds) ? block.memberIds : []).map(String).includes(normalized.productId);
  }

  function reconcile(state) {
    if (!current) return null;
    if (isValidTarget(state, current)) return get();
    return clear();
  }

  NS.ComposerSelection = {
    normalize,
    get,
    select,
    clear,
    blockMembership,
    targetForProduct,
    isValidTarget,
    reconcile
  };
})();