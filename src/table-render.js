(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  if (!NS.Render?.renderCatalog || !NS.TableBlock || !NS.CatalogDocument?.build) return;

  const Render = NS.Render;
  const originalRenderCatalog = Render.renderCatalog.bind(Render);

  function cellMarkup(columnId, row) {
    if (columnId === 'image') {
      const src = row.image || Render.PLACEHOLDER;
      return `<td class="table-cell-image"><img src="${Render.esc(src)}" alt="" /></td>`;
    }
    return `<td>${Render.esc(row[columnId] || '—')}</td>`;
  }

  function tableMarkup(item, showPrices) {
    const block = item.block;
    const columns = block.columns.filter(columnId => showPrices || columnId !== 'price');
    const continuation = item.fragmentStart > 0;
    const placement = `grid-column:1 / span 6;grid-row:${item.row} / span ${item.rowSpan};`;
    return `<section class="catalog-table-block density-${Render.esc(block.density)}${continuation ? ' is-continuation' : ''}" data-table-block-id="${Render.esc(block.id)}" data-row-span="${item.rowSpan}" data-fragment-start="${item.fragmentStart}" data-fragment-end="${item.fragmentEnd}" data-fragment-total="${item.fragmentTotal}" style="${placement}">
      ${!continuation && (block.title || block.subtitle) ? `<header class="catalog-table-heading"><div>${block.title ? `<h3>${Render.esc(block.title)}</h3>` : ''}${block.subtitle ? `<p>${Render.esc(block.subtitle)}</p>` : ''}</div><span>${item.memberIds.length} ${item.memberIds.length === 1 ? 'produto' : 'produtos'}</span></header>` : ''}
      ${continuation ? `<div class="catalog-table-continuation">${Render.esc(block.title || 'Tabela')} · continuação</div>` : ''}
      <div class="catalog-table-wrap">
        <table>
          <thead><tr>${columns.map(columnId => `<th>${Render.esc(NS.TableBlock.columnDefinition(columnId)?.name || columnId)}</th>`).join('')}</tr></thead>
          <tbody>${item.rows.map(row => `<tr data-table-row-id="${Render.esc(row.rowId)}">${columns.map(columnId => cellMarkup(columnId, row)).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
    </section>`;
  }

  function categoryDividerMarkup(page) {
    return `<div class="catalog-category-divider" data-category-divider="${Render.esc(page.category)}">
      <span>Categoria</span><strong>${Render.esc(page.category)}</strong><small>${page.categoryProductCount} ${page.categoryProductCount === 1 ? 'produto' : 'produtos'} · ${page.categoryPageTotal} ${page.categoryPageTotal === 1 ? 'página' : 'páginas'}</small>
    </div>`;
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
    if (grid) {
      grid.innerHTML = page.items.map(item => {
        if (item.type === 'collection') return Render.collectionMarkup(item, state.catalog.showPrices);
        if (item.type === 'table') return tableMarkup(item, state.catalog.showPrices);
        const layoutItem = {
          ...item,
          style: { contentPreset: item.contentPreset, emphasis: item.emphasis, width: item.width }
        };
        return Render.cardMarkup(item.product, template, state.catalog.showPrices, layoutItem);
      }).join('');
    }
    pageElement.querySelector('.catalog-empty')?.remove();
    return pageElement;
  }

  function skeletonFor(page, state, template) {
    const scratch = document.createElement('div');
    const firstProduct = page.products[0] || state.products.find(product => product.status === 'Ativo');
    if (!firstProduct) return null;
    const tempState = {
      ...state,
      selectedIds: [firstProduct.id],
      catalog: {
        ...state.catalog,
        templateId: template.id,
        presentation: NS.Composition.normalizePresentation({
          ...state.catalog.presentation,
          blocks: []
        })
      }
    };
    originalRenderCatalog(scratch, tempState);
    return scratch.querySelector('.catalog-page');
  }

  function renderTableDocument(root, state) {
    const documentModel = NS.CatalogDocument.build(state);
    if (!documentModel.pages.some(page => page.items?.some(item => item.type === 'table'))) {
      return originalRenderCatalog(root, state);
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

  Render.renderCatalog = renderTableDocument;
  Render.tableMarkup = tableMarkup;
})();