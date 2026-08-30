import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
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
if (first.manifest.kind !== 'catalogotop.image-variation-request' || first.manifest.version !== 1) fail('manifest kind/version inválidos');
if (first.manifest.jobs.length !== 2) fail(`esperava 2 jobs acionáveis: ${JSON.stringify(first.manifest.jobs)}`);
if (first.manifest.issues.map(item => item.reason).join(',') !== 'commercial-image-grid,missing-source') fail(`issues inesperadas: ${JSON.stringify(first.manifest.issues)}`);
if (first.manifest.jobs[0].placementKey !== 'card:p1' || first.manifest.jobs[1].placementKey !== 'collection:c1:member:p2') fail('jobs devem ficar ordenados por placementKey');
if (first.manifest.jobs[0].target.imageFrame.zoom !== 1.4 || first.manifest.jobs[0].source.originalRef !== sharedSource) fail('job não preservou framing/source canônico');
if (!first.manifest.jobs.every(job => /^job-[a-f0-9]{20}$/.test(job.jobId) && /^[a-f0-9]{64}$/.test(job.usageSignature))) fail('jobId/usageSignature inválidos');
if (first.manifest.policy.resultScope !== 'catalog-local' || !first.manifest.policy.identityAndGeometryMustBePreserved) fail('policy não mantém resultado local/fidelidade');
if (JSON.stringify(first.manifest).includes('R$ 99,90')) fail('manifest de imagem não deve transportar fatos comerciais desnecessários');
if (fetchCount !== 2) fail(`cada build deve deduplicar a mesma sourceRef; fetches totais esperados=2, recebido=${fetchCount}`);

const sourceEntries = first.archive.entries.filter(item => item.path.startsWith('sources/'));
if (sourceEntries.length !== 1) fail(`asset compartilhado deveria aparecer uma vez no ZIP: ${JSON.stringify(sourceEntries)}`);
if (!first.archive.entries.some(item => item.path === 'manifest.json') || !first.archive.entries.some(item => item.path === 'context/layout.json')) fail('ZIP precisa conter manifest e layout context');
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

console.log('PASS variation bundle request fixture: placements, signatures, timestamp informativo, policy, issues, dedupe e ZIP');
