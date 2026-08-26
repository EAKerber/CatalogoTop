(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};

  function getTemplate(state, override) {
    if (override) return override;
    if (NS.Templates?.getTemplate) return NS.Templates.getTemplate(state?.catalog?.templateId);
    return { id: 'technical', columns: 2, rows: 4, perPage: 8, className: 'template-technical' };
  }

  function getRenderableProducts(state) {
    const products = Array.isArray(state?.products) ? state.products : [];
    const byId = new Map(products.map(product => [String(product.id), product]));
    const selectedIds = Array.isArray(state?.selectedIds) ? state.selectedIds : [];
    return selectedIds
      .map(id => byId.get(String(id)))
      .filter(product => product && product.status !== 'Inativo');
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
      : { distribution: 'balanced', typography: 'neutral', itemStyles: {} };
  }

  function fallbackPaginate(products, template) {
    const perPage = Math.max(1, Number(template?.perPage) || 8);
    const pages = [];
    for (let index = 0; index < products.length; index += perPage) {
      pages.push({ products: products.slice(index, index + perPage), layout: null });
    }
    return pages;
  }

  function build(state, templateOverride) {
    const template = getTemplate(state, templateOverride);
    const presentation = normalizePresentation(state);
    const selected = getRenderableProducts(state);
    const groups = groupByCategory(selected);
    const pages = [];
    const effectiveOrderById = {};
    const orderedIds = [];
    let effectiveOrder = 0;

    groups.forEach((group, categoryIndex) => {
      const categoryPages = NS.Composition?.paginateProducts
        ? NS.Composition.paginateProducts(group.products, template, presentation)
        : fallbackPaginate(group.products, template);

      categoryPages.forEach((entry, categoryPageIndex) => {
        const layoutItems = Array.isArray(entry?.layout?.items) ? entry.layout.items : [];
        const orderedProducts = layoutItems.length
          ? layoutItems.map(item => item.product).filter(Boolean)
          : (Array.isArray(entry?.products) ? entry.products : []);

        const layoutById = new Map(layoutItems.map(item => [String(item.product?.id), item]));
        const items = orderedProducts.map(product => {
          effectiveOrder += 1;
          const id = String(product.id);
          orderedIds.push(id);
          effectiveOrderById[id] = effectiveOrder;
          const layout = layoutById.get(id) || null;
          return {
            product,
            productId: id,
            effectiveOrder,
            contentPreset: layout?.contentPreset || NS.Composition?.resolveContentPreset?.(product, layout?.style?.contentPreset) || 'visual',
            emphasis: layout?.style?.emphasis || 'normal',
            row: Number(layout?.row) || null,
            start: Number(layout?.start) || null,
            span: Number(layout?.span) || null
          };
        });

        pages.push({
          index: pages.length,
          category: group.category,
          categoryIndex,
          categoryPageIndex,
          categoryPageTotal: categoryPages.length,
          categoryProductCount: group.products.length,
          products: orderedProducts,
          items,
          layout: entry?.layout || null
        });
      });
    });

    return {
      schemaVersion: 1,
      createdAt: state?.catalog?.createdAt || null,
      title: state?.catalog?.title || '',
      showPrices: state?.catalog?.showPrices !== false,
      template,
      presentation,
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
    const ordered = new Set(doc.orderedIds);
    const remaining = (Array.isArray(state?.selectedIds) ? state.selectedIds : [])
      .map(String)
      .filter(id => !ordered.has(id));
    return {
      ...state,
      selectedIds: [...doc.orderedIds, ...remaining]
    };
  }

  NS.CatalogDocument = {
    build,
    getRenderableProducts,
    groupByCategory,
    withEffectiveOrder
  };
})();
