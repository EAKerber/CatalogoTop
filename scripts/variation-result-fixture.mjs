import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';

const storage = new Map();
const events = [];
const context = {
  window: { CatalogoTop: {}, crypto: webcrypto, dispatchEvent(event) { events.push(event.type); } },
  crypto: webcrypto,
  localStorage: {
    getItem(key) { return storage.get(key) || null; },
    setItem(key, value) { storage.set(key, String(value)); }
  },
  TextEncoder,
  TextDecoder,
  Uint8Array,
  Uint32Array,
  ArrayBuffer,
  DataView,
  Blob,
  AbortController,
  structuredClone,
  CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
  Intl,
  Date,
  Object,
  Array,
  String,
  Number,
  Math,
  JSON,
  Map,
  Set,
  console
};
context.window.window = context.window;
context.window.localStorage = context.localStorage;
context.window.CustomEvent = context.CustomEvent;
context.window.structuredClone = structuredClone;

vm.runInNewContext(await readFile('src/composition.js', 'utf8'), context, { filename: 'src/composition.js' });
vm.runInNewContext(await readFile('src/core.js', 'utf8'), context, { filename: 'src/core.js' });
vm.runInNewContext(await readFile('src/zip-store.js', 'utf8'), context, { filename: 'src/zip-store.js' });
vm.runInNewContext(await readFile('src/zip-reader.js', 'utf8'), context, { filename: 'src/zip-reader.js' });

const NS = context.window.CatalogoTop;
async function sha256(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  const digest = await webcrypto.subtle.digest('SHA-256', bytes);
  return Buffer.from(digest).toString('hex');
}
NS.VariationBundle = {
  ALLOWED_TRANSFORMS: ['upscale', 'focus-reframe', 'artifact-cleanup'],
  sha256
};
vm.runInNewContext(await readFile('src/variation-result.js', 'utf8'), context, { filename: 'src/variation-result.js' });

const { Core, ZipStore, VariationResult } = NS;
const fail = message => { throw new Error(message); };
const requestId = 'a'.repeat(64);
const job = {
  jobId: `job-${'b'.repeat(20)}`,
  usageSignature: 'c'.repeat(64),
  productId: 'p1',
  placementKey: 'card:p1',
  source: { sha256: 'd'.repeat(64) }
};
const secondJob = {
  jobId: `job-${'e'.repeat(20)}`,
  usageSignature: 'f'.repeat(64),
  productId: 'p2',
  placementKey: 'card:p2',
  source: { sha256: '1'.repeat(64) }
};
const currentRequest = { requestId, manifest: { jobs: [job, secondJob] } };

Core.setState({
  schemaVersion: 7,
  products: [
    {
      id: 'p1', code: 'P1', description: 'Produto 1', category: 'Teste', subcategory: '', price: 'R$ 10,00', status: 'Ativo', notes: '',
      image: '/original.webp', imageGallery: [{ id: 'manual', label: 'Manual', image: '/manual.webp', provenance: { kind: 'manual' } }],
      specs: [], variants: [], tableRows: [], updatedAt: '2026-08-29T00:00:00.000Z'
    },
    {
      id: 'p2', code: 'P2', description: 'Produto 2', category: 'Teste', subcategory: '', price: 'R$ 20,00', status: 'Ativo', notes: '',
      image: '/p2.webp', imageGallery: [], specs: [], variants: [], tableRows: [], updatedAt: '2026-08-29T00:00:00.000Z'
    }
  ],
  selectedIds: ['p1', 'p2'],
  catalog: { title: 'Resultado', templateId: 'technical', showPrices: true, presentation: { imageSelections: {}, imageVariants: {} } }
}, { persist: false });

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6]);
const pngHash = await sha256(png);
const assetPath = 'results/p1-main.png';

function manifest(overrides = {}) {
  return {
    kind: VariationResult.RESULT_KIND,
    version: VariationResult.RESULT_VERSION,
    requestId,
    generatedAt: '2026-08-29T15:00:00.000Z',
    generator: 'fixture-agent',
    variants: [{
      resultId: 'p1-clean',
      jobId: job.jobId,
      usageSignature: job.usageSignature,
      productId: job.productId,
      placementKey: job.placementKey,
      label: 'Fundo limpo',
      generator: 'fixture-agent',
      transforms: ['focus-reframe', 'artifact-cleanup'],
      asset: { path: assetPath, mimeType: 'image/png', sha256: pngHash },
      ...(overrides.variant || {})
    }],
    ...overrides.root
  };
}

async function packageFor(rawManifest, extraEntries = []) {
  const archive = await ZipStore.create([
    { path: 'manifest.json', data: `${JSON.stringify(rawManifest)}\n` },
    { path: assetPath, data: png },
    ...extraEntries
  ]);
  return VariationResult.readPackage(archive.bytes);
}

const packageData = await packageFor(manifest(), [{ path: 'notes/info.txt', data: 'ignored' }]);
const validated = await VariationResult.validatePackage(packageData, currentRequest);
if (validated.assets.length !== 1 || validated.matchedJobCount !== 1 || validated.missingJobs.length !== 1) fail(`validação válida inesperada: ${JSON.stringify(validated)}`);
if (validated.ignoredFiles.join(',') !== 'notes/info.txt') fail(`arquivo extra não foi reportado como ignorado: ${validated.ignoredFiles}`);

let prepareCalls = 0;
const prepared = await VariationResult.prepareValidated(validated, async blob => {
  prepareCalls += 1;
  if (blob.type !== 'image/png') fail(`prepare recebeu MIME errado: ${blob.type}`);
  return new Blob([await blob.arrayBuffer()], { type: 'image/webp' });
});
if (prepareCalls !== 1 || prepared.prepared[0].blob.type !== 'image/webp') fail('prepareValidated não preparou exatamente um asset');

let uploadCalls = 0;
const uploaded = await VariationResult.uploadPrepared(prepared, async blob => {
  uploadCalls += 1;
  if (blob.type !== 'image/webp') fail(`upload recebeu MIME inesperado: ${blob.type}`);
  return `/api/assets/sha256/${'9'.repeat(64)}`;
});
if (uploadCalls !== 1) fail('uploadPrepared deveria fazer um upload');

const before = structuredClone(Core.getState());
const committed = VariationResult.commitUploaded(uploaded);
const after = Core.getState();
if (committed.imported !== 1 || committed.duplicates !== 0) fail(`commit válido inesperado: ${JSON.stringify(committed)}`);
if (after.products[0].image !== before.products[0].image || JSON.stringify(after.products[0].imageGallery) !== JSON.stringify(before.products[0].imageGallery)) fail('import não pode tocar Original/imageGallery');
if (Object.keys(after.catalog.presentation.imageSelections || {}).length) fail('import não deve auto-selecionar a derivada');
const local = after.catalog.presentation.imageVariants?.p1?.[0];
if (!local || local.image !== `/api/assets/sha256/${'9'.repeat(64)}` || local.provenance?.kind !== 'external-variation') fail(`derivada local não foi materializada: ${JSON.stringify(local)}`);
if (local.provenance.requestId !== requestId || local.provenance.jobId !== job.jobId || local.provenance.placementKey !== job.placementKey || local.provenance.resultSha256 !== pngHash) fail('proveniência importada incompleta');
if (!events.includes('catalogotop:products-updated')) fail('commit deveria notificar renderer sem publicar ProductStore');

const repeated = VariationResult.commitUploaded(uploaded);
if (repeated.imported !== 0 || repeated.duplicates !== 1 || Core.getState().catalog.presentation.imageVariants.p1.length !== 1) fail('reimport idêntico deve ser idempotente');

let rejected = false;
try { await VariationResult.validatePackage(await packageFor(manifest({ root: { requestId: '2'.repeat(64) } })), currentRequest); }
catch (error) { rejected = error.code === 'result_request_stale'; }
if (!rejected) fail('requestId divergente deve invalidar pacote inteiro');

rejected = false;
try { await VariationResult.validatePackage(await packageFor(manifest({ variant: { usageSignature: '3'.repeat(64) } })), currentRequest); }
catch (error) { rejected = error.code === 'result_job_mismatch'; }
if (!rejected) fail('usageSignature divergente deve invalidar pacote inteiro');

rejected = false;
try { await VariationResult.validatePackage(await packageFor(manifest({ variant: { asset: { path: assetPath, mimeType: 'image/jpeg', sha256: pngHash } } })), currentRequest); }
catch (error) { rejected = error.code === 'result_asset_mime_mismatch'; }
if (!rejected) fail('MIME declarado incompatível com bytes deve falhar');

rejected = false;
try { await VariationResult.validatePackage(await packageFor(manifest({ variant: { asset: { path: assetPath, mimeType: 'image/png', sha256: '4'.repeat(64) } } })), currentRequest); }
catch (error) { rejected = error.code === 'result_asset_hash_mismatch'; }
if (!rejected) fail('SHA-256 divergente deve falhar');

rejected = false;
try { await packageFor(manifest({ variant: { transforms: ['invent-product'] } })); }
catch (error) { rejected = error.code === 'result_transform_not_allowed'; }
if (!rejected) fail('transformação não permitida deve falhar ainda no parse do manifest');

console.log('PASS variation result fixture: request/signature, MIME/hash, stage/upload, commit local, Original e idempotência');
