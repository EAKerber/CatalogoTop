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
    updatedAt: '2026-08-27T00:00:00.000Z'
  }));
  NS.Core.setState({
    schemaVersion: NS.Core.SCHEMA_VERSION,
    products,
    selectedIds: products.map(product => product.id),
    catalog: {
      title: 'Grouping UX gate',
      templateId: 'technical',
      showPrices: true,
      createdAt: '2026-08-27T00:00:00.000Z',
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
    && window.CatalogoTop?.BlockSelection
    && window.CatalogoTop?.CollectionControls
    && window.CatalogoTop?.TableControls
  ));

  await page.evaluate(installFixture);
  await page.click('[data-tab="catalog"]');
  await page.waitForSelector('#selectableProducts [data-product-row="p1"] [data-block-pick]');

  const membership = ['p1', 'p2', 'p3', 'p4'];
  const membershipLabels = await page.evaluate(() => ({
    include: document.querySelector('#btnSelectVisible')?.textContent?.trim(),
    clear: document.querySelector('#btnClearSelection')?.textContent?.trim(),
    checked: [...document.querySelectorAll('#selectableProducts [data-select-product]')].every(input => input.checked)
  }));
  if (membershipLabels.include !== 'Incluir visíveis no catálogo' || membershipLabels.clear !== 'Esvaziar catálogo' || !membershipLabels.checked) {
    throw new Error(`membership não ficou semanticamente explícito: ${JSON.stringify(membershipLabels)}`);
  }

  await page.click('#selectableProducts [data-product-row="p1"] [data-block-pick]');
  await page.click('#selectableProducts [data-product-row="p2"] [data-block-pick]');
  const marked = await page.evaluate(() => ({
    ids: window.CatalogoTop.BlockSelection.ids(),
    collectionDisabled: document.querySelector('#btnCreateCollection')?.disabled,
    tableDisabled: document.querySelector('#btnCreateTableBlock')?.disabled,
    p1Checked: document.querySelector('[data-select-product="p1"]')?.checked,
    p2Checked: document.querySelector('[data-select-product="p2"]')?.checked
  }));
  if (marked.ids.join(',') !== 'p1,p2' || marked.collectionDisabled || marked.tableDisabled || !marked.p1Checked || !marked.p2Checked) {
    throw new Error(`marcação estrutural conflitou com membership: ${JSON.stringify(marked)}`);
  }
  await assertMembershipUnchanged(page, membership, 'marcar produtos para bloco');

  await page.click('#btnCreateCollection');
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().catalog.presentation.blocks.some(block => block.type === 'collection'));
  const collectionState = await page.evaluate(() => {
    const NS = window.CatalogoTop;
    const block = NS.Core.getState().catalog.presentation.blocks.find(item => item.type === 'collection');
    return { id: block?.id, members: block?.memberIds || [], marked: NS.BlockSelection.ids() };
  });
  if (!collectionState.id || collectionState.members.join(',') !== 'p1,p2' || collectionState.marked.length) {
    throw new Error(`Collection criada com estado inesperado: ${JSON.stringify(collectionState)}`);
  }
  await assertMembershipUnchanged(page, membership, 'criar Collection');

  await page.waitForSelector('#selectableProducts [data-product-row="p2"] [data-block-member-delta="-1"]:not(:disabled)');
  await page.click('#selectableProducts [data-product-row="p2"] [data-block-member-delta="-1"]');
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().catalog.presentation.order.join(',') === 'p2,p1,p3,p4');
  const collectionOrder = await page.evaluate(() => ({
    order: window.CatalogoTop.Core.getState().catalog.presentation.order.slice(),
    documentOrder: window.CatalogoTop.CatalogDocument.build(window.CatalogoTop.Core.getState()).orderedIds
  }));
  if (collectionOrder.order.join(',') !== 'p2,p1,p3,p4' || collectionOrder.documentOrder.join(',') !== 'p2,p1,p3,p4') {
    throw new Error(`reorder interno da Collection não chegou ao documento: ${JSON.stringify(collectionOrder)}`);
  }
  await assertMembershipUnchanged(page, membership, 'reorder interno da Collection');

  await page.click('#selectableProducts [data-product-row="p3"] [data-block-pick]');
  await page.click('#selectableProducts [data-product-row="p4"] [data-block-pick]');
  await page.click('#btnCreateTableBlock');
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().catalog.presentation.blocks.some(block => block.type === 'table'));
  await page.waitForSelector('#selectableProducts [data-product-row="p4"] [data-block-member-delta="-1"]:not(:disabled)');
  await page.click('#selectableProducts [data-product-row="p4"] [data-block-member-delta="-1"]');
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().catalog.presentation.order.join(',') === 'p2,p1,p4,p3');
  const tableOrder = await page.evaluate(() => window.CatalogoTop.CatalogDocument.build(window.CatalogoTop.Core.getState()).orderedIds);
  if (tableOrder.join(',') !== 'p2,p1,p4,p3') throw new Error(`reorder interno da Table não chegou ao documento: ${tableOrder.join(',')}`);
  await assertMembershipUnchanged(page, membership, 'reorder interno da Table');

  console.log('PASS browser grouping UX gate: membership, marcação estrutural e reorder interno permanecem separados');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
