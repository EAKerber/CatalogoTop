(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  let current = null;
  let selectedProductIds = new Set();
  let anchorProductId = '';

  function normalize(target) {
    if (!target || typeof target !== 'object') return null;
    const kind = String(target.kind || '');
    if (kind === 'card' && target.productId) return { kind, productId: String(target.productId) };
    if (kind === 'collection' && target.blockId) return { kind, blockId: String(target.blockId) };
    if (kind === 'collection-member' && target.blockId && target.productId) {
      return { kind, blockId: String(target.blockId), productId: String(target.productId) };
    }
    if (kind === 'table' && target.blockId) return { kind, blockId: String(target.blockId) };
    if (kind === 'table-row' && target.blockId && target.rowId && target.productId) {
      return { kind, blockId: String(target.blockId), rowId: String(target.rowId), productId: String(target.productId) };
    }
    return null;
  }

  function equal(left, right) {
    return JSON.stringify(left || null) === JSON.stringify(right || null);
  }

  function get() {
    return current ? { ...current } : null;
  }

  function ids() {
    return Array.from(selectedProductIds);
  }

  function anchor() {
    return anchorProductId || null;
  }

  function emit() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('catalogotop:editor-selection-changed', {
        detail: { target: get(), productIds: ids(), anchorProductId: anchor() }
      }));
    }
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

  function blockById(state, blockId) {
    return (Array.isArray(state?.catalog?.presentation?.blocks) ? state.catalog.presentation.blocks : [])
      .find(block => String(block?.id || '') === String(blockId)) || null;
  }

  function productsForBlock(state, block) {
    const memberIds = new Set((Array.isArray(block?.memberIds) ? block.memberIds : []).map(String));
    return (Array.isArray(state?.products) ? state.products : []).filter(product => memberIds.has(String(product.id)));
  }

  function productIdsForTarget(state, target) {
    const normalized = normalize(target);
    if (!normalized) return [];
    if (normalized.productId) return [normalized.productId];
    const block = normalized.blockId ? blockById(state, normalized.blockId) : null;
    return (Array.isArray(block?.memberIds) ? block.memberIds : []).map(String);
  }

  function targetForProduct(state, productId) {
    const id = String(productId || '');
    if (!id) return null;
    const block = blockMembership(state).get(id);
    if (block?.type === 'collection') return { kind: 'collection-member', blockId: String(block.id), productId: id };
    if (block?.type === 'table') {
      const normalized = NS.TableBlock?.normalizeBlock?.(block) || block;
      const rows = NS.TableBlock?.rowsForBlock?.(normalized, productsForBlock(state, block)) || [];
      const matches = rows.filter(row => String(row.productId) === id);
      if (matches.length === 1) return { kind: 'table-row', blockId: String(block.id), rowId: String(matches[0].rowId), productId: id };
      return { kind: 'table', blockId: String(block.id) };
    }
    return { kind: 'card', productId: id };
  }

  function orderedCatalogIds(state) {
    const included = new Set((Array.isArray(state?.selectedIds) ? state.selectedIds : []).map(String));
    const effective = NS.CatalogOrder?.effectiveIds?.(state) || Array.from(included);
    return effective.map(String).filter(id => included.has(id));
  }

  function select(target, { preserveProducts = false } = {}) {
    const next = normalize(target);
    const nextIds = preserveProducts ? ids() : productIdsForTarget(NS.Core?.getState?.(), next);
    const changed = !equal(next, current) || JSON.stringify(nextIds) !== JSON.stringify(ids());
    current = next;
    if (!preserveProducts) selectedProductIds = new Set(nextIds);
    if (next?.productId) anchorProductId = next.productId;
    else if (!next) anchorProductId = '';
    if (changed) emit();
    return get();
  }

  function shouldPreserveExistingSelection(productId, options = {}) {
    if (options.additive || options.range || selectedProductIds.size < 2 || !selectedProductIds.has(String(productId))) return false;
    return Boolean(current && !['collection', 'table'].includes(current.kind));
  }

  function selectProduct(state, productId, { target = null, additive = false, range = false } = {}) {
    const id = String(productId || '');
    const included = new Set((Array.isArray(state?.selectedIds) ? state.selectedIds : []).map(String));
    if (!id || !included.has(id)) return get();
    const nextTarget = normalize(target) || targetForProduct(state, id);

    if (shouldPreserveExistingSelection(id, { additive, range })) {
      const changed = !equal(nextTarget, current);
      current = nextTarget;
      anchorProductId = id;
      if (changed) emit();
      return get();
    }

    const next = new Set(selectedProductIds);
    if (range && anchorProductId) {
      const ordered = orderedCatalogIds(state);
      const start = ordered.indexOf(anchorProductId);
      const end = ordered.indexOf(id);
      if (start >= 0 && end >= 0) {
        if (!additive) next.clear();
        const from = Math.min(start, end);
        const to = Math.max(start, end);
        ordered.slice(from, to + 1).forEach(value => next.add(value));
      } else {
        if (!additive) next.clear();
        next.add(id);
      }
    } else if (additive) {
      if (next.has(id)) next.delete(id);
      else next.add(id);
      anchorProductId = id;
    } else {
      next.clear();
      next.add(id);
      anchorProductId = id;
    }

    selectedProductIds = next;
    if (selectedProductIds.has(id)) current = nextTarget;
    else if (current?.productId === id) {
      const fallback = Array.from(selectedProductIds).at(-1);
      current = fallback ? normalize(targetForProduct(state, fallback)) : null;
    }
    if (!selectedProductIds.size) current = null;
    emit();
    return get();
  }

  function clear() {
    const changed = current || selectedProductIds.size || anchorProductId;
    current = null;
    selectedProductIds.clear();
    anchorProductId = '';
    if (changed) emit();
    return null;
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
    if (normalized.kind === 'collection-member') {
      return block.type === 'collection'
        && selected.has(normalized.productId)
        && (Array.isArray(block.memberIds) ? block.memberIds : []).map(String).includes(normalized.productId);
    }
    if (normalized.kind === 'table-row') {
      if (block.type !== 'table' || !selected.has(normalized.productId)) return false;
      const rows = NS.TableBlock?.rowsForBlock?.(block, productsForBlock(state, block)) || [];
      return rows.some(row => String(row.rowId) === normalized.rowId && String(row.productId) === normalized.productId);
    }
    return false;
  }

  function reconcile(state) {
    const included = new Set((Array.isArray(state?.selectedIds) ? state.selectedIds : []).map(String));
    const before = ids();
    selectedProductIds = new Set(before.filter(id => included.has(id)));
    if (anchorProductId && !included.has(anchorProductId)) anchorProductId = '';
    if (current && !isValidTarget(state, current)) {
      const fallback = Array.from(selectedProductIds).at(-1);
      current = fallback ? normalize(targetForProduct(state, fallback)) : null;
    }
    if (!selectedProductIds.size && current?.productId) current = null;
    const after = ids();
    if (JSON.stringify(before) !== JSON.stringify(after)) emit();
    return get();
  }

  NS.ComposerSelection = {
    normalize,
    get,
    ids,
    anchor,
    select,
    selectProduct,
    clear,
    blockMembership,
    productIdsForTarget,
    targetForProduct,
    isValidTarget,
    reconcile
  };
})();
