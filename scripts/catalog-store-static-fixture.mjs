import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const names = [
  'index.html',
  'catalog-library.css',
  'src/catalog-snapshot.js',
  'src/catalog-store.js',
  'src/library-shell.js',
  'src/catalog-library.js',
  'src/indexed-cache.js',
  'src/product-store.js',
  'src/app.js'
];
const files = Object.fromEntries(await Promise.all(names.map(async file => [file, await readFile(file, 'utf8')])));
for (const file of names.filter(name => name.endsWith('.js'))) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `Falha de sintaxe em ${file}\n`);
    process.exit(result.status || 1);
  }
}

const html = files['index.html'];
const checks = [
  ['CatalogSnapshot carrega após FolderTree e antes do Core', html.indexOf('src/folder-tree.js') < html.indexOf('src/catalog-snapshot.js') && html.indexOf('src/catalog-snapshot.js') < html.indexOf('src/core.js')],
  ['CatalogStore carrega após cache/ProductStore e antes do App', html.indexOf('src/indexed-cache.js') < html.indexOf('src/catalog-store.js') && html.indexOf('src/product-store.js') < html.indexOf('src/catalog-store.js') && html.indexOf('src/catalog-store.js') < html.indexOf('src/app.js')],
  ['Biblioteca expõe providers Produtos e Catálogos sem nova aba top-level', html.includes('data-library-provider="products"') && html.includes('data-library-provider="catalogs"') && !html.includes('data-tab="catalogs"')],
  ['Catálogo expõe save/status explícitos', html.includes('id="catalogSaveStatus"') && html.includes('id="btnSaveCatalog"')],
  ['provider Catálogos possui busca/lista próprias', html.includes('id="catalogLibrarySearch"') && html.includes('id="catalogLibraryList"')],
  ['cache IndexedDB separa produtos e catálogos', files['src/indexed-cache.js'].includes("PRODUCT_KEY = 'products-current'") && files['src/indexed-cache.js'].includes("CATALOG_KEY = 'catalogs-current'") && files['src/indexed-cache.js'].includes('getCatalogSnapshot') && files['src/indexed-cache.js'].includes('setCatalogSnapshot')],
  ['CatalogStore usa endpoint/revisão próprios', files['src/catalog-store.js'].includes("fetch('/api/catalogs'") && files['src/catalog-store.js'].includes('expectedRevision: revision') && !files['src/catalog-store.js'].includes('ProductStore.getRevision')],
  ['CatalogStore reutiliza sessão de escrita sem acoplar revision', files['src/catalog-store.js'].includes('ProductStore.isWritable') && files['src/catalog-store.js'].includes('ProductStore.unlock')],
  ['CatalogStore oferece save/open/duplicate e identidade ativa local', files['src/catalog-store.js'].includes('saveCurrent') && files['src/catalog-store.js'].includes('openCatalog') && files['src/catalog-store.js'].includes('duplicateCatalog') && files['src/catalog-store.js'].includes("ACTIVE_KEY = 'catalogotop:active-catalog:v1'")],
  ['Novo catálogo é interceptado pela authority salva', files['src/catalog-store.js'].includes("document.getElementById('btnNewCatalog')") && files['src/catalog-store.js'].includes('event.stopImmediatePropagation()') && files['src/catalog-store.js'].includes('newSession()')],
  ['backup importado perde identidade salva antes de materializar sessão', files['src/catalog-store.js'].includes("document.getElementById('backupFile')") && files['src/catalog-store.js'].includes('clearActive')],
  ['ProductStore não apaga selectedIds ao sincronizar product truth', !files['src/product-store.js'].includes('draft.selectedIds = draft.selectedIds.map(String).filter') && files['src/product-store.js'].includes('draft.products = normalized')],
  ['LibraryShell mantém provider como estado efêmero de UI', files['src/library-shell.js'].includes('activeProvider') && !files['src/library-shell.js'].includes('localStorage') && files['src/library-shell.js'].includes('catalogotop:library-provider-changed')],
  ['CatalogLibrary abre/duplica pela CatalogStore', files['src/catalog-library.js'].includes('CatalogStore.openCatalog') && files['src/catalog-library.js'].includes('CatalogStore.duplicateCatalog')],
  ['R2 não injeta produtos em CatalogRecord', !files['src/catalog-snapshot.js'].includes('products:')],
  ['CSS de catálogo é bootstrap estático', html.includes('catalog-library.css') && !files['src/catalog-library.js'].includes("createElement('style')")]
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  failed.forEach(([name]) => console.error(`FAIL ${name}`));
  process.exit(1);
}
checks.forEach(([name]) => console.log(`PASS ${name}`));
