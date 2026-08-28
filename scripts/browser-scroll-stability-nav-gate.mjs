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
  const categories = ['CORREDIÇAS', 'DOBRADIÇAS', 'SUPORTES', 'PUXADORES'];
  const products = Array.from({ length: 20 }, (_, index) => ({
    id: `p${index + 1}`, code: String(1200 + index), description: `PRODUTO DE TESTE ${index + 1} COM DESCRIÇÃO COMERCIAL`,
    category: categories[index % categories.length], subcategory: '', price: `R$ ${10 + index},90`, status: 'Ativo', notes: '', image: '', specs: [], variants: [], tableRows: [], updatedAt: '2026-08-28T00:00:00.000Z'
  }));
  NS.Core.setState({
    schemaVersion: NS.Core.SCHEMA_VERSION, products, selectedIds: products.map(product => product.id),
    catalog: { title: 'Scroll gate', templateId: 'technical', showPrices: true, createdAt: '2026-08-28T00:00:00.000Z', presentation: NS.Composition.normalizePresentation({
      order: products.map(product => product.id), itemStyles: {}, imageFrames: {}, blocks: [
        { id: 'table-scroll', type: 'table', memberIds: ['p1','p5','p9','p13','p17'], title: 'CORREDIÇAS', subtitle: '', rowSource: 'products', density: 'compact', columns: ['code','description','price'], priceStyle: 'label' }
      ]
    }) }
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
  await page.waitForSelector('.selection-layout');
  await page.waitForTimeout(60);

  const desktop = await page.evaluate(() => {
    const panel = document.querySelector('.selection-panel');
    const previewColumn = document.querySelector('.preview-column');
    const preview = document.querySelector('#catalogPreviewViewport');
    const list = document.querySelector('#selectableProducts');
    const scrolling = document.scrollingElement;
    const previewStyle = getComputedStyle(preview);
    return {
      panelHeight: panel.getBoundingClientRect().height,
      panelMaxHeight: getComputedStyle(panel).maxHeight,
      previewHeight: previewColumn.getBoundingClientRect().height,
      previewRange: Math.max(0, preview.scrollHeight - preview.clientHeight),
      previewScrollTop: preview.scrollTop,
      previewOverflowY: previewStyle.overflowY,
      previewTouchAction: previewStyle.touchAction,
      documentRange: Math.max(0, scrolling.scrollHeight - scrolling.clientHeight),
      columnOverflow: getComputedStyle(previewColumn).overflowY,
      listOverflow: getComputedStyle(list).overflowY,
      listScrollbar: getComputedStyle(list).scrollbarWidth
    };
  });
  if (desktop.panelMaxHeight !== 'none' || desktop.previewRange > 2 || desktop.previewOverflowY !== 'clip' || !desktop.previewTouchAction.includes('pan-y') || desktop.documentRange < 50 || desktop.columnOverflow !== 'visible' || desktop.listOverflow !== 'auto') {
    throw new Error(`ownership desktop adaptativo incorreto: ${JSON.stringify(desktop)}`);
  }
  if (desktop.listScrollbar !== 'thin') throw new Error(`scrollbar editorial não foi tematizada: ${JSON.stringify(desktop)}`);

  const heightBeforeScroll = await page.locator('.selection-panel').evaluate(node => node.getBoundingClientRect().height);
  await page.evaluate(() => window.scrollBy(0, 260));
  await page.waitForTimeout(80);
  const externalScroll = await page.evaluate(() => ({ y: window.scrollY, previewTop: document.querySelector('#catalogPreviewViewport').scrollTop }));
  const heightAfterScroll = await page.locator('.selection-panel').evaluate(node => node.getBoundingClientRect().height);
  if (externalScroll.y < 20 || externalScroll.previewTop > 2) throw new Error(`scroll vertical não pertenceu ao documento: ${JSON.stringify(externalScroll)}`);
  if (Math.abs(heightBeforeScroll - heightAfterScroll) > 1) throw new Error(`scroll externo redimensionou compositor: ${heightBeforeScroll} -> ${heightAfterScroll}`);

  await page.click('.catalog-table-block[data-table-block-id="table-scroll"] .catalog-table-heading');
  await page.waitForSelector('#contextualInspector .inspector-mode-tabs');
  await page.click('#contextualInspector [data-inspector-mode="order"]');
  await page.waitForSelector('#contextualInspector .inspector-member-order-list', { state: 'visible' });
  const nested = await page.evaluate(() => {
    const memberList = document.querySelector('#contextualInspector .inspector-member-order-list');
    const inspector = document.querySelector('#contextualInspector');
    return { memberOverflow: getComputedStyle(memberList).overflowY, inspectorOverflow: getComputedStyle(inspector).overflowY, delta: memberList.scrollHeight - memberList.clientHeight };
  });
  if (nested.memberOverflow !== 'visible' || Math.abs(nested.delta) > 2 || nested.inspectorOverflow !== 'auto') throw new Error(`ordem interna não está sob o único scroll da aba Ordenação: ${JSON.stringify(nested)}`);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('[data-tab="products"]');
  await page.evaluate(() => document.querySelector('[data-mobile-workspace-target="library"]')?.click());
  await page.waitForSelector('#categoryFolders .category-folder-row');
  const rail = await page.evaluate(() => {
    const root = document.querySelector('#categoryFolders');
    const style = getComputedStyle(root);
    return { display: style.display, wrap: style.flexWrap, overflowX: style.overflowX, client: root.clientWidth, total: root.scrollWidth, windowY: window.scrollY };
  });
  if (rail.display !== 'flex' || rail.wrap !== 'nowrap' || rail.overflowX !== 'auto' || rail.total <= rail.client + 40) throw new Error(`categorias mobile não formaram rail horizontal: ${JSON.stringify(rail)}`);
  await page.evaluate(() => {
    const buttons = document.querySelectorAll('#categoryFolders [data-category-folder]');
    buttons[buttons.length - 1]?.click();
  });
  await page.waitForTimeout(350);
  const railAfter = await page.evaluate(() => ({ left: document.querySelector('#categoryFolders').scrollLeft, windowY: window.scrollY }));
  if (railAfter.left <= 0 || Math.abs(railAfter.windowY - rail.windowY) > 2) throw new Error(`categoria ativa não foi trazida horizontalmente sem scroll vertical: ${JSON.stringify({ rail, railAfter })}`);

  await page.click('[data-tab="catalog"]');
  await page.waitForSelector('#selectableProducts [data-product-row="p2"]');
  await page.evaluate(() => window.CatalogoTop.ContextualInspector.selectProductFromList('p2'));
  await page.waitForSelector('#editorOrderFloater:not([hidden]) [data-editor-settings]');
  const floaterCount = await page.locator('#editorOrderFloater button').count();
  if (floaterCount !== 3) throw new Error(`floater mobile deveria ter ↑ / ajustes / ↓; recebeu ${floaterCount}`);
  await page.evaluate(() => { window.CatalogoTop.ContextualInspector.setMinimized(true); window.scrollTo(0, document.body.scrollHeight); });
  await page.waitForTimeout(60);
  await page.click('[data-editor-settings]');
  await page.waitForFunction(() => window.CatalogoTop.ContextualInspector.isMinimized() === false);
  await page.waitForTimeout(350);
  const settings = await page.evaluate(() => ({
    target: window.CatalogoTop.ComposerSelection.get(),
    mode: document.querySelector('#contextualInspector')?.dataset.inspectorMode,
    minimized: window.CatalogoTop.ContextualInspector.isMinimized()
  }));
  if (settings.target?.productId !== 'p2' || settings.minimized || settings.mode !== 'general') throw new Error(`atalho Ajustes perdeu seleção/estado: ${JSON.stringify(settings)}`);

  console.log('PASS browser scroll stability/nav gate: fluxo vertical, ordem com scroll único, rail horizontal e atalho Ajustes');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
