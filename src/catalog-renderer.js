(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const Render = NS.Render;
  if (!Render?.renderCatalog || !NS.CatalogDocument?.build) return;

  const baseRenderCatalog = Render.renderCatalog.bind(Render);

  function categoryDividerMarkup(page) {
    return `<div class="catalog-category-divider" data-category-divider="${Render.esc(page.category)}">
      <span>Categoria</span><strong>${Render.esc(page.category)}</strong><small>${page.categoryProductCount} ${page.categoryProductCount === 1 ? 'produto' : 'produtos'} · ${page.categoryPageTotal} ${page.categoryPageTotal === 1 ? 'página' : 'páginas'}</small>
    </div>`;
  }

  function markupForItem(item, state, template) {
    if (item.type === 'collection') return Render.collectionMarkup?.(item, state.catalog.showPrices) || '';
    if (item.type === 'table') return Render.tableMarkup?.(item, state.catalog.showPrices) || '';
    const layoutItem = {
      ...item,
      style: { contentPreset: item.contentPreset, emphasis: item.emphasis, width: item.width }
    };
    return Render.cardMarkup(item.product, template, state.catalog.showPrices, layoutItem);
  }

  function patchSkeleton(pageElement, page, pageIndex, pageTotal, state, template) {
    pageElement.dataset.category = page.category;
    pageElement.dataset.categoryPage = String(page.categoryPageIndex + 1);
    pageElement.dataset.documentPage = String(pageIndex + 1);
    pageElement.dataset.documentPageTotal = String(pageTotal);
    pageElement.style.setProperty('--catalog-cols', '6');
    pageElement.style.setProperty('--catalog-rows', String(Math.max(1, page.layout?.rowCount || 1)));
    pageElement.style.setProperty('--catalog-planned-rows', String(Math.max(1, page.layout?.rowCount || 1)));

    const title = pageElement.querySelector('.catalog-title-block h2');
    const count = pageElement.querySelector('.catalog-title-block p');
    if (title) title.textContent = page.category;
    if (count) count.textContent = `${page.categoryProductCount} ${page.categoryProductCount === 1 ? 'produto nesta categoria' : 'produtos nesta categoria'}`;

    const pageNumber = pageElement.querySelector('.footer-meta > div:first-child > strong');
    if (pageNumber) pageNumber.innerHTML = `${String(pageIndex + 1).padStart(2, '0')}<small> / ${String(pageTotal).padStart(2, '0')}</small>`;

    const grid = pageElement.querySelector('.catalog-products');
    if (grid) grid.innerHTML = page.items.map(item => markupForItem(item, state, template)).join('');
    pageElement.querySelector('.catalog-empty')?.remove();
    return pageElement;
  }

  function skeletonFor(page, state, template) {
    const firstProduct = page.products[0] || state.products.find(product => product.status === 'Ativo');
    if (!firstProduct) return null;
    const scratch = document.createElement('div');
    const tempState = {
      ...state,
      selectedIds: [firstProduct.id],
      catalog: {
        ...state.catalog,
        templateId: template.id,
        presentation: NS.Composition.normalizePresentation({ ...state.catalog.presentation, blocks: [] })
      }
    };
    baseRenderCatalog(scratch, tempState);
    return scratch.querySelector('.catalog-page');
  }

  function renderDocument(root, state) {
    const documentModel = NS.CatalogDocument.build(state);
    if (!documentModel.pageCount) {
      const summary = baseRenderCatalog(root, state);
      root.__catalogDocument = documentModel;
      return { ...summary, document: documentModel };
    }

    const template = documentModel.template;
    const fragments = [];
    documentModel.pages.forEach((page, index) => {
      const skeleton = skeletonFor(page, state, template);
      if (!skeleton) return;
      patchSkeleton(skeleton, page, index, documentModel.pageCount, state, template);
      if (page.categoryPageIndex === 0) fragments.push(categoryDividerMarkup(page));
      fragments.push(skeleton.outerHTML);
    });
    root.innerHTML = fragments.join('');
    root.__catalogDocument = documentModel;
    return {
      selectedCount: documentModel.selectedCount,
      pageCount: documentModel.pageCount,
      categoryCount: documentModel.categoryCount,
      categories: documentModel.groups.map(group => ({ category: group.category, productCount: group.products.length })),
      template,
      document: documentModel
    };
  }

  Render.baseRenderCatalog = baseRenderCatalog;
  Render.renderCatalog = renderDocument;
})();
