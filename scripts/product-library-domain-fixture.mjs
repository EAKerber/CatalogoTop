import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ window: {}, console, TextEncoder });
for (const file of ['folder-tree.js', 'product-folder-migration.js', 'product-domain.js', 'product-snapshot.js']) {
  vm.runInContext(fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'), context, { filename: `src/${file}` });
}
const { ProductSnapshot } = context.window.CatalogoTop;

const folders = [
  { id: 'hardware', parentId: null, name: 'Ferragens' },
  { id: 'slides', parentId: 'hardware', name: 'Corrediças' },
  { id: 'telescopic', parentId: 'slides', name: 'Telescópicas' },
  { id: 'profiles', parentId: null, name: 'Perfis' },
  { id: 'empty', parentId: 'profiles', name: 'Vazia' }
];
const products = [
  { id: 'p1', code: 'P1', description: 'Um', folderId: 'telescopic', category: 'stale', subcategory: 'stale' },
  { id: 'p2', code: 'P2', description: 'Dois', folderId: 'slides', category: 'stale', subcategory: 'stale' }
];

const moved = ProductSnapshot.moveProducts(folders, products, ['p1', 'p2'], 'profiles');
assert.deepEqual(Array.from(moved.products, product => product.id), ['p1', 'p2']);
assert.ok(moved.products.every(product => product.folderId === 'profiles'));
assert.ok(moved.products.every(product => product.category === 'Perfis' && product.subcategory === ''));

const renamed = ProductSnapshot.renameFolder(moved.folders, moved.products, 'profiles', 'Perfis de alumínio');
assert.equal(renamed.folders.find(folder => folder.id === 'profiles').name, 'Perfis de alumínio');
assert.deepEqual(Array.from(renamed.products, product => product.id), ['p1', 'p2']);
assert.ok(renamed.products.every(product => product.category === 'Perfis de alumínio'));

const movedFolder = ProductSnapshot.moveFolder(renamed.folders, renamed.products, 'profiles', 'hardware');
assert.equal(movedFolder.folders.find(folder => folder.id === 'profiles').parentId, 'hardware');
assert.ok(movedFolder.products.every(product => product.category === 'Ferragens'));
assert.ok(movedFolder.products.every(product => product.subcategory === 'Perfis de alumínio'));

assert.throws(
  () => ProductSnapshot.deleteEmptyFolder(movedFolder.folders, movedFolder.products, 'profiles'),
  error => error?.code === 'folder_not_empty'
);

const emptyDeleted = ProductSnapshot.deleteEmptyFolder(movedFolder.folders, movedFolder.products, 'empty');
assert.ok(!emptyDeleted.folders.some(folder => folder.id === 'empty'));
assert.deepEqual(Array.from(emptyDeleted.products, product => product.id), ['p1', 'p2']);

assert.throws(
  () => ProductSnapshot.moveProducts(folders, products, ['missing'], 'profiles'),
  error => error?.code === 'product_not_found'
);
assert.throws(
  () => ProductSnapshot.moveProducts(folders, products, ['p1'], 'missing'),
  error => error?.code === 'product_folder_invalid'
);
assert.throws(
  () => ProductSnapshot.moveFolder(folders, products, 'hardware', 'telescopic'),
  error => error?.code === 'folder_cycle'
);

console.log('PASS product library domain fixture: bulk move, folder rename/move/delete-empty, stable identities and legacy mirrors');
