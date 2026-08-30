import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadModules() {
  const context = vm.createContext({ window: {}, console, TextEncoder });
  vm.runInContext(fs.readFileSync(new URL('../src/folder-tree.js', import.meta.url), 'utf8'), context, { filename: 'src/folder-tree.js' });
  vm.runInContext(fs.readFileSync(new URL('../src/product-folder-migration.js', import.meta.url), 'utf8'), context, { filename: 'src/product-folder-migration.js' });
  return context.window.CatalogoTop;
}

const { FolderTree, ProductFolderMigration: Migration } = loadModules();

const products = [
  { id: 'p1', code: '1265', description: 'Corrediça 250 mm', category: 'Ferragens', subcategory: 'Corrediças' },
  { id: 'p2', code: '2001', description: 'Dobradiça', category: 'Ferragens', subcategory: 'Dobradiças' },
  { id: 'p3', code: '3001', description: 'Perfil', category: 'Perfis', subcategory: '' },
  { id: 'p4', code: '9999', description: 'Sem pasta', category: '   ', subcategory: '' },
  { id: 'p5', code: '1266', description: 'Mesmo ramo', category: 'FERRAGENS', subcategory: 'corredicas' }
];

const first = Migration.migrateLegacyProducts(products);
const second = Migration.migrateLegacyProducts(products);
assert.equal(first.migrationNamespace, 'product-folders-v1');
assert.deepEqual(JSON.parse(JSON.stringify(first)), JSON.parse(JSON.stringify(second)));

const byCode = new Map(first.products.map(product => [product.code, product]));
assert.equal(byCode.get('1265').folderId, byCode.get('1266').folderId, 'equivalência case/accent-insensitive deve convergir para a mesma pasta');
assert.equal(byCode.get('9999').category, 'Sem categoria');
assert.equal(byCode.get('9999').subcategory, '');

const ferragens = first.folders.find(folder => folder.name === 'Ferragens');
assert.ok(ferragens);
const corredicas = first.folders.find(folder => folder.parentId === ferragens.id && FolderTree.nameKey(folder.name) === 'corredicas');
assert.ok(corredicas);
assert.equal(corredicas.id, 'pf1-b9b77c1406a3b08afe949456a211e1bb', 'golden ID deve travar o algoritmo product-folders-v1');
assert.equal(byCode.get('1265').folderId, corredicas.id);
assert.deepEqual(Array.from(FolderTree.pathOf(first.folders, corredicas.id), folder => folder.name), ['Ferragens', 'Corrediças']);

const reversed = Migration.migrateLegacyProducts(products.slice().reverse());
const reversedByCode = new Map(reversed.products.map(product => [product.code, product]));
for (const product of first.products) {
  assert.equal(reversedByCode.get(product.code).folderId, product.folderId, `folderId deve ser independente da ordem para ${product.code}`);
}
assert.deepEqual(
  reversed.folders.map(folder => folder.id),
  first.folders.map(folder => folder.id),
  'ordem serializada dos folderIds deve depender apenas das chaves canônicas, não da ordem de produtos'
);

const deepFolders = FolderTree.normalize([
  { id: 'a', parentId: null, name: 'Ferragens' },
  { id: 'b', parentId: 'a', name: 'Corrediças' },
  { id: 'c', parentId: 'b', name: 'Telescópicas' }
]);
assert.deepEqual(
  JSON.parse(JSON.stringify(Migration.projectLegacyForFolder(deepFolders, 'c'))),
  { category: 'Ferragens', subcategory: 'Corrediças / Telescópicas' }
);
assert.deepEqual(
  Array.from(Migration.legacyPathFromProduct({ category: 'Ferragens', subcategory: 'Corrediças / Telescópicas' })),
  ['Ferragens', 'Corrediças', 'Telescópicas'],
  'projeção profunda deve voltar aos mesmos segmentos quando reutilizada pelo adaptador legado'
);
assert.deepEqual(
  Array.from(Migration.legacyPathFromProduct({ category: 'Ferragens', subcategory: 'Corrediças/especiais' })),
  ['Ferragens', 'Corrediças/especiais'],
  'barra sem o delimitador editorial " / " continua pertencendo ao nome legado'
);

const projected = Migration.applyLegacyProjection({ id: 'p', folderId: 'c', category: 'velho', subcategory: 'velho' }, deepFolders);
assert.equal(projected.category, 'Ferragens');
assert.equal(projected.subcategory, 'Corrediças / Telescópicas');
assert.equal(projected.id, 'p');
assert.equal(projected.folderId, 'c');

assert.match(Migration.deterministicFolderId(['ferragens']), /^pf1-[0-9a-f]{32}$/);
assert.equal(Migration.deterministicFolderId(['ferragens']), Migration.deterministicFolderId(['ferragens']));
assert.notEqual(Migration.deterministicFolderId(['ferragens']), Migration.deterministicFolderId(['perfis']));

console.log('PASS product folder migration fixture: deterministic IDs, stable ordering and deep legacy projection round-trip');
