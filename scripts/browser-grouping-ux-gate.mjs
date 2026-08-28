import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.csv': 'text/csv; charset=utf-8'
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

function installFixture() {
  const NS = window.CatalogoTop;
  const products = Array.from({ length: 6 }, (_, index) => ({
    id: `p${index + 1}`,
    code: String(1265 + index),
    description: `CORREDIÇA TELESCÓPICA REFORÇADA ${250 + index * 50} MM COM DESCRIÇÃO COMERCIAL MAIS LONGA`,
    category: 'CORREDIÇAS',
    subcategory: '',
    price: `R$ ${10 + index * 2},90`,
    status: 'Ativo', notes: '', image: '', specs: [], variants: [], tableRows: [], quantityPrice: null,
    updatedAt: '2026-08-28T00:00:00.000Z'
  }));
  NS.Core.setState({
    schemaVersion: NS.Core.SCHEMA_VERSION,
    products,
    selectedIds: products.map(product => product.id),
    catalog: {
      title: 'Seleção editorial gate', templateId: 'technical', showPrices: true, createdAt: '2026-08-28T00:00:00.000Z',
      presentation: NS.Composition.normalizePresentation({ order: products.map(product => product.id), blocks: [], itemStyles: {}, imageFrames: {} })
    }
  }, { persist: false });
  NS.ComposerSelection?.clear?.();
  window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
}

const membership = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
async function assertMembership(page, context) {
  const ids = await page.evaluate(() => window.CatalogoTop.Core.getState().selectedIds.slice());
  if (ids.join(',') !== membership.join(',')) throw new Error(`${context}: membership mudou para ${ids.join(',')}`);
}

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(
    window.CatalogoTop?.Core && window.CatalogoTop?.ComposerSelection && window.CatalogoTop?.GroupingControls
    && window.CatalogoTop?.CollectionControls && window.CatalogoTop?.TableControls && window.CatalogoTop?.ContextualInspector
  ));
  await page.evaluate(installFixture);
  await page.click('[data-tab="catalog"]');
  await page.waitForSelector('#selectableProducts [data-product-row="p1"]');

  const baseline = await page.evaluate(() => {
    const row = document.querySelector('#selectableProducts [data-product-row="p1"]');
    return {
      checked: row?.querySelector('[data-select-product]')?.checked,
      background: getComputedStyle(row).backgroundColor,
      orderDisplay: getComputedStyle(row.querySelector('.selection-order')).display,
      contextHidden: document.querySelector('#groupingActions')?.hidden,
      legacyBulk: document.querySelectorAll('.bulk-presentation-controls,[data-bulk-presentation]').length,
      oldGroupingButtonDisplay: document.querySelector('#btnEnterGrouping') ? getComputedStyle(document.querySelector('#btnEnterGrouping')).display : 'missing'
    };
  });
  if (!baseline.checked || baseline.background !== 'rgb(255, 255, 255)' || baseline.orderDisplay !== 'none' || !baseline.contextHidden || baseline.legacyBulk) {
    throw new Error(`membership ainda parece seleção editorial ou há chrome legado: ${JSON.stringify(baseline)}`);
  }
  if (!['none', 'missing'].includes(baseline.oldGroupingButtonDisplay)) throw new Error(`botão Agrupar legado ficou visível: ${baseline.oldGroupingButtonDisplay}`);

  const p1 = page.locator('#selectableProducts [data-product-row="p1"] > span strong');
  const p2 = page.locator('#selectableProducts [data-product-row="p2"] > span strong');
  const p4 = page.locator('#selectableProducts [data-product-row="p4"] > span strong');
  await p1.click();
  await p2.click({ modifiers: ['Control'] });
  let selected = await page.evaluate(() => ({
    ids: window.CatalogoTop.ComposerSelection.ids(),
    candidates: window.CatalogoTop.GroupingControls.candidateIds(12),
    contextHidden: document.querySelector('#groupingActions')?.hidden,
    collectionDisabled: document.querySelector('#btnCreateCollection')?.disabled,
    tableDisabled: document.querySelector('#btnCreateTableBlock')?.disabled,
    p1Editor: document.querySelector('[data-product-row="p1"]')?.classList.contains('editor-selected-row'),
    p2Editor: document.querySelector('[data-product-row="p2"]')?.classList.contains('editor-selected-row')
  }));
  if (selected.ids.join(',') !== 'p1,p2' || selected.candidates.join(',') !== 'p1,p2' || selected.contextHidden || selected.collectionDisabled || selected.tableDisabled || !selected.p1Editor || !selected.p2Editor) {
    throw new Error(`Ctrl seleção/contexto inválidos: ${JSON.stringify(selected)}`);
  }
  await assertMembership(page, 'Ctrl seleção');

  await p4.click({ modifiers: ['Shift'] });
  selected = await page.evaluate(() => ({ ids: window.CatalogoTop.ComposerSelection.ids(), anchor: window.CatalogoTop.ComposerSelection.anchor() }));
  if (selected.ids.join(',') !== 'p2,p3,p4' || selected.anchor !== 'p2') throw new Error(`Shift range não seguiu a âncora editorial: ${JSON.stringify(selected)}`);
  await assertMembership(page, 'Shift range');

  await page.keyboard.press('Escape');
  await p1.click();
  await p2.click({ modifiers: ['Control'] });
  await page.click('#btnCreateCollection');
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().catalog.presentation.blocks.some(block => block.type === 'collection'));
  const collectionId = await page.evaluate(() => window.CatalogoTop.Core.getState().catalog.presentation.blocks.find(block => block.type === 'collection').id);
  await assertMembership(page, 'criar Collection');
  await page.waitForSelector(`#contextualInspector [data-inspector-member-order="${collectionId}"]`);

  await page.keyboard.press('Escape');
  const p3 = page.locator('#selectableProducts [data-product-row="p3"] > span strong');
  const p6 = page.locator('#selectableProducts [data-product-row="p6"] > span strong');
  await p3.click();
  await p6.click({ modifiers: ['Shift'] });
  await page.waitForFunction(() => window.CatalogoTop.GroupingControls.candidateIds(30).join(',') === 'p3,p4,p5,p6');
  await page.click('#btnCreateTableBlock');
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().catalog.presentation.blocks.some(block => block.type === 'table'));
  const tableId = await page.evaluate(() => window.CatalogoTop.Core.getState().catalog.presentation.blocks.find(block => block.type === 'table').id);
  await assertMembership(page, 'criar Table');

  await page.waitForSelector(`#catalogPreview .catalog-table-block[data-table-block-id="${tableId}"] tr[data-product-id="p3"]`);
  const widthContract = await page.evaluate(tableId => {
    const NS = window.CatalogoTop;
    const state = NS.Core.getState();
    const block = state.catalog.presentation.blocks.find(item => item.id === tableId);
    const byId = new Map(state.products.map(product => [String(product.id), product]));
    const members = block.memberIds.map(id => byId.get(String(id))).filter(Boolean);
    const fragmented = NS.TableBlock.fragmentTable(block, members);
    const expected = NS.TableBlock.planColumnWidths(fragmented.block.columns, fragmented.columnDemand).map(item => ({ id: item.id, width: item.percent }));
    const logicalItems = NS.CatalogDocument.build(state).pages.flatMap(item => item.items).filter(item => item.type === 'table' && item.blockId === tableId);
    const rendered = Array.from(document.querySelectorAll(`#catalogPreview .catalog-table-block[data-table-block-id="${CSS.escape(tableId)}"]`)).map(table => Array.from(table.querySelectorAll('col[data-table-column-width]')).map(col => ({ id: col.dataset.tableColumnWidth, width: parseFloat(col.style.width) })));
    return {
      rawFragments: fragmented.fragments.length,
      expected,
      logicalDemands: logicalItems.map(item => item.columnDemand || {}),
      rendered
    };
  }, tableId);
  if (widthContract.rawFragments < 2) throw new Error(`fixture deveria produzir fragmentação lógica, recebeu ${widthContract.rawFragments}`);
  if (!widthContract.rendered.length) throw new Error('Table não foi materializada no preview');
  const expectedSignature = JSON.stringify(widthContract.expected);
  if (widthContract.rendered.some(widths => JSON.stringify(widths) !== expectedSignature)) {
    throw new Error(`Table renderizada divergiu do plano adaptativo único: ${JSON.stringify(widthContract)}`);
  }
  if (widthContract.logicalDemands.some(demand => JSON.stringify(demand) !== JSON.stringify(widthContract.logicalDemands[0]))) {
    throw new Error(`itens lógicos da mesma Table não compartilharam demanda: ${JSON.stringify(widthContract.logicalDemands)}`);
  }
  const firstWidths = Object.fromEntries(widthContract.expected.map(item => [item.id, item.width]));
  const totalWidth = widthContract.expected.reduce((sum, item) => sum + item.width, 0);
  if (Math.abs(totalWidth - 100) > .05 || !(firstWidths.description > firstWidths.code && firstWidths.description > firstWidths.price)) {
    throw new Error(`plano adaptativo não ocupou 100% com Produto dominante: ${JSON.stringify(widthContract.expected)}`);
  }

  await page.click(`#catalogPreview .catalog-table-block[data-table-block-id="${tableId}"] tr[data-product-id="p3"] td`);
  await page.waitForSelector('#contextualInspector [data-inspector-table-row]');
  selected = await page.evaluate(() => window.CatalogoTop.ComposerSelection.get());
  if (selected?.kind !== 'table-row' || selected.blockId !== tableId || selected.productId !== 'p3') throw new Error(`linha da Table não virou target específico: ${JSON.stringify(selected)}`);

  const listHeightBefore = await page.evaluate(() => document.querySelector('#selectableProducts').clientHeight);
  await page.click('#contextualInspector [data-inspector-toggle]');
  await page.waitForSelector('#contextualInspector.is-minimized');
  const collapsed = await page.evaluate(() => ({ target: window.CatalogoTop.ComposerSelection.get(), listHeight: document.querySelector('#selectableProducts').clientHeight }));
  if (collapsed.target?.kind !== 'table-row' || collapsed.listHeight <= listHeightBefore) throw new Error(`recolher inspector não preservou target/devolveu altura: ${JSON.stringify({ listHeightBefore, ...collapsed })}`);
  await page.click('#contextualInspector [data-inspector-toggle]');
  await page.waitForSelector('#contextualInspector [data-inspector-table-row]');

  await page.waitForSelector('#contextualInspector [data-commercial-table-price-style] input[value="block"]');
  await page.check('#contextualInspector [data-commercial-table-price-style] input[value="block"]');
  await page.waitForFunction(tableId => window.CatalogoTop.Core.getState().catalog.presentation.blocks.find(block => block.id === tableId)?.priceStyle === 'block', tableId);
  await page.waitForSelector(`#catalogPreview .catalog-table-block[data-table-block-id="${tableId}"].price-style-block`);

  await page.click(`#catalogPreview .catalog-collection[data-collection-id="${collectionId}"] .catalog-collection-item[data-product-id="p1"]`);
  await page.waitForSelector('#contextualInspector [data-commercial-member-price-style] input[value="label"]');
  await page.check('#contextualInspector [data-commercial-member-price-style] input[value="label"]');
  await page.waitForFunction(collectionId => window.CatalogoTop.Core.getState().catalog.presentation.blocks.find(block => block.id === collectionId)?.itemStyles?.p1?.priceStyle === 'label', collectionId);
  await page.waitForSelector(`#catalogPreview .catalog-collection[data-collection-id="${collectionId}"] .catalog-collection-item[data-product-id="p1"].price-style-label .catalog-collection-price`);

  const printFrame = await page.evaluate(async () => {
    const frame = await window.CatalogoTop.Print.createPrintFrame(window.CatalogoTop.Core.getState());
    const table = frame.contentDocument.querySelector('.catalog-table-block.price-style-block .table-cell-price');
    const collectionPrice = frame.contentDocument.querySelector('.catalog-collection-item.price-style-label .catalog-collection-price');
    const result = {
      tableBackground: table ? frame.contentWindow.getComputedStyle(table).backgroundColor : '',
      collectionBorder: collectionPrice ? frame.contentWindow.getComputedStyle(collectionPrice).borderTopWidth : '',
      legacyBulk: frame.contentDocument.querySelectorAll('.bulk-presentation-controls,[data-bulk-presentation]').length
    };
    frame.remove();
    return result;
  });
  if (!printFrame.tableBackground || printFrame.tableBackground === 'rgba(0, 0, 0, 0)' || printFrame.collectionBorder === '0px' || printFrame.legacyBulk) {
    throw new Error(`estilos de agrupamento não sobreviveram ao documento de impressão: ${JSON.stringify(printFrame)}`);
  }

  await assertMembership(page, 'estilos e seleção de linha');

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForFunction(() => Boolean(window.CatalogoTop?.ContextualInspector && window.CatalogoTop?.ComposerSelection));
  await mobilePage.evaluate(installFixture);
  await mobilePage.click('[data-tab="catalog"]');
  await mobilePage.waitForSelector('#selectableProducts [data-product-row="p1"]');
  await mobilePage.evaluate(() => window.CatalogoTop.ComposerSelection.clear());

  const dispatchPress = async move => mobilePage.evaluate(async shouldMove => {
    const row = document.querySelector('#selectableProducts [data-product-row="p1"] > span strong');
    row.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', button: 0, clientX: 20, clientY: 20 }));
    if (shouldMove) row.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'touch', clientX: 20, clientY: 45 }));
    await new Promise(resolve => setTimeout(resolve, 510));
    row.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', button: 0, clientX: 20, clientY: shouldMove ? 45 : 20 }));
    return window.CatalogoTop.ComposerSelection.ids();
  }, move);

  let mobileIds = await dispatchPress(true);
  if (mobileIds.length) throw new Error(`movimento deve cancelar long-press, recebeu ${mobileIds.join(',')}`);
  mobileIds = await dispatchPress(false);
  if (mobileIds.join(',') !== 'p1') throw new Error(`long-press não selecionou produto: ${mobileIds.join(',')}`);
  await mobile.close();

  console.log('PASS browser grouping UX gate: seleção unificada, Table row/adaptativa, inspector recolhível e preços em agrupamentos');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
