(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};

  function uniqueIds(values) {
    const seen = new Set();
    return (Array.isArray(values) ? values : []).map(String).filter(id => {
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function productMap(state) {
    return new Map((Array.isArray(state?.products) ? state.products : []).map(product => [String(product.id), product]));
  }

  function selectedIds(state) {
    const byId = productMap(state);
    return uniqueIds(state?.selectedIds).filter(id => byId.has(id));
  }

  function categoryOf(product) {
    return String(product?.category || '').trim() || 'Sem categoria';
  }

  function categorySequence(state) {
    const byId = productMap(state);
    const seen = new Set();
    const categories = [];
    selectedIds(state).forEach(id => {
      const category = categoryOf(byId.get(id));
      if (seen.has(category)) return;
      seen.add(category);
      categories.push(category);
    });
    return categories;
  }

  function normalizedOrder(state) {
    const selected = new Set(selectedIds(state));
    return uniqueIds(state?.catalog?.presentation?.order).filter(id => selected.has(id));
  }

  function effectiveIds(state) {
    const byId = productMap(state);
    const selected = selectedIds(state);
    const explicit = normalizedOrder(state);
    const explicitSet = new Set(explicit);
    const categories = categorySequence(state);
    const result = [];

    categories.forEach(category => {
      explicit.forEach(id => {
        if (categoryOf(byId.get(id)) === category) result.push(id);
      });
      selected.forEach(id => {
        if (!explicitSet.has(id) && categoryOf(byId.get(id)) === category) result.push(id);
      });
    });
    return result;
  }

  function effectiveProducts(state, { activeOnly = false } = {}) {
    const byId = productMap(state);
    return effectiveIds(state)
      .map(id => byId.get(id))
      .filter(product => product && (!activeOnly || product.status !== 'Inativo'));
  }

  function validBlockUnits(state, category) {
    const ids = effectiveIds(state).filter(id => categoryOf(productMap(state).get(id)) === category);
    const indexById = new Map(ids.map((id, index) => [id, index]));
    const claimed = new Set();
    const valid = [];
    const blocks = Array.isArray(state?.catalog?.presentation?.blocks) ? state.catalog.presentation.blocks : [];

    blocks.forEach(raw => {
      if (!raw || !['collection', 'table'].includes(raw.type)) return;
      const members = uniqueIds(raw.memberIds).filter(id => indexById.has(id));
      if (members.length < 2 || members.length !== uniqueIds(raw.memberIds).length) return;
      const positions = members.map(id => indexById.get(id)).sort((a, b) => a - b);
      const contiguous = positions.every((value, index) => index === 0 || value === positions[index - 1] + 1);
      if (!contiguous || members.some(id => claimed.has(id))) return;
      const orderedMembers = ids.filter(id => members.includes(id));
      orderedMembers.forEach(id => claimed.add(id));
      valid.push({
        id: `${raw.type}:${String(raw.id)}`,
        type: raw.type,
        blockId: String(raw.id),
        category,
        memberIds: orderedMembers,
        firstIndex: Math.min(...positions)
      });
    });
    return valid.sort((a, b) => a.firstIndex - b.firstIndex);
  }

  function unitsForCategory(state, category) {
    const byId = productMap(state);
    const ids = effectiveIds(state).filter(id => categoryOf(byId.get(id)) === category);
    const blocks = validBlockUnits(state, category);
    const blockByMember = new Map();
    blocks.forEach(block => block.memberIds.forEach(id => blockByMember.set(id, block)));
    const emitted = new Set();
    const units = [];

    ids.forEach(id => {
      const block = blockByMember.get(id);
      if (!block) {
        units.push({ id: `card:${id}`, type: 'card', productId: id, category, memberIds: [id] });
        return;
      }
      if (emitted.has(block.id)) return;
      emitted.add(block.id);
      units.push({ ...block });
    });
    return units;
  }

  function allUnits(state) {
    return categorySequence(state).flatMap(category => unitsForCategory(state, category));
  }

  function orderFromUnits(state, category, units) {
    const current = effectiveIds(state);
    const byId = productMap(state);
    const replacement = units.flatMap(unit => unit.memberIds.map(String));
    const first = current.findIndex(id => categoryOf(byId.get(id)) === category);
    const withoutCategory = current.filter(id => categoryOf(byId.get(id)) !== category);
    if (first < 0) return current;
    const prefixCount = current.slice(0, first).filter(id => categoryOf(byId.get(id)) !== category).length;
    withoutCategory.splice(prefixCount, 0, ...replacement);
    return withoutCategory;
  }

  function moveUnit(state, sourceUnitId, targetUnitId, position = 'before') {
    const units = allUnits(state);
    const source = units.find(unit => unit.id === String(sourceUnitId));
    const target = units.find(unit => unit.id === String(targetUnitId));
    if (!source || !target || source.category !== target.category || source.id === target.id) return effectiveIds(state);
    const categoryUnits = unitsForCategory(state, source.category);
    const sourceIndex = categoryUnits.findIndex(unit => unit.id === source.id);
    let targetIndex = categoryUnits.findIndex(unit => unit.id === target.id);
    if (sourceIndex < 0 || targetIndex < 0) return effectiveIds(state);
    const [moved] = categoryUnits.splice(sourceIndex, 1);
    if (sourceIndex < targetIndex) targetIndex -= 1;
    if (position === 'after') targetIndex += 1;
    categoryUnits.splice(Math.max(0, Math.min(categoryUnits.length, targetIndex)), 0, moved);
    return orderFromUnits(state, source.category, categoryUnits);
  }

  function moveUnitRelative(state, sourceUnitId, delta) {
    const units = allUnits(state);
    const source = units.find(unit => unit.id === String(sourceUnitId));
    if (!source) return effectiveIds(state);
    const categoryUnits = unitsForCategory(state, source.category);
    const index = categoryUnits.findIndex(unit => unit.id === source.id);
    const targetIndex = index + (Number(delta) < 0 ? -1 : 1);
    if (index < 0 || targetIndex < 0 || targetIndex >= categoryUnits.length) return effectiveIds(state);
    const target = categoryUnits[targetIndex];
    return moveUnit(state, source.id, target.id, delta < 0 ? 'before' : 'after');
  }

  function removeFromOrder(order, productId) {
    const id = String(productId);
    return uniqueIds(order).filter(item => item !== id);
  }

  NS.CatalogOrder = {
    uniqueIds,
    selectedIds,
    categoryOf,
    categorySequence,
    normalizedOrder,
    effectiveIds,
    effectiveProducts,
    validBlockUnits,
    unitsForCategory,
    allUnits,
    moveUnit,
    moveUnitRelative,
    removeFromOrder
  };
})();