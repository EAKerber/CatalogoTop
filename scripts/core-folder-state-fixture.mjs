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

for (const file of ['folder-tree.js', 'product-folder-migration.js', 'product-domain.js', 'product-snapshot.js', 'core.js']) {
  vm.runInContext(fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'), context, { filename: `src/${file}` });
}

const { Core, FolderTree } = context.window.CatalogoTop;
assert.equal(Core.SCHEMA_VERSION, 9);
assert.deepEqual(Array.from(Core.createInitialState().folders), []);
assert.equal(Core.createInitialState().catalog.templateVersion, 1, 'sessão nova deve vincular explicitamente technical@1');

const legacy = Core.migrate({
  schemaVersion: 7,
  products: [
    { id: 'p1', code: '1265', description: 'Corrediça', category: 'Ferragens', subcategory: 'Corrediças' }
  ],
  selectedIds: ['p1'],
  catalog: { title: 'Teste', presentation: { order: ['p1'] } }
});
assert.equal(legacy.schemaVersion, 9);
assert.equal(legacy.catalog.templateId, 'technical');
assert.equal(legacy.catalog.templateVersion, 1, 'catálogo legado sem versão deve migrar para v1');
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

// Merge parcial não pode achatar uma hierarquia profunda só porque a UI/import legado
// representa o restante do caminho em `subcategory` com " / ".
const deepFolders = [
  { id: 'deep-root', parentId: null, name: 'Ferragens' },
  { id: 'deep-mid', parentId: 'deep-root', name: 'Corrediças' },
  { id: 'deep-leaf', parentId: 'deep-mid', name: 'Telescópicas' }
];
Core.setState({
  ...Core.createInitialState(),
  schemaVersion: 9,
  folders: deepFolders,
  products: [{
    id: 'deep-product', code: 'DEEP', description: 'Profundo', folderId: 'deep-leaf',
    category: 'Ferragens', subcategory: 'Corrediças / Telescópicas', status: 'Ativo'
  }]
}, { persist: false });
Core.mergeProducts([{ code: 'DEEP', description: 'Profundo atualizado', price: '25' }]);
let deepState = Core.getState();
assert.equal(deepState.products[0].folderId, 'deep-leaf', 'merge sem organização deve preservar folderId profundo');
assert.equal(deepState.folders.some(folder => folder.name === 'Corrediças / Telescópicas'), false, 'merge sem organização não pode criar pasta achatada');

Core.mergeProducts([{
  code: 'DEEP', description: 'Profundo atualizado 2',
  category: 'Ferragens', subcategory: 'Corrediças / Telescópicas'
}]);
deepState = Core.getState();
assert.equal(deepState.products[0].folderId, 'deep-leaf', 'mirrors legados idênticos devem preservar folderId profundo');
assert.equal(deepState.folders.some(folder => folder.name === 'Corrediças / Telescópicas'), false, 'mirrors idênticos não podem achatar a árvore');

Core.mergeProducts([{
  code: 'DEEP', description: 'Movido explicitamente',
  category: 'Ferragens', subcategory: 'Invisíveis'
}]);
deepState = Core.getState();
assert.notEqual(deepState.products[0].folderId, 'deep-leaf', 'mudança organizacional explícita deve poder mover o produto');
assert.deepEqual(Array.from(FolderTree.pathOf(deepState.folders, deepState.products[0].folderId), item => item.name), ['Ferragens', 'Invisíveis']);

const preservedEmpty = { id: 'folder-empty', parentId: null, name: 'Planejada' };
Core.setState({
  ...afterCreate,
  schemaVersion: 9,
  folders: afterCreate.folders.concat([preservedEmpty])
});
Core.mergeProducts([
  { id: 'incoming', code: '9000', description: 'Importado', category: 'Perfis', subcategory: 'Sobrepor' }
], 'replace');
const afterReplace = Core.getState();
assert.equal(afterReplace.products.length, 1);
assert.equal(afterReplace.folders.some(folder => folder.id === 'folder-empty'), true, 'replace de produtos deve preservar pastas explícitas');
assert.deepEqual(Array.from(FolderTree.pathOf(afterReplace.folders, afterReplace.products[0].folderId), item => item.name), ['Perfis', 'Sobrepor']);

const versioned = Core.migrate({
  ...afterReplace,
  catalog: { ...afterReplace.catalog, templateId: 'technical', templateVersion: 7 }
});
assert.equal(versioned.catalog.templateVersion, 7, 'Core deve preservar versão positiva explícita sem assumir versão disponível');

const session = JSON.parse(storage.get(Core.STORAGE_KEY));
assert.deepEqual(session.products, []);
assert.deepEqual(session.folders, []);
assert.equal(session.schemaVersion, 9);
assert.equal(session.catalog.templateVersion, 1);

const backupRoundTrip = Core.migrate(JSON.parse(JSON.stringify(afterReplace)));
assert.deepEqual(JSON.parse(JSON.stringify(backupRoundTrip.folders)), JSON.parse(JSON.stringify(afterReplace.folders)));
assert.equal(backupRoundTrip.products[0].folderId, afterReplace.products[0].folderId);
assert.equal(backupRoundTrip.catalog.templateVersion, afterReplace.catalog.templateVersion);

console.log('PASS core folder-state fixture: schema 9, template binding migration, deep-merge preservation, explicit moves, replace preservation and backup round-trip');
