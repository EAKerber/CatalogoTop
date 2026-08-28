(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};

  const DOCUMENT_STYLE_SHEETS = Object.freeze([
    Object.freeze({ href: 'styles.css' }),
    Object.freeze({ href: 'cards.css' }),
    Object.freeze({ href: 'catalog-page.css' }),
    Object.freeze({ href: 'editorial-composition.css' }),
    Object.freeze({ href: 'collection-block.css' }),
    Object.freeze({ href: 'table-block.css' }),
    Object.freeze({ href: 'commercial-presentation.css' }),
    Object.freeze({ href: 'print.css', media: 'print' })
  ]);

  function linksMarkup() {
    return DOCUMENT_STYLE_SHEETS.map(sheet => {
      const media = sheet.media ? ` media="${sheet.media}"` : '';
      return `<link rel="stylesheet" href="${sheet.href}"${media} />`;
    }).join('\n  ');
  }

  function loadedHrefs(doc) {
    if (!doc?.querySelectorAll) return [];
    return Array.from(doc.querySelectorAll('link[rel="stylesheet"][href]')).map(link => {
      try { return new URL(link.getAttribute('href'), doc.baseURI).pathname.split('/').pop(); }
      catch (_) { return String(link.getAttribute('href') || '').split('/').pop(); }
    });
  }

  function missingFrom(doc) {
    const loaded = new Set(loadedHrefs(doc));
    return DOCUMENT_STYLE_SHEETS.map(sheet => sheet.href).filter(href => !loaded.has(href));
  }

  NS.DocumentStyles = {
    DOCUMENT_STYLE_SHEETS,
    linksMarkup,
    loadedHrefs,
    missingFrom
  };
})();
