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
  const image = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="80"%3E%3Crect width="120" height="80" fill="white"/%3E%3Crect x="20" y="25" width="80" height="30" rx="4" fill="silver"/%3E%3C/svg%3E';
  const products = Array.from({ length: 28 }, (_, index) => ({
    id: `p${index + 1}`, code: String(1201 + index), description: `PRODUTO ${index + 1} COM DESCRIÇÃO COMERCIAL PARA TESTE DO WORKSPACE DESKTOP`,
    category: categories[index % categories.length], subcategory: '', price: `R$ ${10 + index},90`, status: 'Ativo', notes: '', image: index === 1 ? image : '', specs: [], variants: [], tableRows: [], updatedAt: '2026-08-28T00:00:00.000Z'
  }));
  NS.Core.setState({
    schemaVersion: 7,
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
  await page.waitForFunction(() => Boolean(window.CatalogoTop?.Core && window.CatalogoTop?.GroupingControls && window.CatalogoTop?.ContextualInspector && window.CatalogoTop?.PreviewZoom));
  await page.evaluate(installFixture);
  await page.click('[data-tab="catalog"]');
  await page.waitForSelector('#catalog.panel.active .catalog-page');
  await page.waitForFunction(() => document.querySelector('.desktop-editor-actions') && document.querySelector('.selection-category-rail')?.children.length > 1);
  await page.waitForTimeout(120);

  const emptyDesktop = await page.evaluate(() => {
    const catalog = document.querySelector('#catalog.panel.active');
    const controls = catalog.querySelector('.catalog-controls');
    const inspector = catalog.querySelector('#contextualInspector');
    const panel = catalog.querySelector('.selection-panel');
    const previewColumn = catalog.querySelector('.preview-column');
    const preview = catalog.querySelector('#catalogPreviewViewport');
    const toolbar = catalog.querySelector('.preview-toolbar');
    const headingActions = toolbar.querySelector('.heading-actions');
    const zoom = toolbar.querySelector('.preview-zoom-controls');
    const actions = catalog.querySelector('.desktop-editor-actions');
    const list = catalog.querySelector('#selectableProducts');
    const firstRow = list.querySelector('.select-product');
    const actionNodes = [document.querySelector('#btnSelectVisible'), document.querySelector('#btnCreateCollection'), document.querySelector('#btnCreateTableBlock'), actions.querySelector('.desktop-action-overflow > summary')];
    const actionTops = actionNodes.map(node => node?.getBoundingClientRect().top ?? -1000);
    return {
      bodyOverflow: getComputedStyle(document.body).overflow,
      catalogOverflow: getComputedStyle(catalog).overflow,
      controlsDisplay: getComputedStyle(controls).display,
      inspectorDisplay: getComputedStyle(inspector).display,
      leftWidth: panel.getBoundingClientRect().width,
      previewWidth: previewColumn.getBoundingClientRect().width,
      previewHeight: preview.getBoundingClientRect().height,
      previewOverflowY: getComputedStyle(preview).overflowY,
      previewOverflowX: getComputedStyle(preview).overflowX,
      previewRangeY: Math.max(0, preview.scrollHeight - preview.clientHeight),
      previewRangeX: Math.max(0, preview.scrollWidth - preview.clientWidth),
      toolbarHeight: toolbar.getBoundingClientRect().height,
      actionsInToolbar: Boolean(headingActions && headingActions.parentElement === toolbar),
      actionsTop: headingActions?.getBoundingClientRect().top || 0,
      zoomTop: zoom?.getBoundingClientRect().top || 0,
      actionSpread: Math.max(...actionTops) - Math.min(...actionTops),
      listHeight: list.clientHeight,
      rowHeight: firstRow?.getBoundingClientRect().height || 1,
      listOverflow: getComputedStyle(list).overflowY,
      drawerDisplay: document.querySelector('#catalogPanelToggle') ? getComputedStyle(document.querySelector('#catalogPanelToggle')).display : 'none',
      zoomScale: window.CatalogoTop.PreviewZoom.getScale(),
      zoomMax: window.CatalogoTop.PreviewZoom.getMaxScale(),
      zoomValue: document.querySelector('#previewZoomValue').textContent,
      zoomInDisabled: document.querySelector('#btnPreviewZoomIn').disabled
    };
  });

  if (emptyDesktop.bodyOverflow !== 'hidden' || emptyDesktop.catalogOverflow !== 'hidden') throw new Error(`shell desktop voltou a rolar: ${JSON.stringify(emptyDesktop)}`);
  if (emptyDesktop.controlsDisplay === 'none' || emptyDesktop.inspectorDisplay !== 'none') throw new Error(`metadados não são o estado default sem target: ${JSON.stringify(emptyDesktop)}`);
  if (emptyDesktop.leftWidth < 470 || emptyDesktop.leftWidth > 600 || emptyDesktop.previewWidth < 760) throw new Error(`largura autoral não aproveita o novo teto do preview: ${JSON.stringify(emptyDesktop)}`);
  if (emptyDesktop.previewHeight < 760 || emptyDesktop.previewOverflowY !== 'auto' || emptyDesktop.previewRangeY < 160) throw new Error(`A4 não recebeu território vertical suficiente: ${JSON.stringify(emptyDesktop)}`);
  if (emptyDesktop.previewOverflowX !== 'hidden' || emptyDesktop.previewRangeX > 3) throw new Error(`novo 100% não deveria exigir scroll horizontal: ${JSON.stringify(emptyDesktop)}`);
  if (!emptyDesktop.actionsInToolbar || Math.abs(emptyDesktop.actionsTop - emptyDesktop.zoomTop) > 10 || emptyDesktop.toolbarHeight > 48) throw new Error(`ações principais não cabem na toolbar do preview: ${JSON.stringify(emptyDesktop)}`);
  if (emptyDesktop.actionSpread > 4) throw new Error(`toolbar contextual voltou a empilhar ações: ${JSON.stringify(emptyDesktop)}`);
  if (emptyDesktop.listOverflow !== 'auto' || emptyDesktop.listHeight < emptyDesktop.rowHeight * 4) throw new Error(`lista deve manter ao menos quatro itens visíveis: ${JSON.stringify(emptyDesktop)}`);
  if (emptyDesktop.drawerDisplay !== 'none') throw new Error(`drawer desktop não deve reaparecer: ${JSON.stringify(emptyDesktop)}`);
  if (Math.abs(emptyDesktop.zoomScale - .8) > .01 || Math.abs(emptyDesktop.zoomMax - .8) > .01 || emptyDesktop.zoomValue !== '100%' || !emptyDesktop.zoomInDisabled) throw new Error(`antigo 80% não virou o novo teto de 100%: ${JSON.stringify(emptyDesktop)}`);

  await page.click('#btnPreviewZoomOut');
  await page.waitForTimeout(40);
  const zoomOut = await page.evaluate(() => ({ value: document.querySelector('#previewZoomValue').textContent, scale: window.CatalogoTop.PreviewZoom.getScale(), plusDisabled: document.querySelector('#btnPreviewZoomIn').disabled }));
  if (!(zoomOut.scale < .8) || zoomOut.value === '100%' || zoomOut.plusDisabled) throw new Error(`zoom out desktop não usa escala normalizada: ${JSON.stringify(zoomOut)}`);
  await page.click('#btnPreviewZoomIn');
  await page.waitForFunction(() => document.querySelector('#previewZoomValue').textContent === '100%');

  await page.evaluate(() => window.CatalogoTop.ContextualInspector.selectProductFromList('p2'));
  await page.waitForSelector('#contextualInspector:not(.is-collapsed)');
  await page.waitForFunction(() => Boolean(document.querySelector('[data-inspector-image-tab]')));
  const selectedDesktop = await page.evaluate(() => {
    const controls = document.querySelector('#catalog > .catalog-controls');
    const inspector = document.querySelector('#contextualInspector');
    const fields = [...inspector.querySelectorAll('[data-inspector-card-field]')].map(node => node.getBoundingClientRect());
    const imageTab = inspector.querySelector('[data-inspector-image-tab]');
    const general = inspector.querySelector('[data-inspector-mode="general"]');
    return {
      controlsDisplay: getComputedStyle(controls).display,
      inspectorDisplay: getComputedStyle(inspector).display,
      inspectorHeight: inspector.getBoundingClientRect().height,
      fieldsSameRow: fields.length >= 3 && Math.max(...fields.map(rect => rect.top)) - Math.min(...fields.map(rect => rect.top)) < 5,
      imageTab: Boolean(imageTab),
      generalActive: general?.classList.contains('active') || false
    };
  });
  if (selectedDesktop.controlsDisplay !== 'none' || selectedDesktop.inspectorDisplay === 'none' || !selectedDesktop.fieldsSameRow || !selectedDesktop.imageTab || !selectedDesktop.generalActive) throw new Error(`target não substituiu metadados por configuração compacta: ${JSON.stringify(selectedDesktop)}`);

  await page.click('[data-inspector-image-tab]');
  await page.waitForFunction(() => document.querySelector('#contextualInspector')?.dataset.inspectorMode === 'image');
  const imageMode = await page.evaluate(() => ({
    frameDisplay: getComputedStyle(document.querySelector('.inspector-image-frame:not(.is-unavailable)')).display,
    fieldsDisplay: getComputedStyle(document.querySelector('.inspector-fields[data-inspector-card]')).display,
    sliderColor: getComputedStyle(document.querySelector('.inspector-frame-range input[type="range"]')).accentColor
  }));
  if (imageMode.frameDisplay === 'none' || imageMode.fieldsDisplay !== 'none') throw new Error(`tab Imagem não isolou enquadramento: ${JSON.stringify(imageMode)}`);

  await page.click('[data-tab="products"]');
  await page.waitForSelector('#products.panel.active');
  const products = await page.evaluate(() => {
    const workspace = document.querySelector('#products .product-workspace');
    const form = document.querySelector('#productForm');
    const contextual = document.querySelector('#productLibraryPanel');
    const path = document.querySelector('#productFolderPath');
    const legacyFolders = document.querySelector('#categoryFolders');
    const visibleTable = document.querySelector('.cadastro-product-table')?.closest('.table-wrap');
    return {
      columns: getComputedStyle(workspace).gridTemplateColumns,
      formDisplay: getComputedStyle(form).display,
      contextualDisplay: getComputedStyle(contextual).display,
      pathDisplay: getComputedStyle(path).display,
      legacyFoldersDisplay: getComputedStyle(legacyFolders).display,
      tableOverflow: visibleTable ? Math.max(0, visibleTable.scrollWidth - visibleTable.clientWidth) : -1,
      destructiveVisible: [...contextual.querySelectorAll('[data-delete-product-direct], [data-delete-category]')].some(node => getComputedStyle(node).display !== 'none' && node.getClientRects().length)
    };
  });
  if (products.formDisplay === 'none' || products.contextualDisplay === 'none' || products.pathDisplay === 'none' || products.legacyFoldersDisplay !== 'none' || products.tableOverflow > 3 || products.destructiveVisible) {
    throw new Error(`Cadastro desktop deve usar formulário + consulta contextual, sem filesystem/destruição legados: ${JSON.stringify(products)}`);
  }

  await page.setViewportSize({ width: 1100, height: 800 });
  await page.click('[data-tab="catalog"]');
  await page.waitForSelector('#catalog.panel.active');
  const tablet = await page.evaluate(() => ({
    layoutColumns: getComputedStyle(document.querySelector('.selection-layout')).gridTemplateColumns,
    panelPosition: getComputedStyle(document.querySelector('.selection-panel')).position,
    drawerDisplay: document.querySelector('#catalogPanelToggle') ? getComputedStyle(document.querySelector('#catalogPanelToggle')).display : 'none'
  }));
  if (tablet.layoutColumns.trim().split(/\s+/).length !== 1 || tablet.panelPosition !== 'static' || tablet.drawerDisplay !== 'none') throw new Error(`abaixo do desktop deve voltar diretamente ao fluxo vertical: ${JSON.stringify(tablet)}`);

  await page.setViewportSize({ width: 390, height: 844 });
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
    returning: document.querySelector('[data-editor-settings]').classList.contains('is-returning')
  }));
  if (mobileAnchor.filterTop <= mobileAnchor.inspectorTop || !mobileAnchor.returning) throw new Error(`⚙ mobile deve ancorar na configuração, antes do filtro: ${JSON.stringify(mobileAnchor)}`);

  console.log('PASS desktop panel ergonomics gate: metadata contextual, actions compactas, Cadastro contextual, 100%=0.8 e lista útil');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
