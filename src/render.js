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
    return result.length ? result : [[]];
  }

  function icon(type) {
    return NS.Icons?.render(type) || '';
  }

  function renderSpecs(specs, limit) {
    const normalized = Array.isArray(specs) ? specs.filter(item => item && item.value) : [];
    return normalized.slice(0, limit).map(item => `<li>${item.label ? `<span>${esc(item.label)}</span>` : ''}<strong>${esc(item.value)}</strong></li>`).join('');
  }

  function limitsFor(template, hasTable) {
    if (template.id === 'compact') return { variants: 3, rows: 3, specs: hasTable ? 1 : 2 };
    if (template.id === 'showcase') return { variants: 5, rows: 6, specs: hasTable ? 3 : 5 };
    return { variants: 4, rows: 4, specs: hasTable ? 2 : 3 };
  }

  function renderVisuals(product, limit) {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    const withImage = variants.filter(item => item && item.image).slice(0, limit);
    const labelOnly = variants.filter(item => item && item.label && !item.image).slice(0, limit);

    if (!withImage.length) {
      const labels = labelOnly.length
        ? `<div class="catalog-variant-labels">${labelOnly.map(item => `<span>${esc(item.label)}</span>`).join('')}</div>`
        : '';
      return `<div class="catalog-card-visuals single"><img src="${esc(product.image || PLACEHOLDER)}" alt="${esc(product.description)}" />${labels}</div>`;
    }

    const omitted = Math.max(0, variants.length - withImage.length);
    return `<div class="catalog-card-visuals multi variants-${Math.min(withImage.length, 5)}">
      ${withImage.map(item => `<figure><img src="${esc(item.image)}" alt="${esc(`${product.description} — ${item.label}`)}" /><figcaption>${esc(item.label || 'Variação')}</figcaption></figure>`).join('')}
      ${omitted ? `<span class="catalog-variant-more">+${omitted}</span>` : ''}
    </div>`;
  }

  function renderCommercialTable(rows, showPrices, limit) {
    const normalized = Array.isArray(rows) ? rows.filter(Boolean) : [];
    if (!normalized.length) return '';
    const visible = normalized.slice(0, limit);
    const columns = [
      { key: 'variant', label: 'Cor', enabled: normalized.some(row => row.variant) },
      { key: 'code', label: 'Código', enabled: normalized.some(row => row.code) },
      { key: 'package', label: 'Embalagem', enabled: normalized.some(row => row.package) },
      { key: 'price', label: 'Preço', enabled: showPrices && normalized.some(row => row.price) }
    ].filter(column => column.enabled);
    if (!columns.length) return '';

    return `<div class="catalog-card-table-wrap">
      <table class="catalog-card-table">
        <thead><tr>${columns.map(column => `<th>${esc(column.label)}</th>`).join('')}</tr></thead>
        <tbody>${visible.map(row => `<tr>${columns.map(column => `<td>${esc(row[column.key] || '—')}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
      ${normalized.length > visible.length ? `<small class="catalog-table-more">+${normalized.length - visible.length} linha(s)</small>` : ''}
    </div>`;
  }

  function cardMarkup(product, template, showPrices) {
    const hasTable = Array.isArray(product.tableRows) && product.tableRows.length > 0;
    const limits = limitsFor(template, hasTable);
    const specs = renderSpecs(product.specs, limits.specs);
    const table = renderCommercialTable(product.tableRows, showPrices, limits.rows);
    const classes = [hasTable ? 'has-table' : '', product.variants?.length ? 'has-variants' : ''].filter(Boolean).join(' ');
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

  function headerMarkup(title, productCount) {
    return `<header class="catalog-page-header">
      <img class="catalog-logo" src="assets/logo-top-mobili.svg" alt="Top Mobili" />
      <div class="catalog-title-block">
        <span>CATÁLOGO</span>
        <h2>${esc(title || 'Categoria')}</h2>
        <p>${productCount} ${productCount === 1 ? 'produto selecionado' : 'produtos selecionados'}</p>
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

  function pageMarkup(products, pageIndex, pageTotal, state, template, totalSelected) {
    return `<article class="catalog-page ${template.className}" style="--catalog-cols:${template.columns};--catalog-rows:${template.rows}">
      ${headerMarkup(state.catalog.title, totalSelected)}
      <section class="catalog-page-body">
        <div class="catalog-decoration-circle" aria-hidden="true"></div>
        <div class="catalog-products">${products.map(product => cardMarkup(product, template, state.catalog.showPrices)).join('')}</div>
        ${products.length ? '' : '<div class="catalog-empty"><strong>Nenhum produto selecionado.</strong><span>Marque produtos na coluna à esquerda.</span></div>'}
      </section>
      ${footerMarkup(pageIndex, pageTotal, state.catalog.createdAt)}
    </article>`;
  }

  function getRenderableProducts(state) {
    const byId = new Map(state.products.map(product => [product.id, product]));
    return state.selectedIds.map(id => byId.get(id)).filter(product => product && product.status === 'Ativo');
  }

  function renderCatalog(root, state) {
    const template = NS.Templates.getTemplate(state.catalog.templateId);
    const selected = getRenderableProducts(state);
    const pages = chunk(selected, template.perPage);
    root.innerHTML = pages.map((products, index) => pageMarkup(products, index, pages.length, state, template, selected.length)).join('');
    return { selectedCount: selected.length, pageCount: pages.length, template };
  }

  function renderTemplatePreview(template) {
    const cells = Array.from({ length: Math.min(template.perPage, 12) }, () => '<span class="mini-card"></span>').join('');
    return `<div class="template-miniature ${template.className}" style="--catalog-cols:${template.columns};--catalog-rows:${template.rows}">
      <div class="mini-header"><img src="assets/logo-top-mobili.svg" alt="" /><div><i></i><b></b><em></em></div></div>
      <div class="mini-grid">${cells}</div>
      <div class="mini-footer"></div>
    </div>`;
  }

  NS.Render = { PLACEHOLDER, esc, formatDate, renderCatalog, renderTemplatePreview, getRenderableProducts };
})();
