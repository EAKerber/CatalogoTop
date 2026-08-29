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
  const svg = label => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="white"/><rect x="60" y="70" width="480" height="260" rx="24" fill="#d9dde2"/><circle cx="180" cy="200" r="58" fill="#777"/><text x="360" y="215" text-anchor="middle" font-family="Arial" font-size="42" fill="#222">${label}</text></svg>`)}`;
  const product = (id, variants = []) => ({
    id,
    code: id.toUpperCase(),
    description: `Produto ${id}`,
    category: 'Ferragens',
    subcategory: '',
    price: 'R$ 39,90',
    status: 'Ativo',
    notes: '',
    image: svg(id),
    specs: [],
    variants,
    tableRows: [],
    updatedAt: '2026-08-28T00:00:00.000Z'
  });
  const p1 = product('p1');
  const p2 = product('p2');
  const p3 = product('p3');
  const p4 = product('p4', [{ label: 'A', image: svg('A') }, { label: 'B', image: svg('B') }]);
  const products = [p1, p2, p3, p4];
  NS.Core.setState({
    schemaVersion: NS.Core.SCHEMA_VERSION,
    products,
    selectedIds: products.map(item => item.id),
    catalog: {
      title: 'Image framing gate',
      templateId: 'technical',
      showPrices: true,
      createdAt: '2026-08-28T00:00:00.000Z',
      presentation: NS.Composition.normalizePresentation({
        order: ['p1', 'p2', 'p3', 'p4'],
        imageFrames: {},
        blocks: [{
          id: 'collection-frame',
          type: 'collection',
          memberIds: ['p2', 'p3'],
          title: 'Coleção',
          subtitle: '',
          theme: 'light',
          columns: 2,
          itemPreset: 'visual',
          itemStyles: {}
        }]
      })
    }
  }, { persist: false });
  window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
  return { originalP1: p1.image, originalP2: p2.image };
}

async function enterImageMode(page) {
  await page.waitForSelector('#contextualInspector [data-inspector-image-tab]');
  await page.click('#contextualInspector [data-inspector-image-tab]');
  await page.waitForFunction(() => document.querySelector('#contextualInspector')?.dataset.inspectorMode === 'image');
}

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.CatalogoTop?.ImageFraming && window.CatalogoTop?.PresentationActions && window.CatalogoTop?.ContextualInspector && window.CatalogoTop?.Print));
  const originals = await page.evaluate(fixtureStateScript);
  await page.click('[data-tab="catalog"]');
  await page.waitForSelector('#catalogPreview .catalog-card[data-product-id="p1"] .catalog-card-visuals.single > img');

  await page.click('#catalogPreview .catalog-card[data-product-id="p1"]');
  await page.waitForSelector('#contextualInspector [data-image-frame-editor="p1"]');
  await enterImageMode(page);
  await page.check('#contextualInspector [data-image-frame-editor="p1"] input[data-image-frame-field="fit"][value="cover"]');
  await page.locator('#contextualInspector [data-image-frame-editor="p1"] input[data-image-frame-field="zoom"]').evaluate(input => {
    input.value = '1.8';
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.locator('#contextualInspector [data-image-frame-editor="p1"] input[data-image-frame-field="x"]').evaluate(input => {
    input.value = '22';
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.locator('#contextualInspector [data-image-frame-editor="p1"] input[data-image-frame-field="y"]').evaluate(input => {
    input.value = '76';
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForFunction(() => {
    const frame = window.CatalogoTop.Core.getState().catalog.presentation.imageFrames.p1;
    return frame?.fit === 'cover' && frame.zoom === 1.8 && frame.x === 22 && frame.y === 76;
  });

  const cardFrame = await page.evaluate(() => {
    const NS = window.CatalogoTop;
    const image = document.querySelector('#catalogPreview .catalog-card[data-product-id="p1"] .catalog-card-visuals.single > img');
    const product = NS.Core.getState().products.find(item => item.id === 'p1');
    return {
      stored: NS.Core.getState().catalog.presentation.imageFrames.p1,
      image: product.image,
      fit: image?.style.objectFit,
      position: image?.style.objectPosition,
      transform: image?.style.transform,
      origin: image?.style.transformOrigin,
      target: image?.dataset.imageFrameTarget
    };
  });
  if (cardFrame.image !== originals.originalP1) throw new Error('framing alterou a URL original do produto');
  if (cardFrame.fit !== 'cover' || cardFrame.position !== '22% 76%' || cardFrame.transform !== 'scale(1.8)' || cardFrame.origin !== '22% 76%' || cardFrame.target !== 'primary') {
    throw new Error(`frame do Card não chegou ao renderer: ${JSON.stringify(cardFrame)}`);
  }

  await page.click('#catalogPreview .catalog-collection[data-collection-id="collection-frame"] .catalog-collection-item[data-product-id="p2"]');
  await page.waitForSelector('#contextualInspector [data-image-frame-editor="p2"]');
  await enterImageMode(page);
  await page.locator('#contextualInspector [data-image-frame-editor="p2"] input[data-image-frame-field="zoom"]').evaluate(input => {
    input.value = '1.5';
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().catalog.presentation.imageFrames.p2?.zoom === 1.5);
  const collectionFrame = await page.evaluate(() => {
    const NS = window.CatalogoTop;
    const image = document.querySelector('#catalogPreview .catalog-collection-item[data-product-id="p2"] .catalog-collection-image > img');
    const product = NS.Core.getState().products.find(item => item.id === 'p2');
    return { image: product.image, transform: image?.style.transform, holderOverflow: image?.parentElement?.style.overflow };
  });
  if (collectionFrame.image !== originals.originalP2 || collectionFrame.transform !== 'scale(1.5)' || collectionFrame.holderOverflow !== 'hidden') {
    throw new Error(`frame do membro da Collection inválido: ${JSON.stringify(collectionFrame)}`);
  }

  await page.click('#catalogPreview .catalog-card[data-product-id="p4"]');
  await page.waitForSelector('#contextualInspector .inspector-image-frame.is-unavailable');
  const variantGridControls = await page.locator('#contextualInspector [data-image-frame-editor="p4"]').count();
  if (variantGridControls) throw new Error('Card com grade de variantes não deve expor frame único enganoso');

  const printableHtml = await page.evaluate(() => window.CatalogoTop.Print.buildPrintableHtml(window.CatalogoTop.Core.getState()));
  const printPage = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await printPage.setContent(printableHtml, { waitUntil: 'networkidle' });
  const printState = await printPage.evaluate(() => {
    const card = document.querySelector('.catalog-card[data-product-id="p1"] .catalog-card-visuals.single > img');
    const collection = document.querySelector('.catalog-collection-item[data-product-id="p2"] .catalog-collection-image > img');
    return {
      cardTransform: card?.style.transform,
      cardPosition: card?.style.objectPosition,
      collectionTransform: collection?.style.transform,
      inspectorChrome: document.querySelectorAll('.inspector-image-frame,[data-image-frame-editor]').length
    };
  });
  if (printState.cardTransform !== 'scale(1.8)' || printState.cardPosition !== '22% 76%' || printState.collectionTransform !== 'scale(1.5)' || printState.inspectorChrome) {
    throw new Error(`preview/print sem paridade de framing: ${JSON.stringify(printState)}`);
  }
  await printPage.close();

  await page.click('#catalogPreview .catalog-card[data-product-id="p1"]');
  await page.waitForSelector('#contextualInspector [data-image-frame-reset="p1"]');
  await enterImageMode(page);
  await page.click('#contextualInspector [data-image-frame-reset="p1"]');
  await page.waitForFunction(() => !Object.prototype.hasOwnProperty.call(window.CatalogoTop.Core.getState().catalog.presentation.imageFrames, 'p1'));
  const reset = await page.evaluate(() => {
    const image = document.querySelector('#catalogPreview .catalog-card[data-product-id="p1"] .catalog-card-visuals.single > img');
    return { fit: image?.style.objectFit, position: image?.style.objectPosition, transform: image?.style.transform };
  });
  if (reset.fit !== 'contain' || reset.position !== '50% 50%' || reset.transform !== 'scale(1)') throw new Error(`reset visual inválido: ${JSON.stringify(reset)}`);

  console.log('PASS browser image framing gate: tab Imagem, Card/Collection, print e reset');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}