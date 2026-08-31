import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadModules() {
  const context = vm.createContext({ window: {}, console });
  for (const file of ['composition.js', 'folder-tree.js', 'catalog-snapshot.js']) {
    vm.runInContext(fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'), context, { filename: `src/${file}` });
  }
  return context.window.CatalogoTop;
}

const { CatalogSnapshot } = loadModules();
const now = '2026-08-31T02:00:00.000Z';
const state = {
  schemaVersion: 8,
  folders: [{ id: 'product-folder', parentId: null, name: 'Produtos' }],
  products: [{ id: 'p1', code: 'A', description: 'Produto atual', folderId: 'product-folder' }],
  selectedIds: ['p1', 'stale-product'],
  catalog: {
    title: 'Catálogo agosto',
    templateId: 'technical',
    showPrices: true,
    dateOverride: '2026-08-31',
    createdAt: '2026-08-31T12:00:00.000Z',
    presentation: { order: ['p1', 'stale-product'], itemStyles: { p1: { width: 'wide' } }, blocks: [] }
  }
};

const record = CatalogSnapshot.fromState(state, { id: 'catalog-1', folderId: 'catalog-folder', now });
assert.equal(record.id, 'catalog-1');
assert.equal(record.folderId, 'catalog-folder');
assert.equal(record.catalog.title, 'Catálogo agosto');
assert.equal(record.selectedIds.includes('stale-product'), true, 'referência stale deve permanecer no documento salvo');
assert.equal(Object.prototype.hasOwnProperty.call(record, 'products'), false, 'CatalogRecord não pode incorporar Product records');
assert.equal(Object.prototype.hasOwnProperty.call(record, 'folders'), false, 'CatalogRecord não pode incorporar árvore de produtos');

const targetState = {
  schemaVersion: 8,
  folders: [{ id: 'different-product-folder', parentId: null, name: 'Base atual' }],
  products: [{ id: 'p2', code: 'B', description: 'Outra base' }],
  selectedIds: ['p2'],
  catalog: { title: 'Sessão temporária', templateId: 'compact', showPrices: false, dateOverride: '', createdAt: now, presentation: {} }
};
const applied = CatalogSnapshot.applyToState(targetState, record);
assert.equal(JSON.stringify(applied.products), JSON.stringify(targetState.products), 'abrir catálogo não pode substituir produtos');
assert.equal(JSON.stringify(applied.folders), JSON.stringify(targetState.folders), 'abrir catálogo não pode substituir pastas de produto');
assert.equal(JSON.stringify(applied.selectedIds), JSON.stringify(['p1', 'stale-product']), 'abrir deve preservar intenção editorial inclusive stale IDs');
assert.equal(applied.catalog.title, 'Catálogo agosto');

const duplicated = CatalogSnapshot.duplicate(record, { id: 'catalog-2', now: '2026-08-31T02:05:00.000Z' });
assert.equal(duplicated.id, 'catalog-2');
assert.equal(duplicated.catalog.title, 'Catálogo agosto (cópia)');
assert.equal(record.id, 'catalog-1', 'duplicação não pode mutar original');
assert.equal(JSON.stringify(duplicated.selectedIds), JSON.stringify(record.selectedIds));

const catalogFolders = [
  { id: 'catalog-root', parentId: null, name: 'Campanhas' },
  { id: 'catalog-folder', parentId: 'catalog-root', name: '2026' }
];
const snapshot = CatalogSnapshot.forWrite({
  revision: 4,
  updatedAt: now,
  writeId: 'write-4',
  folders: catalogFolders,
  catalogs: [record]
});
assert.equal(snapshot.schemaVersion, 1);
assert.equal(snapshot.revision, 4);
assert.equal(snapshot.catalogs[0].folderId, 'catalog-folder');
assert.equal(CatalogSnapshot.read(snapshot).snapshot.catalogs[0].id, 'catalog-1');

assert.throws(() => CatalogSnapshot.forWrite({
  folders: catalogFolders,
  catalogs: [{ ...record, folderId: 'missing' }]
}), error => error?.code === 'catalog_folder_invalid');

assert.throws(() => CatalogSnapshot.forWrite({
  folders: catalogFolders,
  catalogs: [record, { ...record }]
}), error => error?.code === 'catalog_id_duplicate');

assert.throws(() => CatalogSnapshot.forWrite({
  folders: catalogFolders,
  catalogs: [{ ...record, selectedIds: ['p1', 'p1'] }]
}), error => error?.code === 'catalog_selected_id_duplicate');

const moved = { ...record, folderId: null, updatedAt: '2026-09-01T00:00:00.000Z' };
assert.equal(CatalogSnapshot.contentSignature(moved), CatalogSnapshot.contentSignature(record), 'metadata/folder de recurso não devem marcar conteúdo editorial como dirty');
const rederivedDate = { ...record, catalog: { ...record.catalog, createdAt: '2026-09-01T14:00:00.000Z' } };
assert.equal(CatalogSnapshot.contentSignature(rederivedDate), CatalogSnapshot.contentSignature(record), 'createdAt efetivo é derivado de dateOverride/Core e não deve marcar dirty');
const changedOverride = { ...record, catalog: { ...record.catalog, dateOverride: '2026-09-01' } };
assert.notEqual(CatalogSnapshot.contentSignature(changedOverride), CatalogSnapshot.contentSignature(record), 'dateOverride explícito deve marcar dirty');
assert.throws(() => CatalogSnapshot.read({ schemaVersion: 2, folders: [], catalogs: [] }), error => error?.code === 'catalog_snapshot_version');

console.log('PASS catalog snapshot fixture: separate identity, stale references, duplicate, folder guard, derived date signature and product-truth isolation');
