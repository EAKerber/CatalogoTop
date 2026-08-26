import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';

const port = 4173;
const root = process.cwd();
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.csv': 'text/csv; charset=utf-8'
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    if (url.pathname.startsWith('/api/')) {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'fixture_offline' }));
      return;
    }
    const requested = url.pathname === '/' ? '/index.html' : url.pathname;
    const safe = normalize(requested).replace(/^([.][.][/\\])+/, '');
    let path = join(root, safe);
    const info = await stat(path);
    if (info.isDirectory()) path = join(path, 'index.html');
    const body = await readFile(path);
    response.writeHead(200, { 'content-type': mime[extname(path)] || 'application/octet-stream' });
    response.end(body);
  } catch (_) {
    response.writeHead(404);
    response.end('not found');
  }
});

await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.CatalogoTop?.Core && window.CatalogoTop?.Print && window.CatalogoTop?.CatalogDocument && window.CatalogoTop?.PreviewZoom);

  const materialized = await page.evaluate(() => {
    const { Core, Composition, CatalogDocument } = window.CatalogoTop;
    const product = (id, category) => ({
      id,
      code: id.toUpperCase(),
      description: `Produto ${id}`,
      category,
      status: 'Ativo',
      image: '',
      price: 'R$ 10,00',
      specs: [],
      variants: [],
      tableRows: [],
      updatedAt: '2026-08-26T00:00:00.000Z'
    });
    const products = [
      product('a-normal', 'Dobradiças'),
      product('a-feature', 'Dobradiças'),
      product('a-hero', 'Dobradiças'),
      product('b-1', 'Corrediças'),
      product('b-2', 'Corrediças'),
      product('b-3', 'Corrediças')
    ];
    Core.setState({
      schemaVersion: Core.SCHEMA_VERSION,
      products,
      selectedIds: products.map(item => item.id),
      catalog: {
        title: 'Gate físico',
        templateId: 'technical',
        showPrices: true,
        createdAt: '2026-08-26T00:00:00.000Z',
        presentation: Composition.normalizePresentation({
          distribution: 'balanced',
          typography: 'neutral',
          itemStyles: {
            'a-feature': { emphasis: 'feature', contentPreset: 'visual' },
            'a-hero': { emphasis: 'hero', contentPreset: 'visual' }
          }
        })
      }
    }, { persist: false });
    window.dispatchEvent(new Event('catalogotop:products-updated'));
    const doc = CatalogDocument.build(Core.getState());
    return { pageCount: doc.pageCount, orderedIds: doc.orderedIds };
  });

  if (materialized.pageCount !== 2) throw new Error(`CatalogDocument deveria ter 2 páginas; recebeu ${materialized.pageCount}`);
  if (materialized.orderedIds.slice(0, 3).join(',') !== 'a-hero,a-feature,a-normal') throw new Error(`ordem Hero/Destaque incorreta: ${materialized.orderedIds.join(',')}`);

  await page.click('[data-tab="catalog"]');
  await page.waitForSelector('#catalogPreview .catalog-page');
  const preview = await page.evaluate(() => {
    const hero = document.querySelector('#catalogPreview [data-product-id="a-hero"]');
    const normal = document.querySelector('#catalogPreview [data-product-id="a-normal"]');
    const heroTitle = hero?.querySelector('h3');
    const normalTitle = normal?.querySelector('h3');
    return {
      pages: document.querySelectorAll('#catalogPreview .catalog-page').length,
      firstCard: document.querySelector('#catalogPreview .catalog-card')?.dataset.productId || '',
      chromeVisibleInPreview: Boolean(document.querySelector('#catalogPreview .app-shell-header')),
      heroColumns: hero ? getComputedStyle(hero).gridTemplateColumns : '',
      heroTitleSize: heroTitle ? parseFloat(getComputedStyle(heroTitle).fontSize) : 0,
      normalTitleSize: normalTitle ? parseFloat(getComputedStyle(normalTitle).fontSize) : 0
    };
  });
  if (preview.pages !== 2) throw new Error(`preview deveria ter 2 páginas; recebeu ${preview.pages}`);
  if (preview.firstCard !== 'a-hero') throw new Error(`primeiro card do preview deveria ser Hero; recebeu ${preview.firstCard}`);
  if (preview.chromeVisibleInPreview) throw new Error('preview contém chrome da aplicação');
  if (preview.heroColumns.trim().split(/\s+/).length < 2) throw new Error(`Hero Visual precisa de composição focal em duas áreas; recebeu ${preview.heroColumns}`);
  if (!(preview.heroTitleSize > preview.normalTitleSize * 1.2)) throw new Error(`Hero precisa ampliar hierarquia tipográfica: hero=${preview.heroTitleSize}, normal=${preview.normalTitleSize}`);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('#btnPreviewFit');
  await page.waitForTimeout(120);
  const mobilePreview = await page.evaluate(() => {
    const viewport = document.getElementById('catalogPreviewViewport');
    const root = document.getElementById('catalogPreview');
    return {
      clientWidth: viewport?.clientWidth || 0,
      scrollWidth: viewport?.scrollWidth || 0,
      scale: parseFloat(getComputedStyle(root).getPropertyValue('--preview-scale')) || 1,
      mode: window.CatalogoTop.PreviewZoom?.getMode?.() || ''
    };
  });
  if (mobilePreview.mode !== 'fit' || mobilePreview.scale >= 1) throw new Error(`preview mobile deveria entrar em Fit abaixo de 100%: ${JSON.stringify(mobilePreview)}`);
  if (mobilePreview.scrollWidth > mobilePreview.clientWidth + 3) throw new Error(`Fit mobile não deveria exigir scroll horizontal: ${JSON.stringify(mobilePreview)}`);

  const printableHtml = await page.evaluate(() => window.CatalogoTop.Print.buildPrintableHtml(window.CatalogoTop.Core.getState()));
  const printPage = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await printPage.setContent(printableHtml, { waitUntil: 'networkidle' });
  await printPage.emulateMedia({ media: 'print' });

  const printDom = await printPage.evaluate(() => ({
    pages: document.querySelectorAll('.catalog-page').length,
    headers: document.querySelectorAll('.catalog-page-header').length,
    footers: document.querySelectorAll('.catalog-page-footer').length,
    appShell: document.querySelectorAll('.app-shell-header').length,
    selectionPanel: document.querySelectorAll('.selection-panel').length,
    divider: document.querySelectorAll('.catalog-category-divider').length,
    firstCard: document.querySelector('.catalog-card')?.dataset.productId || '',
    headerLine: getComputedStyle(document.querySelector('.catalog-title-block i')).borderTopWidth,
    footerLine: getComputedStyle(document.querySelector('.footer-line')).borderTopWidth
  }));

  if (printDom.pages !== 2 || printDom.headers !== 2 || printDom.footers !== 2) throw new Error(`documento print incompleto: ${JSON.stringify(printDom)}`);
  if (printDom.appShell || printDom.selectionPanel || printDom.divider) throw new Error(`documento print contaminado pela UI: ${JSON.stringify(printDom)}`);
  if (printDom.firstCard !== 'a-hero') throw new Error(`ordem do documento print divergiu do CatalogDocument: ${printDom.firstCard}`);
  if (parseFloat(printDom.headerLine) <= 0 || parseFloat(printDom.footerLine) <= 0) throw new Error('linhas institucionais precisam existir sem background graphics');

  const pdfBytes = await printPage.pdf({
    format: 'A4',
    printBackground: false,
    preferCSSPageSize: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' }
  });
  const pdf = await PDFDocument.load(pdfBytes);
  if (pdf.getPageCount() !== 2) throw new Error(`PDF físico deveria ter exatamente 2 páginas; recebeu ${pdf.getPageCount()}`);

  const expectedWidth = 210 * 72 / 25.4;
  const expectedHeight = 297 * 72 / 25.4;
  for (const [index, pdfPage] of pdf.getPages().entries()) {
    const { width, height } = pdfPage.getSize();
    if (Math.abs(width - expectedWidth) > .6 || Math.abs(height - expectedHeight) > .6) {
      throw new Error(`página ${index + 1} não é A4: ${width.toFixed(2)} × ${height.toFixed(2)} pt`);
    }
  }

  console.log('PASS browser print gate: A4 físico, 2 páginas, Hero focal/primeiro, UI isolada e preview mobile em Fit');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
