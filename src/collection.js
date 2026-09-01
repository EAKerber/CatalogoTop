(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const Composition = NS.Composition;

  const COLLECTION_THEMES = Object.freeze([
    { id: 'light', name: 'Claro' },
    { id: 'dark', name: 'Escuro' }
  ]);
  const COLLECTION_PRESETS = Object.freeze([
    { id: 'visual', name: 'Visual' },
    { id: 'compact', name: 'Compacto' },
    { id: 'commercial', name: 'Comercial' },
    { id: 'technical', name: 'Técnico' }
  ]);
  const COLLECTION_COLUMNS = Object.freeze([2, 3, 4]);
  const TECHNICAL_SPEC_BUDGETS = Object.freeze({ simple: 1, wide: 2, full: 2 });
  const MAX_MEMBERS = 12;

  function choice(value, allowed, fallback) {
    const text = String(value || '');
    return allowed.some(item => String(item.id) === text) ? text : fallback;
  }

  function uniqueIds(values) {
    const seen = new Set();
    return (Array.isArray(values) ? values : []).map(String).filter(id => {
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function normalizeMemberStyle(style) {
    const source = style && typeof style === 'object' ? style : {};
    const priceStyles = Composition?.PRICE_STYLES || [{ id: 'standard' }];
    return {
      emphasis: source.emphasis === 'feature' ? 'feature' : 'normal',
      width: ['simple', 'wide', 'full'].includes(source.width) ? source.width : 'simple',
      priceStyle: choice(source.priceStyle, priceStyles, 'standard')
    };
  }

  function normalizeBlock(block, index = 0) {
    const source = block && typeof block === 'object' ? block : {};
    const itemStyles = {};
    if (source.itemStyles && typeof source.itemStyles === 'object') {
      Object.entries(source.itemStyles).forEach(([id, style]) => {
        if (id) itemStyles[String(id)] = normalizeMemberStyle(style);
      });
    }
    const members = uniqueIds(source.memberIds || source.members).slice(0, MAX_MEMBERS);
    return {
      id: String(source.id || `collection-${index + 1}`),
      type: 'collection',
      memberIds: members,
      title: String(source.title || '').trim(),
      subtitle: String(source.subtitle || '').trim(),
      theme: choice(source.theme, COLLECTION_THEMES, 'light'),
      columns: COLLECTION_COLUMNS.includes(Number(source.columns)) ? Number(source.columns) : 4,
      itemPreset: choice(source.itemPreset, COLLECTION_PRESETS, 'visual'),
      itemStyles
    };
  }

  function normalizeBlocks(raw) {
    return (Array.isArray(raw) ? raw : [])
      .filter(block => block?.type === 'collection' || (!block?.type && block?.memberIds))
      .map(normalizeBlock)
      .filter(block => block.memberIds.length >= 2);
  }

  function memberStyleFor(block, productId) {
    const normalized = normalizeBlock(block);
    return normalizeMemberStyle(normalized.itemStyles[String(productId)]);
  }

  function technicalSpecBudget(style) {
    const normalized = normalizeMemberStyle(style);
    return TECHNICAL_SPEC_BUDGETS[normalized.width] || TECHNICAL_SPEC_BUDGETS.simple;
  }

  function technicalDetailFor(product, style) {
    const specs = (Array.isArray(product?.specs) ? product.specs : []).reduce((items, spec) => {
      if (!spec || typeof spec !== 'object') return items;
      const value = String(spec.value ?? '').trim();
      if (!value) return items;
      items.push({ label: String(spec.label ?? '').trim(), value });
      return items;
    }, []);
    const limit = technicalSpecBudget(style);
    return {
      specs: specs.slice(0, limit),
      omittedSpecCount: Math.max(0, specs.length - limit),
      limit
    };
  }

  function localSpan(style, columns) {
    const total = Math.max(2, Math.min(4, Number(columns) || 4));
    if (style?.width === 'full') return total;
    if (style?.width === 'wide') return Math.min(2, total);
    return 1;
  }

  function planCollection(block, members, template) {
    const normalized = normalizeBlock(block);
    const columns = normalized.columns;
    const rows = [];
    let current = [];
    let used = 0;
    const flush = () => {
      if (!current.length) return;
      rows.push(current);
      current = [];
      used = 0;
    };
    (Array.isArray(members) ? members : []).forEach(product => {
      const style = memberStyleFor(normalized, product.id);
      const slotSpan = localSpan(style, columns);
      if (current.length && slotSpan > columns - used) flush();
      current.push({ product, productId: String(product.id), style, slotSpan, start: used + 1, row: rows.length + 1 });
      used += slotSpan;
      if (used >= columns) flush();
    });
    flush();
    rows.forEach((row, rowIndex) => row.forEach(item => { item.row = rowIndex + 1; }));
    const localRowCount = Math.max(1, rows.length);
    const maxPageRows = Math.max(1, Number(template?.rows) || 4);
    const rowSpan = Math.min(localRowCount, maxPageRows);
    return { columns, rows, items: rows.flat(), localRowCount, rowSpan, compressed: localRowCount > rowSpan };
  }

  function contiguousMemberRun(block, products) {
    const indexById = new Map((Array.isArray(products) ? products : []).map((product, index) => [String(product.id), index]));
    const positions = block.memberIds.map(id => indexById.get(String(id)));
    if (positions.some(value => value == null)) return false;
    const sorted = positions.slice().sort((a, b) => a - b);
    return sorted.every((value, index) => index === 0 || value === sorted[index - 1] + 1);
  }

  function validBlocksForProducts(blocks, products) {
    const list = Array.isArray(products) ? products : [];
    const byId = new Map(list.map(product => [String(product.id), product]));
    const category = String(list[0]?.category || '').trim();
    const consumed = new Set();
    const valid = [];
    for (const block of normalizeBlocks(blocks)) {
      const members = block.memberIds.map(id => byId.get(String(id))).filter(Boolean);
      const isValid = members.length === block.memberIds.length
        && members.length >= 2
        && members.every(product => String(product.category || '').trim() === category)
        && contiguousMemberRun(block, list)
        && block.memberIds.every(id => !consumed.has(String(id)));
      if (!isValid) continue;
      block.memberIds.forEach(id => consumed.add(String(id)));
      valid.push(block);
    }
    return valid;
  }

  function buildFlowNodes(products, blocks, template, presentation) {
    const list = Array.isArray(products) ? products : [];
    const validBlocks = validBlocksForProducts(blocks, list);
    const blockByMember = new Map();
    validBlocks.forEach(block => block.memberIds.forEach(id => blockByMember.set(String(id), block)));
    const emitted = new Set();
    const nodes = [];
    list.forEach(product => {
      const id = String(product.id);
      const block = blockByMember.get(id);
      if (block) {
        if (emitted.has(block.id)) return;
        emitted.add(block.id);
        const memberSet = new Set(block.memberIds.map(String));
        const members = list.filter(member => memberSet.has(String(member.id)));
        const collectionLayout = planCollection(block, members, template);
        nodes.push({
          id: `collection:${block.id}`,
          type: 'collection',
          block: { ...block, memberIds: members.map(member => String(member.id)) },
          members,
          memberIds: members.map(member => String(member.id)),
          rowSpan: collectionLayout.rowSpan,
          collectionLayout
        });
        return;
      }
      const style = Composition.styleFor(presentation, id);
      nodes.push({
        id: `card:${id}`,
        type: 'card',
        product,
        productId: id,
        style,
        contentPreset: Composition.resolveContentPreset(product, style.contentPreset),
        slotSpan: Composition.slotSpanFor(style, template),
        rowSpan: 1
      });
    });
    return nodes;
  }

  function planFlowNodes(nodes, template) {
    const slotsPerRow = Composition.templateSlotCount(template);
    const microPerSlot = 6 / slotsPerRow;
    const items = [];
    let row = 1;
    let used = 0;
    const nextRow = () => {
      if (used > 0) row += 1;
      used = 0;
    };
    (Array.isArray(nodes) ? nodes : []).forEach(node => {
      if (node.type === 'collection') {
        nextRow();
        const rowSpan = Math.max(1, Number(node.rowSpan) || 1);
        items.push({ ...node, row, start: 1, span: 6, slotSpan: slotsPerRow, rowSpan });
        row += rowSpan;
        used = 0;
        return;
      }
      const slotSpan = Math.max(1, Math.min(slotsPerRow, Number(node.slotSpan) || 1));
      if (used && slotSpan > slotsPerRow - used) nextRow();
      const startSlot = used + 1;
      items.push({
        ...node,
        row,
        startSlot,
        start: Math.round((startSlot - 1) * microPerSlot) + 1,
        span: Math.round(slotSpan * microPerSlot),
        slotSpan,
        rowSpan: Math.max(1, Number(node.rowSpan) || 1)
      });
      used += slotSpan;
      if (used >= slotsPerRow) nextRow();
    });
    const rowCount = Math.max(0, items.reduce((max, item) => Math.max(max, item.row + Math.max(1, item.rowSpan || 1) - 1), 0));
    return { items, rowCount, slotsPerRow };
  }

  function paginateNodes(nodes, template) {
    const maxRows = Math.max(1, Number(template?.rows) || 4);
    const pages = [];
    let current = [];
    for (const node of (Array.isArray(nodes) ? nodes : [])) {
      const candidate = current.concat(node);
      const plan = planFlowNodes(candidate, template);
      if (current.length && plan.rowCount > maxRows) {
        pages.push({ nodes: current, layout: planFlowNodes(current, template) });
        current = [node];
      } else current = candidate;
    }
    if (current.length) pages.push({ nodes: current, layout: planFlowNodes(current, template) });
    return pages;
  }

  function blockForMember(blocks, productId) {
    const id = String(productId);
    return normalizeBlocks(blocks).find(block => block.memberIds.includes(id)) || null;
  }

  NS.Collection = {
    COLLECTION_THEMES,
    COLLECTION_PRESETS,
    COLLECTION_COLUMNS,
    TECHNICAL_SPEC_BUDGETS,
    MAX_MEMBERS,
    normalizeMemberStyle,
    normalizeBlock,
    normalizeBlocks,
    memberStyleFor,
    technicalSpecBudget,
    technicalDetailFor,
    localSpan,
    planCollection,
    validBlocksForProducts,
    buildFlowNodes,
    planFlowNodes,
    paginateNodes,
    blockForMember
  };
})();