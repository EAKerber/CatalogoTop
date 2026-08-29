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
  const categories = ['CORREDIÇAS', 'DOBRADIÇAS', 'SUPORTES', 'PUXADORES', 'PISTÕES', 'SAPATAS', 'PERFIS', 'ACESSÓRIOS'];
  const products = categories.flatMap((category, categoryIndex) => Array.from({ length: categoryIndex < 2 ? 3 : 1 }, (_, itemIndex) => {
    const index = categoryIndex * 3 + itemIndex + 1;
    return {
      id: `p${index}`,
      code: String(1200 + index),
      description: `${category} ${itemIndex === 1 ? 'SUPER ' : ''}PRODUTO ${index} COM DESCRIÇÃO LONGA PARA TESTAR TRÊS LINHAS NO MOBILE`,
      category,
      subcategory: '',
      price: `R$ ${10 + index},90`,
      status: 'Ativo',
      notes: '',
      image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="90"%3E%3Crect width="120" height="90" fill="white"/%3E%3Crect x="12" y="24" width="96" height="42" rx="8" fill="%23999"/%3E%3C/svg%3E',
      specs: [], variants: [], tableRows: [], updatedAt: '2026-08-28T00:00:00.000Z'
    };
  }));

  NS.Core.setState({
    schemaVersion: NS.Core.SCHEMA_VERSION,
    products,
    selectedIds: products.slice(0, 5).map(product => product.id),
    catalog: {
      title: 'Mobile polish gate', templateId: 'technical', showPrices: true, createdAt: '2026-08-28T00:00:00.000Z',
      presentation: NS.Composition.normalizePresentation({ order: products.slice(0, 5).map(product => product.id), itemStyles: {}, imageFrames: {}, blocks: [] })
    }
  }, { persist: false });
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
  await page.waitForFunction(() => Boolean(window.CatalogoTop?.Core && window.CatalogoTop?.App && window.CatalogoTop?.MobileWorkspace));
  await page.evaluate(installFixture);
  await page.click('[data-tab="catalog"]');
  await page.waitForSelector('#catalog.panel.active .catalog-page');
  await page.waitForSelector('.selection-category-rail .selection-category-chip');

  const callout = await page.evaluate(() => {
    const preview = document.querySelector('#catalogPreviewViewport');
    const image = preview.querySelector('img');
    const outside = document.querySelector('#searchSelection');
    const previewEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    const outsideEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    return {
      previewCanceled: !image.dispatchEvent(previewEvent),
      outsideCanceled: !outside.dispatchEvent(outsideEvent),
      draggable: image.draggable,
      draggableAttr: image.getAttribute('draggable'),
      userSelect: getComputedStyle(preview).userSelect,
      webkitUserSelect: getComputedStyle(preview).webkitUserSelect || '',
      touchCallout: getComputedStyle(preview).webkitTouchCallout || ''
    };
  });
  if (!callout.previewCanceled || callout.outsideCanceled || callout.draggable || callout.draggableAttr !== 'false' || !['none'].includes(callout.userSelect)) {
    throw new Error(`proteção mobile do preview inválida: ${JSON.stringify(callout)}`);
  }

  const firstProductId = await page.evaluate(() => document.querySelector('.catalog-card[data-product-id]')?.dataset.productId || '');
  if (firstProductId) {
    await page.click(`.catalog-card[data-product-id="${firstProductId}"]`);
    const target = await page.evaluate(() => window.CatalogoTop.ComposerSelection.get());
    if (!target || String(target.productId || '') !== String(firstProductId)) throw new Error(`tap editorial deixou de funcionar após proteção do preview: ${JSON.stringify(target)}`);
  }

  const railInitial = await page.evaluate(() => {
    const toolbar = document.querySelector('#catalog .selection-toolbar');
    const search = document.querySelector('#searchSelection');
    const select = document.querySelector('#selectionCategory');
    const rail = document.querySelector('.selection-category-rail');
    const list = document.querySelector('#selectableProducts');
    const searchRect = search.getBoundingClientRect();
    const railRect = rail.getBoundingClientRect();
    const listRect = list.getBoundingClientRect();
    return {
      toolbarOrder: getComputedStyle(toolbar).order,
      selectDisplay: getComputedStyle(select).display,
      railDisplay: getComputedStyle(rail).display,
      railOverflowX: getComputedStyle(rail).overflowX,
      railOverflow: rail.scrollWidth - rail.clientWidth,
      verticalOrder: [searchRect.top, railRect.top, listRect.top],
      scrollTop: document.scrollingElement.scrollTop
    };
  });
  if (railInitial.selectDisplay !== 'none' || railInitial.railDisplay !== 'flex' || railInitial.railOverflowX !== 'auto' || railInitial.railOverflow < 20 || !(railInitial.verticalOrder[0] < railInitial.verticalOrder[1] && railInitial.verticalOrder[1] < railInitial.verticalOrder[2])) {
    throw new Error(`rail mobile de categorias inválido: ${JSON.stringify(railInitial)}`);
  }

  const beforeCategoryScroll = await page.evaluate(() => document.scrollingElement.scrollTop);
  await page.click('.selection-category-chip[data-selection-category-value="DOBRADIÇAS"]');
  await page.waitForFunction(() => document.querySelector('#selectionCategory').value === 'DOBRADIÇAS');
  const categoryFilter = await page.evaluate(() => {
    const state = window.CatalogoTop.Core.getState();
    const ids = Array.from(document.querySelectorAll('#selectableProducts [data-product-row]')).map(row => row.dataset.productRow);
    const byId = new Map(state.products.map(product => [String(product.id), product]));
    return {
      value: document.querySelector('#selectionCategory').value,
      active: document.querySelector('.selection-category-chip.active')?.dataset.selectionCategoryValue,
      categories: Array.from(new Set(ids.map(id => byId.get(String(id))?.category))),
      verticalScroll: document.scrollingElement.scrollTop
    };
  });
  if (categoryFilter.value !== 'DOBRADIÇAS' || categoryFilter.active !== 'DOBRADIÇAS' || categoryFilter.categories.length !== 1 || categoryFilter.categories[0] !== 'DOBRADIÇAS' || Math.abs(categoryFilter.verticalScroll - beforeCategoryScroll) > 3) {
    throw new Error(`rail não sincronizou filtro sem salto vertical: ${JSON.stringify({ beforeCategoryScroll, categoryFilter })}`);
  }

  await page.fill('#searchSelection', 'SUPER');
  await page.waitForTimeout(60);
  const composedFilter = await page.evaluate(() => ({ rows: document.querySelectorAll('#selectableProducts [data-product-row]').length, category: document.querySelector('#selectionCategory').value }));
  if (composedFilter.rows !== 1 || composedFilter.category !== 'DOBRADIÇAS') throw new Error(`busca + categoria não compuseram filtro: ${JSON.stringify(composedFilter)}`);

  await page.fill('#searchSelection', '');
  await page.click('.selection-category-chip[data-selection-category-value=""]');
  await page.waitForFunction(() => document.querySelector('#selectionCategory').value === '');
  const resetFilter = await page.evaluate(() => ({ active: document.querySelector('.selection-category-chip.active')?.dataset.selectionCategoryValue, rows: document.querySelectorAll('#selectableProducts [data-product-row]').length }));
  if (resetFilter.active !== '' || resetFilter.rows < 8) throw new Error(`chip Todas não limpou categoria: ${JSON.stringify(resetFilter)}`);

  await page.click('[data-tab="products"]');
  await page.evaluate(() => document.querySelector('[data-mobile-workspace-target="library"]')?.click());
  await page.waitForSelector('#productRows tr');
  const rowContract = await page.evaluate(() => {
    const row = document.querySelector('#productRows tr');
    const cells = Array.from(row.children);
    const thumb = row.querySelector('.product-thumb');
    const description = row.querySelector('.table-product-link');
    return {
      rowBorderWidth: getComputedStyle(row).borderBottomWidth,
      rowBorderStyle: getComputedStyle(row).borderBottomStyle,
      cellBorders: cells.map(cell => getComputedStyle(cell).borderBottomWidth),
      thumbWidth: thumb.getBoundingClientRect().width,
      clamp: getComputedStyle(description).webkitLineClamp,
      rowHeight: row.getBoundingClientRect().height
    };
  });
  if (parseFloat(rowContract.rowBorderWidth) < 1 || rowContract.rowBorderStyle === 'none' || rowContract.cellBorders.some(width => parseFloat(width) > 0.1) || rowContract.thumbWidth < 49 || rowContract.clamp !== '3' || rowContract.rowHeight < 88) {
    throw new Error(`separador/linha mobile inválidos: ${JSON.stringify(rowContract)}`);
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.click('[data-tab="catalog"]');
  await page.waitForSelector('#catalog.panel.active');
  const desktop = await page.evaluate(() => {
    const select = document.querySelector('#selectionCategory');
    const rail = document.querySelector('.selection-category-rail');
    const image = document.querySelector('#catalogPreviewViewport img');
    const contextEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    return {
      selectDisplay: getComputedStyle(select).display,
      railDisplay: getComputedStyle(rail).display,
      contextCanceled: !image.dispatchEvent(contextEvent)
    };
  });
  if (desktop.selectDisplay === 'none' || desktop.railDisplay !== 'none' || desktop.contextCanceled) throw new Error(`proteção/rail vazaram para desktop: ${JSON.stringify(desktop)}`);

  console.log('PASS browser mobile polish gate: preview callout, continuous row separator and catalog category rail');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
