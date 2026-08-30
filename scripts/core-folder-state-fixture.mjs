import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const storage = new Map();
let uuidCounter = 0;
const context = vm.createContext({
  console,
  TextEncoder,
  Intl,
  Date,
  JSON,
  Math,
  structuredClone,
  localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value))
  }
});
context.window = context;
context.window.crypto = { randomUUID: () => `uuid-${++uuidCounter}` };
context.window.CatalogoTop = {
  Composition: {
    normalizePresentation(value = {}) {
      return {
        distribution: value.distribution || 'balanced',
        typography: value.typography || 'neutral',
        order: Array.isArray(value.order) ? value.order.slice() : [],
        itemStyles: value.itemStyles && typeof value.itemStyles === 'object' ? { ...value.itemStyles } : {},
        blocks: Array.isArray(value.blocks) ? value.blocks.slice() : [],
        imageFrames: value.imageFrames && typeof value.imageFrames === 'object' ? { ...value.imageFrames } : {},
        imageSelections: value.imageSelections && typeof value.imageSelections === 'object' ? { ...value.imageSelections } : {},
        imageVariants: value.imageVariants && typeof value.imageVariants === 'object' ? { ...value.imageVariants } : {}
      };
    }
  }
};

for (const file of ['folder-tree.js', 'product-folder-migration.js', 'product-snapshot.js', 'core.js']) {
  vm.runInContext(fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'), context, { filename: `src/${file}` });
}

const { Core, FolderTree } = context.window.CatalogoTop;
assert.equal(Core.SCHEMA_VERSION, 8);
assert.deepEqual(Array.from(Core.createInitialState().folders), []);

const legacy = Core.migrate({
  schemaVersion: 7,
  products: [
    { id: 'p1', code: '1265', description: 'Corrediça', category: 'Ferragens', subcategory: 'Corrediças' }
  ],
  selectedIds: ['p1'],
  catalog: { title: 'Teste', presentation: { order: ['p1'] } }
});
assert.equal(legacy.schemaVersion, 8);
assert.equal(legacy.products.length, 1);
assert.ok(legacy.products[0].folderId);
assert.deepEqual(Array.from(FolderTree.pathOf(legacy.folders, legacy.products[0].folderId), item => item.name), ['Ferragens', 'Corrediças']);

Core.setState(legacy);
Core.mutate(draft => {
  const product = Core.assignProductToLegacyPath(draft, {
    id: 'p2', code: '1266', description: 'Nova', category: 'Ferragens', subcategory: 'Telescópicas'
  });
  draft.products.push(product);
});
const afterCreate = Core.getState();
const newProduct = afterCreate.products.find(product => product.id === 'p2');
assert.ok(newProduct.folderId);
assert.deepEqual(Array.from(FolderTree.pathOf(afterCreate.folders, newProduct.folderId), item => item.name), ['Ferragens', 'Telescópicas']);

const preservedEmpty = { id: 'folder-empty', parentId: null, name: 'Planejada' };
Core.setState({
  ...afterCreate,
  schemaVersion: 8,
  folders: afterCreate.folders.concat([preservedEmpty])
});
Core.mergeProducts([
  { id: 'incoming', code: '9000', description: 'Importado', category: 'Perfis', subcategory: 'Sobrepor' }
], 'replace');
const afterReplace = Core.getState();
assert.equal(afterReplace.products.length, 1);
assert.equal(afterReplace.folders.some(folder => folder.id === 'folder-empty'), true, 'replace de produtos deve preservar pastas explícitas');
assert.deepEqual(Array.from(FolderTree.pathOf(afterReplace.folders, afterReplace.products[0].folderId), item => item.name), ['Perfis', 'Sobrepor']);

const session = JSON.parse(storage.get(Core.STORAGE_KEY));
assert.deepEqual(session.products, []);
assert.deepEqual(session.folders, []);
assert.equal(session.schemaVersion, 8);

const backupRoundTrip = Core.migrate(JSON.parse(JSON.stringify(afterReplace)));
assert.deepEqual(JSON.parse(JSON.stringify(backupRoundTrip.folders)), JSON.parse(JSON.stringify(afterReplace.folders)));
assert.equal(backupRoundTrip.products[0].folderId, afterReplace.products[0].folderId);

console.log('PASS core folder-state fixture: schema 8, legacy migration, explicit legacy adapter, replace preservation and backup round-trip');
