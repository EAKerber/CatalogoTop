(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};

  // Subconjunto deliberado da biblioteca canônica do Gerador_de_catalogos_v1_AI,
  // main@050589347e55613182a00ed1e22f6efd2f1a2540 (app/catalog-icons.js).
  // Mantemos apenas ícones úteis ao paradigma simplificado; não importamos o editor.
  const LIBRARY = Object.freeze({
    location: {
      label: 'Localização',
      body: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>'
    },
    whatsapp: {
      label: 'Atendimento por mensagem',
      body: '<path d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.5L3 20.5l1.4-4.7A8.5 8.5 0 1 1 20.5 11.6Z"/><path d="M8.3 7.5c.5 3.9 3.2 6.5 7 7.1M8.4 7.6l1.6-.7 1.2 2.4-1.1.9M15.2 14.6l.8-1.2 2.3 1.3-.6 1.6"/>'
    },
    award: {
      label: 'Qualidade',
      body: '<circle cx="12" cy="9" r="5"/><path d="m8.5 13-1 8 4.5-2 4.5 2-1-8"/><path d="m12 6.2.8 1.6 1.8.3-1.3 1.2.3 1.8-1.6-.9-1.6.9.3-1.8-1.3-1.2 1.8-.3.8-1.6Z"/>'
    },
    stock: {
      label: 'Estoque',
      body: '<path d="M4 7h16v13H4z"/><path d="M8 7V4h8v3M8 11h8M12 11v6"/>'
    },
    truck: {
      label: 'Entrega rápida',
      body: '<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M3 10H1M5 13H2"/>'
    },
    headset: {
      label: 'Atendimento',
      body: '<path d="M4 13v-2a8 8 0 0 1 16 0v2"/><path d="M4 13h3v6H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 1-2ZM20 13h-3v6h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-1-2ZM17 19c0 2-2 3-5 3"/>'
    },
    calendar: {
      label: 'Data de atualização',
      body: '<rect x="4" y="5" width="16" height="16" rx="1.5"/><path d="M8 3v4M16 3v4M4 10h16M8 14h2M14 14h2M8 18h2M14 18h2"/>'
    }
  });

  const ALIASES = Object.freeze({
    pin: 'location',
    phone: 'whatsapp',
    medal: 'award',
    box: 'stock'
  });

  function resolve(name) {
    return LIBRARY[ALIASES[name] || name] || null;
  }

  function render(name, { title = false } = {}) {
    const icon = resolve(name);
    if (!icon) return '';
    const accessibility = title
      ? `<title>${icon.label}</title>`
      : 'aria-hidden="true"';
    return `<svg viewBox="0 0 24 24" ${accessibility}>${icon.body}</svg>`;
  }

  NS.Icons = Object.freeze({ LIBRARY, resolve, render });

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('pt-BR').format(date);
  }

  function chromeIssue(name) {
    const error = new Error(`Chrome documental indisponível: ${String(name || 'vazio')}.`);
    error.code = 'document_chrome_unavailable';
    error.chrome = String(name || '');
    return error;
  }

  function footerItem(iconName, title, subtitle = '') {
    return `<div class="footer-item">${render(iconName)}<div><strong>${esc(title)}</strong>${subtitle ? `<span>${esc(subtitle)}</span>` : ''}</div></div>`;
  }

  const TOP_MOBILI_V1 = Object.freeze({
    header({ category, productCount }) {
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
    },
    footer({ pageIndex, pageTotal, createdAt, config = NS.Core?.APP_CONFIG || {} }) {
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
            <div class="footer-date">${render('calendar')}<p><span>CRIADO EM</span><strong>${formatDate(createdAt)}</strong></p></div>
          </div>
        </div>
      </footer>`;
    }
  });

  const CHROME = Object.freeze({ 'top-mobili-v1': TOP_MOBILI_V1 });
  function chrome(name) {
    const value = CHROME[String(name || '')];
    if (!value) throw chromeIssue(name);
    return value;
  }
  function renderHeader(name, context) { return chrome(name).header(context || {}); }
  function renderFooter(name, context) { return chrome(name).footer(context || {}); }

  NS.DocumentChrome = Object.freeze({ CHROME, chrome, renderHeader, renderFooter });

  // Assets podem existir em outra authority/site durante migrações ou previews.
  // A UI não deve expor o ícone nativo de imagem quebrada; preserva a caixa e cai
  // para um pixel transparente até que a referência seja novamente resolvível.
  if (typeof document !== 'undefined' && typeof HTMLImageElement !== 'undefined') {
    const transparentPixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
    document.addEventListener('error', event => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement)) return;
      if (!image.closest('#selectableProducts,#catalogPreview')) return;
      if (image.dataset.catalogoFallbackApplied === 'true') return;
      image.dataset.catalogoFallbackApplied = 'true';
      image.src = transparentPixel;
    }, true);
  }
})();
