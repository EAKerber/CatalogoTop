import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const files = {
  storage: await readFile('netlify/lib/storage.mts', 'utf8'),
  products: await readFile('netlify/functions/products.mts', 'utf8'),
  session: await readFile('netlify/functions/write-session.mts', 'utf8'),
  assets: await readFile('netlify/functions/assets.mts', 'utf8'),
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
  ['snapshot anterior entra em history', files.products.includes('history/${String(current.revision)')],
  ['concorrência preserva candidato conflitante', files.products.includes('concurrent_write') && files.products.includes('conflicts/${Date.now()}')],
  ['sessão usa cookie HttpOnly Secure Strict', files.storage.includes('HttpOnly; Secure; SameSite=Strict')],
  ['frase é verificada por scrypt e timing-safe', files.storage.includes('ACCESS_PHRASE_SCRYPT') && files.storage.includes('scryptSync') && files.storage.includes('timingSafeEqual')],
  ['sessão é token aleatório guardado no Blob store', files.storage.includes('randomBytes(32)') && files.storage.includes('SESSION_STORE') && files.storage.includes('sessionKey(token)')],
  ['sessão pode ser consultada sem nova frase', files.session.includes("request.method === 'GET'") && files.session.includes('writable: await hasWriteSession(request)')],
  ['sessão não depende de env secret', !files.storage.includes('CATALOGOTOP_SESSION_SECRET') && !files.storage.includes('CATALOGOTOP_WRITE_PASSWORD_SCRYPT')],
  ['assets são content-addressed por sha256', files.assets.includes("createHash('sha256')") && files.assets.includes('sha256/${hash}')],
  ['assets exigem sessão só para POST', files.assets.includes("request.method === 'GET'") && files.assets.includes('if (!await hasWriteSession(request))')],
  ['browser reduz imagem antes do upload', files.assetClient.includes('MAX_EDGE = 1800') && files.assetClient.includes('canvas.toBlob')],
  ['data URLs são materializados antes de persistir', files.assetClient.includes('materializeProducts') && files.assetClient.includes('isDataUrl')],
  ['imageGallery usa o mesmo pipeline content-addressed', files.assetClient.includes('product.imageGallery') && files.assetClient.includes('entry.image = await materializeImageValue(entry.image)') && files.storage.includes('validImageGallery')],
  ['cache local usa IndexedDB', files.cache.includes('indexedDB.open') && files.cache.includes('products-current')],
  ['base remota vazia não publica local automaticamente', files.client.includes('migrationNeeded = true') && files.client.includes('Local · publicar')],
  ['alteração pendente é preservada no cache', files.client.includes('pendingWrite: true')],
  ['conflito não sobrescreve silenciosamente', files.client.includes('Conflito de revisão') && files.client.includes('reloadRemote')],
  ['estado de sincronização aparece no shell', files.html.includes('id="productSyncStatus"')],
  ['clientes de storage carregam antes do app', files.html.indexOf('src/product-store.js') < files.html.indexOf('src/app.js')]
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  failed.forEach(([name]) => console.error(`FAIL ${name}`));
  process.exit(1);
}
checks.forEach(([name]) => console.log(`PASS ${name}`));
