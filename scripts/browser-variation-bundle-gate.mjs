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
  const svg = label => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="white"/><text x="400" y="320" text-anchor="middle" font-family="Arial" font-size="70">${label}</text></svg>`)}`;
  const products = [
    {
      id: 'request-p1', code: 'REQ-1', description: 'Produto exportável', category: 'Teste', subcategory: '', price: 'R$ 50,00', status: 'Ativo', notes: '',
      image: svg('source-original'), imageGallery: [], specs: [{ label: 'Carga', value: '35 kg' }], variants: [], tableRows: [], updatedAt: '2026-08-29T00:00:00.000Z'
    },
    {
      id: 'request-p2', code: 'REQ-2', description: 'Produto sem imagem', category: 'Teste', subcategory: '', price: 'R$ 60,00', status: 'Ativo', notes: '',
      image: '', imageGallery: [], specs: [], variants: [], tableRows: [], updatedAt: '2026-08-29T00:00:00.000Z'
    }
  ];
  NS.Core.setState({
    schemaVersion: NS.Core.SCHEMA_VERSION,
    products,
    selectedIds: products.map(item => item.id),
    catalog: {
      title: 'Request Browser Gate', templateId: 'technical', showPrices: true, createdAt: '2026-08-29T00:00:00.000Z',
      presentation: NS.Composition.normalizePresentation({
        order: products.map(item => item.id),
        itemStyles: { 'request-p1': { contentPreset: 'visual', emphasis: 'feature', width: 'wide' } },
        imageFrames: { 'request-p1': { fit: 'cover', zoom: 1.25, x: 40, y: 60 } },
        imageSelections: {}, imageVariants: {}, blocks: []
      })
    }
  }, { persist: false });
  window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
}

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true, acceptDownloads: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.CatalogoTop?.VariationBundleControls && window.CatalogoTop?.VariationBundle && window.CatalogoTop?.ZipStore));
  await page.evaluate(seedState);

  const before = await page.evaluate(() => JSON.stringify(window.CatalogoTop.Core.getState()));
  await page.evaluate(() => {
    window.__variationExport = null;
    window.addEventListener('catalogotop:variation-request-exported', event => { window.__variationExport = event.detail; }, { once: true });
  });

  await page.click('#headerDataMenu > summary');
  const downloadPromise = page.waitForEvent('download');
  await page.click('#btnExportImageVariationBundle');
  const download = await downloadPromise;
  await page.waitForFunction(() => Boolean(window.__variationExport));
  const exported = await page.evaluate(() => ({
    detail: window.__variationExport,
    after: JSON.stringify(window.CatalogoTop.Core.getState()),
    activeTab: document.querySelector('.tab.active')?.dataset.tab || '',
    status: document.getElementById('variationBundleStatus')?.textContent || '',
    statusState: document.getElementById('variationBundleStatus')?.dataset.state || '',
    measuredImageWidth: document.querySelector('#catalogPreview .catalog-card[data-product-id="request-p1"] .catalog-card-visuals.single')?.offsetWidth || 0
  }));

  if (!download.suggestedFilename().match(/^catalogotop-image-request-[a-f0-9]{12}\.zip$/)) throw new Error(`nome de download inválido: ${download.suggestedFilename()}`);
  if (exported.detail.jobs !== 1 || exported.detail.issues?.length !== 1 || exported.detail.issues[0]?.reason !== 'missing-source') throw new Error(`resumo de exportação inesperado: ${JSON.stringify(exported.detail)}`);
  if (exported.activeTab !== 'catalog' || exported.measuredImageWidth <= 0) throw new Error(`exportação não mediu o renderer visível: ${JSON.stringify(exported)}`);
  if (exported.after !== before) throw new Error('exportação de request não pode mutar estado do catálogo/produtos');
  if (exported.statusState !== 'warning' || !exported.status.includes('1 imagem preparada') || !exported.status.includes('1 sem imagem original')) throw new Error(`status de exportação inesperado: ${JSON.stringify(exported)}`);
  if (!Number.isFinite(exported.detail.byteLength) || exported.detail.byteLength <= 100) throw new Error(`ZIP exportado parece vazio: ${exported.detail.byteLength}`);

  // Quando todos os jobs ficam inelegíveis, deve bloquear sem alterar estado.
  await page.evaluate(() => {
    const NS = window.CatalogoTop;
    NS.Core.mutate(draft => { draft.products.forEach(product => { product.image = ''; }); });
    window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
    window.__variationBlocked = null;
    window.addEventListener('catalogotop:variation-request-blocked', event => { window.__variationBlocked = event.detail; }, { once: true });
  });
  const blockedBefore = await page.evaluate(() => JSON.stringify(window.CatalogoTop.Core.getState()));
  await page.evaluate(() => window.CatalogoTop.VariationBundleControls.exportRequest());
  await page.waitForFunction(() => Boolean(window.__variationBlocked));
  const blocked = await page.evaluate(() => ({
    detail: window.__variationBlocked,
    after: JSON.stringify(window.CatalogoTop.Core.getState()),
    status: document.getElementById('variationBundleStatus')?.textContent || '',
    statusState: document.getElementById('variationBundleStatus')?.dataset.state || ''
  }));
  if (blocked.detail.jobs !== 0 || blocked.detail.issues?.length !== 2) throw new Error(`bloqueio sem jobs incorreto: ${JSON.stringify(blocked)}`);
  if (blocked.after !== blockedBefore || blocked.statusState !== 'error' || !blocked.status.includes('Nenhuma imagem elegível')) throw new Error(`bloqueio alterou estado/status: ${JSON.stringify(blocked)}`);

  console.log('PASS browser variation bundle gate: export ZIP, renderer real, issues, zero-job block e estado imutável');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
