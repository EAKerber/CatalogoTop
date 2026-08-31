import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadModules() {
  const context = vm.createContext({ window: {}, console, TextEncoder });
  for (const file of ['folder-tree.js', 'product-folder-migration.js', 'product-domain.js', 'product-snapshot.js']) {
    vm.runInContext(fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'), context, { filename: `src/${file}` });
  }
  return context.window.CatalogoTop;
}

const { FolderTree, ProductSnapshot } = loadModules();

const legacy = ProductSnapshot.read({
  schemaVersion: 1,
  revision: 7,
  updatedAt: '2026-08-30T12:00:00.000Z',
  writeId: 'legacy-write',
  products: [
    { id: 'p1', code: '1265', description: 'Corrediça', category: 'Ferragens', subcategory: 'Corrediças' },
    { id: 'p2', code: '3000', description: 'Perfil', category: 'Perfis', subcategory: '' }
  ]
});
assert.equal(legacy.migratedFromVersion, 1);
assert.equal(legacy.snapshot.schemaVersion, 2);
assert.equal(legacy.snapshot.revision, 7);
assert.equal(legacy.snapshot.folders.length, 3);
assert.ok(legacy.snapshot.products.every(product => product.folderId));

const v2 = ProductSnapshot.read({
  schemaVersion: 2,
  revision: 8,
  updatedAt: '2026-08-30T12:10:00.000Z',
  writeId: 'v2-write',
  folders: [
    { id: 'a', parentId: null, name: 'Ferragens' },
    { id: 'b', parentId: 'a', name: 'Corrediças' },
    { id: 'c', parentId: 'b', name: 'Telescópicas' }
  ],
  products: [
    { id: 'p1', code: '1265', description: 'Corrediça', folderId: 'c', category: 'stale', subcategory: 'stale' }
  ]
});
assert.equal(v2.migratedFromVersion, null);
assert.equal(v2.snapshot.products[0].category, 'Ferragens');
assert.equal(v2.snapshot.products[0].subcategory, 'Corrediças / Telescópicas');
assert.equal(v2.snapshot.products[0].folderId, 'c');

assert.throws(() => ProductSnapshot.read({
  schemaVersion: 2,
  folders: [{ id: 'a', parentId: null, name: 'Ferragens' }],
  products: [{ id: 'p', folderId: 'missing' }]
}), error => error?.code === 'product_folder_invalid');

assert.throws(() => ProductSnapshot.read({
  schemaVersion: 2,
  folders: [{ id: 'a', parentId: null, name: 'Ferragens' }],
  products: [
    { id: 'p1', code: 'ABC', description: 'Um', folderId: 'a' },
    { id: 'p2', code: ' abc ', description: 'Dois', folderId: 'a' }
  ]
}), error => error?.code === 'product_code_duplicate', 'snapshot v2 deve bloquear códigos equivalentes');

assert.throws(() => ProductSnapshot.read({ schemaVersion: 3, products: [] }), error => error?.code === 'product_snapshot_version');

let sequence = 0;
const assigned = ProductSnapshot.assignLegacyProduct(
  [{ id: 'ferragens', parentId: null, name: 'Ferragens' }],
  { id: 'p3', code: '1266', description: 'Nova', category: 'ferragens', subcategory: 'Telescópicas' },
  { idFactory: () => `folder-new-${++sequence}` }
);
assert.equal(assigned.folders.length, 2);
assert.equal(assigned.product.folderId, 'folder-new-1');
assert.equal(assigned.product.category, 'Ferragens', 'display existente deve prevalecer sobre variação de caixa da UI legada');
assert.equal(assigned.product.subcategory, 'Telescópicas');
assert.deepEqual(Array.from(FolderTree.pathOf(assigned.folders, assigned.product.folderId), folder => folder.name), ['Ferragens', 'Telescópicas']);

const reused = ProductSnapshot.assignLegacyProduct(
  assigned.folders,
  { id: 'p4', category: 'FERRAGENS', subcategory: 'telescopicas' },
  { idFactory: () => { throw new Error('não deveria criar pasta'); } }
);
assert.equal(reused.product.folderId, assigned.product.folderId);
assert.equal(reused.folders.length, assigned.folders.length);

let pathSequence = 0;
const deepAssigned = ProductSnapshot.assignPathProduct(
  assigned.folders,
  { id: 'p5', code: 'DEEP', description: 'Profunda' },
  ['Ferragens', 'Corrediças', 'Telescópicas', 'Premium'],
  { idFactory: () => `path-folder-${++pathSequence}` }
);
assert.deepEqual(
  Array.from(FolderTree.pathOf(deepAssigned.folders, deepAssigned.product.folderId), folder => folder.name),
  ['Ferragens', 'Corrediças', 'Telescópicas', 'Premium'],
  'atribuição V2 explícita deve preservar todos os segmentos do caminho'
);
assert.equal(deepAssigned.product.category, 'Ferragens');
assert.equal(deepAssigned.product.subcategory, 'Corrediças / Telescópicas / Premium');
assert.deepEqual(
  Array.from(ProductSnapshot.resolveLegacyPath([], { category: 'Ferragens', subcategory: 'Corrediças / Telescópicas' }, { idFactory: () => `legacy-${++pathSequence}` }).folders).map(folder => folder.name),
  ['Ferragens', 'Corrediças / Telescópicas'],
  'adaptador legado continua tratando subcategory histórica como um único segmento'
);
assert.throws(() => ProductSnapshot.assignPathProduct([], { id: 'x' }, ['Ferragens', ''], { idFactory: () => 'x' }), error => error?.code === 'folder_path_invalid');

const write = ProductSnapshot.forWrite({
  revision: 9,
  folders: assigned.folders,
  products: [assigned.product]
});
assert.equal(write.schemaVersion, 2);
assert.equal(write.products[0].folderId, 'folder-new-1');

assert.throws(() => ProductSnapshot.assignLegacyProduct([], { category: 'Ferragens' }), error => error?.code === 'folder_id_factory_required');

console.log('PASS product snapshot fixture: v1 migration, v2 folder/code authority, explicit deep path assignment and fail-closed references');
