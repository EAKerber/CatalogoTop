import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const names = [
  'index.html',
  'catalog-library.css',
  'src/catalog-snapshot.js',
  'src/catalog-query.js',
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
const store = files['src/catalog-store.js'];
const library = files['src/catalog-library.js'];
const deleteCatalogsBody = store.slice(
  store.indexOf('async function deleteCatalogs'),
  store.indexOf('function newSession')
);
const checks = [
  ['CatalogSnapshot carrega após FolderTree e antes do Core', html.indexOf('src/folder-tree.js') < html.indexOf('src/catalog-snapshot.js') && html.indexOf('src/catalog-snapshot.js') < html.indexOf('src/core.js')],
  ['CatalogQuery carrega após FolderTree e antes da Library', html.indexOf('src/folder-tree.js') < html.indexOf('src/catalog-query.js') && html.indexOf('src/catalog-query.js') < html.indexOf('src/catalog-library.js')],
  ['CatalogStore carrega após cache/ProductStore e antes do App', html.indexOf('src/indexed-cache.js') < html.indexOf('src/catalog-store.js') && html.indexOf('src/product-store.js') < html.indexOf('src/catalog-store.js') && html.indexOf('src/catalog-store.js') < html.indexOf('src/app.js')],
  ['Biblioteca expõe providers Produtos e Catálogos sem nova aba top-level', html.includes('data-library-provider="products"') && html.includes('data-library-provider="catalogs"') && !html.includes('data-tab="catalogs"')],
  ['Catálogo expõe save/status explícitos', html.includes('id="catalogSaveStatus"') && html.includes('id="btnSaveCatalog"')],
  ['provider Catálogos possui árvore, busca, seleção e administração', ['catalogLibraryFolderTree', 'catalogLibrarySearch', 'catalogLibrarySelectionCount', 'catalogLibraryMoveCatalogs', 'catalogLibraryDeleteCatalogs', 'catalogLibraryCreateFolder', 'catalogLibraryRenameFolder', 'catalogLibraryMoveFolder', 'catalogLibraryDeleteFolder'].every(id => html.includes(`id="${id}"`))],
  ['provider Catálogos possui switch mobile próprio', html.includes('data-catalog-library-mobile-view="folders"') && html.includes('data-catalog-library-mobile-view="catalogs"')],
  ['cache IndexedDB separa produtos e catálogos', files['src/indexed-cache.js'].includes("PRODUCT_KEY = 'products-current'") && files['src/indexed-cache.js'].includes("CATALOG_KEY = 'catalogs-current'") && files['src/indexed-cache.js'].includes('getCatalogSnapshot') && files['src/indexed-cache.js'].includes('setCatalogSnapshot')],
  ['CatalogStore usa endpoint/revisão próprios', store.includes("fetch('/api/catalogs'") && store.includes('expectedRevision: revision') && !store.includes('ProductStore.getRevision')],
  ['CatalogStore reutiliza sessão de escrita sem acoplar revision', store.includes('ProductStore.isWritable') && store.includes('ProductStore.unlock')],
  ['CatalogStore oferece save/open/duplicate e identidade ativa local', store.includes('saveCurrent') && store.includes('openCatalog') && store.includes('duplicateCatalog') && store.includes("ACTIVE_KEY = 'catalogotop:active-catalog:v1'")],
  ['CatalogStore oferece mutações administrativas provider-scoped', ['createFolder', 'renameFolder', 'moveFolder', 'deleteEmptyFolder', 'moveCatalogs', 'deleteCatalogs'].every(name => store.includes(name))],
  ['administração de catálogos não publica ProductStore', !store.includes('ProductStore.publishCurrent') && !store.includes('ProductStore.publishSnapshot')],
  ['mover catálogo preserva record e altera somente folderId', store.includes("? { ...record, folderId: destination } : record")],
  ['excluir ativo limpa identidade sem resetar Core', store.includes("deletingActive ? { activateId: '' } : {}") && store.includes('deletedResource: true') && !deleteCatalogsBody.includes('Core.resetCatalog()')],
  ['CatalogLibrary consulta provider pelo CatalogQuery', library.includes('CatalogQuery.query') && !library.includes("fetch('/api/catalogs'")],
  ['CatalogLibrary administra somente via CatalogStore', ['CatalogStore.createFolder', 'CatalogStore.renameFolder', 'CatalogStore.moveFolder', 'CatalogStore.deleteEmptyFolder', 'CatalogStore.moveCatalogs', 'CatalogStore.deleteCatalogs'].every(call => library.includes(call))],
  ['Novo catálogo é interceptado pela authority salva', store.includes("document.getElementById('btnNewCatalog')") && store.includes('event.stopImmediatePropagation()') && store.includes('newSession()')],
  ['backup importado perde identidade salva antes de materializar sessão', store.includes("document.getElementById('backupFile')") && store.includes('clearActive')],
  ['ProductStore não apaga selectedIds ao sincronizar product truth', !files['src/product-store.js'].includes('draft.selectedIds = draft.selectedIds.map(String).filter') && files['src/product-store.js'].includes('draft.products = normalized')],
  ['LibraryShell mantém provider como estado efêmero de UI', files['src/library-shell.js'].includes('activeProvider') && !files['src/library-shell.js'].includes('localStorage') && files['src/library-shell.js'].includes('catalogotop:library-provider-changed')],
  ['R2 não injeta produtos em CatalogRecord', !files['src/catalog-snapshot.js'].includes('products:')],
  ['CSS de catálogo é bootstrap estático', html.includes('catalog-library.css') && !library.includes("createElement('style')")]
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  failed.forEach(([name]) => console.error(`FAIL ${name}`));
  process.exit(1);
}
checks.forEach(([name]) => console.log(`PASS ${name}`));
