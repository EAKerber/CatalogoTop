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

const LONG_DESCRIPTION = 'CORREDIÇA TELESCÓPICA INV SOFT EXTRA 350 MM REFORÇADA PARA MÓVEIS RESIDENCIAIS COM ABERTURA TOTAL DESLIZAMENTO SUAVE ALTA DURABILIDADE ACABAMENTO ZINCADO E SISTEMA DE AMORTECIMENTO INTEGRADO';

function installFixture(longDescription) {
  const NS = window.CatalogoTop;
  const base = (id, price, extras = {}) => ({
    id, code: id.toUpperCase(), description: `Produto ${id.toUpperCase()}`, category: 'CORREDIÇAS', subcategory: 'Telescópicas',
    price, status: 'Ativo', notes: '', image: '', specs: [], variants: [], tableRows: [], updatedAt: '2026-08-27T00:00:00.000Z', ...extras
  });
  const products = [
    base('p1', '54,9', { description: longDescription }),
    base('p2', '39,9'),
    base('p3', '89,9', { description: longDescription }),
    base('p4', '17,64', { tableRows: [{ id: 'r1', variant: '350 mm', code: 'P4-350', package: 'CX 10', price: '16,9' }] }),
    base('p5', '25,9'),
    base('p6', '27,9')
  ];

  NS.Core.setState({
    schemaVersion: 7,
    products,
    selectedIds: products.map(product => product.id),
    catalog: {
      title: 'Commercial gate', templateId: 'technical', showPrices: true, createdAt: '2026-08-27T00:00:00.000Z',
      presentation: NS.Composition.normalizePresentation({
        order: products.map(product => product.id),
        itemStyles: {
          p1: { contentPreset: 'commercial', width: 'simple', emphasis: 'normal', priceStyle: 'standard' },
          p2: { contentPreset: 'commercial', width: 'simple', emphasis: 'normal', priceStyle: 'red' },
          p3: { contentPreset: 'commercial', width: 'wide', emphasis: 'normal', priceStyle: 'label' },
          p4: { contentPreset: 'commercial', width: 'simple', emphasis: 'normal', priceStyle: 'block' }
        },
        imageFrames: {},
        blocks: [{
          id: 'table-commercial', type: 'table', memberIds: ['p5', 'p6'], title: 'Tabela comercial', rowSource: 'products', density: 'compact',
          columns: ['code', 'price', 'description'], commercialPrices: true
        }]
      })
    }
  }, { persist: false });
  NS.App.renderAll();
}

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(
    window.CatalogoTop?.Core && window.CatalogoTop?.App && window.CatalogoTop?.TextFit
    && window.CatalogoTop?.CommercialPresentation && window.CatalogoTop?.CommercialControls
  ));

  await page.evaluate(installFixture, LONG_DESCRIPTION);
  await page.click('[data-tab="catalog"]');
  await page.waitForSelector('.catalog-card[data-product-id="p1"].price-style-standard');
  await page.waitForSelector('.catalog-table-block[data-table-block-id="table-commercial"].price-style-label');

  const initial = await page.evaluate(fullDescription => {
    const card = id => document.querySelector(`.catalog-card[data-product-id="${id}"]`);
    const heading = id => card(id)?.querySelector('h3');
    const state = window.CatalogoTop.Core.getState();
    const tableBlock = document.querySelector('.catalog-table-block[data-table-block-id="table-commercial"]');
    const priceCell = tableBlock?.querySelector('.table-cell-price');
    const priceHeader = tableBlock?.querySelector('.table-column-price');
    const internalPriceCell = card('p4')?.querySelector('.catalog-card-table.has-price-column tbody td:last-child');
    return {
      classes: ['p1', 'p2', 'p3', 'p4'].map(id => ({ id, classes: [...card(id).classList], style: card(id).dataset.priceStyle })),
      p1: { text: heading('p1').textContent.trim(), full: heading('p1').dataset.fullDescription, lines: heading('p1').dataset.fitLines, words: Number(heading('p1').dataset.visibleWords), truncated: heading('p1').dataset.descriptionTruncated },
      p3: { text: heading('p3').textContent.trim(), full: heading('p3').dataset.fullDescription, lines: heading('p3').dataset.fitLines, words: Number(heading('p3').dataset.visibleWords), truncated: heading('p3').dataset.descriptionTruncated },
      stateDescription: state.products.find(product => product.id === 'p1').description,
      table: {
        style: tableBlock?.dataset.priceStyle,
        legacyCommercial: tableBlock?.classList.contains('commercial-prices'),
        headerIndex: priceHeader ? [...priceHeader.parentElement.children].indexOf(priceHeader) : -1,
        cellAlign: priceCell ? getComputedStyle(priceCell).textAlign : '',
        cellColor: priceCell ? getComputedStyle(priceCell).color : ''
      },
      internalBackground: internalPriceCell ? getComputedStyle(internalPriceCell).backgroundColor : '',
      fullDescription
    };
  }, LONG_DESCRIPTION);

  const expectedStyles = { p1: 'standard', p2: 'red', p3: 'label', p4: 'block' };
  for (const entry of initial.classes) {
    if (entry.style !== expectedStyles[entry.id] || !entry.classes.includes(`price-style-${expectedStyles[entry.id]}`)) throw new Error(`priceStyle não chegou ao Card ${entry.id}: ${JSON.stringify(entry)}`);
  }
  if (initial.p1.full !== LONG_DESCRIPTION || initial.p3.full !== LONG_DESCRIPTION || initial.stateDescription !== LONG_DESCRIPTION) throw new Error('fitting alterou a descrição factual');
  if (initial.p1.text.includes('…') || initial.p1.text.includes('...') || initial.p3.text.includes('…')) throw new Error('fitting não deve usar reticências');
  if (initial.p1.lines !== '3' || initial.p3.lines !== '4') throw new Error(`orçamento de linhas inesperado: ${JSON.stringify({ p1: initial.p1, p3: initial.p3 })}`);
  if (initial.p1.truncated !== 'true') throw new Error('descrição longa do card simples deveria ser truncada por palavras');
  if (!(initial.p3.words >= initial.p1.words)) throw new Error(`card largo mostrou menos palavras que card simples: ${initial.p1.words} vs ${initial.p3.words}`);
  if (initial.table.style !== 'label' || !initial.table.legacyCommercial || initial.table.headerIndex !== 1 || initial.table.cellAlign !== 'right') {
    throw new Error(`Table legada não migrou para Etiqueta/semântica de preço: ${JSON.stringify(initial.table)}`);
  }
  if (!initial.internalBackground || initial.internalBackground === 'rgba(0, 0, 0, 0)') throw new Error(`priceStyle block não destacou preço da tabela interna: ${initial.internalBackground}`);

  await page.click('.catalog-card[data-product-id="p1"]');
  const cardEditor = '[data-commercial-card-price-editor][data-product-id="p1"]';
  await page.waitForSelector(cardEditor);
  const cardRadioCount = await page.locator(`${cardEditor} input[data-commercial-price-style]`).count();
  if (cardRadioCount !== 4) throw new Error(`inspector deveria oferecer 4 apresentações de preço no Card; recebeu ${cardRadioCount}`);
  await page.click(`${cardEditor} label:has(input[data-commercial-price-style][value="block"]) span`);
  await page.waitForSelector('.catalog-card[data-product-id="p1"].price-style-block');
  const afterCardChange = await page.evaluate(() => {
    const state = window.CatalogoTop.Core.getState();
    return { price: state.products.find(product => product.id === 'p1')?.price, style: state.catalog.presentation.itemStyles.p1?.priceStyle };
  });
  if (afterCardChange.price !== 'R$ 54,90' || afterCardChange.style !== 'block') throw new Error(`inspector contaminou Product ou não persistiu presentation: ${JSON.stringify(afterCardChange)}`);

  await page.click('.catalog-table-block[data-table-block-id="table-commercial"] .catalog-table-heading');
  const tableEditor = '#contextualInspector [data-commercial-table-price-editor]';
  await page.waitForSelector(tableEditor);
  const tableRadioCount = await page.locator(`${tableEditor} input[data-commercial-table-price-style]`).count();
  if (tableRadioCount !== 4) throw new Error(`Table deveria oferecer 4 apresentações de preço; recebeu ${tableRadioCount}`);
  for (const style of ['standard', 'red', 'label', 'block']) {
    await page.click(`${tableEditor} label:has(input[data-commercial-table-price-style][value="${style}"]) span`);
    await page.waitForFunction(({ style }) => window.CatalogoTop.Core.getState().catalog.presentation.blocks.find(block => block.id === 'table-commercial')?.priceStyle === style, { style });
    await page.waitForSelector(`.catalog-table-block[data-table-block-id="table-commercial"].price-style-${style}`);
  }
  const tableState = await page.evaluate(() => {
    const block = window.CatalogoTop.Core.getState().catalog.presentation.blocks.find(item => item.id === 'table-commercial');
    return { priceStyle: block?.priceStyle, commercialPrices: block?.commercialPrices };
  });
  if (tableState.priceStyle !== 'block' || tableState.commercialPrices !== true) throw new Error(`Table não persistiu priceStyle block/compatibilidade: ${JSON.stringify(tableState)}`);

  const prePrintText = await page.textContent('.catalog-card[data-product-id="p1"] h3');
  await page.emulateMedia({ media: 'print' });
  const printText = await page.textContent('.catalog-card[data-product-id="p1"] h3');
  if (prePrintText !== printText) throw new Error('preview e print divergiram no texto ajustado');
  await page.emulateMedia({ media: 'screen' });

  await page.evaluate(() => {
    const NS = window.CatalogoTop;
    NS.Core.mutate(draft => { draft.catalog.showPrices = false; });
    NS.App.renderCatalog();
  });
  const hidden = await page.evaluate(() => ({
    cardPrices: document.querySelectorAll('.catalog-card-price').length,
    internalPriceHeaders: [...document.querySelectorAll('.catalog-card-table th')].filter(node => node.textContent.trim() === 'Preço').length,
    tablePriceHeaders: document.querySelectorAll('.catalog-table-block .table-column-price').length
  }));
  if (hidden.cardPrices || hidden.internalPriceHeaders || hidden.tablePriceHeaders) throw new Error(`showPrices=false deixou preços estruturais visíveis: ${JSON.stringify(hidden)}`);

  console.log('PASS browser commercial presentation gate: quatro estilos de Card/Table, migração legada, fitting por palavras e fidelidade factual/print');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
