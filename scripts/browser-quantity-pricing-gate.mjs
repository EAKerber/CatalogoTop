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
  const base = (id, extras = {}) => ({
    id,
    code: id.toUpperCase(),
    description: `Produto ${id.toUpperCase()} com descrição comercial suficientemente longa para validar o encaixe no catálogo`,
    category: 'CORREDIÇAS',
    subcategory: 'Telescópicas',
    price: '54,9',
    quantityPrice: null,
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
    base('p1', { quantityPrice: { minQuantity: 10, price: '49.9' } }),
    base('p2', {
      quantityPrice: { minQuantity: 20, price: '45' },
      tableRows: [
        { id: 'r1', variant: '350 mm', code: 'P2-350', package: 'CX 10', price: '39,9', quantityPrice: { minQuantity: 10, price: '34,9' } },
        { id: 'r2', variant: '400 mm', code: 'P2-400', package: 'CX 10', price: '42,9' }
      ]
    }),
    base('p3', { price: '70', quantityPrice: { minQuantity: 12, price: '62,5' } }),
    base('p4', { price: '72' }),
    base('p5', {
      price: '80',
      quantityPrice: { minQuantity: 30, price: '70' },
      tableRows: [{ id: 'r5', variant: 'A', code: 'P5-A', package: 'CX 5', price: '78' }]
    }),
    base('p6', {
      price: '82',
      tableRows: [{ id: 'r6', variant: 'B', code: 'P6-B', package: 'CX 5', price: '80', quantityPrice: { minQuantity: 8, price: '74' } }]
    })
  ];

  NS.Core.setState({
    schemaVersion: 7,
    products,
    selectedIds: products.map(product => product.id),
    catalog: {
      title: 'Quantity gate',
      templateId: 'technical',
      showPrices: true,
      createdAt: '2026-08-27T00:00:00.000Z',
      presentation: NS.Composition.normalizePresentation({
        order: products.map(product => product.id),
        itemStyles: {
          p1: { contentPreset: 'commercial', emphasis: 'normal', width: 'simple', priceStyle: 'block' },
          p2: { contentPreset: 'commercial', emphasis: 'normal', width: 'wide', priceStyle: 'red' }
        },
        imageFrames: {},
        blocks: [
          { id: 'table-products-q', type: 'table', memberIds: ['p3', 'p4'], rowSource: 'products', density: 'compact', columns: ['code', 'price', 'minQuantity', 'quantityPrice'], commercialPrices: true },
          { id: 'table-rows-q', type: 'table', memberIds: ['p5', 'p6'], rowSource: 'commercialRows', density: 'compact', columns: ['variant', 'code', 'price', 'minQuantity', 'quantityPrice'], commercialPrices: true }
        ]
      })
    }
  }, { persist: false });
  NS.ProductStore.publishCurrent = async () => true;
  NS.App.renderAll();
}

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}/`;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.CatalogoTop?.Core && window.CatalogoTop?.App && window.CatalogoTop?.CommercialPresentation));
  await page.evaluate(installFixture);
  await page.click('[data-tab="catalog"]');
  await page.waitForSelector('.catalog-card[data-product-id="p1"] .catalog-card-quantity-price');

  const initial = await page.evaluate(() => {
    const root = document.getElementById('catalogPreview');
    const card1 = root.querySelector('.catalog-card[data-product-id="p1"]');
    const card2 = root.querySelector('.catalog-card[data-product-id="p2"]');
    const card2Rows = Array.from(card2.querySelectorAll('.catalog-card-table tbody tr')).map(row => Array.from(row.children).map(cell => cell.textContent.trim()));
    const tableProducts = root.querySelector('.catalog-table-block[data-table-block-id="table-products-q"]');
    const tableRows = root.querySelector('.catalog-table-block[data-table-block-id="table-rows-q"]');
    return {
      p1Unit: card1.querySelector('.catalog-card-price')?.textContent.trim(),
      p1Quantity: card1.querySelector('.catalog-card-quantity-price')?.textContent.replace(/\s+/g, ' ').trim(),
      p2Headers: Array.from(card2.querySelectorAll('.catalog-card-table th')).map(node => node.textContent.trim()),
      p2Rows: card2Rows,
      tableProductHeaders: Array.from(tableProducts.querySelectorAll('th')).map(node => node.textContent.trim()),
      tableProductText: tableProducts.textContent.replace(/\s+/g, ' ').trim(),
      tableRowsText: tableRows.textContent.replace(/\s+/g, ' ').trim(),
      overflow: Array.from(root.querySelectorAll('.catalog-card-content')).map(node => ({ scroll: node.scrollHeight, client: node.clientHeight }))
    };
  });

  if (initial.p1Unit !== 'R$ 54,90' || !initial.p1Quantity.includes('A partir de 10 un.') || !initial.p1Quantity.includes('R$ 49,90')) throw new Error(`Card não mostrou preço por quantidade: ${JSON.stringify(initial)}`);
  if (!initial.p2Headers.includes('Qtd. mín.') || !initial.p2Headers.includes('Preço qtd.')) throw new Error(`tabela interna não ganhou colunas de quantidade: ${JSON.stringify(initial.p2Headers)}`);
  if (!initial.p2Rows[0].includes('10') || !initial.p2Rows[0].includes('R$ 34,90')) throw new Error(`linha com condição não renderizou: ${JSON.stringify(initial.p2Rows)}`);
  if (!initial.p2Rows[1].includes('—')) throw new Error(`linha sem condição deveria permanecer vazia: ${JSON.stringify(initial.p2Rows[1])}`);
  if (!initial.tableProductHeaders.includes('Qtd. mín.') || !initial.tableProductHeaders.includes('Preço qtd.') || !initial.tableProductText.includes('R$ 62,50')) throw new Error(`Table products perdeu colunas de quantidade: ${JSON.stringify(initial)}`);
  if (initial.tableRowsText.includes('R$ 70,00') || !initial.tableRowsText.includes('R$ 74,00')) throw new Error(`Table commercialRows herdou condição geral ou perdeu condição da linha: ${initial.tableRowsText}`);
  if (initial.overflow.some(item => item.scroll > item.client + 2)) throw new Error(`Card com preço em quantidade excedeu área útil: ${JSON.stringify(initial.overflow)}`);

  const screenText = await page.textContent('#catalogPreview');
  await page.emulateMedia({ media: 'print' });
  const printText = await page.textContent('#catalogPreview');
  if (screenText !== printText) throw new Error('preview e print divergiram na condição por quantidade');
  await page.emulateMedia({ media: 'screen' });

  await page.click('[data-tab="products"]');
  await page.click('[data-cadastro-product="p1"]');
  await page.click('[data-form-step-target="2"]');
  await page.waitForSelector('[data-form-step="2"].active #hasQuantityPrice');
  const loaded = await page.evaluate(() => ({
    checked: document.getElementById('hasQuantityPrice').checked,
    min: document.getElementById('quantityMin').value,
    price: document.getElementById('quantityPrice').value
  }));
  if (!loaded.checked || loaded.min !== '10' || loaded.price !== 'R$ 49,90') throw new Error(`editor não carregou quantityPrice: ${JSON.stringify(loaded)}`);

  await page.uncheck('#hasQuantityPrice');
  await page.click('[data-form-step-target="3"]');
  await page.waitForSelector('[data-form-step="3"].active #commercialRows');
  await page.click('#btnSaveProduct');
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().products.find(product => product.id === 'p1')?.quantityPrice === null);

  await page.click('[data-cadastro-product="p1"]');
  await page.click('[data-form-step-target="2"]');
  await page.waitForSelector('[data-form-step="2"].active #hasQuantityPrice');
  await page.check('#hasQuantityPrice');
  await page.fill('#quantityMin', '1');
  await page.fill('#quantityPrice', '40');
  await page.click('[data-form-step-target="3"]');
  const invalid = await page.evaluate(() => ({
    valid: document.getElementById('quantityMin').checkValidity(),
    message: document.getElementById('quantityMin').validationMessage,
    step2Active: document.querySelector('[data-form-step="2"]')?.classList.contains('active') || false,
    savedValue: window.CatalogoTop.Core.getState().products.find(product => product.id === 'p1')?.quantityPrice
  }));
  if (invalid.valid || !invalid.message || !invalid.step2Active || invalid.savedValue !== null) throw new Error(`quantidade mínima inválida não bloqueou avanço/salvamento: ${JSON.stringify(invalid)}`);

  await page.evaluate(() => {
    const NS = window.CatalogoTop;
    NS.Core.mutate(draft => { draft.catalog.showPrices = false; });
    NS.App.renderCatalog();
  });
  const hidden = await page.evaluate(() => {
    const root = document.getElementById('catalogPreview');
    return {
      bands: root.querySelectorAll('.catalog-card-quantity-price').length,
      quantityHeaders: Array.from(root.querySelectorAll('th')).filter(node => ['Qtd. mín.', 'Preço qtd.'].includes(node.textContent.trim())).length,
      priceHeaders: Array.from(root.querySelectorAll('th')).filter(node => node.textContent.trim() === 'Preço').length
    };
  });
  if (hidden.bands || hidden.quantityHeaders || hidden.priceHeaders) throw new Error(`showPrices=false deixou condição comercial visível: ${JSON.stringify(hidden)}`);

  console.log('PASS browser quantity pricing gate: Card/Table, editor, não-herança, preview/print, overflow e showPrices');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
