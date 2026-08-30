import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const files = {
  storage: await readFile('netlify/lib/storage.mts', 'utf8'),
  productFolders: await readFile('netlify/lib/product-folders.mts', 'utf8'),
  products: await readFile('netlify/functions/products.mts', 'utf8'),
  session: await readFile('netlify/functions/write-session.mts', 'utf8'),
  assets: await readFile('netlify/functions/assets.mts', 'utf8'),
  remoteSource: await readFile('netlify/lib/remote-product-source.mts', 'utf8'),
  client: await readFile('src/product-store.js', 'utf8'),
  assetClient: await readFile('src/asset-client.js', 'utf8'),
  cache: await readFile('src/indexed-cache.js', 'utf8'),
  html: await readFile('index.html', 'utf8')
};

for (const file of ['src/product-store.js', 'src/asset-client.js', 'src/indexed-cache.js']) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `Falha de sintaxe em ${file}\n`);
    process.exit(result.status || 1);
  }
}

const getBranch = files.products.indexOf("if (request.method === 'GET')");
const putBranch = files.products.indexOf("if (request.method !== 'PUT')");
const writeGuard = files.products.indexOf('if (!await hasWriteSession(request))');

const checks = [
  ['produção usa store global forte', files.storage.includes("getStore(PRODUCT_STORE, { consistency: 'strong' })")],
  ['preview usa deploy stores isolados com consistência forte', files.storage.includes("getDeployStore({ name, consistency: 'strong' })") && files.storage.includes('deployStore(PRODUCT_STORE)') && files.storage.includes('deployStore(ASSET_STORE)') && files.storage.includes('deployStore(SESSION_STORE)')],
  ['GET de produtos é público', getBranch >= 0 && putBranch > getBranch && writeGuard > putBranch],
  ['PUT exige sessão de escrita assíncrona', files.products.includes("request.method !== 'PUT'") && files.products.includes('if (!await hasWriteSession(request))')],
  ['PUT exige expectedRevision', files.products.includes('expectedRevision') && files.products.includes('revision_conflict')],
  ['PUT publica ProductSnapshot v2 com folders', files.products.includes('PRODUCT_SNAPSHOT_VERSION') && files.products.includes('folders: body.folders || []') && files.products.includes('validateProductSnapshot(body.folders, body.products)')],
  ['backend valida hierarquia e mirrors de folderId', files.storage.includes('validateProductFolders') && files.productFolders.includes('folderId inexistente') && files.productFolders.includes('divergentes de folderId') && files.productFolders.includes('duplicado entre irmãos')],
  ['snapshot anterior entra em history', files.products.includes('history/${String(current.revision)')],
  ['concorrência preserva candidato conflitante', files.products.includes('concurrent_write') && files.products.includes('conflicts/${Date.now()}')],
  ['sessão usa cookie HttpOnly Secure Strict', files.storage.includes('HttpOnly; Secure; SameSite=Strict')],
  ['frase é verificada por scrypt e timing-safe', files.storage.includes('ACCESS_PHRASE_SCRYPT') && files.storage.includes('scryptSync') && files.storage.includes('timingSafeEqual')],
  ['sessão é token aleatório guardado no Blob store', files.storage.includes('randomBytes(32)') && files.storage.includes('SESSION_STORE') && files.storage.includes('sessionKey(token)')],
  ['sessão pode ser consultada sem nova frase', files.session.includes("request.method === 'GET'") && files.session.includes('writable: await hasWriteSession(request)')],
  ['sessão não depende de env secret', !files.storage.includes('CATALOGOTOP_SESSION_SECRET') && !files.storage.includes('CATALOGOTOP_WRITE_PASSWORD_SCRYPT')],
  ['assets são content-addressed por sha256', files.assets.includes("createHash('sha256')") && files.assets.includes('sha256/${hash}')],
  ['assets exigem sessão para qualquer escrita', files.assets.includes("request.method === 'GET'") && files.assets.includes('materialize-product-source') && files.assets.match(/hasWriteSession\(request\)/g)?.length >= 2],
  ['materialização remota é autorizada pelo ProductStore antes do fetch', files.assets.includes('currentSnapshot') && files.assets.includes('authorizedSource !== sourceRef') && files.assets.indexOf('source_authority_changed') < files.assets.indexOf('const remote = await fetchRemoteProductSource')],
  ['materializador remoto restringe rede e bytes', files.remoteSource.includes("url.protocol !== 'https:'") && files.remoteSource.includes('remote-source-address-blocked') && files.remoteSource.includes("redirect: 'manual'") && files.remoteSource.includes('readLimitedBody')],
  ['browser reduz imagem antes do upload', files.assetClient.includes('MAX_EDGE = 1800') && files.assetClient.includes('canvas.toBlob')],
  ['data URLs são materializados antes de persistir', files.assetClient.includes('materializeProducts') && files.assetClient.includes('isDataUrl')],
  ['fonte remota autorizada pode virar asset gerenciado sem reescrever produto', files.assetClient.includes('materializeProductSource') && files.assetClient.includes('/api/assets/materialize-product-source') && !files.assetClient.includes('product.image = await materializeProductSource')],
  ['imageGallery usa o mesmo pipeline content-addressed', files.assetClient.includes('product.imageGallery') && files.assetClient.includes('entry.image = await materializeImageValue(entry.image)') && files.storage.includes('validImageGallery')],
  ['cache local usa IndexedDB', files.cache.includes('indexedDB.open') && files.cache.includes('products-current')],
  ['ProductStore publica folders e products no mesmo expectedRevision', files.client.includes('putSnapshot(localFolders, materialized)') && files.client.includes('folders: candidate.folders') && files.client.includes('products: candidate.products')],
  ['ProductStore lê snapshots v1/v2 pela autoridade ProductSnapshot', files.client.includes('ProductSnapshot.read(raw)') && files.client.includes('snapshotMigrationPending')],
  ['base remota vazia não publica local automaticamente', files.client.includes('migrationNeeded = true') && files.client.includes('Local · publicar')],
  ['alteração pendente é preservada no cache', files.client.includes('pendingWrite: true')],
  ['conflito não sobrescreve silenciosamente', files.client.includes('Conflito de revisão') && files.client.includes('reloadRemote')],
  ['estado de sincronização aparece no shell', files.html.includes('id="productSyncStatus"')],
  ['contratos de folder/snapshot carregam antes do Core', files.html.indexOf('src/folder-tree.js') < files.html.indexOf('src/product-folder-migration.js') && files.html.indexOf('src/product-folder-migration.js') < files.html.indexOf('src/product-snapshot.js') && files.html.indexOf('src/product-snapshot.js') < files.html.indexOf('src/core.js')],
  ['clientes de storage carregam antes do app', files.html.indexOf('src/product-store.js') < files.html.indexOf('src/app.js')]
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  failed.forEach(([name]) => console.error(`FAIL ${name}`));
  process.exit(1);
}
checks.forEach(([name]) => console.log(`PASS ${name}`));
