(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  if (!NS.CatalogDocument?.build || !NS.Collection || !NS.Composition) return;

  const originalBuild = NS.CatalogDocument.build.bind(NS.CatalogDocument);

  function getTemplate(state, override) {
    if (override) return override;
    return NS.Templates?.getTemplate?.(state?.catalog?.templateId) || { id: 'technical', columns: 2, rows: 4, perPage: 8, className: 'template-technical' };
  }

  function buildCollectionDocument(state, templateOverride) {
    const template = getTemplate(state, templateOverride);
    const presentation = NS.Composition.normalizePresentation(state?.catalog?.presentation);
    const blocks = NS.Collection.normalizeBlocks(presentation.blocks);
    if (!blocks.length) return originalBuild(state, templateOverride);

    const selected = NS.CatalogDocument.getRenderableProducts(state);
    const groups = NS.CatalogDocument.groupByCategory(selected);
    const pages = [];
    const orderedIds = [];
    const effectiveOrderById = {};
    let effectiveOrder = 0;

    groups.forEach((group, categoryIndex) => {
      const nodes = NS.Collection.buildFlowNodes(group.products, blocks, template, presentation);
      const categoryPages = NS.Collection.paginateNodes(nodes, template);

      categoryPages.forEach((entry, categoryPageIndex) => {
        const items = entry.layout.items.map(layoutItem => {
          if (layoutItem.type === 'collection') {
            const memberEffectiveOrders = {};
            layoutItem.members.forEach(member => {
              const id = String(member.id);
              effectiveOrder += 1;
              orderedIds.push(id);
              effectiveOrderById[id] = effectiveOrder;
              memberEffectiveOrders[id] = effectiveOrder;
            });
            return {
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
            };
          }

          const product = layoutItem.product;
          const id = String(product.id);
          effectiveOrder += 1;
          orderedIds.push(id);
          effectiveOrderById[id] = effectiveOrder;
          return {
            type: 'card',
            product,
            productId: id,
            effectiveOrder,
            contentPreset: layoutItem.contentPreset || NS.Composition.resolveContentPreset(product, layoutItem.style?.contentPreset),
            emphasis: layoutItem.style?.emphasis || 'normal',
            width: layoutItem.style?.width || 'simple',
            slotSpan: layoutItem.slotSpan,
            rowSpan: 1,
            row: layoutItem.row,
            start: layoutItem.start,
            span: layoutItem.span
          };
        });

        const flattenedProducts = items.flatMap(item => item.type === 'collection' ? item.members : [item.product]).filter(Boolean);
        pages.push({
          index: pages.length,
          category: group.category,
          categoryIndex,
          categoryPageIndex,
          categoryPageTotal: categoryPages.length,
          categoryProductCount: group.products.length,
          products: flattenedProducts,
          items,
          layout: entry.layout
        });
      });
    });

    if (!pages.length) return originalBuild(state, templateOverride);

    return {
      schemaVersion: 3,
      createdAt: state?.catalog?.createdAt || null,
      title: state?.catalog?.title || '',
      showPrices: state?.catalog?.showPrices !== false,
      template,
      presentation,
      blocks,
      selectedCount: selected.length,
      categoryCount: groups.length,
      pageCount: pages.length,
      groups,
      pages,
      orderedIds,
      effectiveOrderById
    };
  }

  NS.CatalogDocument.build = buildCollectionDocument;
})();
