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
  const base = (id, price, extras = {}) => ({
    id,
    code: id.toUpperCase(),
    description: `Produto ${id.toUpperCase()}`,
    category: 'CORREDIÇAS',
    subcategory: '',
    price,
    status: 'Ativo',
    notes: '',
    image: '',
    specs: [],
    variants: [],
    tableRows: [],
    updatedAt: '2026-08-27T00:00:00.000Z',
    ...extras
  });
  const products = [
    base('p1', '54,9'),
    base('p2', '10', { tableRows: [{ id: 'r1', variant: '350 mm', code: 'P2-350', package: 'CX 10', price: '39.9' }] }),
    base('p3', '4.2'),
    base('p4', '4,25'),
    base('p5', '1234.56'),
    base('p6', '1.200,00')
  ];
  NS.Core.setState({
    schemaVersion: NS.Core.SCHEMA_VERSION,
    products,
    selectedIds: products.map(product => product.id),
    catalog: {
      title: 'Money gate',
      templateId: 'technical',
      showPrices: true,
      createdAt: '2026-08-27T00:00:00.000Z',
      presentation: NS.Composition.normalizePresentation({
        order: products.map(product => product.id),
        itemStyles: { p2: { contentPreset: 'commercial', emphasis: 'normal', width: 'simple' } },
        imageFrames: {},
        blocks: [
          { id: 'collection-money', type: 'collection', memberIds: ['p3', 'p4'], itemPreset: 'commercial', columns: 2, theme: 'light' },
          { id: 'table-money', type: 'table', memberIds: ['p5', 'p6'], rowSource: 'products', density: 'compact', columns: ['code', 'description', 'price'] }
        ]
      })
    }
  }, { persist: false });
  NS.App.renderAll();
}

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}/`;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.CatalogoTop?.Money && window.CatalogoTop?.Core && window.CatalogoTop?.App));
  await page.evaluate(installFixture);
  await page.click('[data-tab="catalog"]');
  await page.waitForSelector('[data-product-id="p1"] .catalog-card-price');

  const rendered = await page.evaluate(() => {
    const text = selector => document.querySelector(selector)?.textContent?.trim() || '';
    return {
      card: text('[data-product-id="p1"] .catalog-card-price'),
      cardTable: text('[data-product-id="p2"] .catalog-card-table'),
      collectionP3: text('.catalog-collection [data-product-id="p3"] .catalog-collection-price'),
      collectionP4: text('.catalog-collection [data-product-id="p4"] .catalog-collection-price'),
      table: text('.catalog-table-block[data-table-block-id="table-money"]'),
      statePrices: window.CatalogoTop.Core.getState().products.map(product => ({ id: product.id, price: product.price, rows: product.tableRows.map(row => row.price) }))
    };
  });

  if (rendered.card !== 'R$ 54,90') throw new Error(`card não renderizou BRL canônico: ${JSON.stringify(rendered)}`);
  if (!rendered.cardTable.includes('R$ 39,90')) throw new Error(`tabela interna do card não renderizou BRL: ${rendered.cardTable}`);
  if (rendered.collectionP3 !== 'R$ 4,20' || rendered.collectionP4 !== 'R$ 4,25') throw new Error(`Collection não renderizou BRL: ${JSON.stringify(rendered)}`);
  if (!rendered.table.includes('R$ 1.234,56') || !rendered.table.includes('R$ 1.200,00')) throw new Error(`Table não renderizou BRL: ${rendered.table}`);
  if (rendered.statePrices.some(entry => entry.price && !entry.price.startsWith('R$ ')) || rendered.statePrices.some(entry => entry.rows.some(price => price && !price.startsWith('R$ ')))) {
    throw new Error(`estado contém preço reconhecido não canônico: ${JSON.stringify(rendered.statePrices)}`);
  }

  await page.click('[data-tab="products"]');
  await page.click('[data-form-step-target="2"]');
  await page.fill('#price', '4.2');
  await page.locator('#price').blur();
  const normalizedField = await page.inputValue('#price');
  if (normalizedField !== 'R$ 4,20') throw new Error(`campo de preço não normalizou no blur: ${normalizedField}`);

  await page.click('[data-form-step-target="3"]');
  await page.fill('#commercialRows', 'Branco | P-1 | CX 10 | 39.9');
  await page.locator('#commercialRows').blur();
  const commercialField = await page.inputValue('#commercialRows');
  if (!commercialField.includes('R$ 39,90')) throw new Error(`linhas comerciais não normalizaram no blur: ${commercialField}`);

  await page.click('[data-form-step-target="2"]');
  await page.fill('#price', '54 reais');
  await page.locator('#price').blur();
  const invalidState = await page.evaluate(() => ({ valid: document.getElementById('price').checkValidity(), message: document.getElementById('price').validationMessage }));
  if (invalidState.valid || !invalidState.message) throw new Error(`entrada manual inválida não foi bloqueada: ${JSON.stringify(invalidState)}`);

  await page.evaluate(() => {
    const NS = window.CatalogoTop;
    NS.Core.mutate(draft => { draft.catalog.showPrices = false; });
    NS.App.renderCatalog();
  });
  const hiddenPrices = await page.evaluate(() => ({
    card: document.querySelectorAll('.catalog-card-price').length,
    collection: document.querySelectorAll('.catalog-collection-price').length,
    tableHeaders: [...document.querySelectorAll('.catalog-table-block th')].map(node => node.textContent.trim())
  }));
  if (hiddenPrices.card || hiddenPrices.collection || hiddenPrices.tableHeaders.includes('Preço')) {
    throw new Error(`showPrices=false deixou preço visível: ${JSON.stringify(hiddenPrices)}`);
  }

  console.log('PASS browser money gate: BRL canônico em Card/Collection/Table, edição normalizada e showPrices preservado');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
