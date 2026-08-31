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
vm.runInNewContext(await readFile('src/asset-usage.js', 'utf8'), context, { filename: 'src/asset-usage.js' });

const { AssetIndexSnapshot, AssetUsage } = context.window.CatalogoTop;
const fail = message => { throw new Error(message); };
const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const C = 'c'.repeat(64);
const remote = 'https://example.com/not-managed.png';

const snapshot = AssetIndexSnapshot.forWrite({
  revision: 7,
  folders: [],
  assets: [
    { id: `sha256/${A}`, sha256: A, folderId: null, label: 'Imagem A', contentType: 'image/webp', bytes: 1200, createdAt: '2026-08-31T00:00:00.000Z', updatedAt: '2026-08-31T00:00:00.000Z' },
    { id: `sha256/${C}`, sha256: C, folderId: null, label: 'Sem uso', contentType: 'image/png', bytes: 900, createdAt: '', updatedAt: '' }
  ]
});
if (snapshot.revision !== 7 || snapshot.assets.length !== 2) fail('snapshot base inválido');
if (AssetIndexSnapshot.hashFrom(`/api/assets/sha256/${A}`) !== A) fail('managed URL não resolveu hash');
if (AssetIndexSnapshot.idFrom(A) !== `sha256/${A}` || AssetIndexSnapshot.urlFrom(`sha256/${A}`) !== `/api/assets/sha256/${A}`) fail('conversão hash/id/url inválida');
if (AssetIndexSnapshot.hashFrom(remote)) fail('URL remota não pode virar asset gerenciado');

let duplicateFailed = false;
try { AssetIndexSnapshot.forWrite({ assets: [snapshot.assets[0], snapshot.assets[0]] }); } catch (error) { duplicateFailed = error.code === 'asset_id_duplicate'; }
if (!duplicateFailed) fail('hash duplicado precisa falhar fechado');

let mismatchFailed = false;
try { AssetIndexSnapshot.forWrite({ assets: [{ ...snapshot.assets[0], id: `sha256/${B}` }] }); } catch (error) { mismatchFailed = error.code === 'asset_id_mismatch'; }
if (!mismatchFailed) fail('id/hash divergentes precisam falhar fechado');

let folderFailed = false;
try { AssetIndexSnapshot.forWrite({ assets: [{ ...snapshot.assets[0], folderId: 'missing' }] }); } catch (error) { folderFailed = error.code === 'asset_folder_invalid'; }
if (!folderFailed) fail('folderId inexistente precisa falhar fechado');

const products = [
  { id: 'p1', code: 'P1', description: 'Produto Um', image: `/api/assets/sha256/${A}`, imageGallery: [], variants: [] },
  { id: 'p2', code: 'P2', description: 'Produto Dois', image: remote, imageGallery: [{ id: 'gallery-a', image: `/api/assets/sha256/${A}` }], variants: [{ id: 'finish-b', image: `/api/assets/sha256/${B}` }] }
];
const catalogs = [{
  id: 'catalog-1',
  catalog: { title: 'Catálogo Um', presentation: { imageVariants: { p1: [{ id: 'local-a', image: `/api/assets/sha256/${A}` }] } } }
}];
const usages = AssetUsage.collect(products, catalogs);
const usesA = usages.filter(usage => usage.sha256 === A);
if (usesA.length !== 3) fail(`A deveria ter três usos autoritativos, recebeu ${usesA.length}`);
if (usages.some(usage => usage.url === remote)) fail('URL remota entrou em usage gerenciado');
if (!usages.some(usage => usage.sha256 === B && usage.field === 'variants')) fail('uso de variant gerenciado não foi coletado');

const inventory = AssetUsage.inventory({ indexSnapshot: snapshot, products, catalogs });
const ids = new Set(inventory.map(asset => asset.id));
if (inventory.length !== 3 || !ids.has(`sha256/${A}`) || !ids.has(`sha256/${B}`) || !ids.has(`sha256/${C}`)) fail('inventory precisa ser união índice + usage');
const discoveredB = inventory.find(asset => asset.sha256 === B);
if (!discoveredB || discoveredB.indexed || discoveredB.usages.length !== 1 || !discoveredB.label.includes('Produto Dois')) fail('asset descoberto por usage inválido');
const indexedC = inventory.find(asset => asset.sha256 === C);
if (!indexedC?.indexed || indexedC.usages.length) fail('asset indexado sem uso precisa permanecer visível');

console.log('PASS asset index fixture: managed identity, fail-closed validation, authoritative usage and index-union inventory');
