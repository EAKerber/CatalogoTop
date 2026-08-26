(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};

  const PLACEHOLDER = `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="420" viewBox="0 0 600 420">
      <rect width="600" height="420" fill="#f6f7f8"/>
      <path d="M115 290h370M175 235l73-72 65 63 47-42 65 51" fill="none" stroke="#c9cdd2" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="404" cy="132" r="30" fill="none" stroke="#c9cdd2" stroke-width="12"/>
      <text x="300" y="350" text-anchor="middle" font-family="Arial" font-size="28" fill="#8c929a">SEM IMAGEM</text>
    </svg>`)}`;

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatDate(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('pt-BR').format(date);
  }

  function chunk(list, size) {
    const result = [];
    for (let index = 0; index < list.length; index += size) result.push(list.slice(index, index + size));
    return result;
  }

  function icon(type) {
    return NS.Icons?.render(type) || '';
  }

  function renderSpecs(specs, limit) {
    const normalized = Array.isArray(specs) ? specs.filter(item => item && item.value) : [];
    return normalized.slice(0, Math.max(0, limit)).map(item => `<li>${item.label ? `<span>${esc(item.label)}</span>` : ''}<strong>${esc(item.value)}</strong></li>`).join('');
  }

  function limitsFor(template, hasTable) {
    if (template.id === 'compact') return { variants: 3, rows: 3, specs: hasTable ? 0 : 2 };
    if (template.id === 'showcase') return { variants: 5, rows: 8, specs: hasTable ? 2 : 5 };
    return { variants: 4, rows: 6, specs: hasTable ? 1 : 3 };
  }

  function renderVariantLabels(items) {
    if (!items.length) return '';
    return `<div class="catalog-variant-labels">${items.map(item => `<span>${esc(item.label)}</span>`).join('')}</div>`;
  }

  function renderVisuals(product, limit) {
    const variants = Array.isArray(product.variants) ? product.variants.filter(item => item && (item.label || item.image)) : [];
    const imageVariants = variants.filter(item => item.image);
    const labelOnlyVariants = variants.filter(item => item.label && !item.image);

    if (!imageVariants.length) {
      const visibleLabels = labelOnlyVariants.slice(0, limit);
      const omitted = Math.max(0, variants.length - visibleLabels.length);
      return `<div class="catalog-card-visuals single">
        <img src="${esc(product.image || PLACEHOLDER)}" alt="${esc(product.description)}" />
        ${renderVariantLabels(visibleLabels)}
        ${omitted ? `<span class="catalog-variant-more">+${omitted}</span>` : ''}
      </div>`;
    }

    const visibleImages = imageVariants.slice(0, limit);
    const remainingSlots = Math.max(0, limit - visibleImages.length);
    const visibleLabels = labelOnlyVariants.slice(0, remainingSlots);
    const shownCount = visibleImages.length + visibleLabels.length;
    const omitted = Math.max(0, variants.length - shownCount);

    return `<div class="catalog-card-visuals multi variants-${Math.min(visibleImages.length, 5)}">
      <div class="catalog-variant-image-grid">
        ${visibleImages.map(item => `<figure><img src="${esc(item.image)}" alt="${esc(`${product.description} — ${item.label}`)}" /><figcaption>${esc(item.label || 'Variação')}</figcaption></figure>`).join('')}
      </div>
      ${renderVariantLabels(visibleLabels)}
      ${omitted ? `<span class="catalog-variant-more">+${omitted}</span>` : ''}
    </div>`;
  }

  function weightedColumns(columns) {
    const weights = { variant: 1.2, code: 1.7, package: 1.05, price: 1.25 };
    const total = columns.reduce((sum, column) => sum + (weights[column.key] || 1), 0);
    return columns.map(column => ({
      ...column,
      width: (((weights[column.key] || 1) / total) * 100).toFixed(2)
    }));
  }

  function renderCommercialTable(rows, showPrices, limit) {
    const normalized = Array.isArray(rows) ? rows.filter(Boolean) : [];
    if (!normalized.length) return '';
    const visible = normalized.slice(0, limit);
    const columns = weightedColumns([
      { key: 'variant', label: 'Cor', enabled: normalized.some(row => row.variant) },
      { key: 'code', label: 'Código', enabled: normalized.some(row => row.code) },
      { key: 'package', label: 'Embalagem', enabled: normalized.some(row => row.package) },
      { key: 'price', label: 'Preço', enabled: showPrices && normalized.some(row => row.price) }
    ].filter(column => column.enabled));
    if (!columns.length) return '';

    const tableClasses = [
      'catalog-card-table',
      `columns-${columns.length}`,
      columns.some(column => column.key === 'price') ? 'has-price-column' : '',
      columns.some(column => column.key === 'variant') ? 'has-variant-column' : ''
    ].filter(Boolean).join(' ');

    return `<div class="catalog-card-table-wrap">
      <table class="${tableClasses}">
        <colgroup>${columns.map(column => `<col style="width:${column.width}%" />`).join('')}</colgroup>
        <thead><tr>${columns.map(column => `<th>${esc(column.label)}</th>`).join('')}</tr></thead>
        <tbody>${visible.map(row => `<tr>${columns.map(column => `<td>${esc(row[column.key] || '—')}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
      ${normalized.length > visible.length ? `<small class="catalog-table-more">+${normalized.length - visible.length} linha(s)</small>` : ''}
    </div>`;
  }

  function cardMarkup(product, template, showPrices) {
    const hasTable = Array.isArray(product.tableRows) && product.tableRows.length > 0;
    const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
    const hasVariantImages = hasVariants && product.variants.some(item => item && item.image);
    const limits = limitsFor(template, hasTable);
    const specs = renderSpecs(product.specs, limits.specs);
    const table = renderCommercialTable(product.tableRows, showPrices, limits.rows);
    const classes = [
      hasTable ? 'has-table' : '',
      hasVariants ? 'has-variants' : '',
      hasVariantImages ? 'has-variant-images' : ''
    ].filter(Boolean).join(' ');

    return `<article class="catalog-card ${classes}">
      ${renderVisuals(product, limits.variants)}
      <div class="catalog-card-content">
        <div class="catalog-card-code">${esc(product.code)}</div>
        <h3>${esc(product.description)}</h3>
        ${product.subcategory ? `<p class="catalog-card-subcategory">${esc(product.subcategory)}</p>` : ''}
        ${specs ? `<ul class="catalog-card-specs">${specs}</ul>` : ''}
        ${table}
        ${product.notes && !hasTable ? `<p class="catalog-card-notes">${esc(product.notes)}</p>` : ''}
        ${showPrices && product.price && !hasTable ? `<div class="catalog-card-price">${esc(product.price)}</div>` : ''}
      </div>
    </article>`;
  }

  function headerMarkup(category, productCount) {
    return `<header class="catalog-page-header">
      <img class="catalog-logo" src="assets/logo-top-mobili.svg" alt="Top Mobili" />
      <div class="catalog-title-block">
        <span>CATÁLOGO</span>
        <h2>${esc(category || 'Sem categoria')}</h2>
        <p>${productCount} ${productCount === 1 ? 'produto nesta categoria' : 'produtos nesta categoria'}</p>
        <i aria-hidden="true"></i>
      </div>
      <div class="catalog-blueprint catalog-blueprint-dots" aria-hidden="true"></div>
      <div class="catalog-blueprint catalog-blueprint-word" aria-hidden="true">TOP MOBILI</div>
    </header>`;
  }

  function footerItem(iconName, title, subtitle = '') {
    return `<div class="footer-item">${icon(iconName)}<div><strong>${esc(title)}</strong>${subtitle ? `<span>${esc(subtitle)}</span>` : ''}</div></div>`;
  }

  function footerMarkup(pageIndex, pageTotal, createdAt) {
    const config = NS.Core.APP_CONFIG;
    return `<footer class="catalog-page-footer">
      <div class="footer-line"></div>
      <div class="footer-grid">
        ${footerItem('location', 'TOP MOBILI FERRAGENS', config.location)}
        ${footerItem('whatsapp', config.whatsapp, 'Atendimento via WhatsApp')}
        ${footerItem('award', 'QUALIDADE')}
        ${footerItem('stock', 'ESTOQUE')}
        ${footerItem('truck', 'ENTREGA RÁPIDA')}
        ${footerItem('headset', 'ATENDIMENTO')}
        <div class="footer-meta">
          <div><span>PÁGINA</span><strong>${String(pageIndex + 1).padStart(2, '0')}<small> / ${String(pageTotal).padStart(2, '0')}</small></strong></div>
          <div class="footer-date">${icon('calendar')}<p><span>CRIADO EM</span><strong>${formatDate(createdAt)}</strong></p></div>
        </div>
      </div>
    </footer>`;
  }

  function pageMarkup(page, pageIndex, pageTotal, state, template) {
    return `<article class="catalog-page ${template.className}" data-category="${esc(page.category)}" data-category-page="${page.categoryPageIndex + 1}" style="--catalog-cols:${template.columns};--catalog-rows:${template.rows}">
      ${headerMarkup(page.category, page.categoryProductCount)}
      <section class="catalog-page-body">
        <div class="catalog-decoration-circle" aria-hidden="true"></div>
        <div class="catalog-products">${page.products.map(product => cardMarkup(product, template, state.catalog.showPrices)).join('')}</div>
        ${page.products.length ? '' : '<div class="catalog-empty"><strong>Nenhum produto selecionado.</strong><span>Marque produtos na coluna à esquerda.</span></div>'}
      </section>
      ${footerMarkup(pageIndex, pageTotal, state.catalog.createdAt)}
    </article>`;
  }

  function getRenderableProducts(state) {
    const byId = new Map(state.products.map(product => [product.id, product]));
    return state.selectedIds.map(id => byId.get(id)).filter(product => product && product.status === 'Ativo');
  }

  function buildCategoryPages(state, perPage) {
    const selected = getRenderableProducts(state);
    const groups = [];
    const byCategory = new Map();

    selected.forEach(product => {
      const category = String(product.category || '').trim() || 'Sem categoria';
      let group = byCategory.get(category);
      if (!group) {
        group = { category, products: [] };
        byCategory.set(category, group);
        groups.push(group);
      }
      group.products.push(product);
    });

    const pages = [];
    groups.forEach((group, categoryIndex) => {
      const categoryPages = chunk(group.products, perPage);
      categoryPages.forEach((products, categoryPageIndex) => {
        pages.push({
          category: group.category,
          products,
          categoryIndex,
          categoryPageIndex,
          categoryPageTotal: categoryPages.length,
          categoryProductCount: group.products.length
        });
      });
    });

    if (!pages.length) {
      pages.push({
        category: String(state.catalog?.title || '').trim() || 'Catálogo',
        products: [],
        categoryIndex: 0,
        categoryPageIndex: 0,
        categoryPageTotal: 1,
        categoryProductCount: 0
      });
    }

    return { selected, groups, pages };
  }

  function categoryDividerMarkup(page) {
    return `<div class="catalog-category-divider" data-category-divider="${esc(page.category)}">
      <span>Categoria</span>
      <strong>${esc(page.category)}</strong>
      <small>${page.categoryProductCount} ${page.categoryProductCount === 1 ? 'produto' : 'produtos'} · ${page.categoryPageTotal} ${page.categoryPageTotal === 1 ? 'página' : 'páginas'}</small>
    </div>`;
  }

  function renderCatalog(root, state) {
    const template = NS.Templates.getTemplate(state.catalog.templateId);
    const { selected, groups, pages } = buildCategoryPages(state, template.perPage);
    root.innerHTML = pages.map((page, index) => `${page.categoryPageIndex === 0 && selected.length ? categoryDividerMarkup(page) : ''}${pageMarkup(page, index, pages.length, state, template)}`).join('');
    return {
      selectedCount: selected.length,
      pageCount: pages.length,
      categoryCount: groups.length,
      categories: groups.map(group => ({ category: group.category, productCount: group.products.length })),
      template
    };
  }

  function renderTemplatePreview(template) {
    const cells = Array.from({ length: Math.min(template.perPage, 12) }, () => '<span class="mini-card"></span>').join('');
    return `<div class="template-miniature ${template.className}" style="--catalog-cols:${template.columns};--catalog-rows:${template.rows}">
      <div class="mini-header"><img src="assets/logo-top-mobili.svg" alt="" /><div><i></i><b></b><em></em></div></div>
      <div class="mini-grid">${cells}</div>
      <div class="mini-footer"></div>
    </div>`;
  }

  NS.Render = { PLACEHOLDER, esc, formatDate, renderCatalog, renderTemplatePreview, getRenderableProducts, buildCategoryPages };
})();
