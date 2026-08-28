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
    Object.freeze({ href: 'editorial-selection-table.css' }),
    Object.freeze({ href: 'print.css', media: 'print' })
  ]);

  function escAttr(value) {
    return String(value || '').replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  }

  function baseHref() {
    return new URL('./', window.location.href).href;
  }

  function styleSheetName(value, base = window.location.href) {
    try { return new URL(value, base).pathname.split('/').pop(); }
    catch (_) { return String(value || '').split('/').pop(); }
  }

  function documentStyleLinksMarkup() {
    return DOCUMENT_STYLE_SHEETS.map(sheet => {
      const media = sheet.media ? ` media="${sheet.media}"` : '';
      return `<link rel="stylesheet" href="${escAttr(sheet.href)}"${media} />`;
    }).join('\n  ');
  }

  function missingDocumentStyles(doc) {
    if (!doc?.querySelectorAll) return DOCUMENT_STYLE_SHEETS.map(sheet => sheet.href);
    const loaded = new Set(Array.from(doc.querySelectorAll('link[rel="stylesheet"][href]'))
      .map(link => styleSheetName(link.getAttribute('href'), doc.baseURI)));
    return DOCUMENT_STYLE_SHEETS.map(sheet => sheet.href).filter(href => !loaded.has(styleSheetName(href, doc.baseURI)));
  }

  function renderPages(state) {
    if (!NS.Render?.renderCatalog) throw new Error('Renderer do catálogo indisponível.');
    const root = document.createElement('div');
    const summary = NS.Render.renderCatalog(root, state);
    const documentModel = summary?.document || NS.CatalogDocument?.build?.(state);
    const pages = Array.from(root.querySelectorAll('.catalog-page'));
    if (documentModel && pages.length !== documentModel.pageCount) {
      throw new Error(`Documento inconsistente: ${documentModel.pageCount} página(s) lógica(s), ${pages.length} página(s) renderizada(s).`);
    }
    return { documentModel, pages };
  }

  function buildPrintableHtml(state) {
    const { documentModel, pages } = renderPages(state);
    const href = escAttr(baseHref());
    const markup = pages.map(page => page.outerHTML).join('\n');
    return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <base href="${href}" />
  <title>CatalogoTop · impressão</title>
  ${documentStyleLinksMarkup()}
</head>
<body class="catalog-print-document" data-logical-pages="${documentModel?.pageCount ?? pages.length}">
${markup}
</body>
</html>`;
  }

  async function waitForStyles(doc) {
    const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
    await Promise.all(links.map(link => {
      if (link.sheet) return Promise.resolve();
      return new Promise(resolve => {
        const done = () => resolve();
        link.addEventListener('load', done, { once: true });
        link.addEventListener('error', done, { once: true });
        setTimeout(done, 4000);
      });
    }));
  }

  async function waitForImages(doc) {
    const images = Array.from(doc.images || []);
    await Promise.all(images.map(async image => {
      if (image.complete && image.naturalWidth) return;
      try {
        if (typeof image.decode === 'function') await image.decode();
        else await new Promise(resolve => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
          setTimeout(resolve, 4000);
        });
      } catch (_) {
        // Uma imagem externa quebrada não deve impedir a impressão do restante do documento.
      }
    }));
  }

  function nextFrame(doc) {
    const view = doc?.defaultView || window;
    return new Promise(resolve => view.requestAnimationFrame(() => view.requestAnimationFrame(resolve)));
  }

  async function waitForDocumentReady(doc) {
    await waitForStyles(doc);
    if (doc.fonts?.ready) {
      try { await doc.fonts.ready; } catch (_) { /* sem bloqueio */ }
    }
    await waitForImages(doc);
    await nextFrame(doc);
    // O fitting precisa ser medido no documento que será impresso, depois de CSS,
    // fontes e imagens. Reusar a medição do preview gera quebras diferentes no PDF.
    NS.TextFit?.fitCatalog?.(doc);
    await nextFrame(doc);
  }

  async function createPrintFrame(state) {
    const iframe = document.createElement('iframe');
    iframe.className = 'catalog-print-frame';
    iframe.setAttribute('aria-hidden', 'true');
    Object.assign(iframe.style, {
      position: 'fixed',
      left: '-10000px',
      top: '0',
      width: '210mm',
      height: '297mm',
      border: '0',
      opacity: '0',
      pointerEvents: 'none'
    });
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    doc.open();
    doc.write(buildPrintableHtml(state));
    doc.close();
    await waitForDocumentReady(doc);
    return iframe;
  }

  async function printCurrent() {
    const state = NS.Core?.getState?.();
    if (!state) throw new Error('Estado do catálogo indisponível.');
    const iframe = await createPrintFrame(state);
    const target = iframe.contentWindow;
    let removed = false;
    const cleanup = () => {
      if (removed) return;
      removed = true;
      iframe.remove();
    };
    target.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(cleanup, 120000);
    target.focus();
    target.print();
  }

  function interceptPrintButton() {
    const button = document.getElementById('btnPrint');
    if (!button) return;
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      printCurrent().catch(error => window.alert?.(error.message || 'Não foi possível preparar o PDF.'));
    }, true);
  }

  NS.Print = {
    DOCUMENT_STYLE_SHEETS,
    documentStyleLinksMarkup,
    missingDocumentStyles,
    buildPrintableHtml,
    waitForDocumentReady,
    createPrintFrame,
    printCurrent
  };

  interceptPrintButton();
})();