import { readFile } from 'node:fs/promises';

const [store, cache, storage, assetIndexFn, inventoryFn, indexHtml] = await Promise.all([
  readFile('src/asset-index-store.js', 'utf8'),
  readFile('src/indexed-cache.js', 'utf8'),
  readFile('netlify/lib/storage.mts', 'utf8'),
  readFile('netlify/functions/asset-index.mts', 'utf8'),
  readFile('netlify/functions/asset-inventory.mts', 'utf8'),
  readFile('index.html', 'utf8')
]);
const fail = message => { throw new Error(message); };

if (!store.includes("fetch('/api/asset-index'") || !store.includes('expectedRevision: revision')) fail('AssetIndexStore precisa usar endpoint/revisão próprios');
if (!store.includes('setLabel') || !store.includes('AssetIndexSnapshot.fromManaged')) fail('AssetIndexStore precisa expor mutação de label por managed identity');
if (store.includes('ProductStore.publishCurrent') || store.includes('CatalogStore')) fail('AssetIndexStore não pode publicar ProductStore/CatalogStore');
if (/\.delete\s*\(/.test(store)) fail('R3a não pode introduzir delete no AssetIndexStore');
if (!cache.includes("const ASSET_INDEX_KEY = 'asset-index-current'")) fail('cache do índice precisa de key separada');
if (!storage.includes("ASSET_INDEX_STORE = 'catalogotop-asset-index'")) fail('backend precisa de Blob store separado para índice');
if (!storage.includes('assetIndexStore()') || !storage.includes('currentAssetIndexSnapshot')) fail('storage precisa expor authority do índice');
if (!assetIndexFn.includes("path: '/api/asset-index'") || !assetIndexFn.includes('history/') || !assetIndexFn.includes('revision_conflict')) fail('endpoint de índice precisa preservar expectedRevision/history/readback');
if (!inventoryFn.includes('currentSnapshot()') || !inventoryFn.includes('currentCatalogSnapshot()') || !inventoryFn.includes('currentAssetIndexSnapshot()')) fail('inventory precisa derivar das três authorities persistidas');
if (inventoryFn.includes('Core.getState') || inventoryFn.includes("method === 'POST'") || inventoryFn.includes("method === 'DELETE'")) fail('inventory deve ser read-only e não derivar do Core');
if (!indexHtml.includes('data-library-provider="images"') || !indexHtml.includes('src/asset-index-snapshot.js') || !indexHtml.includes('src/asset-index-store.js') || !indexHtml.includes('src/asset-library.js')) fail('bootstrap de Asset Library precisa ser explícito no index.html');
if (!indexHtml.includes('id="btnChooseAssetLibrary"')) fail('Cadastro precisa expor reuso da Biblioteca');

console.log('PASS asset index static fixture: independent authority/cache, read-only inventory, explicit bootstrap and no GC/delete');
