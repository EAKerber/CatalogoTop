import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.csv': 'text/csv; charset=utf-8'
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'fixture_offline' }));
      return;
    }
    const rawPath = decodeURIComponent(url.pathname);
    const relative = rawPath === '/' ? 'index.html' : rawPath.replace(/^\/+/, '');
    const safe = normalize(relative).replace(/^(\.\.[/\\])+/, '');
    const file = join(root, safe);
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not file');
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
    response.end(body);
  } catch (_) {
    response.writeHead(404);
    response.end('not found');
  }
});

function fixtureStateScript() {
  const NS = window.CatalogoTop;
  const product = id => ({
    id,
    code: id.toUpperCase(),
    description: `Produto ${id}`,
    category: 'Elétrica',
    subcategory: '35 mm',
    price: `R$ ${Number(id.slice(1)) + 10},90`,
    status: 'Ativo',
    notes: '',
    image: '',
    specs: [],
    variants: [],
    tableRows: [],
    updatedAt: '2026-08-26T00:00:00.000Z'
  });
  const products = Array.from({ length: 8 }, (_, index) => product(`p${index + 1}`));
  const selectedIds = products.map(item => item.id);
  const presentation = NS.Composition.normalizePresentation({
    distribution: 'balanced',
    typography: 'neutral',
    order: selectedIds,
    itemStyles: {},
    blocks: [
      {
        id: 'collection-1',
        type: 'collection',
        memberIds: ['p3', 'p4'],
        title: 'Coleção elétrica',
        subtitle: '35 mm',
        theme: 'light',
        columns: 2,
        itemPreset: 'visual',
        itemStyles: {}
      },
      {
        id: 'table-1',
        type: 'table',
        memberIds: ['p6', 'p7'],
        title: 'Tabela elétrica',
        subtitle: 'Referências',
        rowSource: 'products',
        density: 'compact',
        columns: ['code', 'description', 'price']
      }
    ]
  });
  NS.Core.setState({
    schemaVersion: NS.Core.SCHEMA_VERSION,
    products,
    selectedIds,
    catalog: {
      title: 'Inspector gate',
      templateId: 'technical',
      showPrices: true,
      createdAt: '2026-08-26T00:00:00.000Z',
      presentation
    }
  }, { persist: false });
  window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
  return NS.CatalogDocument.build(NS.Core.getState());
}

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}/`;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.CatalogoTop?.Core && window.CatalogoTop?.CatalogOrder && window.CatalogoTop?.ComposerSelection && window.CatalogoTop?.PresentationActions && window.CatalogoTop?.ContextualInspector && window.CatalogoTop?.Print));

  const initial = await page.evaluate(fixtureStateScript);
  if (initial.orderedIds.join(',') !== 'p1,p2,p3,p4,p5,p6,p7,p8') throw new Error(`ordem inicial inesperada: ${initial.orderedIds.join(',')}`);

  const migration = await page.evaluate(() => {
    const NS = window.CatalogoTop;
    const products = NS.Core.getState().products;
    const migrated = NS.Core.migrate({
      schemaVersion: 4,
      products,
      selectedIds: ['p2', 'p1'],
      catalog: { title: 'Legado', templateId: 'technical', showPrices: true, presentation: { itemStyles: {}, blocks: [] } }
    });
    return { schemaVersion: migrated.schemaVersion, order: migrated.catalog.presentation.order };
  });
  if (migration.schemaVersion !== 7 || migration.order.join(',') !== 'p2,p1') throw new Error(`migração legada→v7 não preservou ordem: ${JSON.stringify(migration)}`);

  await page.click('[data-tab="catalog"]');
  await page.waitForSelector('#catalogPreview .catalog-card[data-product-id="p1"]');
  await page.waitForSelector('#catalogPreview .catalog-collection[data-collection-id="collection-1"]');
  await page.waitForSelector('#catalogPreview .catalog-table-block[data-table-block-id="table-1"]');

  await page.click('#catalogPreview .catalog-card[data-product-id="p1"]');
  await page.waitForSelector('#contextualInspector [data-inspector-card="p1"]');
  let selected = await page.evaluate(() => window.CatalogoTop.ComposerSelection.get());
  if (selected?.kind !== 'card' || selected.productId !== 'p1') throw new Error(`Card do preview não selecionou target correto: ${JSON.stringify(selected)}`);

  const selectedIdsBefore = await page.evaluate(() => window.CatalogoTop.Core.getState().selectedIds.slice());
  await page.selectOption('#contextualInspector [data-inspector-card="p1"] [data-inspector-card-field="width"]', 'full');
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().catalog.presentation.itemStyles.p1?.width === 'full');
  await page.waitForSelector('#catalogPreview .catalog-card[data-product-id="p1"][data-card-width="full"]');
  const widthState = await page.evaluate(() => {
    const NS = window.CatalogoTop;
    const doc = NS.CatalogDocument.build(NS.Core.getState());
    const card = doc.pages.flatMap(item => item.items).find(item => item.type === 'card' && item.productId === 'p1');
    return { width: card?.width, selectedIds: NS.Core.getState().selectedIds.slice() };
  });
  if (widthState.width !== 'full') throw new Error(`largura alterada no inspector não chegou ao CatalogDocument: ${JSON.stringify(widthState)}`);
  if (widthState.selectedIds.join(',') !== selectedIdsBefore.join(',')) throw new Error('editar largura não pode alterar membership');

  await page.click('#catalogPreview .catalog-collection[data-collection-id="collection-1"] .catalog-collection-item[data-product-id="p3"]');
  await page.waitForSelector('#contextualInspector [data-inspector-collection-member="p3"]');
  selected = await page.evaluate(() => window.CatalogoTop.ComposerSelection.get());
  if (selected?.kind !== 'collection-member' || selected.blockId !== 'collection-1' || selected.productId !== 'p3') throw new Error(`membro da Collection não selecionou target correto: ${JSON.stringify(selected)}`);
  await page.selectOption('#contextualInspector [data-inspector-collection-member="p3"] [data-inspector-member-field="emphasis"]', 'feature');
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().catalog.presentation.blocks.find(block => block.id === 'collection-1')?.itemStyles?.p3?.emphasis === 'feature');

  await page.click('#catalogPreview .catalog-collection[data-collection-id="collection-1"] .catalog-collection-header');
  await page.waitForSelector('#contextualInspector [data-inspector-collection="collection-1"]');
  await page.selectOption('#contextualInspector [data-inspector-collection="collection-1"] [data-inspector-collection-field="theme"]', 'dark');
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().catalog.presentation.blocks.find(block => block.id === 'collection-1')?.theme === 'dark');

  await page.click('#catalogPreview .catalog-table-block[data-table-block-id="table-1"]');
  await page.waitForSelector('#contextualInspector [data-inspector-table="table-1"]');
  await page.selectOption('#contextualInspector [data-inspector-table="table-1"] [data-inspector-table-field="density"]', 'comfortable');
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().catalog.presentation.blocks.find(block => block.id === 'table-1')?.density === 'comfortable');

  await page.click('#selectableProducts [data-product-row="p2"] > span strong');
  await page.waitForFunction(() => window.CatalogoTop.ComposerSelection.get()?.kind === 'card' && window.CatalogoTop.ComposerSelection.get()?.productId === 'p2');
  const listSync = await page.evaluate(() => ({
    previewSelected: document.querySelector('#catalogPreview .catalog-card[data-product-id="p2"]')?.classList.contains('editor-selected') || false,
    rowSelected: document.querySelector('#selectableProducts [data-product-row="p2"]')?.classList.contains('editor-selected-row') || false
  }));
  if (!listSync.previewSelected || !listSync.rowSelected) throw new Error(`lista/preview não sincronizaram seleção: ${JSON.stringify(listSync)}`);

  const p2Handle = page.locator('#selectableProducts [data-order-handle="card:p2"]');
  await p2Handle.focus();
  await p2Handle.press('Alt+ArrowDown');
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().catalog.presentation.order.join(',') === 'p1,p3,p4,p2,p5,p6,p7,p8');
  let reorder = await page.evaluate(() => ({
    order: window.CatalogoTop.CatalogDocument.build(window.CatalogoTop.Core.getState()).orderedIds,
    selectedIds: window.CatalogoTop.Core.getState().selectedIds.slice()
  }));
  if (reorder.order.join(',') !== 'p1,p3,p4,p2,p5,p6,p7,p8') throw new Error(`reorder pela lista não chegou ao documento: ${JSON.stringify(reorder)}`);
  if (reorder.selectedIds.join(',') !== selectedIdsBefore.join(',')) throw new Error('reorder não pode alterar selectedIds');

  let collectionHandle = page.locator('#selectableProducts [data-order-handle="collection:collection-1"]');
  await collectionHandle.focus();
  await collectionHandle.press('Alt+ArrowDown');
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().catalog.presentation.order.join(',') === 'p1,p2,p3,p4,p5,p6,p7,p8');
  collectionHandle = page.locator('#selectableProducts [data-order-handle="collection:collection-1"]');
  await collectionHandle.focus();
  await collectionHandle.press('Alt+ArrowDown');
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().catalog.presentation.order.join(',') === 'p1,p2,p5,p3,p4,p6,p7,p8');
  reorder = await page.evaluate(() => ({
    order: window.CatalogoTop.CatalogDocument.build(window.CatalogoTop.Core.getState()).orderedIds,
    selectedIds: window.CatalogoTop.Core.getState().selectedIds.slice(),
    collectionMembers: window.CatalogoTop.Core.getState().catalog.presentation.blocks.find(block => block.id === 'collection-1')?.memberIds || []
  }));
  if (reorder.order.join(',') !== 'p1,p2,p5,p3,p4,p6,p7,p8') throw new Error(`Collection não moveu como unidade: ${JSON.stringify(reorder)}`);
  if (reorder.order.indexOf('p4') !== reorder.order.indexOf('p3') + 1 || reorder.collectionMembers.join(',') !== 'p3,p4') throw new Error('reorder de Collection rompeu contiguidade/membership');
  if (reorder.selectedIds.join(',') !== selectedIdsBefore.join(',')) throw new Error('reorder de Collection alterou selectedIds');

  await page.fill('#searchSelection', 'Produto');
  await page.waitForFunction(() => [...document.querySelectorAll('#selectableProducts [data-order-handle]')].every(handle => handle.disabled));
  const disabledDuringSearch = await page.evaluate(() => [...document.querySelectorAll('#selectableProducts [data-order-handle]')].every(handle => handle.disabled));
  if (!disabledDuringSearch) throw new Error('busca textual ativa deve desabilitar reorder');
  await page.fill('#searchSelection', '');
  await page.waitForFunction(() => [...document.querySelectorAll('#selectableProducts [data-order-handle]')].some(handle => !handle.disabled));

  const printableHtml = await page.evaluate(() => window.CatalogoTop.Print.buildPrintableHtml(window.CatalogoTop.Core.getState()));
  const printPage = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await printPage.setContent(printableHtml, { waitUntil: 'networkidle' });
  const printChrome = await printPage.evaluate(() => ({
    inspector: document.querySelectorAll('#contextualInspector,.contextual-inspector').length,
    handles: document.querySelectorAll('[data-order-handle]').length,
    editorSelection: document.querySelectorAll('.editor-selected,.editor-selected-row').length,
    selectionPanel: document.querySelectorAll('.selection-panel').length,
    pages: document.querySelectorAll('.catalog-page').length
  }));
  if (printChrome.inspector || printChrome.handles || printChrome.editorSelection || printChrome.selectionPanel || !printChrome.pages) throw new Error(`print contaminado pelo chrome editorial: ${JSON.stringify(printChrome)}`);
  await printPage.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForFunction(() => Boolean(window.CatalogoTop?.ContextualInspector && window.CatalogoTop?.PreviewZoom));
  await mobilePage.evaluate(fixtureStateScript);
  await mobilePage.click('[data-tab="catalog"]');
  await mobilePage.waitForSelector('#catalogPreview .catalog-card[data-product-id="p1"]');
  await mobilePage.click('#btnPreviewFit');
  await mobilePage.waitForTimeout(100);
  const mobileCard = mobilePage.locator('#catalogPreview .catalog-card[data-product-id="p1"]');
  await mobileCard.tap();
  const mobileSelected = await mobilePage.evaluate(() => window.CatalogoTop.ComposerSelection.get());
  if (mobileSelected?.kind !== 'card' || mobileSelected.productId !== 'p1') throw new Error(`tap mobile não selecionou Card: ${JSON.stringify(mobileSelected)}`);

  await mobileCard.scrollIntoViewIfNeeded();
  const beforeTouch = await mobilePage.evaluate(() => document.scrollingElement?.scrollTop || window.scrollY || 0);
  const box = await mobileCard.boundingBox();
  if (!box) throw new Error('não foi possível medir Card mobile para gate touch');
  const x = Math.max(20, Math.min(370, box.x + box.width * .5));
  const startY = Math.max(180, Math.min(760, box.y + Math.min(box.height * .7, 220)));
  const cdp = await mobileContext.newCDPSession(mobilePage);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY, radiusX: 2, radiusY: 2, force: 1, id: 1 }] });
  for (let step = 1; step <= 6; step += 1) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: startY - step * 28, radiusX: 2, radiusY: 2, force: 1, id: 1 }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await mobilePage.waitForTimeout(180);
  const afterTouch = await mobilePage.evaluate(() => document.scrollingElement?.scrollTop || window.scrollY || 0);
  if (afterTouch <= beforeTouch + 8) throw new Error(`seleção contextual bloqueou scroll touch vertical: antes=${beforeTouch}, depois=${afterTouch}`);
  await mobileContext.close();

  console.log('PASS browser inspector gate: seleção contextual, inspector, reorder atômico, membership estável, print limpo e touch vertical');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
