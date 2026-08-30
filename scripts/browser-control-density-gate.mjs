import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) { response.writeHead(404, { 'content-type': 'application/json' }); response.end('{}'); return; }
    const relative = decodeURIComponent(url.pathname) === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const file = join(root, normalize(relative).replace(/^(\.\.[/\\])+/, ''));
    if (!(await stat(file)).isFile()) throw new Error('not file');
    response.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
    response.end(await readFile(file));
  } catch (_) { response.writeHead(404); response.end('not found'); }
});

function installFixture() {
  const NS = window.CatalogoTop;
  const products = Array.from({ length: 14 }, (_, index) => ({
    id: `p${index + 1}`,
    code: String(1265 + index),
    description: `PRODUTO ${index + 1} PARA TESTE DE DENSIDADE E SCROLL`,
    category: index < 7 ? 'CORREDIÇAS' : 'DOBRADIÇAS',
    subcategory: '',
    price: `R$ ${10 + index},90`,
    status: 'Ativo',
    notes: '',
    image: '',
    specs: [], variants: [], tableRows: [], updatedAt: '2026-08-29T00:00:00.000Z'
  }));
  NS.Core.setState({
    schemaVersion: 7,
    products,
    selectedIds: products.map(product => product.id),
    catalog: {
      title: 'Density gate', templateId: 'technical', showPrices: true, createdAt: '2026-08-29T00:00:00.000Z',
      presentation: NS.Composition.normalizePresentation({ order: products.map(product => product.id), itemStyles: {}, imageFrames: {}, blocks: [] })
    }
  }, { persist: false });
  window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
  NS.App.renderAll();
}

function trackCount(template) {
  const value = String(template || '').trim();
  const repeated = value.match(/^repeat\((\d+),/);
  if (repeated) return Number(repeated[1]);
  return value.split(/\s+/).filter(Boolean).length;
}

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.CatalogoTop?.Core && window.CatalogoTop?.ContextualInspector));
  await page.evaluate(installFixture);
  await page.click('[data-tab="catalog"]');
  await page.waitForSelector('#selectableProducts .select-product');
  await page.evaluate(() => window.CatalogoTop.ContextualInspector.selectProductFromList('p1'));
  await page.waitForSelector('#contextualInspector:not(.is-collapsed) .inspector-segmented');

  const desktop = await page.evaluate(() => {
    const inspector = document.querySelector('#contextualInspector');
    const segmented = inspector.querySelector('.inspector-segmented');
    const syntheticColumns = document.createElement('fieldset');
    syntheticColumns.className = 'inspector-columns';
    syntheticColumns.innerHTML = '<legend>Colunas</legend>' + Array.from({ length: 7 }, (_, i) => `<label><input type="checkbox" checked>Campo ${i + 1}</label>`).join('');
    inspector.appendChild(syntheticColumns);
    const columnTemplate = getComputedStyle(syntheticColumns).gridTemplateColumns;
    const segmentedTemplate = getComputedStyle(segmented).gridTemplateColumns;

    const checkbox = syntheticColumns.querySelector('input[type="checkbox"]');
    const checkboxStyle = getComputedStyle(checkbox);
    const list = document.querySelector('#selectableProducts');
    list.scrollTop = list.scrollHeight;
    const last = list.lastElementChild;
    const listRect = list.getBoundingClientRect();
    const lastRect = last.getBoundingClientRect();
    const result = {
      columnTemplate,
      segmentedTemplate,
      checkboxBackground: checkboxStyle.backgroundColor,
      checkboxBorder: checkboxStyle.borderColor,
      checkboxAppearance: checkboxStyle.appearance,
      scrollEndGap: listRect.bottom - lastRect.bottom,
      scrollTop: list.scrollTop,
      scrollRange: list.scrollHeight - list.clientHeight,
      scrollPaddingBottom: getComputedStyle(list).scrollPaddingBottom
    };
    syntheticColumns.remove();
    return result;
  });

  if (trackCount(desktop.columnTemplate) !== 4) throw new Error(`COLUNAS desktop deve materializar 4 colunas: ${JSON.stringify(desktop)}`);
  if (trackCount(desktop.segmentedTemplate) !== 4) throw new Error(`picker comercial desktop deve usar uma linha de 4 opções: ${JSON.stringify(desktop)}`);
  if (desktop.checkboxAppearance !== 'none' || !desktop.checkboxBackground.includes('239, 23, 27')) throw new Error(`checkbox marcado deve ter preenchimento vermelho consistente: ${JSON.stringify(desktop)}`);
  if (desktop.scrollRange <= 0 || desktop.scrollEndGap < 24) throw new Error(`último item precisa de folga scrollável no fim da lista: ${JSON.stringify(desktop)}`);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(80);
  const mobile = await page.evaluate(() => {
    const segmented = document.querySelector('#contextualInspector .inspector-segmented');
    return { segmentedTemplate: getComputedStyle(segmented).gridTemplateColumns };
  });
  if (trackCount(mobile.segmentedTemplate) !== 2) throw new Error(`mobile deve preservar picker 2x2: ${JSON.stringify(mobile)}`);

  console.log('PASS control density gate: 4-col desktop, picker 4-up, checkbox vermelho e scroll-end legível');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}