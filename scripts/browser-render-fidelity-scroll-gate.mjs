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

const LONG_DESCRIPTION = 'CORREDIÇA TELESCÓPICA REFORÇADA COM AMORTECIMENTO ABERTURA TOTAL DESLIZAMENTO SUAVE ALTA DURABILIDADE ACABAMENTO ZINCADO PARA MÓVEIS RESIDENCIAIS E CORPORATIVOS';

function installFixture(longDescription) {
  const NS = window.CatalogoTop;
  const product = index => ({
    id: `p${index}`,
    code: String(1264 + index),
    description: index >= 8 && index <= 12 ? longDescription : `CORREDIÇA TELESCÓPICA REFORÇADA ${200 + index * 50} MM`,
    category: 'CORREDIÇAS',
    subcategory: 'Telescópicas',
    price: `R$ ${10 + index},90`,
    status: 'Ativo',
    notes: '',
    image: '',
    specs: [],
    variants: [],
    tableRows: [],
    updatedAt: '2026-08-28T00:00:00.000Z'
  });
  const products = Array.from({ length: 30 }, (_, index) => product(index + 1));
  const order = products.map(item => item.id);
  const presentation = NS.Composition.normalizePresentation({
    order,
    itemStyles: {
      p13: { contentPreset: 'commercial', emphasis: 'normal', width: 'simple', priceStyle: 'block' }
    },
    blocks: [
      {
        id: 'table-1', type: 'table', memberIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'],
        title: 'CORREDIÇAS', subtitle: '', rowSource: 'products', density: 'compact',
        columns: ['image', 'code', 'description', 'price'], commercialPrices: true
      },
      {
        id: 'collection-1', type: 'collection', memberIds: ['p8', 'p9', 'p10', 'p11', 'p12'],
        title: 'CORREDIÇAS', subtitle: '', theme: 'light', columns: 4, itemPreset: 'commercial', itemStyles: {}
      }
    ]
  });
  NS.Core.setState({
    schemaVersion: 7,
    products,
    selectedIds: order,
    catalog: {
      title: 'Fidelity gate', templateId: 'technical', showPrices: true,
      createdAt: '2026-08-28T00:00:00.000Z', presentation
    }
  }, { persist: false });
  NS.App.renderAll();
}

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}/`;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.CatalogoTop?.Core && window.CatalogoTop?.App && window.CatalogoTop?.Print && window.CatalogoTop?.TextFit && window.CatalogoTop?.TableBlock));
  await page.evaluate(installFixture, LONG_DESCRIPTION);
  await page.click('[data-tab="catalog"]');
  await page.waitForSelector('.catalog-table-block[data-table-block-id="table-1"]');
  await page.waitForSelector('.catalog-collection[data-collection-id="collection-1"] .catalog-collection-item[data-product-id="p8"]');

  const contract = await page.evaluate(() => ({
    missing: window.CatalogoTop.Print.missingDocumentStyles(document),
    printable: window.CatalogoTop.Print.buildPrintableHtml(window.CatalogoTop.Core.getState()),
    retired: {
      distribution: getComputedStyle(document.querySelector('#catalogDistribution').closest('label')).display,
      typography: getComputedStyle(document.querySelector('#catalogTypography').closest('label')).display
    }
  }));
  if (contract.missing.length) throw new Error(`preview não carrega todos os estilos documentais: ${contract.missing.join(', ')}`);
  if (!contract.printable.includes('commercial-presentation.css')) throw new Error('documento imprimível voltou a omitir commercial-presentation.css');
  if (contract.retired.distribution !== 'none' || contract.retired.typography !== 'none') throw new Error(`Distribuição/Tipografia deveriam estar aposentadas da UI: ${JSON.stringify(contract.retired)}`);

  const geometry = await page.evaluate(longDescription => {
    const table = document.querySelector('.catalog-table-block[data-table-block-id="table-1"]');
    const cols = Object.fromEntries(Array.from(table.querySelectorAll('col[data-table-column-width]')).map(col => [col.dataset.tableColumnWidth, col.getBoundingClientRect().width]));
    const price = table.querySelector('.table-cell-price');
    const priceStyle = getComputedStyle(price);
    const collectionDescription = document.querySelector('.catalog-collection[data-collection-id="collection-1"] .catalog-collection-item[data-product-id="p8"] .catalog-collection-copy b');
    const stateDescription = window.CatalogoTop.Core.getState().products.find(product => product.id === 'p8').description;
    return {
      cols,
      tableLayout: getComputedStyle(table.querySelector('table')).tableLayout,
      price: { color: priceStyle.color, backgroundColor: priceStyle.backgroundColor, fontSize: priceStyle.fontSize, fontWeight: priceStyle.fontWeight },
      collection: {
        text: collectionDescription.textContent.trim(), full: collectionDescription.dataset.fullDescription,
        lines: collectionDescription.dataset.fitLines, truncated: collectionDescription.dataset.descriptionTruncated,
        visibleWords: Number(collectionDescription.dataset.visibleWords || 0), stateDescription, longDescription
      }
    };
  }, LONG_DESCRIPTION);

  if (geometry.tableLayout !== 'fixed') throw new Error(`Table deve continuar fixed com colgroup semântico; recebeu ${geometry.tableLayout}`);
  if (!(geometry.cols.description > geometry.cols.code * 2 && geometry.cols.description > geometry.cols.image * 2 && geometry.cols.description > geometry.cols.price * 1.8)) {
    throw new Error(`larguras físicas da Table não refletem semântica: ${JSON.stringify(geometry.cols)}`);
  }
  if (!geometry.price.backgroundColor || geometry.price.backgroundColor === 'rgba(0, 0, 0, 0)') throw new Error(`destaque comercial não apareceu no preview: ${JSON.stringify(geometry.price)}`);
  if (geometry.collection.lines !== '4' || geometry.collection.full !== LONG_DESCRIPTION || geometry.collection.stateDescription !== LONG_DESCRIPTION) {
    throw new Error(`Collection de 4 colunas não recebeu fitting factual de 4 linhas: ${JSON.stringify(geometry.collection)}`);
  }
  if (geometry.collection.text.includes('…') || geometry.collection.text.includes('...')) throw new Error('Collection não deve truncar com reticências');
  if (geometry.collection.truncated !== 'true') throw new Error('descrição longa da Collection deveria ser truncada por palavras');

  await page.evaluate(async () => {
    window.__fidelityPrintFrame = await window.CatalogoTop.Print.createPrintFrame(window.CatalogoTop.Core.getState());
  });

  const parity = await page.evaluate(() => {
    const snapshot = (doc, selector) => {
      const element = doc.querySelector(selector);
      if (!element) return null;
      const style = doc.defaultView.getComputedStyle(element);
      return {
        text: element.textContent.trim(), color: style.color, backgroundColor: style.backgroundColor,
        fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight
      };
    };
    const frame = window.__fidelityPrintFrame;
    const printDoc = frame.contentDocument;
    const previewPrice = snapshot(document, '.catalog-table-block[data-table-block-id="table-1"] .table-cell-price');
    const printPrice = snapshot(printDoc, '.catalog-table-block[data-table-block-id="table-1"] .table-cell-price');
    const previewDescription = document.querySelector('.catalog-collection[data-collection-id="collection-1"] .catalog-collection-item[data-product-id="p8"] .catalog-collection-copy b');
    const printDescription = printDoc.querySelector('.catalog-collection[data-collection-id="collection-1"] .catalog-collection-item[data-product-id="p8"] .catalog-collection-copy b');
    const ratioFor = doc => {
      const table = doc.querySelector('.catalog-table-block[data-table-block-id="table-1"]');
      const cols = Object.fromEntries(Array.from(table.querySelectorAll('col[data-table-column-width]')).map(col => [col.dataset.tableColumnWidth, col.getBoundingClientRect().width]));
      return { descriptionToCode: cols.description / cols.code, descriptionToPrice: cols.description / cols.price };
    };
    return {
      previewPrice,
      printPrice,
      previewText: previewDescription.textContent.trim(),
      printText: printDescription.textContent.trim(),
      previewLines: previewDescription.dataset.fitLines,
      printLines: printDescription.dataset.fitLines,
      previewRatio: ratioFor(document),
      printRatio: ratioFor(printDoc),
      printMissing: window.CatalogoTop.Print.missingDocumentStyles(printDoc)
    };
  });

  if (parity.printMissing.length) throw new Error(`iframe de impressão perdeu CSS documental: ${parity.printMissing.join(', ')}`);
  for (const property of ['color', 'backgroundColor', 'fontSize', 'fontWeight', 'lineHeight']) {
    if (parity.previewPrice?.[property] !== parity.printPrice?.[property]) throw new Error(`preview/PDF divergem em ${property}: ${JSON.stringify(parity)}`);
  }
  if (parity.previewPrice?.text !== parity.printPrice?.text) throw new Error(`preço mudou entre preview/PDF: ${JSON.stringify(parity)}`);
  if (parity.previewText !== parity.printText || parity.previewLines !== '4' || parity.printLines !== '4') throw new Error(`fitting mudou entre preview/PDF: ${JSON.stringify(parity)}`);
  if (Math.abs(parity.previewRatio.descriptionToCode - parity.printRatio.descriptionToCode) > 0.08 || Math.abs(parity.previewRatio.descriptionToPrice - parity.printRatio.descriptionToPrice) > 0.08) {
    throw new Error(`proporções de Table mudaram no PDF: ${JSON.stringify(parity)}`);
  }

  await page.click('.catalog-table-block[data-table-block-id="table-1"] .catalog-table-heading');
  await page.waitForSelector('#contextualInspector [data-inspector-table="table-1"]');

  const list = page.locator('#selectableProducts');
  await list.hover();
  const listBefore = await page.evaluate(() => ({
    inner: document.querySelector('#selectableProducts').scrollTop,
    client: document.querySelector('#selectableProducts').clientHeight,
    total: document.querySelector('#selectableProducts').scrollHeight,
    outer: document.querySelector('#catalog').scrollTop,
    overscroll: getComputedStyle(document.querySelector('#selectableProducts')).overscrollBehaviorY
  }));
  if (!(listBefore.total > listBefore.client + 50) || listBefore.overscroll !== 'auto') throw new Error(`lista não formou viewport rolável independente: ${JSON.stringify(listBefore)}`);
  await page.mouse.wheel(0, 520);
  await page.waitForTimeout(120);
  const listAfter = await page.evaluate(() => ({ inner: document.querySelector('#selectableProducts').scrollTop, outer: document.querySelector('#catalog').scrollTop }));
  if (!(listAfter.inner > listBefore.inner + 20)) throw new Error(`wheel não rolou a lista internamente: ${JSON.stringify({ listBefore, listAfter })}`);
  if (Math.abs(listAfter.outer - listBefore.outer) > 3) throw new Error(`lista em meio de curso moveu a página externa: ${JSON.stringify({ listBefore, listAfter })}`);

  const listEdgeBefore = await page.evaluate(() => {
    const node = document.querySelector('#selectableProducts');
    node.scrollTop = node.scrollHeight;
    return {
      top: node.scrollTop,
      max: Math.max(0, node.scrollHeight - node.clientHeight),
      overscroll: getComputedStyle(node).overscrollBehaviorY
    };
  });
  await list.hover();
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(120);
  const listEdgeAfter = await page.evaluate(() => {
    const node = document.querySelector('#selectableProducts');
    return {
      top: node.scrollTop,
      max: Math.max(0, node.scrollHeight - node.clientHeight),
      overscroll: getComputedStyle(node).overscrollBehaviorY
    };
  });
  if (Math.abs(listEdgeBefore.top - listEdgeBefore.max) > 2 || Math.abs(listEdgeAfter.top - listEdgeAfter.max) > 2 || listEdgeAfter.overscroll !== 'auto') {
    throw new Error(`lista deve atingir o limite e deixar chaining nativo desbloqueado: ${JSON.stringify({ listEdgeBefore, listEdgeAfter })}`);
  }

  const previewFlow = await page.evaluate(() => {
    const node = document.querySelector('#catalogPreviewViewport');
    const pageRoot = document.querySelector('#catalog.panel.active');
    return {
      top: node.scrollTop,
      range: Math.max(0, node.scrollHeight - node.clientHeight),
      overflowY: getComputedStyle(node).overflowY,
      pageOverflowY: getComputedStyle(pageRoot).overflowY,
      pageRange: Math.max(0, pageRoot.scrollHeight - pageRoot.clientHeight),
      previewHeight: node.getBoundingClientRect().height
    };
  });
  if (previewFlow.overflowY !== 'auto' || previewFlow.range < 200 || previewFlow.pageOverflowY !== 'hidden' || previewFlow.pageRange > 3 || previewFlow.previewHeight < 500) {
    throw new Error(`preview desktop não assumiu seu território vertical maximizado: ${JSON.stringify(previewFlow)}`);
  }
  await page.evaluate(() => { const node = document.querySelector('#catalogPreviewViewport'); node.scrollTop = 0; node.scrollBy(0, 620); });
  await page.waitForTimeout(80);
  const previewScroll = await page.evaluate(() => ({ outer: document.querySelector('#catalog').scrollTop, inner: document.querySelector('#catalogPreviewViewport').scrollTop }));
  if (previewScroll.inner < 20 || previewScroll.outer > 2) throw new Error(`A4 não assumiu o scroll vertical próprio no workspace desktop: ${JSON.stringify(previewScroll)}`);

  await page.evaluate(() => {
    window.__fidelityPrintFrame?.remove();
  });

  console.log('PASS browser render fidelity/scroll gate: CSS e fitting preview→PDF, colunas semânticas, lista rolável e A4 com scroll próprio maximizado no desktop');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
