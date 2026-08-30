import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';

const context = {
  window: { CatalogoTop: {} },
  crypto: webcrypto,
  TextEncoder,
  Uint8Array,
  Uint32Array,
  ArrayBuffer,
  DataView,
  Blob,
  AbortController,
  setTimeout,
  clearTimeout,
  Object,
  Array,
  String,
  Number,
  Math,
  JSON,
  Map,
  Set,
  Date,
  console
};
context.window.window = context.window;
vm.runInNewContext(await readFile('src/zip-store.js', 'utf8'), context, { filename: 'src/zip-store.js' });

const NS = context.window.CatalogoTop;
NS.Composition = {
  normalizePresentation(value) {
    const source = value && typeof value === 'object' ? value : {};
    return { imageFrames: source.imageFrames || {}, imageSelections: source.imageSelections || {}, imageVariants: source.imageVariants || {} };
  }
};
NS.Collection = {
  memberStyleFor(block, productId) {
    return block?.itemStyles?.[String(productId)] || { emphasis: 'normal', width: 'simple' };
  }
};
NS.ImageVariants = {
  resolveImage(product, presentation) {
    const selected = presentation?.imageSelections?.[String(product.id)];
    return selected ? { source: selected.source, id: selected.id } : { source: 'original', id: 'original' };
  }
};
NS.ImageFraming = {
  imageFrameFor(presentation, productId) {
    return presentation?.imageFrames?.[String(productId)] || { fit: 'contain', zoom: 1, x: 50, y: 50 };
  }
};
NS.AssetClient = { isManagedAsset: value => String(value || '').startsWith('/api/assets/') };

const sharedSource = '/api/assets/sha256/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const product = (id, image = sharedSource) => ({
  id,
  code: id.toUpperCase(),
  description: `Produto ${id}`,
  category: 'Ferragens',
  subcategory: 'Teste',
  price: 'R$ 99,90',
  image,
  specs: [{ label: 'Carga', value: '35 kg' }],
  variants: []
});
const p1 = product('p1');
const p2 = product('p2');
const p3 = product('p3', '');
const p4 = product('p4');
p4.variants = [{ id: 'white', label: 'Branco', image: '/white.webp' }];

const documentModel = {
  schemaVersion: 4,
  template: { id: 'technical' },
  selectedCount: 4,
  pageCount: 1,
  orderedIds: ['p1', 'p2', 'p3', 'p4'],
  pages: [{
    index: 0,
    category: 'Ferragens',
    items: [
      { type: 'card', product: p1, productId: 'p1', row: 1, start: 1, span: 3, contentPreset: 'visual', emphasis: 'feature', width: 'wide' },
      {
        type: 'collection', blockId: 'c1', block: { id: 'c1', theme: 'light', columns: 2, itemPreset: 'visual', itemStyles: { p2: { emphasis: 'feature', width: 'simple' } } },
        members: [p2, p3], memberIds: ['p2', 'p3'], row: 2, rowSpan: 1, start: 1, span: 6
      },
      { type: 'card', product: p4, productId: 'p4', row: 3, start: 1, span: 3, contentPreset: 'commercial', emphasis: 'normal', width: 'simple' }
    ]
  }]
};
NS.CatalogDocument = { build: () => documentModel };
vm.runInNewContext(await readFile('src/variation-bundle.js', 'utf8'), context, { filename: 'src/variation-bundle.js' });

const { VariationBundle } = NS;
const fail = message => { throw new Error(message); };
const helperSource = VariationBundle.sourceMaterializerScript();
if (!helperSource.includes('catalogotop.materialized-sources') || !helperSource.includes('catalogotop.source-materialization-plan') || !helperSource.includes('non-public-address-blocked') || !helperSource.includes('source-fingerprint-mismatch') || !helperSource.includes('--mode')) fail('helper de materialização não preserva índice/plano/guards esperados');
const helperTemp = await mkdtemp(join(tmpdir(), 'catalogotop-materializer-'));
try {
  const helperPath = join(helperTemp, 'materialize-sources.py');
  await writeFile(helperPath, helperSource, 'utf8');
  const probe = spawnSync('python3', ['--version'], { encoding: 'utf8' });
  if (probe.status === 0) {
    const compiled = spawnSync('python3', ['-m', 'py_compile', helperPath], { encoding: 'utf8' });
    if (compiled.status !== 0) fail(`helper Python inválido: ${compiled.stderr || compiled.stdout}`);
    const testUrl = 'https://cdn.example.com/catalog/product.png';
    const fingerprintBytes = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(`remote-url:${testUrl}`));
    const fingerprint = Array.from(new Uint8Array(fingerprintBytes), byte => byte.toString(16).padStart(2, '0')).join('');
    await writeFile(join(helperTemp, 'manifest.json'), `${JSON.stringify({ kind: 'catalogotop.image-variation-request', version: 2, requestId: 'a'.repeat(64), jobs: [{ jobId: 'job-materializer-test', source: { mode: 'remote-url', url: testUrl, fingerprint } }] }, null, 2)}\n`, 'utf8');
    const planned = spawnSync('python3', [helperPath, helperTemp, '--mode', 'plan'], { encoding: 'utf8' });
    if (planned.status !== 0) fail(`helper --mode plan falhou sem precisar de rede: ${planned.stderr || planned.stdout}`);
    const plan = JSON.parse(await readFile(join(helperTemp, 'context', 'materialization-plan.json'), 'utf8'));
    const expectedIncoming = `sources/incoming/${fingerprint}.bin`;
    if (plan.kind !== 'catalogotop.source-materialization-plan' || plan.downloads?.[0]?.url !== testUrl || plan.downloads?.[0]?.downloadPath !== expectedIncoming) fail(`plano de materialização inválido: ${JSON.stringify(plan)}`);
    await mkdir(join(helperTemp, 'sources', 'incoming'), { recursive: true });
    await writeFile(join(helperTemp, expectedIncoming), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlKZcQAAAAASUVORK5CYII=', 'base64'));
    const ingested = spawnSync('python3', [helperPath, helperTemp, '--mode', 'ingest'], { encoding: 'utf8' });
    if (ingested.status !== 0) fail(`helper --mode ingest falhou com pixels locais válidos: ${ingested.stderr || ingested.stdout}`);
    const index = JSON.parse(await readFile(join(helperTemp, 'context', 'materialized-sources.json'), 'utf8'));
    if (index.kind !== 'catalogotop.materialized-sources' || index.failures?.length || index.sources?.[0]?.transport !== 'platform-download' || !index.sources?.[0]?.path?.endsWith('.png')) fail(`índice materializado inválido: ${JSON.stringify(index)}`);
  }
} finally {
  await rm(helperTemp, { recursive: true, force: true });
}
const placements = VariationBundle.placementsForDocument(documentModel);
if (placements.map(item => item.placementKey).join(',') !== 'card:p1,collection:c1:member:p2,collection:c1:member:p3,card:p4') {
  fail(`placement keys inesperadas: ${placements.map(item => item.placementKey).join(',')}`);
}

const state = {
  schemaVersion: 7,
  products: [p1, p2, p3, p4],
  selectedIds: ['p1', 'p2', 'p3', 'p4'],
  catalog: {
    title: 'Pedido de imagens',
    createdAt: '2026-08-29T00:00:00.000Z',
    templateId: 'technical',
    presentation: {
      imageFrames: { p1: { fit: 'cover', zoom: 1.4, x: 25, y: 70 } },
      imageSelections: {},
      imageVariants: {}
    }
  }
};
const measurements = {
  'card:p1': { widthPx: 300, heightPx: 220, widthMm: 79.35, heightMm: 58.22, aspectRatio: 1.3636 },
  'collection:c1:member:p2': { widthPx: 180, heightPx: 140, widthMm: 47.61, heightMm: 37.05, aspectRatio: 1.2857 }
};
let fetchCount = 0;
const fetchFn = async ref => {
  fetchCount += 1;
  return {
    ok: true,
    status: 200,
    async blob() { return new Blob([`source:${ref}`], { type: 'image/webp' }); }
  };
};

const options = { documentModel, measurements, fetchFn, generatedAt: '2026-08-29T12:00:00.000Z' };
const first = await VariationBundle.buildRequest(state, options);
const second = await VariationBundle.buildRequest(state, { ...options, fetchFn });
if (first.requestId !== second.requestId) fail('requestId deve ser determinístico para o mesmo catálogo/contexto');
if (!/^[a-f0-9]{64}$/.test(first.requestId)) fail(`requestId inválido: ${first.requestId}`);
if (first.manifest.kind !== 'catalogotop.image-variation-request' || first.manifest.version !== 2) fail('manifest kind/version inválidos');
if (first.manifest.jobs.length !== 2) fail(`esperava 2 jobs acionáveis: ${JSON.stringify(first.manifest.jobs)}`);
if (first.manifest.issues.map(item => item.reason).join(',') !== 'commercial-image-grid,missing-source') fail(`issues inesperadas: ${JSON.stringify(first.manifest.issues)}`);
if (first.manifest.jobs[0].placementKey !== 'card:p1' || first.manifest.jobs[1].placementKey !== 'collection:c1:member:p2') fail('jobs devem ficar ordenados por placementKey');
if (first.manifest.jobs[0].target.imageFrame.zoom !== 1.4 || first.manifest.jobs[0].source.originalRef !== sharedSource || first.manifest.jobs[0].source.mode !== 'embedded' || first.manifest.jobs[0].source.fingerprint !== first.manifest.jobs[0].source.sha256) fail('job não preservou framing/source canônico embutido');
if (!first.manifest.jobs.every(job => /^job-[a-f0-9]{20}$/.test(job.jobId) && /^[a-f0-9]{64}$/.test(job.usageSignature))) fail('jobId/usageSignature inválidos');
if (first.manifest.policy.resultScope !== 'catalog-local' || !first.manifest.policy.identityAndGeometryMustBePreserved) fail('policy não mantém resultado local/fidelidade');
if (JSON.stringify(first.manifest).includes('R$ 99,90')) fail('manifest de imagem não deve transportar fatos comerciais desnecessários');
if (fetchCount !== 2) fail(`cada build deve deduplicar a mesma sourceRef; fetches totais esperados=2, recebido=${fetchCount}`);

const sourceEntries = first.archive.entries.filter(item => item.path.startsWith('sources/'));
if (sourceEntries.length !== 1) fail(`asset compartilhado deveria aparecer uma vez no ZIP: ${JSON.stringify(sourceEntries)}`);
if (!first.archive.entries.some(item => item.path === 'manifest.json') || !first.archive.entries.some(item => item.path === 'context/layout.json')) fail('ZIP precisa conter manifest e layout context');
if (!first.archive.entries.some(item => item.path === 'tools/materialize-sources.py')) fail('ZIP precisa carregar paved path de materialização para consumidores externos');
if (new DataView(first.archive.bytes.buffer, first.archive.bytes.byteOffset, first.archive.bytes.byteLength).getUint32(0, true) !== 0x04034b50) fail('request bundle não é ZIP válido');

const timestampChanged = await VariationBundle.buildRequest({
  ...state,
  catalog: { ...state.catalog, createdAt: '2026-08-30T12:34:56.000Z' }
}, { ...options, fetchFn });
if (timestampChanged.requestId !== first.requestId) fail('timestamp informativo do catálogo não pode invalidar requestId');
if (timestampChanged.manifest.catalog.createdAt === first.manifest.catalog.createdAt) fail('manifest deve continuar refletindo createdAt como contexto informativo');

const changed = await VariationBundle.buildRequest(state, {
  ...options,
  fetchFn,
  measurements: { ...measurements, 'card:p1': { ...measurements['card:p1'], widthPx: 301 } }
});
if (changed.requestId === first.requestId) fail('mudança no target precisa invalidar requestId/usageSignature');


const remoteProduct = product('remote', 'https://cdn.example.com/catalog/product.webp');
const remoteDocument = {
  schemaVersion: 4,
  template: { id: 'technical' },
  selectedCount: 1,
  pageCount: 1,
  orderedIds: ['remote'],
  pages: [{
    index: 0,
    category: 'Ferragens',
    items: [{ type: 'card', product: remoteProduct, productId: 'remote', row: 1, start: 1, span: 3, contentPreset: 'visual', emphasis: 'normal', width: 'simple' }]
  }]
};
const remoteState = {
  ...state,
  products: [remoteProduct],
  selectedIds: ['remote'],
  catalog: { ...state.catalog, presentation: { imageFrames: {}, imageSelections: {}, imageVariants: {} } }
};
const failingFetch = async () => { throw new TypeError('Failed to fetch'); };
const remoteRequest = await VariationBundle.buildRequest(remoteState, {
  documentModel: remoteDocument,
  measurements: { 'card:remote': { widthPx: 200, heightPx: 150, widthMm: 52.5, heightMm: 39.4, aspectRatio: 1.3333 } },
  fetchFn: failingFetch,
  generatedAt: '2026-08-29T12:00:00.000Z'
});
if (remoteRequest.manifest.jobs.length !== 1 || remoteRequest.manifest.issues.length !== 0) fail(`URL externa bloqueada por CORS deve continuar elegível: ${JSON.stringify(remoteRequest.manifest)}`);
const remoteSource = remoteRequest.manifest.jobs[0].source;
if (remoteSource.mode !== 'remote-url' || remoteSource.url !== remoteProduct.image || remoteSource.originalRef !== remoteProduct.image || !/^[a-f0-9]{64}$/.test(remoteSource.fingerprint) || remoteSource.path || remoteSource.sha256) fail(`source remote-url inválida: ${JSON.stringify(remoteSource)}`);
if (remoteRequest.archive.entries.some(item => item.path.startsWith('sources/'))) fail('fallback remote-url não pode fingir bytes de imagem no ZIP');
if (!remoteRequest.manifest.policy.externalUrlFallback) fail('policy precisa declarar fallback de URL externa');

const managedFailure = await VariationBundle.buildRequest({ ...state, products: [p1], selectedIds: ['p1'] }, {
  documentModel: { ...remoteDocument, orderedIds: ['p1'], pages: [{ ...remoteDocument.pages[0], items: [{ type: 'card', product: p1, productId: 'p1', row: 1, start: 1, span: 3, contentPreset: 'visual', emphasis: 'normal', width: 'simple' }] }] },
  measurements: { 'card:p1': measurements['card:p1'] },
  fetchFn: failingFetch,
  generatedAt: '2026-08-29T12:00:00.000Z'
});
if (managedFailure.manifest.jobs.length !== 0 || managedFailure.manifest.issues[0]?.reason !== 'source-unavailable') fail('asset gerenciado indisponível deve continuar fail-closed; não pode virar URL externa');

console.log('PASS variation bundle request fixture: placements, signatures, source embedded/remote-url, timestamp, policy, issues, dedupe e ZIP');
