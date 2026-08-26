(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  if (!NS.CatalogDocument?.build || !NS.Collection || !NS.TableBlock || !NS.Composition) return;

  const originalBuild = NS.CatalogDocument.build.bind(NS.CatalogDocument);

  function getTemplate(state, override) {
    if (override) return override;
    return NS.Templates?.getTemplate?.(state?.catalog?.templateId) || { id: 'technical', columns: 2, rows: 4, perPage: 8, className: 'template-technical' };
  }

  function resolveBlocks(blocks, products) {
    const claimed = new Set();
    const resolved = [];
    (Array.isArray(blocks) ? blocks : []).forEach(rawBlock => {
      let block = null;
      let valid = false;
      if (rawBlock?.type === 'table') {
        block = NS.TableBlock.normalizeBlock(rawBlock);
        valid = NS.TableBlock.validBlocksForProducts([block], products).length === 1;
      } else if (rawBlock?.type === 'collection') {
        block = NS.Collection.normalizeBlock(rawBlock);
        valid = NS.Collection.validBlocksForProducts([block], products).length === 1;
      }
      if (!block || !valid) return;
      if (block.memberIds.some(id => claimed.has(String(id)))) return;
      const memberSet = new Set(block.memberIds.map(String));
      const factualIds = products.map(product => String(product.id)).filter(id => memberSet.has(id));
      block = { ...block, memberIds: factualIds };
      factualIds.forEach(id => claimed.add(id));
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
      if (emitted.has(`${block.type}:${block.id}`)) return;
      emitted.add(`${block.type}:${block.id}`);
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

  function buildTableDocument(state, templateOverride) {
    const template = getTemplate(state, templateOverride);
    const presentation = NS.Composition.normalizePresentation(state?.catalog?.presentation);
    const tableBlocks = NS.TableBlock.normalizeBlocks(presentation.blocks);
    if (!tableBlocks.length) return originalBuild(state, templateOverride);

    const selected = NS.CatalogDocument.getRenderableProducts(state);
    const groups = NS.CatalogDocument.groupByCategory(selected);
    const orderedIds = selected.map(product => String(product.id));
    const effectiveOrderById = Object.fromEntries(orderedIds.map((id, index) => [id, index + 1]));
    const pages = [];
    const materializedBlocks = [];

    groups.forEach((group, categoryIndex) => {
      const flow = buildFlowNodes(group.products, presentation.blocks, template, presentation);
      flow.resolvedBlocks.forEach(block => {
        if (!materializedBlocks.some(existing => existing.type === block.type && existing.id === block.id)) materializedBlocks.push(block);
      });
      const categoryPages = NS.Collection.paginateNodes(flow.nodes, template);
      categoryPages.forEach((entry, categoryPageIndex) => {
        const items = materializePageItems(entry.layout.items, effectiveOrderById);
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

    if (!pages.length) return originalBuild(state, templateOverride);

    return {
      schemaVersion: 4,
      createdAt: state?.catalog?.createdAt || null,
      title: state?.catalog?.title || '',
      showPrices: state?.catalog?.showPrices !== false,
      template,
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

  NS.CatalogDocument.build = buildTableDocument;
  NS.TableDocument = {
    resolveBlocks,
    buildFlowNodes,
    materializePageItems
  };
})();