import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const context = {
  window: { CatalogoTop: {} },
  console,
  Object, Array, Map, Set, String, Number, Math, JSON, Intl
};
context.window.window = context.window;
vm.runInNewContext(await readFile('src/folder-tree.js', 'utf8'), context, { filename: 'src/folder-tree.js' });
vm.runInNewContext(await readFile('src/asset-index-snapshot.js', 'utf8'), context, { filename: 'src/asset-index-snapshot.js' });
vm.runInNewContext(await readFile('src/asset-query.js', 'utf8'), context, { filename: 'src/asset-query.js' });
vm.runInNewContext(await readFile('src/asset-inventory.js', 'utf8'), context, { filename: 'src/asset-inventory.js' });

const { AssetIndexSnapshot, AssetQuery, AssetInventory } = context.window.CatalogoTop;
const fail = message => { throw new Error(message); };
const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const C = 'c'.repeat(64);
const folders = [
  { id: 'f-images', parentId: null, name: 'Produtos' },
  { id: 'f-slides', parentId: 'f-images', name: 'Corrediças' },
  { id: 'f-brand', parentId: null, name: 'Institucional' }
];
const assets = [
  { id: `sha256/${A}`, sha256: A, folderId: 'f-images', label: 'Corrediça A', contentType: 'image/webp', usages: [{ ownerLabel: 'Produto A' }] },
  { id: `sha256/${B}`, sha256: B, folderId: 'f-slides', label: 'Corrediça B', contentType: 'image/webp', usages: [] },
  { id: `sha256/${C}`, sha256: C, folderId: null, label: 'Sem pasta', contentType: 'image/png', usages: [] }
];

const recursive = AssetQuery.query({ assets, folders, folderId: 'f-images', recursive: true });
if (recursive.length !== 2 || !recursive.some(asset => asset.sha256 === B)) fail('scope recursivo de assets inválido');
const unfiled = AssetQuery.query({ assets, folders, unfiled: true });
if (unfiled.length !== 1 || unfiled[0].sha256 !== C) fail('scope Sem pasta inválido');
const used = AssetQuery.query({ assets, folders, usage: 'used' });
const unused = AssetQuery.query({ assets, folders, usage: 'unused' });
if (used.length !== 1 || used[0].sha256 !== A || unused.length !== 2) fail('filtro used/unused inválido');
if (AssetQuery.query({ assets, folders, text: 'corredicas' }).length !== 1) fail('busca por path de pasta precisa funcionar');
if (AssetQuery.query({ assets, folders, text: 'produto a' }).length !== 1) fail('busca por usage precisa funcionar');

const localSnapshot = AssetIndexSnapshot.forWrite({
  revision: 4,
  folders,
  assets: [
    { id: `sha256/${A}`, sha256: A, folderId: 'f-brand', label: 'A renomeada localmente', contentType: 'image/webp', bytes: 100, createdAt: '', updatedAt: '' },
    { id: `sha256/${C}`, sha256: C, folderId: null, label: 'Upload pendente', contentType: 'image/webp', bytes: 120, createdAt: '', updatedAt: '' }
  ]
});
const projected = AssetInventory.overlay({ assetIndexRevision: 3, assets: [assets[0]] }, localSnapshot, { pending: true });
const projectedA = projected.assets.find(asset => asset.sha256 === A);
const projectedC = projected.assets.find(asset => asset.sha256 === C);
if (projectedA.folderId !== 'f-brand' || projectedA.label !== 'A renomeada localmente') fail('metadata local não sobrepôs inventory remoto');
if (!projectedC || !projectedC.pendingIndex || projectedC.usages.length !== 0 || projectedC.available !== true) fail('asset local pending precisa aparecer sem inventar usage');
if (!projected.assetIndexPending || projected.localAssetIndexRevision !== 4) fail('observabilidade da projeção local inválida');

const storeSource = await readFile('src/asset-index-store.js', 'utf8');
for (const method of ['createFolder', 'renameFolder', 'moveFolder', 'deleteEmptyFolder', 'moveAssets', 'registerAssets']) {
  if (!storeSource.includes(`async function ${method}`)) fail(`AssetIndexStore sem ${method}`);
}
if (/ProductStore\.(?:publishCurrent|delete|remove)/.test(storeSource)) fail('AssetIndexStore não pode publicar/deletar ProductStore');
if (/CatalogStore\.(?:publish|delete|remove)/.test(storeSource)) fail('AssetIndexStore não pode publicar/deletar CatalogStore');
if (/\/api\/assets[^'"`]*.*method:\s*['"]DELETE['"]/s.test(storeSource)) fail('R3b não pode introduzir delete físico de asset');

const clientSource = await readFile('src/asset-client.js', 'utf8');
if (!clientSource.includes('async function uploadBlobDetailed') || !clientSource.includes('return (await uploadBlobDetailed(blob)).url;')) fail('upload detalhado precisa preservar contrato de uploadBlob');

console.log('PASS R3b domain fixture: recursive asset query, unfiled/usage filters, pending overlay and non-destructive store boundaries');
