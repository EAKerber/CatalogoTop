import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { collectAssetUsages } from '../netlify/lib/asset-usage.mts';

const root = process.cwd();
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.csv': 'text/csv; charset=utf-8'
};
const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const C = 'c'.repeat(64);
const urlA = `/api/assets/sha256/${A}`;
const urlB = `/api/assets/sha256/${B}`;
const urlC = `/api/assets/sha256/${C}`;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=', 'base64');

let productSnapshot = {
  schemaVersion: 2, revision: 5, updatedAt: '2026-08-31T12:00:00.000Z', writeId: 'products-5',
  folders: [{ id: 'pf', parentId: null, name: 'Ferragens' }],
  products: [
    { id: 'p1', folderId: 'pf', code: 'P1', description: 'Produto Um', category: 'Ferragens', subcategory: '', price: 'R$ 10,00', quantityPrice: null, status: 'Ativo', notes: '', image: urlA, imageGallery: [], specs: [], variants: [], tableRows: [], updatedAt: '2026-08-31T12:00:00.000Z' },
    { id: 'p2', folderId: 'pf', code: 'P2', description: 'Produto Dois', category: 'Ferragens', subcategory: '', price: 'R$ 20,00', quantityPrice: null, status: 'Ativo', notes: '', image: '', imageGallery: [{ id: 'gallery-a', label: 'Detalhe', image: urlA, provenance: { kind: 'manual-upload' } }], specs: [], variants: [], tableRows: [], updatedAt: '2026-08-31T12:00:00.000Z' }
  ]
};
let catalogSnapshot = {
  schemaVersion: 1, revision: 2, updatedAt: '2026-08-31T12:00:00.000Z', writeId: 'catalogs-2', folders: [],
  catalogs: [{
    id: 'catalog-1', folderId: null, createdAt: '2026-08-31T12:00:00.000Z', updatedAt: '2026-08-31T12:00:00.000Z', selectedIds: ['p1'],
    catalog: {
      title: 'Catálogo Um', templateId: 'technical', showPrices: true, dateOverride: '', createdAt: '2026-08-31T12:00:00.000Z',
      presentation: {
        distribution: 'balanced', typography: 'neutral', order: ['p1'], itemStyles: {}, blocks: [], imageFrames: {}, imageSelections: {},
        imageVariants: { p1: [{ id: 'local-a', label: 'Local A', image: urlA }, { id: 'local-b', label: 'Local B', image: urlB }] }
      }
    }
  }]
};
let assetIndexSnapshot = {
  schemaVersion: 1, revision: 0, updatedAt: '', writeId: '', folders: [],
  assets: [{ id: `sha256/${C}`, sha256: C, folderId: null, label: 'Imagem sem uso', contentType: 'image/png', bytes: png.byteLength, createdAt: '2026-08-31T11:00:00.000Z', updatedAt: '2026-08-31T11:00:00.000Z' }]
};
let assetUploadPosts = 0;
const technical = new Map([
  [A, { contentType: 'image/png', bytes: png.byteLength, createdAt: '2026-08-31T10:00:00.000Z' }],
  [B, { contentType: 'image/png', bytes: png.byteLength, createdAt: '2026-08-31T10:01:00.000Z' }],
  [C, { contentType: 'image/png', bytes: png.byteLength, createdAt: '2026-08-31T10:02:00.000Z' }]
]);

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function inventoryPayload() {
  const usages = collectAssetUsages(productSnapshot.products, catalogSnapshot.catalogs);
  const usesById = new Map();
  for (const usage of usages) {
    const list = usesById.get(usage.assetId) || [];
    list.push(usage);
    usesById.set(usage.assetId, list);
  }
  const indexed = new Map(assetIndexSnapshot.assets.map(record => [record.id, record]));
  const ids = new Set(indexed.keys());
  usages.forEach(usage => ids.add(usage.assetId));
  const assets = Array.from(ids).sort().map(id => {
    const record = indexed.get(id);
    const hash = record?.sha256 || id.replace(/^sha256\//, '');
    const uses = usesById.get(id) || [];
    const meta = technical.get(hash) || {};
    return {
      id: `sha256/${hash}`, sha256: hash, url: `/api/assets/sha256/${hash}`, folderId: record?.folderId ?? null,
      label: record?.label || uses[0]?.ownerLabel || `Imagem ${hash.slice(0, 8)}`,
      indexed: Boolean(record), contentType: meta.contentType || record?.contentType || '', bytes: meta.bytes || record?.bytes || 0,
      createdAt: meta.createdAt || record?.createdAt || '', updatedAt: record?.updatedAt || '', available: true, usages: uses
    };
  });
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), assetIndexRevision: assetIndexSnapshot.revision, productRevision: productSnapshot.revision, catalogRevision: catalogSnapshot.revision, assets };
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    response.setHeader('cache-control', 'no-store');

    if (url.pathname === '/api/write-session') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ writable: true }));
      return;
    }
    if (url.pathname === '/api/products') {
      response.setHeader('content-type', 'application/json');
      if (request.method === 'GET') { response.writeHead(200); response.end(JSON.stringify(productSnapshot)); return; }
      if (request.method === 'PUT') {
        const body = await readJson(request);
        if (Number(body.expectedRevision) !== productSnapshot.revision) { response.writeHead(409); response.end(JSON.stringify({ error: 'revision_conflict', currentRevision: productSnapshot.revision })); return; }
        productSnapshot = { schemaVersion: 2, revision: productSnapshot.revision + 1, updatedAt: new Date().toISOString(), writeId: String(body.writeId || ''), folders: body.folders || [], products: body.products || [] };
        response.writeHead(200); response.end(JSON.stringify(productSnapshot)); return;
      }
    }
    if (url.pathname === '/api/catalogs') {
      response.setHeader('content-type', 'application/json');
      if (request.method === 'GET') { response.writeHead(200); response.end(JSON.stringify(catalogSnapshot)); return; }
      if (request.method === 'PUT') {
        const body = await readJson(request);
        if (Number(body.expectedRevision) !== catalogSnapshot.revision) { response.writeHead(409); response.end(JSON.stringify({ error: 'revision_conflict', currentRevision: catalogSnapshot.revision })); return; }
        catalogSnapshot = { schemaVersion: 1, revision: catalogSnapshot.revision + 1, updatedAt: new Date().toISOString(), writeId: String(body.writeId || ''), folders: body.folders || [], catalogs: body.catalogs || [] };
        response.writeHead(200); response.end(JSON.stringify(catalogSnapshot)); return;
      }
    }
    if (url.pathname === '/api/asset-index') {
      response.setHeader('content-type', 'application/json');
      if (request.method === 'GET') { response.writeHead(200); response.end(JSON.stringify(assetIndexSnapshot)); return; }
      if (request.method === 'PUT') {
        const body = await readJson(request);
        if (Number(body.expectedRevision) !== assetIndexSnapshot.revision) { response.writeHead(409); response.end(JSON.stringify({ error: 'revision_conflict', currentRevision: assetIndexSnapshot.revision })); return; }
        assetIndexSnapshot = { schemaVersion: 1, revision: assetIndexSnapshot.revision + 1, updatedAt: new Date().toISOString(), writeId: String(body.writeId || ''), folders: body.folders || [], assets: body.assets || [] };
        response.writeHead(200); response.end(JSON.stringify(assetIndexSnapshot)); return;
      }
    }
    if (url.pathname === '/api/asset-inventory') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(inventoryPayload()));
      return;
    }
    if (/^\/api\/assets\/sha256\/[a-f0-9]{64}$/.test(url.pathname) && request.method === 'GET') {
      response.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'public, max-age=31536000, immutable' });
      response.end(png);
      return;
    }
    if (url.pathname === '/api/assets' && request.method === 'POST') {
      assetUploadPosts += 1;
      response.writeHead(500, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'unexpected_upload' }));
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'fixture_api_not_found' }));
      return;
    }

    const rawPath = decodeURIComponent(url.pathname);
    const relative = rawPath === '/' ? 'index.html' : rawPath.replace(/^\/+/, '');
    const safe = normalize(relative).replace(/^(\.\.[/\\])+/, '');
    const file = join(root, safe);
    if (!(await stat(file)).isFile()) throw new Error('not file');
    response.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
    response.end(await readFile(file));
  } catch (error) {
    response.writeHead(404);
    response.end(String(error?.message || 'not found'));
  }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.CatalogoTop?.AssetLibrary && window.CatalogoTop?.AssetIndexStore && window.CatalogoTop?.ProductStore && window.CatalogoTop?.CatalogStore));
  await page.waitForFunction(() => window.CatalogoTop.ProductStore.getRevision() === 5 && window.CatalogoTop.CatalogStore.getRevision() === 2);

  await page.click('[data-tab="library"]');
  await page.click('[data-library-provider="images"]');
  await page.waitForFunction(() => document.querySelectorAll('#assetLibraryList [data-asset-resource]').length === 3);

  const initial = await page.evaluate(A => {
    const row = Array.from(document.querySelectorAll('#assetLibraryList [data-asset-resource]')).find(node => node.dataset.assetResource === `sha256/${A}`);
    return {
      providers: document.querySelectorAll('[data-library-provider]').length,
      rows: document.querySelectorAll('#assetLibraryList [data-asset-resource]').length,
      aText: row?.textContent || '',
      assetRevision: window.CatalogoTop.AssetIndexStore.getRevision(),
      productRevision: window.CatalogoTop.ProductStore.getRevision(),
      catalogRevision: window.CatalogoTop.CatalogStore.getRevision()
    };
  }, A);
  if (initial.providers !== 3 || initial.rows !== 3 || !initial.aText.includes('Produto Um') || !initial.aText.includes('Produto Dois') || !initial.aText.includes('Catálogo Um') || initial.assetRevision !== 0 || initial.productRevision !== 5 || initial.catalogRevision !== 2) {
    throw new Error(`inventário inicial inválido: ${JSON.stringify(initial)}`);
  }

  await page.fill('#assetLibrarySearch', 'Produto Dois');
  await page.waitForFunction(A => {
    const rows = Array.from(document.querySelectorAll('#assetLibraryList [data-asset-resource]'));
    return rows.length === 1 && rows[0].dataset.assetResource === `sha256/${A}`;
  }, A);
  await page.fill('#assetLibrarySearch', '');

  page.once('dialog', dialog => dialog.accept('Foto catálogo'));
  await page.click(`[data-asset-edit-label="sha256/${B}"]`);
  await page.waitForFunction(B => window.CatalogoTop.AssetIndexStore.getRevision() === 1 && Array.from(document.querySelectorAll('#assetLibraryList [data-asset-resource]')).some(row => row.dataset.assetResource === `sha256/${B}` && row.textContent.includes('Foto catálogo')), B);
  const afterLabel = await page.evaluate(() => ({
    assetRevision: window.CatalogoTop.AssetIndexStore.getRevision(),
    productRevision: window.CatalogoTop.ProductStore.getRevision(),
    catalogRevision: window.CatalogoTop.CatalogStore.getRevision()
  }));
  if (afterLabel.assetRevision !== 1 || afterLabel.productRevision !== 5 || afterLabel.catalogRevision !== 2) throw new Error(`label contaminou revisions: ${JSON.stringify(afterLabel)}`);

  await page.click('[data-tab="products"]');
  await page.click('#btnNewProduct');
  await page.fill('#code', 'P3');
  await page.fill('#description', 'Produto Três');
  await page.fill('#productFolderPath', 'Ferragens');
  await page.click('#btnNextFormStep');
  await page.waitForFunction(() => document.querySelector('[data-form-step="2"]')?.classList.contains('active'));
  await page.fill('#price', 'R$ 30,00');
  await page.click('#btnChooseAssetLibrary');
  await page.waitForFunction(() => window.CatalogoTop.LibraryShell.getActiveProvider() === 'images' && !document.getElementById('assetPickerContext')?.classList.contains('hidden'));
  const preservedBeforePick = await page.evaluate(() => ({ code: document.getElementById('code').value, description: document.getElementById('description').value, folder: document.getElementById('productFolderPath').value, price: document.getElementById('price').value }));
  if (preservedBeforePick.code !== 'P3' || preservedBeforePick.description !== 'Produto Três' || preservedBeforePick.folder !== 'Ferragens' || preservedBeforePick.price !== 'R$ 30,00') throw new Error(`formulário se perdeu ao abrir picker: ${JSON.stringify(preservedBeforePick)}`);

  await page.fill('#assetLibrarySearch', 'Foto catálogo');
  await page.waitForFunction(B => {
    const rows = Array.from(document.querySelectorAll('#assetLibraryList [data-asset-resource]'));
    return rows.length === 1 && rows[0].dataset.assetResource === `sha256/${B}` && Boolean(rows[0].querySelector('[data-asset-use]'));
  }, B);
  await page.click(`[data-asset-use="sha256/${B}"]`);
  await page.waitForFunction(urlB => document.querySelector('#products.panel.active') && document.getElementById('imageUrl').value === urlB, urlB);
  const afterPick = await page.evaluate(() => ({
    code: document.getElementById('code').value,
    description: document.getElementById('description').value,
    folder: document.getElementById('productFolderPath').value,
    price: document.getElementById('price').value,
    image: document.getElementById('imageUrl').value,
    preview: document.getElementById('imagePreview').getAttribute('src') || ''
  }));
  if (afterPick.code !== 'P3' || afterPick.description !== 'Produto Três' || afterPick.folder !== 'Ferragens' || afterPick.price !== 'R$ 30,00' || afterPick.image !== urlB || !afterPick.preview.includes(urlB)) throw new Error(`picker não preservou/aplicou formulário: ${JSON.stringify(afterPick)}`);

  await page.click('#btnNextFormStep');
  await page.waitForFunction(() => document.querySelector('[data-form-step="3"]')?.classList.contains('active'));
  await page.click('#btnSaveProduct');
  await page.waitForFunction(urlB => window.CatalogoTop.ProductStore.getRevision() === 6 && window.CatalogoTop.Core.getState().products.some(product => product.code === 'P3' && product.image === urlB), urlB);

  await page.click('[data-tab="library"]');
  await page.click('[data-library-provider="images"]');
  await page.fill('#assetLibrarySearch', 'Produto Três');
  await page.waitForFunction(B => {
    const rows = Array.from(document.querySelectorAll('#assetLibraryList [data-asset-resource]'));
    return rows.length === 1 && rows[0].dataset.assetResource === `sha256/${B}` && rows[0].textContent.includes('Produto Três');
  }, B);

  const finalState = await page.evaluate(urlB => ({
    assetRevision: window.CatalogoTop.AssetIndexStore.getRevision(),
    productRevision: window.CatalogoTop.ProductStore.getRevision(),
    catalogRevision: window.CatalogoTop.CatalogStore.getRevision(),
    p3Image: window.CatalogoTop.Core.getState().products.find(product => product.code === 'P3')?.image || '',
    activeProvider: window.CatalogoTop.LibraryShell.getActiveProvider()
  }), urlB);
  if (finalState.assetRevision !== 1 || finalState.productRevision !== 6 || finalState.catalogRevision !== 2 || finalState.p3Image !== urlB || finalState.activeProvider !== 'images') throw new Error(`authority final inválida: ${JSON.stringify(finalState)}`);
  if (assetUploadPosts !== 0) throw new Error(`reuso disparou upload inesperado: ${assetUploadPosts}`);
  const persistedP3 = productSnapshot.products.find(product => product.code === 'P3');
  if (!persistedP3 || persistedP3.image !== urlB) throw new Error(`produto remoto não preservou mesmo hash/url: ${JSON.stringify(persistedP3)}`);
  const indexedB = assetIndexSnapshot.assets.find(asset => asset.sha256 === B);
  if (!indexedB || indexedB.label !== 'Foto catálogo') throw new Error(`label não persistiu no índice: ${JSON.stringify(assetIndexSnapshot)}`);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.fill('#assetLibrarySearch', '');
  const mobile = await page.evaluate(() => ({
    imageProviderVisible: Boolean(document.querySelector('[data-library-provider="images"]')?.getClientRects().length),
    rows: document.querySelectorAll('#assetLibraryList [data-asset-resource]').length,
    overflowX: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
  }));
  if (!mobile.imageProviderVisible || mobile.rows !== 3 || mobile.overflowX > 2) throw new Error(`Asset Library mobile inválida: ${JSON.stringify(mobile)}`);

  console.log('PASS browser Asset Library R3a gate: authoritative inventory, independent label revision, form-preserving reuse, same hash and no upload');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
