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
    description: `PRODUTO ${index + 1}${index === 10 ? ' SUPER' : ''} COM DESCRIÇÃO LONGA PARA TESTAR TRÊS LINHAS NO MOBILE E LEITURA SEM COLISÃO`,
    category: index < 9 ? 'CORREDIÇAS' : index < 13 ? 'DOBRADIÇAS' : 'SUPORTES', subcategory: '',
    price: `R$ ${10 + index},90`, status: 'Ativo', notes: '',
    image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="90"%3E%3Crect width="120" height="90" fill="white"/%3E%3Crect x="12" y="34" width="96" height="22" rx="5" fill="%23999"/%3E%3C/svg%3E',
    specs: [], variants: [], tableRows: [], updatedAt: '2026-08-28T00:00:00.000Z'
  }));
  NS.Core.setState({ schemaVersion: NS.Core.SCHEMA_VERSION, products, selectedIds: products.map(product => product.id), catalog: {
    title: 'Mobile polish gate', templateId: 'technical', showPrices: true, createdAt: '2026-08-28T00:00:00.000Z',
    presentation: NS.Composition.normalizePresentation({ order: products.map(product => product.id), itemStyles: {}, imageFrames: {}, blocks: [] })
  }}, { persist: false });
  NS.ComposerSelection?.clear?.();
  window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
  NS.App.renderAll();
}

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.CatalogoTop?.Core && window.CatalogoTop?.GroupingControls && window.CatalogoTop?.ContextualInspector));
  await page.evaluate(installFixture);

  await page.evaluate(() => document.querySelector('[data-mobile-workspace-target="library"]')?.click());
  await page.waitForSelector('#productRows tr');
  const library = await page.evaluate(() => {
    const first = document.querySelector('#productRows tr');
    const thumb = first.querySelector('.product-thumb');
    const description = first.querySelector('.table-product-link');
    const folders = document.querySelector('#categoryFolders');
    const row = folders.querySelector('.category-folder-row:not(.all)');
    const folder = row?.querySelector('.category-folder');
    const trash = row?.querySelector('.category-delete-button');
    const a = folder?.getBoundingClientRect(); const b = trash?.getBoundingClientRect();
    return {
      rowHeight: first.getBoundingClientRect().height,
      thumbWidth: thumb.getBoundingClientRect().width,
      clamp: getComputedStyle(description).webkitLineClamp,
      rowBorder: getComputedStyle(first).borderBottomWidth,
      cellBorders: Array.from(first.children).map(cell => getComputedStyle(cell).borderBottomWidth),
      folderGap: a && b ? Math.abs(a.right - b.left) : 999,
      railDisplay: getComputedStyle(folders).display,
      railWrap: getComputedStyle(folders).flexWrap,
      railOverflowX: getComputedStyle(folders).overflowX,
      align: getComputedStyle(document.querySelector('.product-library')).alignContent
    };
  });
  if (library.rowHeight < 88 || library.thumbWidth < 46 || library.clamp !== '3' || parseFloat(library.rowBorder) < 1 || library.cellBorders.some(value => parseFloat(value) > .1) || library.folderGap > 1 || library.railDisplay !== 'flex' || library.railWrap !== 'nowrap' || library.railOverflowX !== 'auto' || library.align !== 'start') throw new Error(`biblioteca mobile regrediu: ${JSON.stringify(library)}`);

  await page.click('[data-tab="catalog"]');
  await page.waitForSelector('#catalog.panel.active');
  await page.waitForSelector('.selection-category-rail .selection-category-chip');
  const polish = await page.evaluate(() => {
    const preview = document.querySelector('#catalogPreviewViewport');
    const image = preview.querySelector('img');
    const search = document.querySelector('#searchSelection');
    const rail = document.querySelector('.selection-category-rail');
    const list = document.querySelector('#selectableProducts');
    const select = document.querySelector('#selectionCategory');
    const previewEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    const outsideEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    const a = search.getBoundingClientRect(); const b = rail.getBoundingClientRect(); const c = list.getBoundingClientRect();
    return {
      previewCanceled: !image.dispatchEvent(previewEvent), outsideCanceled: !search.dispatchEvent(outsideEvent),
      draggable: image.draggable, draggableAttr: image.getAttribute('draggable'), userSelect: getComputedStyle(preview).userSelect,
      selectDisplay: getComputedStyle(select).display, railDisplay: getComputedStyle(rail).display, railOverflowX: getComputedStyle(rail).overflowX,
      vertical: [a.top, b.top, c.top]
    };
  });
  if (!polish.previewCanceled || polish.outsideCanceled || polish.draggable || polish.draggableAttr !== 'false' || polish.userSelect !== 'none' || polish.selectDisplay !== 'none' || polish.railDisplay !== 'flex' || polish.railOverflowX !== 'auto' || !(polish.vertical[0] < polish.vertical[1] && polish.vertical[1] < polish.vertical[2])) throw new Error(`polimento mobile do Catálogo regrediu: ${JSON.stringify(polish)}`);

  const chip = page.locator('.selection-category-chip[data-selection-category-value="DOBRADIÇAS"]');
  await chip.scrollIntoViewIfNeeded();
  const yBefore = await page.evaluate(() => document.scrollingElement.scrollTop);
  await chip.click();
  await page.waitForFunction(() => document.querySelector('#selectionCategory').value === 'DOBRADIÇAS');
  const filter = await page.evaluate(() => {
    const state = window.CatalogoTop.Core.getState();
    const byId = new Map(state.products.map(product => [String(product.id), product]));
    const ids = Array.from(document.querySelectorAll('#selectableProducts [data-product-row]')).map(row => row.dataset.productRow);
    return { active: document.querySelector('.selection-category-chip.active')?.dataset.selectionCategoryValue, categories: [...new Set(ids.map(id => byId.get(id)?.category))], y: document.scrollingElement.scrollTop };
  });
  if (filter.active !== 'DOBRADIÇAS' || filter.categories.length !== 1 || filter.categories[0] !== 'DOBRADIÇAS' || Math.abs(filter.y - yBefore) > 3) throw new Error(`rail mobile não sincronizou sem salto: ${JSON.stringify({ yBefore, filter })}`);

  await page.fill('#searchSelection', 'SUPER');
  await page.waitForTimeout(60);
  const combined = await page.locator('#selectableProducts [data-product-row]').count();
  if (combined !== 1) throw new Error(`busca + categoria não compuseram filtro: ${combined}`);
  await page.fill('#searchSelection', '');
  await page.click('.selection-category-chip[data-selection-category-value=""]');

  await page.evaluate(() => window.CatalogoTop.ContextualInspector.selectProductFromList('p6'));
  await page.waitForSelector('#editorOrderFloater:not([hidden]) [data-editor-settings]');
  const selectedBefore = await page.evaluate(() => JSON.stringify(window.CatalogoTop.ComposerSelection.get()));
  await page.click('[data-tab="products"]');
  await page.waitForSelector('#products.panel.active');
  await page.waitForFunction(() => document.querySelector('#editorOrderFloater')?.hidden === true);
  await page.keyboard.press('Escape');
  const outside = await page.evaluate(() => ({ selected: JSON.stringify(window.CatalogoTop.ComposerSelection.get()), moved: window.CatalogoTop.GroupingControls.moveSelectionRelative(1) }));
  if (outside.selected !== selectedBefore || outside.moved) throw new Error(`comandos editoriais vazaram fora de Catálogo: ${JSON.stringify(outside)}`);

  await page.click('[data-tab="catalog"]');
  await page.waitForSelector('#catalog.panel.active');
  await page.waitForSelector('#editorOrderFloater:not([hidden]) [data-editor-settings]');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.click('[data-editor-settings]');
  await page.waitForTimeout(420);
  const anchor = await page.evaluate(() => ({
    header: document.querySelector('.app-shell-header').getBoundingClientRect().bottom,
    inspector: document.querySelector('#contextualInspector').getBoundingClientRect().top,
    filter: document.querySelector('.selection-toolbar').getBoundingClientRect().top,
    mode: document.querySelector('#contextualInspector').dataset.inspectorMode,
    returning: document.querySelector('[data-editor-settings]').classList.contains('is-returning')
  }));
  if (Math.abs(anchor.inspector - anchor.header) > 38 || anchor.filter <= anchor.inspector || anchor.mode !== 'general' || !anchor.returning) throw new Error(`⚙ mobile não ancorou no topo da configuração: ${JSON.stringify(anchor)}`);

  console.log('PASS browser mobile polish gate: lista, rails, callout, escopo editorial e anchor contextual');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
