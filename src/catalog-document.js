(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};

  function getTemplate(state, override) {
    if (override) return override;
    if (!NS.Templates?.resolveCatalog) {
      const error = new Error('Registry de templates indisponível.');
      error.code = 'template_registry_unavailable';
      throw error;
    }
    return NS.Templates.resolveCatalog(state?.catalog);
  }

  function getRenderableProducts(state) {
    if (NS.CatalogOrder?.effectiveProducts) return NS.CatalogOrder.effectiveProducts(state, { activeOnly: true });
    const products = Array.isArray(state?.products) ? state.products : [];
    const byId = new Map(products.map(product => [String(product.id), product]));
    const selectedIds = Array.isArray(state?.selectedIds) ? state.selectedIds : [];
    return selectedIds.map(id => byId.get(String(id))).filter(product => product && product.status !== 'Inativo');
  }

  function groupByCategory(products) {
    const groups = [];
    const byCategory = new Map();
    products.forEach(product => {
      const category = String(product?.category || '').trim() || 'Sem categoria';
      let group = byCategory.get(category);
      if (!group) {
        group = { category, products: [] };
        byCategory.set(category, group);
        groups.push(group);
      }
      group.products.push(product);
    });
    return groups;
  }

  function normalizePresentation(state) {
    return NS.Composition?.normalizePresentation
      ? NS.Composition.normalizePresentation(state?.catalog?.presentation)
      : { distribution: 'balanced', typography: 'neutral', order: [], itemStyles: {}, blocks: [], imageFrames: {} };
  }

  function resolveBlocks(blocks, products) {
    const claimed = new Set();
    const resolved = [];
    (Array.isArray(blocks) ? blocks : []).forEach(rawBlock => {
      let block = null;
      let valid = false;
      if (rawBlock?.type === 'table' && NS.TableBlock) {
        block = NS.TableBlock.normalizeBlock(rawBlock);
        valid = NS.TableBlock.validBlocksForProducts([block], products).length === 1;
      } else if (rawBlock?.type === 'collection' && NS.Collection) {
        block = NS.Collection.normalizeBlock(rawBlock);
        valid = NS.Collection.validBlocksForProducts([block], products).length === 1;
      }
      if (!block || !valid || block.memberIds.some(id => claimed.has(String(id)))) return;
      const memberSet = new Set(block.memberIds.map(String));
      const effectiveIds = products.map(product => String(product.id)).filter(id => memberSet.has(id));
      block = { ...block, memberIds: effectiveIds };
      effectiveIds.forEach(id => claimed.add(id));
      resolved.push(block);
    });
    return resolved;
  }

  function buildFlowNodes(products, blocks, template, presentation) {
    const list = Array.isArray(products) ? products : [];
    const resolvedBlocks = resolveBlocks(blocks, list);
    const blockByMember = new Map();
    resolvedBlocks.forEach(block => block.memberIds.forEach(id => blockByMember.set(String(id), block)));
    const emitted = new Set();
    const byId = new Map(list.map(product => [String(product.id), product]));
    const slotsPerRow = NS.Composition.templateSlotCount(template);
    const nodes = [];

    list.forEach(product => {
      const id = String(product.id);
      const block = blockByMember.get(id);
      if (!block) {
        const style = NS.Composition.styleFor(presentation, id);
        nodes.push({
          id: `card:${id}`,
          type: 'card',
          product,
          productId: id,
          style,
          contentPreset: NS.Composition.resolveContentPreset(product, style.contentPreset),
          slotSpan: NS.Composition.slotSpanFor(style, template),
          rowSpan: 1
        });
        return;
      }

      const key = `${block.type}:${block.id}`;
      if (emitted.has(key)) return;
      emitted.add(key);
      const members = block.memberIds.map(memberId => byId.get(String(memberId))).filter(Boolean);

      if (block.type === 'collection') {
        const collectionLayout = NS.Collection.planCollection(block, members, template);
        nodes.push({
          id: `collection:${block.id}`,
          type: 'collection',
          block,
          members,
          memberIds: block.memberIds.slice(),
          rowSpan: collectionLayout.rowSpan,
          collectionLayout
        });
        return;
      }

      const tablePlan = NS.TableBlock.fragmentTable(block, members);
      tablePlan.fragments.forEach(fragment => {
        nodes.push({
          id: `table:${block.id}:${fragment.fragmentIndex}`,
          type: 'table-fragment',
          block: tablePlan.block,
          blockId: tablePlan.block.id,
          members,
          memberIds: tablePlan.block.memberIds.slice(),
          rows: fragment.rows,
          columnDemand: { ...tablePlan.columnDemand },
          fragmentIndex: fragment.fragmentIndex,
          fragmentTotal: fragment.fragmentTotal,
          slotSpan: slotsPerRow,
          rowSpan: 1
        });
      });
    });

    return { nodes, resolvedBlocks };
  }

  function materializePageItems(layoutItems, effectiveOrderById) {
    const items = [];
    (Array.isArray(layoutItems) ? layoutItems : []).forEach(layoutItem => {
      if (layoutItem.type === 'collection') {
        const memberEffectiveOrders = {};
        layoutItem.memberIds.forEach(id => { memberEffectiveOrders[id] = effectiveOrderById[id]; });
        items.push({
          type: 'collection',
          id: layoutItem.id,
          blockId: layoutItem.block.id,
          block: layoutItem.block,
          members: layoutItem.members,
          memberIds: layoutItem.memberIds,
          memberEffectiveOrders,
          row: layoutItem.row,
          rowSpan: layoutItem.rowSpan,
          start: layoutItem.start,
          span: layoutItem.span,
          slotSpan: layoutItem.slotSpan,
          collectionLayout: layoutItem.collectionLayout
        });
        return;
      }

      if (layoutItem.type === 'table-fragment') {
        const previous = items[items.length - 1];
        if (previous?.type === 'table'
          && previous.blockId === layoutItem.blockId
          && previous.row + previous.rowSpan === layoutItem.row) {
          previous.rows.push(...layoutItem.rows);
          previous.rowSpan += 1;
          previous.fragmentEnd = layoutItem.fragmentIndex;
          return;
        }
        items.push({
          type: 'table',
          id: `table:${layoutItem.blockId}:${layoutItem.fragmentIndex}`,
          blockId: layoutItem.blockId,
          block: layoutItem.block,
          members: layoutItem.members,
          memberIds: layoutItem.memberIds,
          rows: layoutItem.rows.slice(),
          columnDemand: { ...(layoutItem.columnDemand || {}) },
          fragmentStart: layoutItem.fragmentIndex,
          fragmentEnd: layoutItem.fragmentIndex,
          fragmentTotal: layoutItem.fragmentTotal,
          row: layoutItem.row,
          rowSpan: 1,
          start: layoutItem.start,
          span: layoutItem.span,
          slotSpan: layoutItem.slotSpan
        });
        return;
      }

      const product = layoutItem.product;
      const id = String(product.id);
      items.push({
        type: 'card',
        product,
        productId: id,
        effectiveOrder: effectiveOrderById[id],
        contentPreset: layoutItem.contentPreset || NS.Composition.resolveContentPreset(product, layoutItem.style?.contentPreset),
        emphasis: layoutItem.style?.emphasis || 'normal',
        width: layoutItem.style?.width || 'simple',
        slotSpan: layoutItem.slotSpan,
        rowSpan: 1,
        row: layoutItem.row,
        start: layoutItem.start,
        span: layoutItem.span
      });
    });
    return items;
  }

  function productsForPage(items) {
    const seen = new Set();
    const products = [];
    items.forEach(item => {
      const candidates = item.type === 'card' ? [item.product] : (item.members || []);
      candidates.forEach(product => {
        const id = String(product?.id || '');
        if (!id || seen.has(id)) return;
        seen.add(id);
        products.push(product);
      });
    });
    return products;
  }

  function build(state, templateOverride) {
    const template = getTemplate(state, templateOverride);
    const presentation = normalizePresentation(state);
    const selected = getRenderableProducts(state);
    const groups = groupByCategory(selected);
    const orderedIds = selected.map(product => String(product.id));
    const effectiveOrderById = Object.fromEntries(orderedIds.map((id, index) => [id, index + 1]));
    const pages = [];
    const materializedBlocks = [];

    groups.forEach((group, categoryIndex) => {
      const flow = buildFlowNodes(group.products, presentation.blocks, template, presentation);
      flow.resolvedBlocks.forEach(block => {
        if (!materializedBlocks.some(existing => existing.type === block.type && existing.id === block.id)) materializedBlocks.push(block);
      });
      const categoryPages = NS.Collection?.paginateNodes
        ? NS.Collection.paginateNodes(flow.nodes, template)
        : NS.Composition.paginateProducts(group.products, template, presentation);

      categoryPages.forEach((entry, categoryPageIndex) => {
        const layoutItems = Array.isArray(entry?.layout?.items) ? entry.layout.items : [];
        const items = materializePageItems(layoutItems, effectiveOrderById);
        pages.push({
          index: pages.length,
          category: group.category,
          categoryIndex,
          categoryPageIndex,
          categoryPageTotal: categoryPages.length,
          categoryProductCount: group.products.length,
          products: productsForPage(items),
          items,
          layout: entry.layout
        });
      });
    });

    return {
      schemaVersion: 4,
      createdAt: state?.catalog?.createdAt || null,
      title: state?.catalog?.title || '',
      showPrices: state?.catalog?.showPrices !== false,
      template,
      templateBinding: Object.freeze({ id: template.id, version: Number(template.version || state?.catalog?.templateVersion || 1) }),
      presentation,
      blocks: materializedBlocks,
      selectedCount: selected.length,
      categoryCount: groups.length,
      pageCount: pages.length,
      groups,
      pages,
      orderedIds,
      effectiveOrderById
    };
  }

  function withEffectiveOrder(state, documentModel) {
    const doc = documentModel || build(state);
    return {
      ...state,
      catalog: {
        ...state.catalog,
        presentation: NS.Composition.normalizePresentation({
          ...state.catalog?.presentation,
          order: doc.orderedIds
        })
      }
    };
  }

  NS.CatalogDocument = {
    build,
    getRenderableProducts,
    groupByCategory,
    resolveBlocks,
    buildFlowNodes,
    materializePageItems,
    productsForPage,
    withEffectiveOrder
  };
})();
