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

function seedCatalog() {
  const NS = window.CatalogoTop;
  NS.ProductStore.isWritable = () => true;
  NS.ProductStore.unlock = async () => true;
  NS.ProductStore.publishCurrent = async () => true;
  const folders = [{ id: 'products-root', parentId: null, name: 'Ferragens' }];
  const products = NS.ProductSnapshot.reprojectProducts(folders, [
    { id: 'p1', code: 'P1', description: 'Produto salvo', folderId: 'products-root', category: '', subcategory: '', price: 'R$ 10,00', status: 'Ativo', notes: '', image: '', imageGallery: [], specs: [], variants: [], tableRows: [] },
    { id: 'p2', code: 'P2', description: 'Produto atual', folderId: 'products-root', category: '', subcategory: '', price: 'R$ 20,00', status: 'Ativo', notes: '', image: '', imageGallery: [], specs: [], variants: [], tableRows: [] }
  ]).map(NS.Core.normalizeProduct);
  const current = NS.Core.getState();
  NS.Core.setState({
    ...current,
    schemaVersion: 8,
    folders,
    products,
    selectedIds: ['p1'],
    catalog: {
      ...current.catalog,
      title: 'Catálogo salvo',
      templateId: 'technical',
      showPrices: true,
      presentation: NS.Composition.normalizePresentation({ ...current.catalog.presentation, order: ['p1'], blocks: [], itemStyles: { p1: { width: 'wide' } } })
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
  await page.waitForFunction(() => Boolean(window.CatalogoTop?.CatalogStore && window.CatalogoTop?.CatalogLibrary && window.CatalogoTop?.ProductStore));
  await page.waitForFunction(() => document.getElementById('catalogSaveStatus')?.textContent !== 'Conectando…');
  await page.evaluate(seedCatalog);

  await page.click('[data-tab="catalog"]');
  await page.waitForSelector('#catalog.panel.active');
  await page.waitForFunction(() => document.getElementById('catalogSaveStatus')?.textContent === 'Alterações locais');
  await page.click('#btnSaveCatalog');
  await page.waitForFunction(() => window.CatalogoTop.CatalogStore.getSnapshot().catalogs.length === 1 && window.CatalogoTop.CatalogStore.getRevision() === 1);
  await page.waitForFunction(() => document.getElementById('catalogSaveStatus')?.dataset.saveState === 'saved');
  const firstSaved = await page.evaluate(() => ({
    id: window.CatalogoTop.CatalogStore.getActiveCatalogId(),
    title: window.CatalogoTop.CatalogStore.getSnapshot().catalogs[0]?.catalog.title,
    selectedIds: window.CatalogoTop.CatalogStore.getSnapshot().catalogs[0]?.selectedIds.slice(),
    productsEmbedded: Object.prototype.hasOwnProperty.call(window.CatalogoTop.CatalogStore.getSnapshot().catalogs[0] || {}, 'products')
  }));
  if (!firstSaved.id || firstSaved.title !== 'Catálogo salvo' || firstSaved.selectedIds.join(',') !== 'p1' || firstSaved.productsEmbedded) throw new Error(`save inicial inválido: ${JSON.stringify(firstSaved)}`);

  await page.fill('#catalogTitle', 'Catálogo alterado localmente');
  await page.waitForFunction(() => document.getElementById('catalogSaveStatus')?.dataset.saveState === 'dirty');

  await page.click('#btnNewCatalog');
  await page.waitForFunction(() => !window.CatalogoTop.CatalogStore.getActiveCatalogId());
  const fresh = await page.evaluate(() => ({ title: window.CatalogoTop.Core.getState().catalog.title, selectedIds: window.CatalogoTop.Core.getState().selectedIds.slice(), state: document.getElementById('catalogSaveStatus')?.dataset.saveState }));
  if (fresh.title !== 'Categoria' || fresh.selectedIds.length || fresh.state !== 'new') throw new Error(`novo catálogo não limpou só sessão editorial: ${JSON.stringify(fresh)}`);

  await page.evaluate(() => {
    const NS = window.CatalogoTop;
    const current = NS.Core.getState();
    const p2 = current.products.find(product => product.id === 'p2');
    NS.Core.setState({ ...current, products: [p2], selectedIds: [], catalog: { ...current.catalog, presentation: NS.Composition.normalizePresentation({}) } }, { persist: false });
    NS.App.renderAll();
  });
  const beforeOpen = await page.evaluate(() => ({ products: window.CatalogoTop.Core.getState().products.map(product => product.id), folders: window.CatalogoTop.Core.getState().folders.map(folder => folder.id) }));

  await page.click('[data-tab="library"]');
  await page.click('[data-library-provider="catalogs"]');
  await page.waitForSelector('#catalogLibraryList [data-catalog-resource]');
  const provider = await page.evaluate(() => ({
    productPanelHidden: document.querySelector('[data-library-provider-panel="products"]')?.hidden,
    catalogPanelHidden: document.querySelector('[data-library-provider-panel="catalogs"]')?.hidden,
    rows: document.querySelectorAll('#catalogLibraryList [data-catalog-resource]').length
  }));
  if (!provider.productPanelHidden || provider.catalogPanelHidden || provider.rows !== 1) throw new Error(`provider Catálogos inválido: ${JSON.stringify(provider)}`);

  await page.click(`[data-catalog-open="${firstSaved.id}"]`);
  await page.waitForFunction(id => window.CatalogoTop.CatalogStore.getActiveCatalogId() === id, firstSaved.id);
  const reopened = await page.evaluate(() => ({
    title: window.CatalogoTop.Core.getState().catalog.title,
    selectedIds: window.CatalogoTop.Core.getState().selectedIds.slice(),
    products: window.CatalogoTop.Core.getState().products.map(product => product.id),
    folders: window.CatalogoTop.Core.getState().folders.map(folder => folder.id),
    state: document.getElementById('catalogSaveStatus')?.dataset.saveState
  }));
  if (reopened.title !== 'Catálogo salvo' || reopened.selectedIds.join(',') !== 'p1' || reopened.products.join(',') !== beforeOpen.products.join(',') || reopened.folders.join(',') !== beforeOpen.folders.join(',') || reopened.state !== 'saved') {
    throw new Error(`open não preservou product truth + stale intent: ${JSON.stringify({ beforeOpen, reopened })}`);
  }

  await page.click('[data-tab="library"]');
  await page.click('[data-library-provider="catalogs"]');
  await page.click(`[data-catalog-duplicate="${firstSaved.id}"]`);
  await page.waitForFunction(() => window.CatalogoTop.CatalogStore.getSnapshot().catalogs.length === 2 && window.CatalogoTop.CatalogStore.getRevision() === 2);
  const duplicated = await page.evaluate(originalId => {
    const store = window.CatalogoTop.CatalogStore;
    const snapshot = store.getSnapshot();
    return {
      activeId: store.getActiveCatalogId(),
      ids: snapshot.catalogs.map(record => record.id),
      titles: snapshot.catalogs.map(record => record.catalog.title),
      currentTitle: window.CatalogoTop.Core.getState().catalog.title,
      originalId
    };
  }, firstSaved.id);
  if (duplicated.ids.length !== 2 || new Set(duplicated.ids).size !== 2 || duplicated.activeId === firstSaved.id || !duplicated.titles.includes('Catálogo salvo (cópia)') || duplicated.currentTitle !== 'Catálogo salvo (cópia)') {
    throw new Error(`duplicate não criou identidade independente: ${JSON.stringify(duplicated)}`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('[data-tab="library"]');
  await page.click('[data-library-provider="catalogs"]');
  const mobile = await page.evaluate(() => ({
    rows: document.querySelectorAll('#catalogLibraryList [data-catalog-resource]').length,
    openVisible: Boolean(document.querySelector('[data-catalog-open]')?.getClientRects().length),
    duplicateVisible: Boolean(document.querySelector('[data-catalog-duplicate]')?.getClientRects().length),
    overflowX: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
  }));
  if (mobile.rows !== 2 || !mobile.openVisible || !mobile.duplicateVisible || mobile.overflowX > 2) throw new Error(`Catalog provider mobile regrediu: ${JSON.stringify(mobile)}`);

  console.log('PASS browser Saved Catalog R2a gate: save/dirty/new/open/duplicate, provider separation and stale references without replacing product truth');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
