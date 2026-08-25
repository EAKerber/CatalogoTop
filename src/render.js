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
    const common = 'viewBox="0 0 24 24" aria-hidden="true"';
    const icons = {
      pin: `<svg ${common}><path d="M12 21s6-5.4 6-12A6 6 0 1 0 6 9c0 6.6 6 12 6 12Z"/><circle cx="12" cy="9" r="2"/></svg>`,
      phone: `<svg ${common}><path d="M7.2 3.5 9.8 8l-2 1.7c1.1 2.3 2.9 4.1 5.2 5.2l1.7-2 4.5 2.6-.8 3.2c-.3 1-1.3 1.7-2.4 1.6C9.1 19.7 4.3 14.9 3.7 8c-.1-1.1.6-2.1 1.6-2.4l1.9-.6Z"/></svg>`,
      medal: `<svg ${common}><circle cx="12" cy="9" r="5"/><path d="m9 14-2 7 5-2 5 2-2-7M10 9l1.4 1.4L14.5 7"/></svg>`,
      box: `<svg ${common}><path d="m4 7 8-4 8 4v10l-8 4-8-4V7Z"/><path d="m4 7 8 4 8-4M12 11v10"/></svg>`,
      truck: `<svg ${common}><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>`,
      headset: `<svg ${common}><path d="M4 13v-2a8 8 0 0 1 16 0v2M4 13h3v6H5a1 1 0 0 1-1-1v-5ZM20 13h-3v6h2a1 1 0 0 0 1-1v-5ZM17 19c0 1.1-.9 2-2 2h-3"/></svg>`,
      calendar: `<svg ${common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h2M11 14h2M15 14h2M7 18h2M11 18h2"/></svg>`
    };
    return icons[type] || icons.box;
  }

  function renderSpecs(specs, limit) {
    const normalized = Array.isArray(specs) ? specs.filter(item => item && item.value) : [];
    return normalized.slice(0, limit).map(item => `<li>${item.label ? `<span>${esc(item.label)}</span>` : ''}<strong>${esc(item.value)}</strong></li>`).join('');
  }

  function cardMarkup(product, template, showPrices) {
    const specLimit = template.id === 'compact' ? 2 : template.id === 'showcase' ? 5 : 3;
    const specs = renderSpecs(product.specs, specLimit);
    return `<article class="catalog-card">
      <div class="catalog-card-image"><img src="${esc(product.image || PLACEHOLDER)}" alt="${esc(product.description)}" /></div>
      <div class="catalog-card-content">
        <div class="catalog-card-code">${esc(product.code)}</div>
        <h3>${esc(product.description)}</h3>
        ${product.subcategory ? `<p class="catalog-card-subcategory">${esc(product.subcategory)}</p>` : ''}
        ${specs ? `<ul class="catalog-card-specs">${specs}</ul>` : ''}
        ${product.notes ? `<p class="catalog-card-notes">${esc(product.notes)}</p>` : ''}
        ${showPrices && product.price ? `<div class="catalog-card-price">${esc(product.price)}</div>` : ''}
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
        ${footerItem('pin', 'TOP MOBILI FERRAGENS', config.location)}
        ${footerItem('phone', config.whatsapp, 'Atendimento via WhatsApp')}
        ${footerItem('medal', 'QUALIDADE')}
        ${footerItem('box', 'ESTOQUE')}
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
