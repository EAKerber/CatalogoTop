import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
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
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=', 'base64');
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><rect width="2" height="2" fill="black"/></svg>');
const D = createHash('sha256').update(svg).digest('hex');
const urlD = `/api/assets/sha256/${D}`;
const ASSET_INDEX_WRITE_DELAY_MS = 75;

let productSnapshot = {
  schemaVersion: 2, revision: 5, updatedAt: '2026-08-31T12:00:00.000Z', writeId: 'products-5',
  folders: [{ id: 'pf', parentId: null, name: 'Ferragens' }],
  products: [
    { id: 'p1', folderId: 'pf', code: 'P1', description: 'Produto Um', category: 'Ferragens', subcategory: '', price: 'R$ 10,00', quantityPrice: null, status: 'Ativo', notes: '', image: urlA, imageGallery: [], specs: [], variants: [], tableRows: [], updatedAt: '2026-08-31T12:00:00.000Z' }
  ]
};
let catalogSnapshot = {
  schemaVersion: 1, revision: 2, updatedAt: '2026-08-31T12:00:00.000Z', writeId: 'catalogs-2', folders: [],
  catalogs: [{
    id: 'catalog-1', folderId: null, createdAt: '2026-08-31T12:00:00.000Z', updatedAt: '2026-08-31T12:00:00.000Z', selectedIds: ['p1'],
    catalog: { title: 'Catálogo Um', templateId: 'technical', showPrices: true, dateOverride: '', createdAt: '2026-08-31T12:00:00.000Z', presentation: { distribution: 'balanced', typography: 'neutral', order: ['p1'], itemStyles: {}, blocks: [], imageFrames: {}, imageSelections: {}, imageVariants: { p1: [{ id: 'local-b', label: 'Local B', image: urlB }] } } }
  }]
};
let assetIndexSnapshot = {
  schemaVersion: 1, revision: 0, updatedAt: '', writeId: '', folders: [],
  assets: [{ id: `sha256/${C}`, sha256: C, folderId: null, label: 'Imagem antiga sem uso', contentType: 'image/png', bytes: png.byteLength, createdAt: '2026-08-31T11:00:00.000Z', updatedAt: '2026-08-31T11:00:00.000Z' }]
};
let assetUploadPosts = 0;
const physical = new Map([
  [A, { data: png, contentType: 'image/png', createdAt: '2026-08-31T10:00:00.000Z' }],
  [B, { data: png, contentType: 'image/png', createdAt: '2026-08-31T10:01:00.000Z' }],
  [C, { data: png, contentType: 'image/png', createdAt: '2026-08-31T10:02:00.000Z' }]
]);

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
}
async function readJson(request) { return JSON.parse((await readBody(request)).toString('utf8') || '{}'); }

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
  return {
    schemaVersion: 1, generatedAt: new Date().toISOString(), assetIndexRevision: assetIndexSnapshot.revision,
    productRevision: productSnapshot.revision, catalogRevision: catalogSnapshot.revision,
    assets: Array.from(ids).sort().map(id => {
      const record = indexed.get(id);
      const hash = record?.sha256 || id.replace(/^sha256\//, '');
      const uses = usesById.get(id) || [];
      const meta = physical.get(hash);
      return {
        id: `sha256/${hash}`, sha256: hash, url: `/api/assets/sha256/${hash}`, folderId: record?.folderId ?? null,
        label: record?.label || uses[0]?.ownerLabel || `Imagem ${hash.slice(0, 8)}`, indexed: Boolean(record),
        contentType: meta?.contentType || record?.contentType || '', bytes: meta?.data?.byteLength || record?.bytes || 0,
        createdAt: meta?.createdAt || record?.createdAt || '', updatedAt: record?.updatedAt || '', available: Boolean(meta), usages: uses
      };
    })
  };
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    response.setHeader('cache-control', 'no-store');

    if (url.pathname === '/api/write-session') {
      response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ writable: true })); return;
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
      if (request.method === 'PUT') { response.writeHead(500); response.end(JSON.stringify({ error: 'unexpected_catalog_write' })); return; }
    }
    if (url.pathname === '/api/asset-index') {
      response.setHeader('content-type', 'application/json');
      if (request.method === 'GET') { response.writeHead(200); response.end(JSON.stringify(assetIndexSnapshot)); return; }
      if (request.method === 'PUT') {
        const body = await readJson(request);
        await new Promise(resolve => setTimeout(resolve, ASSET_INDEX_WRITE_DELAY_MS));
        if (Number(body.expectedRevision) !== assetIndexSnapshot.revision) { response.writeHead(409); response.end(JSON.stringify({ error: 'revision_conflict', currentRevision: assetIndexSnapshot.revision })); return; }
        assetIndexSnapshot = { schemaVersion: 1, revision: assetIndexSnapshot.revision + 1, updatedAt: new Date().toISOString(), writeId: String(body.writeId || ''), folders: body.folders || [], assets: body.assets || [] };
        response.writeHead(200); response.end(JSON.stringify(assetIndexSnapshot)); return;
      }
    }
    if (url.pathname === '/api/asset-inventory') {
      response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify(inventoryPayload())); return;
    }
    const hashMatch = url.pathname.match(/^\/api\/assets\/sha256\/([a-f0-9]{64})$/);
    if (hashMatch && request.method === 'GET') {
      const item = physical.get(hashMatch[1]);
      if (!item) { response.writeHead(404); response.end(); return; }
      response.writeHead(200, { 'content-type': item.contentType, 'cache-control': 'public, max-age=31536000, immutable' }); response.end(item.data); return;
    }
    if (url.pathname === '/api/assets' && request.method === 'POST') {
      assetUploadPosts += 1;
      const data = await readBody(request);
      const hash = createHash('sha256').update(data).digest('hex');
      const existing = physical.has(hash);
      const contentType = String(request.headers['content-type'] || 'application/octet-stream').split(';')[0];
      if (!existing) physical.set(hash, { data, contentType, createdAt: new Date().toISOString() });
      response.writeHead(existing ? 200 : 201, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ assetId: `sha256/${hash}`, url: `/api/assets/sha256/${hash}`, contentType, bytes: data.byteLength, deduplicated: existing })); return;
    }
    if (url.pathname.startsWith('/api/')) { response.writeHead(404, { 'content-type': 'application/json' }); response.end(JSON.stringify({ error: 'fixture_api_not_found' })); return; }

    const relative = decodeURIComponent(url.pathname) === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const safe = normalize(relative).replace(/^(\.\.[/\\])+/, '');
    const file = join(root, safe);
    if (!(await stat(file)).isFile()) throw new Error('not file');
    response.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' }); response.end(await readFile(file));
  } catch (error) { response.writeHead(404); response.end(String(error?.message || 'not found')); }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true });

async function waitAssetIndexSettled(page) {
  await page.waitForFunction(() => {
    const store = window.CatalogoTop?.AssetIndexStore;
    return Boolean(store) && store.hasPendingWrite() === false && store.hasConflict() === false;
  });
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.CatalogoTop?.AssetLibrary && window.CatalogoTop?.AssetIndexStore && window.CatalogoTop?.AssetQuery));
  await page.waitForFunction(() => window.CatalogoTop.ProductStore.getRevision() === 5 && window.CatalogoTop.CatalogStore.getRevision() === 2);
  await waitAssetIndexSettled(page);
  await page.click('[data-tab="library"]');
  await page.click('[data-library-provider="images"]');
  await page.waitForFunction(() => document.querySelectorAll('#assetLibraryList [data-asset-resource]').length === 3);

  page.once('dialog', dialog => dialog.accept('Produtos'));
  await page.click('#assetLibraryCreateFolder');
  await page.waitForFunction(() => window.CatalogoTop.AssetIndexStore.getSnapshot().folders.some(folder => folder.name === 'Produtos'));
  await waitAssetIndexSettled(page);
  page.once('dialog', dialog => dialog.accept('Corrediças'));
  await page.click('#assetLibraryCreateFolder');
  await page.waitForFunction(() => window.CatalogoTop.AssetIndexStore.getSnapshot().folders.some(folder => folder.name === 'Corrediças'));
  await waitAssetIndexSettled(page);
  const folderIds = await page.evaluate(() => Object.fromEntries(window.CatalogoTop.AssetIndexStore.getSnapshot().folders.map(folder => [folder.name, folder.id])));
  const nestedId = folderIds['Corrediças'];
  const parentId = folderIds['Produtos'];
  if (!nestedId || !parentId) throw new Error(`pastas R3b não criadas: ${JSON.stringify(folderIds)}`);

  await page.click('[data-asset-library-folder=""]');
  await page.check(`[data-asset-library-select="sha256/${A}"]`);
  await page.selectOption('#assetLibraryMoveDestination', nestedId);
  await page.click('#assetLibraryMoveAssets');
  await page.waitForFunction(({ A, nestedId }) => window.CatalogoTop.AssetIndexStore.getSnapshot().assets.some(asset => asset.sha256 === A && asset.folderId === nestedId), { A, nestedId });
  await waitAssetIndexSettled(page);
  if (assetUploadPosts !== 0) throw new Error('adotar/mover asset descoberto não pode fazer upload');

  await page.click(`[data-asset-library-folder="${parentId}"]`);
  await page.fill('#assetLibrarySearch', 'Produto Um');
  await page.waitForFunction(A => {
    const rows = Array.from(document.querySelectorAll('#assetLibraryList [data-asset-resource]'));
    return rows.length === 1 && rows[0].dataset.assetResource === `sha256/${A}`;
  }, A);
  await page.fill('#assetLibrarySearch', '');

  await page.click(`[data-asset-library-folder="${nestedId}"]`);
  page.once('dialog', dialog => dialog.accept('Corrediças Premium'));
  await page.click('#assetLibraryRenameFolder');
  await page.waitForFunction(id => window.CatalogoTop.AssetIndexStore.getSnapshot().folders.find(folder => folder.id === id)?.name === 'Corrediças Premium', nestedId);
  await waitAssetIndexSettled(page);
  await page.selectOption('#assetLibraryFolderParent', '');
  await page.click('#assetLibraryMoveFolder');
  await page.waitForFunction(id => window.CatalogoTop.AssetIndexStore.getSnapshot().folders.find(folder => folder.id === id)?.parentId == null, nestedId);
  await waitAssetIndexSettled(page);

  let dialogs = 0;
  const occupiedHandler = async dialog => { dialogs += 1; await dialog.accept(); };
  page.on('dialog', occupiedHandler);
  await page.click('#assetLibraryDeleteFolder');
  await page.waitForTimeout(100);
  page.off('dialog', occupiedHandler);
  if (dialogs < 2 || !(await page.evaluate(id => window.CatalogoTop.AssetIndexStore.getSnapshot().folders.some(folder => folder.id === id), nestedId))) throw new Error('pasta ocupada precisa falhar fechado');

  const beforeUploadRevision = await page.evaluate(() => window.CatalogoTop.AssetIndexStore.getRevision());
  await page.setInputFiles('#assetLibraryUploadInput', { name: 'nova-imagem.svg', mimeType: 'image/svg+xml', buffer: svg });
  await page.waitForFunction(D => window.CatalogoTop.AssetIndexStore.getSnapshot().assets.some(asset => asset.sha256 === D), D);
  await waitAssetIndexSettled(page);
  const afterFirstUploadRevision = await page.evaluate(() => window.CatalogoTop.AssetIndexStore.getRevision());
  if (afterFirstUploadRevision !== beforeUploadRevision + 1 || assetUploadPosts !== 1) throw new Error(`upload standalone inválido: r${beforeUploadRevision}->r${afterFirstUploadRevision}, posts=${assetUploadPosts}`);

  await page.selectOption('#assetLibraryUsageFilter', 'unused');
  await page.fill('#assetLibrarySearch', 'nova-imagem');
  await page.waitForFunction(D => {
    const rows = Array.from(document.querySelectorAll('#assetLibraryList [data-asset-resource]'));
    return rows.length === 1 && rows[0].dataset.assetResource === `sha256/${D}` && rows[0].textContent.includes('Sem uso autoritativo');
  }, D);

  await page.setInputFiles('#assetLibraryUploadInput', { name: 'outro-nome.svg', mimeType: 'image/svg+xml', buffer: svg });
  await page.waitForFunction(() => document.getElementById('assetLibraryUploadStatus')?.textContent === '');
  await waitAssetIndexSettled(page);
  const afterDedupRevision = await page.evaluate(() => window.CatalogoTop.AssetIndexStore.getRevision());
  if (afterDedupRevision !== afterFirstUploadRevision || assetUploadPosts !== 2) throw new Error(`reupload deduplicado não pode alterar índice: r${afterFirstUploadRevision}->r${afterDedupRevision}, posts=${assetUploadPosts}`);
  const uploadedRecord = await page.evaluate(D => window.CatalogoTop.AssetIndexStore.getSnapshot().assets.find(asset => asset.sha256 === D), D);
  if (uploadedRecord.label !== 'nova-imagem' || uploadedRecord.folderId !== nestedId) throw new Error(`reupload não pode renomear/mover record existente: ${JSON.stringify(uploadedRecord)}`);

  await page.click('[data-tab="products"]');
  await page.click('#btnNewProduct');
  await page.fill('#code', 'P3');
  await page.fill('#description', 'Produto Três');
  await page.fill('#productFolderPath', 'Ferragens');
  await page.click('#btnNextFormStep');
  await page.waitForFunction(() => document.querySelector('[data-form-step="2"]')?.classList.contains('active'));
  await page.fill('#price', 'R$ 30,00');
  await page.click('#btnChooseAssetLibrary');
  await page.waitForFunction(() => window.CatalogoTop.LibraryShell.getActiveProvider() === 'images' && document.getElementById('assetLibraryAdmin')?.dataset.mobileView === 'images');
  await page.selectOption('#assetLibraryUsageFilter', 'all');
  await page.fill('#assetLibrarySearch', 'nova-imagem');
  await page.waitForFunction(D => Boolean(document.querySelector(`[data-asset-resource="sha256/${D}"] [data-asset-use]`)), D);
  await page.click(`[data-asset-use="sha256/${D}"]`);
  await page.waitForFunction(urlD => document.getElementById('imageUrl')?.value === urlD && document.querySelector('#products.panel.active'), urlD);
  const preserved = await page.evaluate(() => ({ code: document.getElementById('code').value, description: document.getElementById('description').value, price: document.getElementById('price').value }));
  if (preserved.code !== 'P3' || preserved.description !== 'Produto Três' || preserved.price !== 'R$ 30,00') throw new Error(`picker R3b perdeu formulário: ${JSON.stringify(preserved)}`);
  await page.click('#btnNextFormStep');
  await page.waitForFunction(() => document.querySelector('[data-form-step="3"]')?.classList.contains('active'));
  await page.click('#btnSaveProduct');
  await page.waitForFunction(() => window.CatalogoTop.ProductStore.getRevision() === 6);
  if ((await page.evaluate(() => window.CatalogoTop.AssetIndexStore.getRevision())) !== afterFirstUploadRevision) throw new Error('salvar produto não pode alterar revisão do AssetIndex');

  await page.click('[data-tab="library"]');
  await page.click('[data-library-provider="images"]');
  await page.selectOption('#assetLibraryUsageFilter', 'used');
  await page.fill('#assetLibrarySearch', 'nova-imagem');
  await page.waitForFunction(D => {
    const row = document.querySelector(`[data-asset-resource="sha256/${D}"]`);
    return row && row.textContent.includes('Produto Três');
  }, D);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.getElementById('assetLibraryAdmin')?.dataset.mobileView === 'images');
  await page.click('[data-asset-library-mobile-view="folders"]');
  await page.waitForFunction(() => document.getElementById('assetLibraryAdmin')?.dataset.mobileView === 'folders');
  await page.click(`[data-asset-library-folder="${nestedId}"]`);
  await page.waitForFunction(() => document.getElementById('assetLibraryAdmin')?.dataset.mobileView === 'images');
  const overflow = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, root: document.getElementById('assetLibraryAdmin').scrollWidth, rootClient: document.getElementById('assetLibraryAdmin').clientWidth }));
  if (overflow.doc > overflow.client + 2 || overflow.root > overflow.rootClient + 2) throw new Error(`overflow mobile em Asset Library: ${JSON.stringify(overflow)}`);

  console.log(`PASS browser R3b asset admin: folders, recursive query, adoption, settled writes, occupied-folder guard, standalone/dedup upload, usage transition and mobile flow (${D.slice(0, 12)})`);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}