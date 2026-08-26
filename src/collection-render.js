(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  if (!NS.Render?.renderCatalog || !NS.Collection || !NS.CatalogDocument?.build) return;

  const Render = NS.Render;
  const originalRenderCatalog = Render.renderCatalog.bind(Render);

  function memberMarkup(item, block, showPrices) {
    const product = item.product;
    const preset = block.itemPreset || 'visual';
    const style = item.style || { emphasis: 'normal', width: 'simple' };
    const placement = `grid-column:${item.start} / span ${item.slotSpan};grid-row:${item.row};`;
    const price = showPrices && product.price && preset === 'commercial'
      ? `<strong class="catalog-collection-price">${Render.esc(product.price)}</strong>`
      : '';
    const description = preset === 'compact' ? '' : `<b>${Render.esc(product.description)}</b>`;
    const effectiveOrder = item.effectiveOrder ? ` data-effective-order="${item.effectiveOrder}"` : '';
    return `<article class="catalog-collection-item emphasis-${Render.esc(style.emphasis)} width-${Render.esc(style.width)} preset-${Render.esc(preset)}" data-product-id="${Render.esc(product.id)}" data-member-width="${Render.esc(style.width)}"${effectiveOrder} style="${placement}">
      <div class="catalog-collection-image"><img src="${Render.esc(product.image || Render.PLACEHOLDER)}" alt="${Render.esc(product.description)}" /></div>
      <div class="catalog-collection-copy"><span>${Render.esc(product.code)}</span>${description}${price}</div>
    </article>`;
  }

  function collectionMarkup(item, showPrices) {
    const block = item.block;
    const plan = item.collectionLayout;
    const orderById = item.memberEffectiveOrders || {};
    const plannedItems = plan.items.map(memberItem => ({ ...memberItem, effectiveOrder: orderById[memberItem.productId] || null }));
    const placement = `grid-column:1 / span 6;grid-row:${item.row} / span ${item.rowSpan};`;
    return `<section class="catalog-collection theme-${Render.esc(block.theme)} preset-${Render.esc(block.itemPreset)}${plan.compressed ? ' is-compressed' : ''}" data-collection-id="${Render.esc(block.id)}" data-local-rows="${plan.localRowCount}" data-row-span="${item.rowSpan}" style="${placement};--collection-cols:${plan.columns};--collection-rows:${plan.localRowCount};">
      ${(block.title || block.subtitle) ? `<header class="catalog-collection-header"><div>${block.title ? `<h3>${Render.esc(block.title)}</h3>` : ''}${block.subtitle ? `<p>${Render.esc(block.subtitle)}</p>` : ''}</div><span>${item.members.length} itens</span></header>` : ''}
      <div class="catalog-collection-grid">${plannedItems.map(member => memberMarkup(member, block, showPrices)).join('')}</div>
    </section>`;
  }

  function categoryDividerMarkup(page) {
    return `<div class="catalog-category-divider" data-category-divider="${Render.esc(page.category)}">
      <span>Categoria</span><strong>${Render.esc(page.category)}</strong><small>${page.categoryProductCount} ${page.categoryProductCount === 1 ? 'produto' : 'produtos'} · ${page.categoryPageTotal} ${page.categoryPageTotal === 1 ? 'página' : 'páginas'}</small>
    </div>`;
  }

  function patchSkeleton(pageElement, page, pageIndex, pageTotal, state) {
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
    if (grid) {
      grid.innerHTML = page.items.map(item => {
        if (item.type === 'collection') return collectionMarkup(item, state.catalog.showPrices);
        const layoutItem = {
          ...item,
          style: { contentPreset: item.contentPreset, emphasis: item.emphasis, width: item.width }
        };
        return Render.cardMarkup(item.product, pageElement.classList.contains('template-compact') ? NS.Templates.getTemplate('compact') : pageElement.classList.contains('template-showcase') ? NS.Templates.getTemplate('showcase') : NS.Templates.getTemplate('technical'), state.catalog.showPrices, layoutItem);
      }).join('');
    }
    pageElement.querySelector('.catalog-empty')?.remove();
    return pageElement;
  }

  function skeletonFor(page, state, template) {
    const scratch = document.createElement('div');
    const firstProduct = page.products[0];
    if (!firstProduct) return null;
    const tempState = {
      ...state,
      products: state.products,
      selectedIds: [firstProduct.id],
      catalog: { ...state.catalog, templateId: template.id }
    };
    originalRenderCatalog(scratch, tempState);
    return scratch.querySelector('.catalog-page');
  }

  function renderCollectionDocument(root, state) {
    const documentModel = NS.CatalogDocument.build(state);
    if (!documentModel.blocks?.length || !documentModel.pages.some(page => page.items?.some(item => item.type === 'collection'))) {
      return originalRenderCatalog(root, state);
    }

    const template = documentModel.template;
    const fragments = [];
    documentModel.pages.forEach((page, index) => {
      const skeleton = skeletonFor(page, state, template);
      if (!skeleton) return;
      patchSkeleton(skeleton, page, index, documentModel.pageCount, state);
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

  Render.renderCatalog = renderCollectionDocument;
  Render.collectionMarkup = collectionMarkup;
})();
