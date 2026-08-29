import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) { response.writeHead(404, { 'content-type': 'application/json' }); response.end('{}'); return; }
    const relative = decodeURIComponent(url.pathname) === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const file = join(root, normalize(relative).replace(/^(\.\.[/\\])+/, ''));
    if (!(await stat(file)).isFile()) throw new Error('not file');
    response.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
    response.end(await readFile(file));
  } catch (_) { response.writeHead(404); response.end('not found'); }
});

function installFixture() {
  const NS = window.CatalogoTop;
  const categories = ['CORREDIÇAS', 'DOBRADIÇAS', 'SUPORTES', 'PUXADORES', 'PERFIS'];
  const products = Array.from({ length: 28 }, (_, index) => ({
    id: `p${index + 1}`, code: String(1201 + index), description: `PRODUTO ${index + 1} COM DESCRIÇÃO COMERCIAL PARA TESTE DO WORKSPACE DESKTOP`,
    category: categories[index % categories.length], subcategory: '', price: `R$ ${10 + index},90`, status: 'Ativo', notes: '', image: '', specs: [], variants: [], tableRows: [], updatedAt: '2026-08-28T00:00:00.000Z'
  }));
  NS.Core.setState({
    schemaVersion: NS.Core.SCHEMA_VERSION,
    products,
    selectedIds: products.map(product => product.id),
    catalog: { title: 'Desktop workspace gate', templateId: 'technical', showPrices: true, createdAt: '2026-08-28T00:00:00.000Z', presentation: NS.Composition.normalizePresentation({ order: products.map(product => product.id), itemStyles: {}, imageFrames: {}, blocks: [] }) }
  }, { persist: false });
  NS.ComposerSelection?.clear?.();
  window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
  NS.App.renderAll();
}

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.CatalogoTop?.Core && window.CatalogoTop?.GroupingControls && window.CatalogoTop?.ContextualInspector));
  await page.evaluate(installFixture);
  await page.click('[data-tab="catalog"]');
  await page.waitForSelector('#catalog.panel.active .catalog-page');
  await page.waitForTimeout(100);

  const desktop = await page.evaluate(() => {
    const catalog = document.querySelector('#catalog.panel.active');
    const heading = catalog.querySelector('.catalog-heading');
    const controls = catalog.querySelector('.catalog-controls');
    const panel = catalog.querySelector('.selection-panel');
    const previewColumn = catalog.querySelector('.preview-column');
    const preview = catalog.querySelector('#catalogPreviewViewport');
    const list = catalog.querySelector('#selectableProducts');
    const rects = { heading: heading.getBoundingClientRect(), controls: controls.getBoundingClientRect(), panel: panel.getBoundingClientRect(), preview: previewColumn.getBoundingClientRect() };
    return {
      bodyOverflow: getComputedStyle(document.body).overflow,
      catalogOverflow: getComputedStyle(catalog).overflow,
      catalogRange: Math.max(0, catalog.scrollHeight - catalog.clientHeight),
      catalogHeight: catalog.getBoundingClientRect().height,
      headingLeft: rects.heading.left, controlsLeft: rects.controls.left, panelLeft: rects.panel.left,
      leftWidth: rects.panel.width, previewLeft: rects.preview.left, previewWidth: rects.preview.width,
      previewHeight: preview.getBoundingClientRect().height,
      previewOverflowY: getComputedStyle(preview).overflowY,
      previewRange: Math.max(0, preview.scrollHeight - preview.clientHeight),
      listOverflowY: getComputedStyle(list).overflowY,
      listRange: Math.max(0, list.scrollHeight - list.clientHeight),
      drawerDisplay: document.querySelector('#catalogPanelToggle') ? getComputedStyle(document.querySelector('#catalogPanelToggle')).display : 'none'
    };
  });
  if (desktop.bodyOverflow !== 'hidden' || desktop.catalogOverflow !== 'hidden' || desktop.catalogRange > 3) throw new Error(`shell desktop voltou a rolar: ${JSON.stringify(desktop)}`);
  if (Math.max(Math.abs(desktop.headingLeft - desktop.panelLeft), Math.abs(desktop.controlsLeft - desktop.panelLeft)) > 3) throw new Error(`metadados não pertencem à coluna autoral: ${JSON.stringify(desktop)}`);
  if (desktop.leftWidth < 340 || desktop.leftWidth > 440 || desktop.previewLeft <= desktop.panelLeft + desktop.leftWidth - 2 || desktop.previewWidth < 760) throw new Error(`distribuição horizontal desktop inadequada: ${JSON.stringify(desktop)}`);
  if (desktop.previewHeight < 700 || desktop.previewOverflowY !== 'auto' || desktop.previewRange < 200) throw new Error(`A4 não recebeu território vertical rolável suficiente: ${JSON.stringify(desktop)}`);
  if (desktop.listOverflowY !== 'auto' || desktop.listRange < 100 || desktop.drawerDisplay !== 'none') throw new Error(`painel autoral/lista incorretos: ${JSON.stringify(desktop)}`);

  await page.evaluate(() => { const node = document.querySelector('#catalogPreviewViewport'); node.scrollTop = 0; node.scrollBy(0, 500); });
  const scrollOwnership = await page.evaluate(() => ({ preview: document.querySelector('#catalogPreviewViewport').scrollTop, page: document.querySelector('#catalog').scrollTop }));
  if (scrollOwnership.preview < 20 || scrollOwnership.page > 2) throw new Error(`A4 não reteve o próprio scroll desktop: ${JSON.stringify(scrollOwnership)}`);

  await page.setViewportSize({ width: 1100, height: 800 });
  await page.waitForTimeout(120);
  const compactDesktop = await page.evaluate(() => ({
    panelPosition: getComputedStyle(document.querySelector('.selection-panel')).position,
    panelWidth: document.querySelector('.selection-panel').getBoundingClientRect().width,
    previewWidth: document.querySelector('.preview-column').getBoundingClientRect().width,
    drawerDisplay: document.querySelector('#catalogPanelToggle') ? getComputedStyle(document.querySelector('#catalogPanelToggle')).display : 'none'
  }));
  if (compactDesktop.panelPosition !== 'static' || compactDesktop.panelWidth < 340 || compactDesktop.previewWidth < 600 || compactDesktop.drawerDisplay !== 'none') throw new Error(`desktop compacto voltou a drawer: ${JSON.stringify(compactDesktop)}`);

  await page.click('[data-tab="products"]');
  await page.waitForSelector('#products.panel.active');
  const products = await page.evaluate(() => {
    const folders = document.querySelector('#categoryFolders');
    const table = document.querySelector('.table-wrap');
    return { foldersDisplay: getComputedStyle(folders).display, wrap: getComputedStyle(folders).flexWrap, overflowX: getComputedStyle(folders).overflowX, tableOverflow: Math.max(0, table.scrollWidth - table.clientWidth) };
  });
  if (products.foldersDisplay !== 'flex' || products.wrap !== 'nowrap' || products.overflowX !== 'auto' || products.tableOverflow > 3) throw new Error(`filesystem desktop não virou rail sem roubar a tabela: ${JSON.stringify(products)}`);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('[data-tab="catalog"]');
  await page.waitForSelector('#selectableProducts [data-product-row="p2"]');
  await page.evaluate(() => window.CatalogoTop.ContextualInspector.selectProductFromList('p2'));
  await page.waitForSelector('#editorOrderFloater:not([hidden]) [data-editor-settings]');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.click('[data-editor-settings]');
  await page.waitForFunction(() => {
    const header = document.querySelector('.app-shell-header');
    const inspector = document.querySelector('#contextualInspector');
    if (!header || !inspector) return false;
    return Math.abs(inspector.getBoundingClientRect().top - header.getBoundingClientRect().bottom) <= 38;
  }, null, { timeout: 2500 });
  const mobileAnchor = await page.evaluate(() => ({
    headerBottom: document.querySelector('.app-shell-header').getBoundingClientRect().bottom,
    inspectorTop: document.querySelector('#contextualInspector').getBoundingClientRect().top,
    filterTop: document.querySelector('.selection-toolbar').getBoundingClientRect().top,
    mode: document.querySelector('#contextualInspector').dataset.inspectorMode,
    returning: document.querySelector('[data-editor-settings]').classList.contains('is-returning')
  }));
  if (mobileAnchor.filterTop <= mobileAnchor.inspectorTop || mobileAnchor.mode !== 'general' || !mobileAnchor.returning) throw new Error(`⚙ mobile não ancora no topo da configuração: ${JSON.stringify(mobileAnchor)}`);

  console.log('PASS desktop authoring workspace gate: painel persistente, A4 maximizado, filesystem rail e anchor mobile contextual');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
