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
  const product = {
    id: 'result-p1', code: 'RES-1', description: 'Produto com resultado', category: 'Teste', subcategory: '', price: 'R$ 70,00', status: 'Ativo', notes: '',
    image: svg('canonical-original'), imageGallery: [], specs: [{ label: 'Carga', value: '35 kg' }], variants: [], tableRows: [], updatedAt: '2026-08-29T00:00:00.000Z'
  };
  NS.Core.setState({
    schemaVersion: 7,
    products: [product],
    selectedIds: [product.id],
    catalog: {
      title: 'Result Browser Gate', templateId: 'technical', showPrices: true, createdAt: '2026-08-29T00:00:00.000Z',
      presentation: NS.Composition.normalizePresentation({
        order: [product.id], itemStyles: {}, imageFrames: {}, imageSelections: {}, imageVariants: {}, blocks: []
      })
    }
  }, { persist: false });
  window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
  return product.image;
}

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.CatalogoTop?.VariationResultControls && window.CatalogoTop?.VariationResult && window.CatalogoTop?.ZipReader));
  const original = await page.evaluate(seedState);

  const generated = await page.evaluate(async () => {
    const NS = window.CatalogoTop;
    const request = await NS.VariationResultControls.currentRequest();
    if (request.manifest.jobs.length !== 1) throw new Error(`request de fixture deveria ter 1 job: ${request.manifest.jobs.length}`);
    const job = request.manifest.jobs[0];
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6, 7]);
    const hash = await NS.VariationBundle.sha256(png);
    const result = {
      kind: NS.VariationResult.RESULT_KIND,
      version: NS.VariationResult.RESULT_VERSION,
      requestId: request.requestId,
      generatedAt: '2026-08-29T18:00:00.000Z',
      generator: 'browser-fixture-agent',
      variants: [{
        resultId: 'clean-white',
        jobId: job.jobId,
        usageSignature: job.usageSignature,
        productId: job.productId,
        placementKey: job.placementKey,
        label: 'Fundo limpo',
        transforms: ['artifact-cleanup', 'white-background'],
        asset: { path: 'results/clean.png', mimeType: 'image/png', sha256: hash }
      }]
    };
    const archive = await NS.ZipStore.create([
      { path: 'manifest.json', data: `${JSON.stringify(result)}\n` },
      { path: 'results/clean.png', data: png }
    ]);
    return { bytes: Array.from(archive.bytes), requestId: request.requestId, jobId: job.jobId, usageSignature: job.usageSignature, hash };
  });

  await page.evaluate(() => {
    const NS = window.CatalogoTop;
    window.__variationUploads = 0;
    window.__variationPublishes = 0;
    window.__variationImported = null;
    window.__variationErrors = [];
    NS.ProductStore.isWritable = () => true;
    NS.ProductStore.publishCurrent = async () => { window.__variationPublishes += 1; return true; };
    NS.AssetClient.prepareImage = async blob => new Blob([await blob.arrayBuffer()], { type: 'image/webp' });
    NS.AssetClient.uploadBlob = async () => {
      window.__variationUploads += 1;
      return `/api/assets/sha256/${'8'.repeat(64)}`;
    };
    window.addEventListener('catalogotop:variation-result-imported', event => { window.__variationImported = event.detail; });
    window.addEventListener('catalogotop:variation-result-error', event => { window.__variationErrors.push(event.detail); });
  });

  await page.click('#headerDataMenu > summary');
  await page.setInputFiles('#importImageVariationResult', {
    name: 'result.zip', mimeType: 'application/zip', buffer: Buffer.from(generated.bytes)
  });
  await page.waitForFunction(() => Boolean(window.__variationImported));
  await page.waitForFunction(() => !document.getElementById('importImageVariationResult')?.disabled);

  let state = await page.evaluate(() => {
    const NS = window.CatalogoTop;
    const current = NS.Core.getState();
    const product = current.products.find(item => item.id === 'result-p1');
    const variants = current.catalog.presentation.imageVariants?.['result-p1'] || [];
    return {
      productImage: product?.image,
      galleryLength: product?.imageGallery?.length || 0,
      imageSelections: current.catalog.presentation.imageSelections || {},
      variants,
      imports: window.__variationImported,
      uploads: window.__variationUploads,
      publishes: window.__variationPublishes,
      status: document.getElementById('variationResultStatus')?.textContent || '',
      statusState: document.getElementById('variationResultStatus')?.dataset.state || ''
    };
  });
  if (state.productImage !== original || state.galleryLength !== 0 || Object.keys(state.imageSelections).length) throw new Error(`import alterou Original/gallery/selection: ${JSON.stringify(state)}`);
  if (state.variants.length !== 1 || state.variants[0].provenance?.requestId !== generated.requestId || state.variants[0].provenance?.usageSignature !== generated.usageSignature) throw new Error(`variante/proveniência importada incorreta: ${JSON.stringify(state.variants)}`);
  if (state.uploads !== 1 || state.publishes !== 0 || state.imports.imported !== 1) throw new Error(`upload/publicação incorretos: ${JSON.stringify(state)}`);
  if (state.statusState !== 'success' || !state.status.includes('1 variante importada')) throw new Error(`status de importação inesperado: ${JSON.stringify(state)}`);

  // Reimport idêntico, no mesmo contexto editorial, deve ser reconhecido como duplicado antes de prepare/upload.
  const uploadsBeforeDuplicate = state.uploads;
  const duplicate = await page.evaluate(async bytes => {
    const NS = window.CatalogoTop;
    const request = await NS.VariationResultControls.currentRequest();
    const file = new File([new Uint8Array(bytes)], 'result-again.zip', { type: 'application/zip' });
    const packageData = await NS.VariationResult.readPackage(file);
    const validated = await NS.VariationResult.validatePackage(packageData, request);
    const capacity = NS.VariationResultControls.checkCapacity(validated);
    const outcome = await NS.VariationResultControls.importResult(file, { currentRequest: request });
    return {
      requestId: request.requestId,
      capacity: { duplicates: capacity.duplicates, incoming: capacity.incoming },
      report: outcome?.report || null,
      uploads: window.__variationUploads,
      variants: NS.Core.getState().catalog.presentation.imageVariants?.['result-p1']?.length || 0,
      status: document.getElementById('variationResultStatus')?.textContent || '',
      statusState: document.getElementById('variationResultStatus')?.dataset.state || ''
    };
  }, generated.bytes);
  if (duplicate.requestId !== generated.requestId || duplicate.capacity.duplicates !== 1 || duplicate.capacity.incoming !== 0) {
    throw new Error(`dedupe não reconheceu request/proveniência existentes: ${JSON.stringify(duplicate)}`);
  }
  if (duplicate.uploads !== uploadsBeforeDuplicate || duplicate.variants !== 1 || duplicate.report?.duplicates !== 1 || duplicate.report?.imported !== 0 || duplicate.statusState !== 'warning' || !duplicate.status.includes('1 duplicada')) {
    throw new Error(`reimport duplicado não foi interrompido cedo: ${JSON.stringify(duplicate)}`);
  }

  // A derivada importada fica disponível ao mesmo ciclo editorial, sem auto-seleção.
  await page.click('#catalogPreview .catalog-card[data-product-id="result-p1"]');
  await page.waitForSelector('#contextualInspector [data-image-choice-editor="result-p1"] [data-image-choice-cycle="1"]');
  await page.click('#contextualInspector [data-image-choice-editor="result-p1"] [data-image-choice-cycle="1"]');
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().catalog.presentation.imageSelections['result-p1']?.source === 'catalog');
  const selected = await page.evaluate(() => {
    const NS = window.CatalogoTop;
    const image = document.querySelector('#catalogPreview .catalog-card[data-product-id="result-p1"] .catalog-card-visuals.single > img');
    const printable = NS.Print.buildPrintableHtml(NS.Core.getState());
    return {
      source: image?.dataset.imageVariantSource,
      src: image?.getAttribute('src'),
      printHasImported: printable.includes(`/api/assets/sha256/${'8'.repeat(64)}`),
      original: NS.Core.getState().products[0].image
    };
  });
  if (selected.source !== 'catalog' || selected.src !== `/api/assets/sha256/${'8'.repeat(64)}` || !selected.printHasImported || selected.original !== original) throw new Error(`derivada importada não ciclou com paridade print: ${JSON.stringify(selected)}`);

  // Um requestId obsoleto deve falhar antes de upload e sem mutação, mesmo após mudança editorial local.
  const staleBytes = await page.evaluate(async bytes => {
    const NS = window.CatalogoTop;
    const opened = await NS.ZipReader.open(new Uint8Array(bytes));
    const manifest = JSON.parse(opened.text('manifest.json'));
    manifest.requestId = '0'.repeat(64);
    const archive = await NS.ZipStore.create([
      { path: 'manifest.json', data: `${JSON.stringify(manifest)}\n` },
      { path: 'results/clean.png', data: opened.get('results/clean.png') }
    ]);
    return Array.from(archive.bytes);
  }, generated.bytes);
  const beforeStale = await page.evaluate(() => ({ uploads: window.__variationUploads, state: JSON.stringify(window.CatalogoTop.Core.getState()) }));
  await page.setInputFiles('#importImageVariationResult', {
    name: 'stale.zip', mimeType: 'application/zip', buffer: Buffer.from(staleBytes)
  });
  await page.waitForFunction(() => document.getElementById('variationResultStatus')?.dataset.state === 'error');
  await page.waitForFunction(() => !document.getElementById('importImageVariationResult')?.disabled);
  const stale = await page.evaluate(() => ({
    uploads: window.__variationUploads,
    state: JSON.stringify(window.CatalogoTop.Core.getState()),
    lastError: window.__variationErrors.at(-1),
    status: document.getElementById('variationResultStatus')?.textContent || ''
  }));
  if (stale.uploads !== beforeStale.uploads || stale.state !== beforeStale.state || stale.lastError?.code !== 'result_request_stale') throw new Error(`resultado stale avançou além da validação: ${JSON.stringify(stale)}`);

  console.log('PASS browser variation result gate: import transacional, local-only, duplicate early-stop, cycle/print e stale fail-closed');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
