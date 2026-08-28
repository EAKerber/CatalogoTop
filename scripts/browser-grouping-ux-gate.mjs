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

function installFixture() {
  const NS = window.CatalogoTop;
  const products = ['p1', 'p2', 'p3', 'p4'].map((id, index) => ({
    id,
    code: id.toUpperCase(),
    description: `Corrediça ${index + 1}`,
    category: 'CORREDIÇAS',
    subcategory: '',
    price: '',
    status: 'Ativo',
    notes: '',
    image: '',
    specs: [],
    variants: [],
    tableRows: [],
    quantityPrice: null,
    updatedAt: '2026-08-28T00:00:00.000Z'
  }));
  NS.Core.setState({
    schemaVersion: NS.Core.SCHEMA_VERSION,
    products,
    selectedIds: products.map(product => product.id),
    catalog: {
      title: 'Grouping UX gate',
      templateId: 'technical',
      showPrices: true,
      createdAt: '2026-08-28T00:00:00.000Z',
      presentation: NS.Composition.normalizePresentation({
        order: products.map(product => product.id),
        blocks: [],
        itemStyles: {},
        imageFrames: {}
      })
    }
  }, { persist: false });
  window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
}

const assertMembershipUnchanged = async (page, expected, context) => {
  const selected = await page.evaluate(() => window.CatalogoTop.Core.getState().selectedIds.slice());
  if (selected.join(',') !== expected.join(',')) throw new Error(`${context}: selectedIds mudou para ${selected.join(',')}`);
};

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}/`;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(
    window.CatalogoTop?.Core
    && window.CatalogoTop?.CatalogOrder
    && window.CatalogoTop?.PresentationActions
    && window.CatalogoTop?.GroupingControls
    && window.CatalogoTop?.BlockSelection
    && window.CatalogoTop?.CollectionControls
    && window.CatalogoTop?.TableControls
    && window.CatalogoTop?.ContextualInspector
  ));

  await page.evaluate(installFixture);
  await page.click('[data-tab="catalog"]');
  await page.waitForSelector('#selectableProducts [data-product-row="p1"]');

  const membership = ['p1', 'p2', 'p3', 'p4'];
  const browse = await page.evaluate(() => ({
    include: document.querySelector('#btnSelectVisible')?.textContent?.trim(),
    clear: document.querySelector('#btnClearSelection')?.textContent?.trim(),
    group: document.querySelector('#btnEnterGrouping')?.textContent?.trim(),
    browseHidden: document.querySelector('#selectionBrowseActions')?.hidden,
    groupingHidden: document.querySelector('#groupingActions')?.hidden,
    legacyPicks: document.querySelectorAll('[data-block-pick]').length,
    legacyMoves: document.querySelectorAll('[data-block-member-delta]').length,
    inspectorCollapsed: document.querySelector('#contextualInspector')?.classList.contains('is-collapsed')
  }));
  if (browse.include !== 'Incluir visíveis no catálogo' || browse.clear !== 'Esvaziar catálogo' || browse.group !== 'Agrupar') {
    throw new Error(`barra normal não ficou explícita: ${JSON.stringify(browse)}`);
  }
  if (browse.browseHidden || !browse.groupingHidden || browse.legacyPicks || browse.legacyMoves || !browse.inspectorCollapsed) {
    throw new Error(`chrome normal ainda contém controles antigos ou inspector expandido: ${JSON.stringify(browse)}`);
  }

  await page.click('#selectableProducts [data-product-row="p1"] > span strong');
  await page.waitForFunction(() => window.CatalogoTop.ComposerSelection.get()?.productId === 'p1');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.CatalogoTop.ComposerSelection.get());

  await page.click('#btnEnterGrouping');
  await page.waitForFunction(() => window.CatalogoTop.GroupingControls.mode() === 'grouping');
  const groupingStart = await page.evaluate(() => ({
    browseHidden: document.querySelector('#selectionBrowseActions')?.hidden,
    groupingHidden: document.querySelector('#groupingActions')?.hidden,
    checkboxesDisabled: [...document.querySelectorAll('[data-select-product]')].every(input => input.disabled),
    handlesDisabled: [...document.querySelectorAll('[data-order-handle]')].every(handle => handle.disabled),
    inspectorHidden: getComputedStyle(document.querySelector('#contextualInspector')).display === 'none'
  }));
  if (!groupingStart.browseHidden || groupingStart.groupingHidden || !groupingStart.checkboxesDisabled || !groupingStart.handlesDisabled || !groupingStart.inspectorHidden) {
    throw new Error(`modo Agrupar não isolou a intenção corretamente: ${JSON.stringify(groupingStart)}`);
  }

  await page.click('#selectableProducts [data-product-row="p1"] > span strong');
  await page.click('#selectableProducts [data-product-row="p2"] > span strong');
  let marked = await page.evaluate(() => ({
    ids: window.CatalogoTop.BlockSelection.ids(),
    collectionDisabled: document.querySelector('#btnCreateCollection')?.disabled,
    tableDisabled: document.querySelector('#btnCreateTableBlock')?.disabled,
    p4Ineligible: document.querySelector('[data-product-row="p4"]')?.classList.contains('grouping-ineligible')
  }));
  if (marked.ids.join(',') !== 'p1,p2' || marked.collectionDisabled || marked.tableDisabled || !marked.p4Ineligible) {
    throw new Error(`seleção estrutural não ficou contígua/operável: ${JSON.stringify(marked)}`);
  }
  await assertMembershipUnchanged(page, membership, 'marcar no modo Agrupar');

  await page.fill('#searchSelection', 'Corrediça');
  await page.waitForFunction(() => window.CatalogoTop.BlockSelection.ids().length === 0);
  if (await page.evaluate(() => window.CatalogoTop.GroupingControls.mode()) !== 'grouping') throw new Error('buscar deve limpar a marcação sem sair do modo Agrupar');
  await page.fill('#searchSelection', '');
  await page.click('#selectableProducts [data-product-row="p1"] > span strong');
  await page.click('#selectableProducts [data-product-row="p2"] > span strong');
  await page.click('#btnCreateCollection');
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().catalog.presentation.blocks.some(block => block.type === 'collection'));

  let blockState = await page.evaluate(() => {
    const NS = window.CatalogoTop;
    const block = NS.Core.getState().catalog.presentation.blocks.find(item => item.type === 'collection');
    return {
      id: block?.id,
      members: block?.memberIds || [],
      marked: NS.BlockSelection.ids(),
      mode: NS.GroupingControls.mode(),
      selection: NS.ComposerSelection.get()
    };
  });
  if (!blockState.id || blockState.members.join(',') !== 'p1,p2' || blockState.marked.length || blockState.mode !== 'browse' || blockState.selection?.kind !== 'collection') {
    throw new Error(`Collection criada com fechamento de modo inesperado: ${JSON.stringify(blockState)}`);
  }
  await assertMembershipUnchanged(page, membership, 'criar Collection');

  await page.waitForSelector(`#contextualInspector [data-inspector-member-order="${blockState.id}"]`);
  await page.click(`#contextualInspector [data-block-id="${blockState.id}"][data-product-id="p2"][data-inspector-member-move="-1"]`);
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().catalog.presentation.order.join(',') === 'p2,p1,p3,p4');
  let documentOrder = await page.evaluate(() => window.CatalogoTop.CatalogDocument.build(window.CatalogoTop.Core.getState()).orderedIds);
  if (documentOrder.join(',') !== 'p2,p1,p3,p4') throw new Error(`reorder interno da Collection não chegou ao documento: ${documentOrder.join(',')}`);
  await assertMembershipUnchanged(page, membership, 'reorder interno da Collection pelo inspector');

  await page.click('#btnEnterGrouping');
  await page.click('#selectableProducts [data-product-row="p3"] > span strong');
  await page.click('#selectableProducts [data-product-row="p4"] > span strong');
  await page.click('#btnCreateTableBlock');
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().catalog.presentation.blocks.some(block => block.type === 'table'));

  blockState = await page.evaluate(() => {
    const NS = window.CatalogoTop;
    const block = NS.Core.getState().catalog.presentation.blocks.find(item => item.type === 'table');
    return { id: block?.id, members: block?.memberIds || [], mode: NS.GroupingControls.mode(), selection: NS.ComposerSelection.get() };
  });
  if (!blockState.id || blockState.members.join(',') !== 'p3,p4' || blockState.mode !== 'browse' || blockState.selection?.kind !== 'table') {
    throw new Error(`Table criada com estado inesperado: ${JSON.stringify(blockState)}`);
  }

  await page.waitForSelector(`#contextualInspector [data-inspector-member-order="${blockState.id}"]`);
  await page.click(`#contextualInspector [data-block-id="${blockState.id}"][data-product-id="p4"][data-inspector-member-move="-1"]`);
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().catalog.presentation.order.join(',') === 'p2,p1,p4,p3');
  documentOrder = await page.evaluate(() => window.CatalogoTop.CatalogDocument.build(window.CatalogoTop.Core.getState()).orderedIds);
  if (documentOrder.join(',') !== 'p2,p1,p4,p3') throw new Error(`reorder interno da Table não chegou ao documento: ${documentOrder.join(',')}`);
  await assertMembershipUnchanged(page, membership, 'reorder interno da Table pelo inspector');

  await page.click('#btnEnterGrouping');
  await page.click('#btnCancelGrouping');
  const cancelled = await page.evaluate(() => ({
    mode: window.CatalogoTop.GroupingControls.mode(),
    marked: window.CatalogoTop.BlockSelection.ids(),
    browseHidden: document.querySelector('#selectionBrowseActions')?.hidden,
    groupingHidden: document.querySelector('#groupingActions')?.hidden
  }));
  if (cancelled.mode !== 'browse' || cancelled.marked.length || cancelled.browseHidden || !cancelled.groupingHidden) {
    throw new Error(`Cancelar não restaurou o modo normal: ${JSON.stringify(cancelled)}`);
  }

  console.log('PASS browser grouping UX gate: modo explícito, membership separado, inspector compacto e reorder interno contextual');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
