import { readFile } from 'node:fs/promises';

const files = {
  storage: await readFile('netlify/lib/storage.mts', 'utf8'),
  contract: await readFile('netlify/lib/catalog-snapshot.mts', 'utf8'),
  endpoint: await readFile('netlify/functions/catalogs.mts', 'utf8'),
  products: await readFile('netlify/functions/products.mts', 'utf8'),
  browser: await readFile('src/catalog-snapshot.js', 'utf8')
};

const checks = [
  ['CatalogStore possui Blob store separado do ProductStore', files.storage.includes("CATALOG_STORE = 'catalogotop-catalogs'") && files.storage.includes('catalogsStore()') && files.storage.includes('productsStore()')],
  ['preview/produção usam a mesma política strong sem compartilhar nome de store', files.storage.includes('deployStore(CATALOG_STORE)') && files.storage.includes("getStore(CATALOG_STORE, { consistency: 'strong' })")],
  ['endpoint de catálogo é próprio', files.endpoint.includes("path: '/api/catalogs'") && !files.endpoint.includes("path: '/api/products'")],
  ['GET de catálogos é público e PUT usa sessão existente', files.endpoint.indexOf("request.method === 'GET'") < files.endpoint.indexOf("request.method !== 'PUT'") && files.endpoint.includes('hasWriteSession(request)')],
  ['PUT de catálogos exige expectedRevision próprio', files.endpoint.includes('expectedRevision') && files.endpoint.includes('currentCatalogSnapshot()') && files.endpoint.includes('revision_conflict')],
  ['history/readback/concurrent write são preservados', files.endpoint.includes('history/${String(current.revision)') && files.endpoint.includes('readback.writeId !== next.writeId') && files.endpoint.includes('conflicts/${Date.now()}')],
  ['endpoint de catálogo não lê current ProductSnapshot', !files.endpoint.includes('currentSnapshot()') && !files.endpoint.includes('productsStore()')],
  ['contrato server aceita stale product refs sem validar ProductStore', files.contract.includes('selectedIds') && !files.contract.includes('validateProducts(') && !files.contract.includes('currentSnapshot')],
  ['browser CatalogSnapshot não incorpora produtos', files.browser.includes('selectedIds') && files.browser.includes('applyToState') && !files.browser.includes('products:')],
  ['Product endpoint continua usando apenas sua revisão', files.products.includes('currentSnapshot()') && !files.products.includes('currentCatalogSnapshot')]
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  failed.forEach(([name]) => console.error(`FAIL ${name}`));
  process.exit(1);
}
checks.forEach(([name]) => console.log(`PASS ${name}`));
