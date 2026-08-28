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
  const products = Array.from({ length: 14 }, (_, index) => ({
    id: `p${index + 1}`, code: String(1201 + index),
    description: `PRODUTO ${index + 1} COM DESCRIÇÃO LONGA PARA TESTAR TRÊS LINHAS NO MOBILE E LEITURA SEM COLISÃO`,
    category: index < 9 ? 'CORREDIÇAS' : index < 13 ? 'DOBRADIÇAS' : 'SUPORTES', subcategory: '',
    price: `R$ ${10 + index},90`, status: 'Ativo', notes: '',
    image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="90"%3E%3Crect width="120" height="90" fill="white"/%3E%3Crect x="12" y="34" width="96" height="22" rx="5" fill="%23999"/%3E%3C/svg%3E',
    specs: [], variants: [], tableRows: [], updatedAt: '2026-08-28T00:00:00.000Z'
  }));
  NS.Core.setState({ schemaVersion: NS.Core.SCHEMA_VERSION, products, selectedIds: products.map(product => product.id), catalog: {
    title: 'Adaptive gate', templateId: 'technical', showPrices: true, createdAt: '2026-08-28T00:00:00.000Z',
    presentation: NS.Composition.normalizePresentation({ order: products.map(product => product.id), itemStyles: {}, imageFrames: {}, blocks: [
      { id: 'table-adaptive', type: 'table', memberIds: ['p1','p2','p3','p4','p5'], title: 'CORREDIÇAS', subtitle: '', rowSource: 'products', density: 'compact', columns: ['image','code','description','price'], priceStyle: 'label' }
    ] })
  }}, { persist: false });
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
  await page.waitForSelector('.catalog-table-block[data-table-block-id="table-adaptive"]');

  const wide = await page.evaluate(() => {
    const preview = document.querySelector('#catalogPreviewViewport');
    const panel = document.querySelector('.selection-panel');
    const list = document.querySelector('#selectableProducts');
    return {
      previewRange: Math.max(0, preview.scrollHeight - preview.clientHeight),
      panelMaxHeight: getComputedStyle(panel).maxHeight,
      listOverflowY: getComputedStyle(list).overflowY,
      listScrollable: list.scrollHeight > list.clientHeight
    };
  });
  if (wide.previewRange > 2 || wide.panelMaxHeight !== 'none' || wide.listOverflowY !== 'auto') throw new Error(`desktop largo ainda usa viewport vertical rígida: ${JSON.stringify(wide)}`);

  await page.click('.catalog-table-block[data-table-block-id="table-adaptive"] .catalog-table-heading');
  await page.waitForSelector('#contextualInspector .inspector-mode-tabs');
  const general = await page.evaluate(() => {
    const root = document.querySelector('#contextualInspector');
    return { mode: root.dataset.inspectorMode, overflowY: getComputedStyle(root).overflowY, orderVisible: getComputedStyle(root.querySelector('.inspector-member-order')).display !== 'none', fieldsVisible: getComputedStyle(root.querySelector('[data-inspector-table]')).display !== 'none' };
  });
  if (general.mode !== 'general' || general.overflowY !== 'visible' || general.orderVisible || !general.fieldsVisible) throw new Error(`aba Configuração incorreta: ${JSON.stringify(general)}`);
  await page.click('#contextualInspector .inspector-mode-tabs [data-inspector-mode="order"]');
  const ordering = await page.evaluate(() => {
    const root = document.querySelector('#contextualInspector');
    return { mode: root.dataset.inspectorMode, overflowY: getComputedStyle(root).overflowY, orderVisible: getComputedStyle(root.querySelector('.inspector-member-order')).display !== 'none', catalogOrderVisible: getComputedStyle(root.querySelector('.inspector-selection-order')).display !== 'none', fieldsVisible: getComputedStyle(root.querySelector('[data-inspector-table]')).display !== 'none' };
  });
  if (ordering.mode !== 'order' || ordering.overflowY !== 'auto' || !ordering.orderVisible || !ordering.catalogOrderVisible || ordering.fieldsVisible) throw new Error(`aba Ordenação incorreta: ${JSON.stringify(ordering)}`);

  const orderBefore = await page.evaluate(() => JSON.stringify(window.CatalogoTop.Core.getState().catalog.presentation.order));
  const selectedBefore = await page.evaluate(() => JSON.stringify(window.CatalogoTop.ComposerSelection.get()));
  await page.click('[data-tab="products"]');
  const scope = await page.evaluate(() => ({ floaterHidden: document.querySelector('#editorOrderFloater')?.hidden, moved: window.CatalogoTop.GroupingControls.moveSelectionRelative(1), order: JSON.stringify(window.CatalogoTop.Core.getState().catalog.presentation.order), selected: JSON.stringify(window.CatalogoTop.ComposerSelection.get()) }));
  await page.keyboard.press('Escape');
  const selectedAfterEscape = await page.evaluate(() => JSON.stringify(window.CatalogoTop.ComposerSelection.get()));
  if (!scope.floaterHidden || scope.moved || scope.order !== orderBefore || scope.selected !== selectedBefore || selectedAfterEscape !== selectedBefore) throw new Error(`controles editoriais vazaram para fora de Catálogo: ${JSON.stringify({ scope, orderBefore, selectedBefore, selectedAfterEscape })}`);
  await page.click('[data-tab="catalog"]');
  if (await page.evaluate(() => JSON.stringify(window.CatalogoTop.ComposerSelection.get())) !== selectedBefore) throw new Error('seleção editorial não sobreviveu ao retorno para Catálogo');

  await page.setViewportSize({ width: 1100, height: 800 });
  await page.waitForTimeout(100);
  const medium = await page.evaluate(() => ({ toggle: getComputedStyle(document.querySelector('#catalogPanelToggle')).display, panelPosition: getComputedStyle(document.querySelector('.selection-panel')).position, previewWidth: document.querySelector('.preview-column').getBoundingClientRect().width, layoutWidth: document.querySelector('.selection-layout').getBoundingClientRect().width }));
  if (medium.toggle === 'none' || medium.panelPosition !== 'fixed' || medium.previewWidth < medium.layoutWidth * .92) throw new Error(`workspace médio não virou drawer: ${JSON.stringify(medium)}`);
  await page.click('#catalogPanelToggle');
  const drawer = await page.evaluate(() => ({ open: document.body.classList.contains('catalog-drawer-open'), backdrop: !document.querySelector('#catalogPanelBackdrop').hidden }));
  if (!drawer.open || !drawer.backdrop) throw new Error(`drawer médio não abriu: ${JSON.stringify(drawer)}`);
  await page.click('#catalogPanelBackdrop');

  await page.click('[data-tab="products"]');
  const productMedium = await page.evaluate(() => {
    const folders = document.querySelector('#categoryFolders'); const table = document.querySelector('.table-wrap');
    return { display: getComputedStyle(folders).display, wrap: getComputedStyle(folders).flexWrap, overflowX: getComputedStyle(folders).overflowX, tableOverflow: table.scrollWidth - table.clientWidth };
  });
  if (productMedium.display !== 'flex' || productMedium.wrap !== 'nowrap' || productMedium.overflowX !== 'auto' || productMedium.tableOverflow > 3) throw new Error(`Produtos médio chegou a overflow: ${JSON.stringify(productMedium)}`);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.querySelector('[data-mobile-workspace-target="library"]')?.click());
  await page.waitForSelector('#productRows tr');
  const mobile = await page.evaluate(() => {
    const first = document.querySelector('#productRows tr'); const thumb = first.querySelector('.product-thumb'); const description = first.querySelector('.table-product-link');
    const folderRow = document.querySelector('#categoryFolders .category-folder-row:not(.all)'); const folder = folderRow?.querySelector('.category-folder'); const trash = folderRow?.querySelector('.category-delete-button');
    const a = folder?.getBoundingClientRect(); const b = trash?.getBoundingClientRect();
    return { rowHeight: first.getBoundingClientRect().height, thumbWidth: thumb.getBoundingClientRect().width, thumbDisplay: getComputedStyle(first.children[0]).display, clamp: getComputedStyle(description).webkitLineClamp, folderGap: a && b ? Math.abs(a.right - b.left) : 999, libraryAlign: getComputedStyle(document.querySelector('.product-library')).alignContent };
  });
  if (mobile.rowHeight < 88 || mobile.thumbWidth < 46 || mobile.thumbDisplay === 'none' || mobile.clamp !== '3' || mobile.folderGap > 1 || mobile.libraryAlign !== 'start') throw new Error(`biblioteca mobile inválida: ${JSON.stringify(mobile)}`);

  await page.click('[data-tab="catalog"]');
  await page.evaluate(() => window.CatalogoTop.ContextualInspector.selectProductFromList('p6'));
  await page.waitForSelector('#editorOrderFloater:not([hidden]) [data-editor-settings]');
  await page.click('[data-editor-settings]');
  await page.waitForTimeout(450);
  const settingsPosition = await page.evaluate(() => ({ headerBottom: document.querySelector('.app-shell-header').getBoundingClientRect().bottom, filterTop: document.querySelector('.selection-toolbar').getBoundingClientRect().top, mode: document.querySelector('#contextualInspector').dataset.inspectorMode, returning: document.querySelector('[data-editor-settings]').classList.contains('is-returning') }));
  if (Math.abs(settingsPosition.filterTop - settingsPosition.headerBottom) > 32 || settingsPosition.mode !== 'general' || !settingsPosition.returning) throw new Error(`⚙ não posicionou filtro/configuração: ${JSON.stringify(settingsPosition)}`);
  await page.click('[data-editor-settings]');
  await page.waitForTimeout(450);
  const targetPosition = await page.evaluate(() => { const target = window.CatalogoTop.ComposerSelection.get(); const node = window.CatalogoTop.ContextualInspector.previewNodeForTarget(target); const rect = node?.getBoundingClientRect(); return { top: rect?.top, bottom: rect?.bottom, viewport: innerHeight, returning: document.querySelector('[data-editor-settings]').classList.contains('is-returning') }; });
  if (targetPosition.top == null || targetPosition.bottom < 0 || targetPosition.top > targetPosition.viewport || targetPosition.returning) throw new Error(`segundo ⚙ não voltou ao target: ${JSON.stringify(targetPosition)}`);

  console.log('PASS browser adaptive workspace gate: tabs, scope, drawer, products rail/mobile and settings toggle');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
