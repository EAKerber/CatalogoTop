import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.csv': 'text/csv; charset=utf-8'
};
let catalogSnapshot = { schemaVersion: 1, revision: 0, updatedAt: '', writeId: '', folders: [], catalogs: [] };

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/api/catalogs') {
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.setHeader('cache-control', 'no-store');
      if (request.method === 'GET') {
        response.writeHead(200);
        response.end(JSON.stringify(catalogSnapshot));
        return;
      }
      if (request.method === 'PUT') {
        const body = await readJson(request);
        if (Number(body.expectedRevision) !== catalogSnapshot.revision) {
          response.writeHead(409);
          response.end(JSON.stringify({ error: 'revision_conflict', currentRevision: catalogSnapshot.revision }));
          return;
        }
        catalogSnapshot = {
          schemaVersion: 1,
          revision: catalogSnapshot.revision + 1,
          updatedAt: new Date().toISOString(),
          writeId: String(body.writeId || ''),
          folders: Array.isArray(body.folders) ? body.folders : [],
          catalogs: Array.isArray(body.catalogs) ? body.catalogs : []
        };
        response.writeHead(200);
        response.end(JSON.stringify(catalogSnapshot));
        return;
      }
      response.writeHead(405);
      response.end(JSON.stringify({ error: 'method_not_allowed' }));
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'fixture_offline' }));
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

function seedProductTruth() {
  const NS = window.CatalogoTop;
  NS.ProductStore.isWritable = () => true;
  NS.ProductStore.unlock = async () => true;
  window.__r2bProductPublishCalls = 0;
  NS.ProductStore.publishCurrent = async () => { window.__r2bProductPublishCalls += 1; return true; };

  const folders = [{ id: 'products-root', parentId: null, name: 'Ferragens' }];
  const products = NS.ProductSnapshot.reprojectProducts(folders, [
    { id: 'p1', code: 'P1', description: 'Produto Alpha', folderId: 'products-root', category: '', subcategory: '', price: 'R$ 10,00', status: 'Ativo', notes: '', image: '', imageGallery: [], specs: [], variants: [], tableRows: [] },
    { id: 'p2', code: 'P2', description: 'Produto Beta', folderId: 'products-root', category: '', subcategory: '', price: 'R$ 20,00', status: 'Ativo', notes: '', image: '', imageGallery: [], specs: [], variants: [], tableRows: [] }
  ]).map(NS.Core.normalizeProduct);
  const current = NS.Core.getState();
  NS.Core.setState({ ...current, schemaVersion: 8, folders, products, selectedIds: [], catalog: { ...current.catalog, presentation: NS.Composition.normalizePresentation({}) } }, { persist: false });
  NS.App.renderAll();
}

function materializeCatalog({ title, selectedIds }) {
  const NS = window.CatalogoTop;
  const current = NS.Core.getState();
  NS.Core.setState({
    ...current,
    selectedIds: selectedIds.slice(),
    catalog: {
      ...current.catalog,
      title,
      templateId: 'technical',
      showPrices: true,
      presentation: NS.Composition.normalizePresentation({ ...current.catalog.presentation, order: selectedIds.slice(), blocks: [] })
    }
  }, { persist: false });
  NS.App.renderAll();
}

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.on('dialog', dialog => dialog.accept());
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.CatalogoTop?.CatalogStore && window.CatalogoTop?.CatalogLibrary && window.CatalogoTop?.CatalogQuery));
  await page.waitForFunction(() => document.getElementById('catalogSaveStatus')?.textContent !== 'Conectando…');
  await page.evaluate(seedProductTruth);

  await page.evaluate(materializeCatalog, { title: 'Proposta Alpha', selectedIds: ['p1'] });
  if (!await page.evaluate(() => window.CatalogoTop.CatalogStore.saveCurrent())) throw new Error('não salvou Alpha');
  const alphaId = await page.evaluate(() => window.CatalogoTop.CatalogStore.getActiveCatalogId());
  if (!alphaId) throw new Error('Alpha sem identidade');

  await page.evaluate(() => window.CatalogoTop.CatalogStore.newSession());
  await page.evaluate(materializeCatalog, { title: 'Proposta Beta', selectedIds: ['p2'] });
  if (!await page.evaluate(() => window.CatalogoTop.CatalogStore.saveCurrent())) throw new Error('não salvou Beta');
  const betaId = await page.evaluate(() => window.CatalogoTop.CatalogStore.getActiveCatalogId());
  if (!betaId || betaId === alphaId) throw new Error('Beta sem identidade independente');

  const folderIds = await page.evaluate(async () => {
    const store = window.CatalogoTop.CatalogStore;
    const clients = await store.createFolder({ name: 'Clientes' });
    const acme = await store.createFolder({ name: 'Acme', parentId: clients });
    const q3 = await store.createFolder({ name: '2026 Q3', parentId: acme });
    const archive = await store.createFolder({ name: 'Arquivo' });
    const temp = await store.createFolder({ name: 'Temporária' });
    await store.renameFolder(acme, 'Ácme Comercial');
    await store.moveFolder(archive, clients);
    return { clients, acme, q3, archive, temp };
  });
  if (Object.values(folderIds).some(id => !id)) throw new Error(`criação de pastas incompleta: ${JSON.stringify(folderIds)}`);

  const moveInvariant = await page.evaluate(async ({ alphaId, betaId, folderIds }) => {
    const NS = window.CatalogoTop;
    const store = NS.CatalogStore;
    const before = store.getSnapshot().catalogs.find(record => record.id === betaId);
    const signature = NS.CatalogSnapshot.contentSignature(before);
    await store.moveCatalogs([betaId], folderIds.archive);
    const after = store.getSnapshot().catalogs.find(record => record.id === betaId);
    await store.moveCatalogs([alphaId], folderIds.q3);
    return {
      activeId: store.getActiveCatalogId(),
      dirty: store.isDirty(),
      before: { id: before.id, createdAt: before.createdAt, updatedAt: before.updatedAt, signature },
      after: { id: after.id, createdAt: after.createdAt, updatedAt: after.updatedAt, signature: NS.CatalogSnapshot.contentSignature(after), folderId: after.folderId }
    };
  }, { alphaId, betaId, folderIds });
  if (moveInvariant.activeId !== betaId || moveInvariant.dirty || moveInvariant.after.folderId !== folderIds.archive || moveInvariant.before.id !== moveInvariant.after.id || moveInvariant.before.createdAt !== moveInvariant.after.createdAt || moveInvariant.before.updatedAt !== moveInvariant.after.updatedAt || moveInvariant.before.signature !== moveInvariant.after.signature) {
    throw new Error(`move alterou identidade/conteúdo/dirty: ${JSON.stringify(moveInvariant)}`);
  }

  const occupiedGuard = await page.evaluate(async q3 => {
    try {
      await window.CatalogoTop.CatalogStore.deleteEmptyFolder(q3);
      return { threw: false };
    } catch (error) {
      return { threw: true, code: error?.code || '', message: error?.message || '' };
    }
  }, folderIds.q3);
  if (!occupiedGuard.threw || occupiedGuard.code !== 'folder_not_empty') throw new Error(`pasta ocupada não falhou fechado: ${JSON.stringify(occupiedGuard)}`);

  await page.click('[data-tab="library"]');
  await page.click('[data-library-provider="catalogs"]');
  await page.waitForSelector('#catalogLibraryFolderTree [data-catalog-library-folder]');

  await page.click(`[data-catalog-library-folder="${folderIds.clients}"]`);
  await page.fill('#catalogLibrarySearch', 'acme');
  await page.waitForFunction(id => {
    const rows = Array.from(document.querySelectorAll('#catalogLibraryList [data-catalog-resource]'));
    return rows.length === 1 && rows[0].dataset.catalogResource === id;
  }, alphaId);
  const scopedPath = await page.textContent('#catalogLibraryFolderPath');
  if (scopedPath !== 'Clientes') throw new Error(`escopo recursivo incorreto: ${scopedPath}`);

  await page.fill('#catalogLibrarySearch', '');
  await page.click(`[data-catalog-library-folder="${folderIds.temp}"]`);
  await page.click('#catalogLibraryDeleteFolder');
  await page.waitForFunction(id => !window.CatalogoTop.CatalogStore.getSnapshot().folders.some(folder => folder.id === id), folderIds.temp);

  await page.click('[data-catalog-library-folder=""]');
  await page.click('#catalogLibrarySelectVisible');
  await page.selectOption('#catalogLibraryMoveDestination', folderIds.clients);
  await page.click('#catalogLibraryMoveCatalogs');
  await page.waitForFunction(({ alphaId, betaId, clients }) => {
    const store = window.CatalogoTop.CatalogStore;
    const byId = new Map(store.getSnapshot().catalogs.map(record => [record.id, record]));
    return byId.get(alphaId)?.folderId === clients && byId.get(betaId)?.folderId === clients && store.isDirty() === false;
  }, { alphaId, betaId, clients: folderIds.clients });

  await page.click('#catalogLibraryClearSelection');
  await page.check(`[data-catalog-library-select="${betaId}"]`);
  const beforeDelete = await page.evaluate(() => {
    const state = window.CatalogoTop.Core.getState();
    return {
      title: state.catalog.title,
      selectedIds: state.selectedIds.slice(),
      products: state.products.map(product => product.id),
      folders: state.folders.map(folder => folder.id),
      publishCalls: window.__r2bProductPublishCalls
    };
  });
  await page.click('#catalogLibraryDeleteCatalogs');
  await page.waitForFunction(id => {
    const store = window.CatalogoTop.CatalogStore;
    const removed = !store.getSnapshot().catalogs.some(record => record.id === id);
    const unsaved = !store.getActiveCatalogId() && store.isDirty();
    const badgeDirty = document.getElementById('catalogSaveStatus')?.dataset.saveState === 'dirty';
    return removed && unsaved && badgeDirty;
  }, betaId);
  const afterDelete = await page.evaluate(() => {
    const NS = window.CatalogoTop;
    const state = NS.Core.getState();
    return {
      activeId: NS.CatalogStore.getActiveCatalogId(),
      dirty: NS.CatalogStore.isDirty(),
      saveState: document.getElementById('catalogSaveStatus')?.dataset.saveState,
      title: state.catalog.title,
      selectedIds: state.selectedIds.slice(),
      products: state.products.map(product => product.id),
      folders: state.folders.map(folder => folder.id),
      publishCalls: window.__r2bProductPublishCalls,
      catalogs: NS.CatalogStore.getSnapshot().catalogs.map(record => record.id)
    };
  });
  if (afterDelete.activeId || !afterDelete.dirty || afterDelete.saveState !== 'dirty' || afterDelete.title !== beforeDelete.title || afterDelete.selectedIds.join(',') !== beforeDelete.selectedIds.join(',') || afterDelete.products.join(',') !== beforeDelete.products.join(',') || afterDelete.folders.join(',') !== beforeDelete.folders.join(',') || afterDelete.publishCalls !== beforeDelete.publishCalls || afterDelete.catalogs.length !== 1 || afterDelete.catalogs[0] !== alphaId) {
    throw new Error(`exclusão do ativo não preservou sessão/authority: ${JSON.stringify({ beforeDelete, afterDelete })}`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('[data-library-provider="catalogs"]');
  const mobileSwitch = await page.locator('[data-catalog-library-mobile-view="catalogs"]');
  if (!await mobileSwitch.isVisible()) throw new Error('switch mobile Catálogos não está visível');
  await mobileSwitch.click();
  const mobile = await page.evaluate(() => ({
    view: document.getElementById('catalogLibraryAdmin')?.dataset.mobileView,
    rows: document.querySelectorAll('#catalogLibraryList [data-catalog-resource]').length,
    openVisible: Boolean(document.querySelector('[data-catalog-open]')?.getClientRects().length),
    duplicateVisible: Boolean(document.querySelector('[data-catalog-duplicate]')?.getClientRects().length),
    overflowX: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
  }));
  if (mobile.view !== 'catalogs' || mobile.rows !== 1 || !mobile.openVisible || !mobile.duplicateVisible || mobile.overflowX > 2) throw new Error(`Catalog Library mobile inválida: ${JSON.stringify(mobile)}`);

  console.log('PASS browser Catalog Library R2b gate: folder tree/search, stable moves, empty-folder guard, bulk admin, active-delete session preservation and mobile');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
