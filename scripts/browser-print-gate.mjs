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

function fixtureStateScript() {
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
    product('a-normal-1', 'Dobradiças'),
    product('a-feature', 'Dobradiças'),
    product('a-normal-2', 'Dobradiças'),
    product('a-normal-3', 'Dobradiças'),
    product('a-normal-4', 'Dobradiças'),
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
  return CatalogDocument.build(Core.getState());
}

await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.CatalogoTop?.Core && window.CatalogoTop?.Print && window.CatalogoTop?.CatalogDocument && window.CatalogoTop?.PreviewZoom);

  const materialized = await page.evaluate(fixtureStateScript);
  if (materialized.pageCount !== 2) throw new Error(`CatalogDocument deveria ter 2 páginas; recebeu ${materialized.pageCount}`);
  const expectedFirstCategory = 'a-feature,a-normal-1,a-normal-2,a-normal-3,a-normal-4,a-hero';
  if (materialized.orderedIds.slice(0, 6).join(',') !== expectedFirstCategory) throw new Error(`ordem Destaque/fluxo/Hero incorreta: ${materialized.orderedIds.join(',')}`);
  const firstPage = materialized.pages[0];
  const heroModel = firstPage.items.find(item => item.productId === 'a-hero');
  if (!heroModel || heroModel.row !== firstPage.layout.rowCount || heroModel.row !== 4) throw new Error(`Hero deve ancorar a última linha da página: ${JSON.stringify(heroModel)}`);
  if (firstPage.items.at(-1)?.productId !== 'a-hero') throw new Error('Hero deve ser o último item materializado da página');

  await page.click('[data-tab="catalog"]');
  await page.waitForSelector('#catalogPreview .catalog-page');
  const preview = await page.evaluate(() => {
    const firstPage = document.querySelector('#catalogPreview .catalog-page');
    const hero = firstPage?.querySelector('[data-product-id="a-hero"]');
    const normal = firstPage?.querySelector('[data-product-id="a-normal-1"]');
    const heroTitle = hero?.querySelector('h3');
    const normalTitle = normal?.querySelector('h3');
    const cards = [...(firstPage?.querySelectorAll('.catalog-card') || [])];
    return {
      pages: document.querySelectorAll('#catalogPreview .catalog-page').length,
      firstCard: cards[0]?.dataset.productId || '',
      lastCard: cards.at(-1)?.dataset.productId || '',
      heroRow: hero ? getComputedStyle(hero).gridRowStart : '',
      chromeVisibleInPreview: Boolean(document.querySelector('#catalogPreview .app-shell-header')),
      heroColumns: hero ? getComputedStyle(hero).gridTemplateColumns : '',
      heroTitleSize: heroTitle ? parseFloat(getComputedStyle(heroTitle).fontSize) : 0,
      normalTitleSize: normalTitle ? parseFloat(getComputedStyle(normalTitle).fontSize) : 0
    };
  });
  if (preview.pages !== 2) throw new Error(`preview deveria ter 2 páginas; recebeu ${preview.pages}`);
  if (preview.firstCard !== 'a-feature' || preview.lastCard !== 'a-hero') throw new Error(`preview deve colocar Destaque no fluxo e Hero como âncora: ${JSON.stringify(preview)}`);
  if (preview.heroRow !== '4') throw new Error(`Hero deveria ocupar a quarta/última linha no fixture: ${preview.heroRow}`);
  if (preview.chromeVisibleInPreview) throw new Error('preview contém chrome da aplicação');
  if (preview.heroColumns.trim().split(/\s+/).length < 2) throw new Error(`Hero Visual precisa de composição focal em duas áreas; recebeu ${preview.heroColumns}`);
  if (!(preview.heroTitleSize > preview.normalTitleSize * 1.2)) throw new Error(`Hero precisa ampliar hierarquia tipográfica: hero=${preview.heroTitleSize}, normal=${preview.normalTitleSize}`);

  const printableHtml = await page.evaluate(() => window.CatalogoTop.Print.buildPrintableHtml(window.CatalogoTop.Core.getState()));
  const printPage = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await printPage.setContent(printableHtml, { waitUntil: 'networkidle' });
  await printPage.emulateMedia({ media: 'print' });

  const printDom = await printPage.evaluate(() => {
    const firstPage = document.querySelector('.catalog-page');
    const cards = [...(firstPage?.querySelectorAll('.catalog-card') || [])];
    return {
      pages: document.querySelectorAll('.catalog-page').length,
      headers: document.querySelectorAll('.catalog-page-header').length,
      footers: document.querySelectorAll('.catalog-page-footer').length,
      appShell: document.querySelectorAll('.app-shell-header').length,
      selectionPanel: document.querySelectorAll('.selection-panel').length,
      divider: document.querySelectorAll('.catalog-category-divider').length,
      firstCard: cards[0]?.dataset.productId || '',
      lastCard: cards.at(-1)?.dataset.productId || '',
      headerLine: getComputedStyle(document.querySelector('.catalog-title-block i')).borderTopWidth,
      footerLine: getComputedStyle(document.querySelector('.footer-line')).borderTopWidth
    };
  });

  if (printDom.pages !== 2 || printDom.headers !== 2 || printDom.footers !== 2) throw new Error(`documento print incompleto: ${JSON.stringify(printDom)}`);
  if (printDom.appShell || printDom.selectionPanel || printDom.divider) throw new Error(`documento print contaminado pela UI: ${JSON.stringify(printDom)}`);
  if (printDom.firstCard !== 'a-feature' || printDom.lastCard !== 'a-hero') throw new Error(`ordem do documento print divergiu do CatalogDocument: ${JSON.stringify(printDom)}`);
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

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForFunction(() => window.CatalogoTop?.Core && window.CatalogoTop?.CatalogDocument && window.CatalogoTop?.PreviewZoom);
  await mobilePage.evaluate(fixtureStateScript);
  await mobilePage.click('[data-tab="catalog"]');
  await mobilePage.waitForSelector('#catalogPreview .catalog-page');
  await mobilePage.click('#btnPreviewFit');
  await mobilePage.waitForTimeout(120);

  const mobilePreview = await mobilePage.evaluate(() => {
    const viewport = document.getElementById('catalogPreviewViewport');
    const root = document.getElementById('catalogPreview');
    const style = getComputedStyle(viewport);
    return {
      clientWidth: viewport?.clientWidth || 0,
      scrollWidth: viewport?.scrollWidth || 0,
      scale: parseFloat(getComputedStyle(root).getPropertyValue('--preview-scale')) || 1,
      mode: window.CatalogoTop.PreviewZoom?.getMode?.() || '',
      overscrollX: style.overscrollBehaviorX,
      overscrollY: style.overscrollBehaviorY,
      touchAction: style.touchAction
    };
  });
  if (mobilePreview.mode !== 'fit' || mobilePreview.scale >= 1) throw new Error(`preview mobile deveria entrar em Fit abaixo de 100%: ${JSON.stringify(mobilePreview)}`);
  if (mobilePreview.scrollWidth > mobilePreview.clientWidth + 3) throw new Error(`Fit mobile não deveria exigir scroll horizontal: ${JSON.stringify(mobilePreview)}`);
  if (mobilePreview.overscrollX !== 'contain' || mobilePreview.overscrollY !== 'auto' || !mobilePreview.touchAction.includes('pan-y')) {
    throw new Error(`viewport deve conter overscroll horizontal e permitir pan vertical: ${JSON.stringify(mobilePreview)}`);
  }

  const firstMobilePage = mobilePage.locator('#catalogPreview .catalog-page').first();
  await firstMobilePage.scrollIntoViewIfNeeded();
  const beforeTouch = await mobilePage.evaluate(() => document.scrollingElement?.scrollTop || window.scrollY || 0);
  const box = await firstMobilePage.boundingBox();
  if (!box) throw new Error('não foi possível medir folha A4 mobile para gate touch');
  const x = Math.max(20, Math.min(370, box.x + box.width * .5));
  const startY = Math.max(180, Math.min(760, box.y + Math.min(box.height * .72, 430)));
  const cdp = await mobileContext.newCDPSession(mobilePage);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY, radiusX: 2, radiusY: 2, force: 1, id: 1 }] });
  for (let step = 1; step <= 6; step += 1) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: startY - step * 28, radiusX: 2, radiusY: 2, force: 1, id: 1 }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await mobilePage.waitForTimeout(180);
  const afterTouch = await mobilePage.evaluate(() => document.scrollingElement?.scrollTop || window.scrollY || 0);
  if (afterTouch <= beforeTouch + 8) throw new Error(`gesto vertical iniciado sobre o PDF deve rolar a página: antes=${beforeTouch}, depois=${afterTouch}`);
  await mobileContext.close();

  console.log('PASS browser print gate: A4 físico, Hero ancorado após a sobra, UI isolada, Fit mobile e scroll touch vertical');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
