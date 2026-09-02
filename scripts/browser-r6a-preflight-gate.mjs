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

function seedCleanState() {
  const NS = window.CatalogoTop;
  const image = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="white"/><rect x="70" y="80" width="460" height="240" fill="#ddd"/></svg>')}`;
  NS.Core.setState({
    schemaVersion: 9,
    folders: [{ id: 'f-ferragens', parentId: null, name: 'Ferragens' }],
    products: [{
      id: 'p1', folderId: 'f-ferragens', code: 'P1', description: 'Produto Preflight', category: 'Ferragens', subcategory: '',
      price: '', quantityPrice: null, status: 'Ativo', notes: '', image, imageGallery: [], specs: [], variants: [], tableRows: [], updatedAt: '2026-09-02T00:00:00.000Z'
    }],
    selectedIds: ['p1'],
    catalog: {
      title: 'R6a Preflight gate', templateId: 'technical', templateVersion: 1, showPrices: true,
      createdAt: '2026-09-02T00:00:00.000Z',
      presentation: NS.Composition.normalizePresentation({ order: ['p1'], blocks: [], imageSelections: {}, imageFrames: {}, imageVariants: {} })
    }
  }, { persist: false });
  NS.App.renderAll();
}

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.CatalogoTop?.Preflight && window.CatalogoTop?.PreflightControls && window.CatalogoTop?.App && window.CatalogoTop?.Print));

  await page.evaluate(seedCleanState);
  await page.click('[data-tab="catalog"]');
  await page.waitForFunction(() => document.getElementById('preflightStatus')?.textContent.trim() === 'Pronto');

  const baseline = await page.evaluate(() => {
    const state = JSON.stringify(window.CatalogoTop.Core.getState());
    const sheet = document.querySelector('#catalogPreview .catalog-page');
    return {
      state,
      pageCount: document.querySelectorAll('#catalogPreview .catalog-page').length,
      width: sheet?.getBoundingClientRect().width || 0,
      height: sheet?.getBoundingClientRect().height || 0,
      buttonDisabled: document.getElementById('btnPrint')?.disabled === true
    };
  });
  if (baseline.pageCount !== 1 || baseline.buttonDisabled) throw new Error(`baseline R6a inválida: ${JSON.stringify(baseline)}`);

  await page.click('#preflightStatus');
  await page.waitForFunction(() => !document.getElementById('preflightPanel')?.hidden);
  const opened = await page.evaluate(() => {
    const sheet = document.querySelector('#catalogPreview .catalog-page');
    return {
      state: JSON.stringify(window.CatalogoTop.Core.getState()),
      pageCount: document.querySelectorAll('#catalogPreview .catalog-page').length,
      width: sheet?.getBoundingClientRect().width || 0,
      height: sheet?.getBoundingClientRect().height || 0,
      panelText: document.getElementById('preflightPanel')?.textContent || ''
    };
  });
  if (opened.state !== baseline.state) throw new Error('abrir Preflight mutou Core state');
  if (opened.pageCount !== baseline.pageCount || Math.abs(opened.width - baseline.width) > .6 || Math.abs(opened.height - baseline.height) > .6) throw new Error(`painel alterou geometria A4: ${JSON.stringify({ baseline, opened })}`);
  if (!opened.panelText.includes('Pronto para revisão final')) throw new Error('painel ready não materializou resumo esperado');

  await page.evaluate(() => {
    const NS = window.CatalogoTop;
    NS.Core.mutate(draft => {
      draft.catalog.presentation.imageSelections = { p1: { source: 'product', id: 'gone-image' } };
    });
    NS.App.renderAll();
  });
  await page.waitForFunction(() => document.getElementById('preflightStatus')?.textContent.trim() === 'Revisar · 1');
  await page.waitForFunction(() => Boolean(document.querySelector('#preflightPanel [data-preflight-issue="image_selection_fallback"]')));

  await page.evaluate(() => {
    const NS = window.CatalogoTop;
    NS.Core.mutate(draft => {
      draft.selectedIds = ['p1', 'gone'];
      draft.catalog.presentation.imageSelections = {};
    });
    NS.App.renderAll();
  });
  await page.waitForFunction(() => document.getElementById('preflightStatus')?.textContent.trim() === 'Bloqueios · 1');
  const blocked = await page.evaluate(() => ({
    disabled: document.getElementById('btnPrint')?.disabled === true,
    issue: document.querySelector('#preflightPanel [data-preflight-issue="selected_product_missing"]')?.textContent || '',
    status: window.CatalogoTop.PreflightControls.getLastReport()?.status
  }));
  if (blocked.disabled || blocked.status !== 'blocked' || !blocked.issue.includes('gone')) throw new Error(`blocker R6a/UI inválido: ${JSON.stringify(blocked)}`);

  const printableHtml = await page.evaluate(() => window.CatalogoTop.Print.buildPrintableHtml(window.CatalogoTop.Core.getState()));
  if (printableHtml.includes('preflightStatus') || printableHtml.includes('preflightPanel') || printableHtml.includes('data-preflight-issue')) throw new Error('chrome de Preflight vazou para HTML print');
  const printPage = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await printPage.setContent(printableHtml, { waitUntil: 'domcontentloaded' });
  const printChrome = await printPage.evaluate(() => document.querySelectorAll('#preflightStatus,#preflightPanel,[data-preflight-issue]').length);
  await printPage.close();
  if (printChrome) throw new Error('chrome de Preflight presente no documento print isolado');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelector('#catalog.panel.active'));
  if (await page.evaluate(() => document.getElementById('preflightPanel')?.hidden)) await page.click('#preflightStatus');
  const overflow = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, catalog: document.getElementById('catalog').scrollWidth, catalogClient: document.getElementById('catalog').clientWidth }));
  if (overflow.doc > overflow.client + 2 || overflow.catalog > overflow.catalogClient + 2) throw new Error(`Preflight criou overflow mobile: ${JSON.stringify(overflow)}`);

  await page.click('#preflightPanel [data-preflight-close]');
  await page.waitForFunction(() => document.getElementById('preflightPanel')?.hidden === true);

  console.log('PASS R6a browser preflight: ready/review/blocked, reactive UI, non-mutation, print isolation and mobile geometry');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
