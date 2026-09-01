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
    const relative = decodeURIComponent(url.pathname) === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const safe = normalize(relative).replace(/^(\.\.[/\\])+/, '');
    const file = join(root, safe);
    if (!(await stat(file)).isFile()) throw new Error('not file');
    response.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404);
    response.end('not found');
  }
});

function seedState() {
  const NS = window.CatalogoTop;
  const svg = label => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="white"/><rect x="45" y="55" width="510" height="290" rx="30" fill="#d9dde2"/><circle cx="155" cy="200" r="64" fill="#777"/><text x="370" y="216" text-anchor="middle" font-family="Arial" font-size="42" fill="#222">${label}</text></svg>`)}`;
  const product = (id, label) => ({
    id,
    folderId: 'f-ferragens',
    code: id.toUpperCase(),
    description: `Produto ${id}`,
    category: 'Ferragens',
    subcategory: '',
    price: 'R$ 39,90',
    status: 'Ativo',
    notes: '',
    image: svg(`${label}-original`),
    imageGallery: [{ id: 'front', label: 'Frente', image: svg(`${label}-front`), provenance: { kind: 'manual' } }],
    specs: [],
    variants: [],
    tableRows: [],
    updatedAt: '2026-09-01T00:00:00.000Z'
  });
  const p1 = product('p1', 'table-one');
  const p2 = product('p2', 'table-two');
  NS.Core.setState({
    schemaVersion: 9,
    folders: [{ id: 'f-ferragens', parentId: null, name: 'Ferragens' }],
    products: [p1, p2],
    selectedIds: ['p1', 'p2'],
    catalog: {
      title: 'R5a table image gate',
      templateId: 'technical',
      templateVersion: 1,
      showPrices: true,
      createdAt: '2026-09-01T00:00:00.000Z',
      presentation: NS.Composition.normalizePresentation({
        order: ['p1', 'p2'],
        imageSelections: {},
        imageFrames: {},
        blocks: [{
          id: 'table-r5a',
          type: 'table',
          memberIds: ['p1', 'p2'],
          title: 'Tabela com imagens',
          subtitle: '',
          rowSource: 'products',
          density: 'compact',
          columns: ['image', 'code', 'description']
        }]
      })
    }
  }, { persist: false });
  window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
  return { original: p1.image };
}

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(
    window.CatalogoTop?.ImageVariants
    && window.CatalogoTop?.ImageVariantControls
    && window.CatalogoTop?.ImageFraming
    && window.CatalogoTop?.PresentationActions
    && window.CatalogoTop?.TableBlock
    && window.CatalogoTop?.Print
  ));

  const seeded = await page.evaluate(seedState);
  await page.click('[data-tab="catalog"]');
  const rowSelector = '#catalogPreview .catalog-table-block[data-table-block-id="table-r5a"] tr[data-table-row-id="p1"]';
  const imageSelector = `${rowSelector} .table-cell-image > img`;
  await page.waitForSelector(imageSelector);

  const before = await page.evaluate(({ rowSelector, imageSelector }) => {
    const row = document.querySelector(rowSelector);
    const image = document.querySelector(imageSelector);
    return {
      rowHeight: row?.getBoundingClientRect().height || 0,
      source: image?.dataset.imageVariantSource,
      variantId: image?.dataset.imageVariantId,
      framePlacement: image?.dataset.imageFramePlacement,
      fit: image?.style.objectFit,
      transform: image?.style.transform
    };
  }, { rowSelector, imageSelector });
  if (before.source !== 'original' || before.variantId !== 'original' || before.framePlacement !== 'table-row' || before.fit !== 'contain' || before.transform !== 'scale(1)') {
    throw new Error(`estado visual inicial da linha inválido: ${JSON.stringify(before)}`);
  }

  await page.click(rowSelector);
  await page.waitForSelector('#contextualInspector [data-table-row-image-frame][data-image-frame-editor="p1"]', { state: 'visible' });
  await page.waitForSelector('#contextualInspector [data-image-choice-editor="p1"] [data-image-choice-cycle="1"]', { state: 'visible' });

  await page.click('#contextualInspector [data-image-choice-editor="p1"] [data-image-choice-cycle="1"]');
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().catalog.presentation.imageSelections.p1?.id === 'front');
  await page.waitForFunction(() => document.querySelector('#catalogPreview .catalog-table-block[data-table-block-id="table-r5a"] tr[data-table-row-id="p1"] .table-cell-image > img')?.dataset.imageVariantId === 'front');

  await page.check('#contextualInspector [data-image-frame-editor="p1"] input[data-image-frame-field="fit"][value="cover"]');
  for (const [field, value] of [['zoom', '1.7'], ['x', '18'], ['y', '82']]) {
    await page.locator(`#contextualInspector [data-image-frame-editor="p1"] input[data-image-frame-field="${field}"]`).evaluate((input, next) => {
      input.value = next;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  }
  await page.waitForFunction(() => {
    const frame = window.CatalogoTop.Core.getState().catalog.presentation.imageFrames.p1;
    return frame?.fit === 'cover' && frame.zoom === 1.7 && frame.x === 18 && frame.y === 82;
  });

  const edited = await page.evaluate(({ rowSelector, imageSelector }) => {
    const NS = window.CatalogoTop;
    const row = document.querySelector(rowSelector);
    const image = document.querySelector(imageSelector);
    const product = NS.Core.getState().products.find(item => item.id === 'p1');
    return {
      rowHeight: row?.getBoundingClientRect().height || 0,
      source: image?.dataset.imageVariantSource,
      variantId: image?.dataset.imageVariantId,
      fit: image?.style.objectFit,
      position: image?.style.objectPosition,
      transform: image?.style.transform,
      origin: image?.style.transformOrigin,
      holderOverflow: image?.parentElement?.style.overflow,
      productImage: product?.image
    };
  }, { rowSelector, imageSelector });
  if (edited.source !== 'product' || edited.variantId !== 'front' || edited.fit !== 'cover' || edited.position !== '18% 82%' || edited.transform !== 'scale(1.7)' || edited.origin !== '18% 82%' || edited.holderOverflow !== 'hidden') {
    throw new Error(`edição da imagem não chegou à linha: ${JSON.stringify(edited)}`);
  }
  if (edited.productImage !== seeded.original) throw new Error('edição editorial da Table alterou product.image');
  if (Math.abs(edited.rowHeight - before.rowHeight) > 0.6) throw new Error(`zoom alterou geometria da linha: ${before.rowHeight} -> ${edited.rowHeight}`);

  const printableHtml = await page.evaluate(() => window.CatalogoTop.Print.buildPrintableHtml(window.CatalogoTop.Core.getState()));
  const printPage = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await printPage.setContent(printableHtml, { waitUntil: 'networkidle' });
  const printState = await printPage.evaluate(() => {
    const image = document.querySelector('.catalog-table-block[data-table-block-id="table-r5a"] tr[data-table-row-id="p1"] .table-cell-image > img');
    return {
      source: image?.dataset.imageVariantSource,
      variantId: image?.dataset.imageVariantId,
      placement: image?.dataset.imageFramePlacement,
      fit: image?.style.objectFit,
      position: image?.style.objectPosition,
      transform: image?.style.transform,
      inspectorChrome: document.querySelectorAll('[data-table-row-image-frame],[data-image-choice-editor]').length
    };
  });
  await printPage.close();
  if (printState.source !== 'product' || printState.variantId !== 'front' || printState.placement !== 'table-row' || printState.fit !== 'cover' || printState.position !== '18% 82%' || printState.transform !== 'scale(1.7)' || printState.inspectorChrome) {
    throw new Error(`preview/print divergem na imagem da Table: ${JSON.stringify(printState)}`);
  }

  await page.evaluate(() => window.CatalogoTop.PresentationActions.updateTable('table-r5a', { columns: ['code', 'description'] }));
  await page.waitForFunction(() => !document.querySelector('#catalogPreview .catalog-table-block[data-table-block-id="table-r5a"] .table-cell-image'));
  await page.click('#catalogPreview .catalog-table-block[data-table-block-id="table-r5a"] tr[data-table-row-id="p1"]');
  await page.waitForSelector('#contextualInspector [data-table-row-image-frame].is-unavailable', { state: 'visible' });
  const unavailable = await page.evaluate(() => ({
    text: document.querySelector('#contextualInspector [data-table-row-image-frame].is-unavailable')?.textContent || '',
    editors: document.querySelectorAll('#contextualInspector [data-table-row-image-frame][data-image-frame-editor]').length,
    choices: document.querySelectorAll('#contextualInspector [data-image-choice-editor="p1"]').length
  }));
  if (!unavailable.text.includes('Ative a coluna Imagem') || unavailable.editors || unavailable.choices) {
    throw new Error(`Table sem coluna Imagem expôs editor inadequado: ${JSON.stringify(unavailable)}`);
  }

  console.log('PASS R5a table row image gate: seleção, framing, geometria, print e eligibility');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
