import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const storage = new Map();
const context = {
  window: { CatalogoTop: {}, dispatchEvent() {}, crypto: { randomUUID: () => 'uuid-backup' } },
  localStorage: {
    getItem(key) { return storage.get(key) || null; },
    setItem(key, value) { storage.set(key, String(value)); }
  },
  console,
  CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
  structuredClone,
  Intl,
  Date,
  Object,
  Array,
  Map,
  Set,
  String,
  Number,
  Math,
  JSON
};
context.window.window = context.window;
context.window.CustomEvent = context.CustomEvent;
context.window.localStorage = context.localStorage;

vm.runInNewContext(await readFile('src/composition.js', 'utf8'), context, { filename: 'src/composition.js' });
vm.runInNewContext(await readFile('src/core.js', 'utf8'), context, { filename: 'src/core.js' });

const { Core } = context.window.CatalogoTop;
const fail = message => { throw new Error(message); };
const original = '/api/assets/sha256/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const reusable = '/api/assets/sha256/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const local = '/api/assets/sha256/cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';

const source = {
  schemaVersion: 7,
  products: [{
    id: 'p1', code: 'P1', description: 'Produto backup', category: 'Teste', subcategory: '', price: 'R$ 10,00', status: 'Ativo', notes: '',
    image: original,
    imageGallery: [{ id: 'detail', label: 'Detalhe', image: reusable, provenance: { kind: 'manual-upload' } }],
    specs: [], variants: [], tableRows: [], updatedAt: '2026-08-29T00:00:00.000Z'
  }],
  selectedIds: ['p1'],
  catalog: {
    title: 'Backup de variantes', templateId: 'technical', showPrices: true,
    presentation: {
      order: ['p1'],
      itemStyles: {},
      blocks: [],
      imageFrames: { p1: { fit: 'cover', zoom: 1.35, x: 35, y: 60 } },
      imageVariants: {
        p1: [{
          id: 'external-job-a', label: 'Fundo branco', image: local,
          provenance: {
            kind: 'external-variation', requestId: '1'.repeat(64), jobId: 'job-123', usageSignature: '2'.repeat(64),
            placementKey: 'card:p1', sourceSha256: '3'.repeat(64), resultSha256: '4'.repeat(64), mimeType: 'image/png', transforms: ['white-background']
          }
        }]
      },
      imageSelections: { p1: { source: 'catalog', id: 'external-job-a' } }
    }
  }
};

Core.setState(source, { persist: false });
const before = Core.getState();
const backupJson = JSON.stringify(before);
if (!backupJson.includes('external-job-a') || !backupJson.includes('imageGallery') || !backupJson.includes('imageSelections')) fail('backup JSON precisa conter galeria, variante local e seleção');

Core.setState(Core.createInitialState(), { persist: false });
const restored = Core.setState(JSON.parse(backupJson), { persist: false });
const product = restored.products[0];
const presentation = restored.catalog.presentation;
if (restored.schemaVersion !== 7) fail(`round-trip deve permanecer schema 7: ${restored.schemaVersion}`);
if (product.image !== original) fail('Original canônico mudou no round-trip');
if (product.imageGallery.length !== 1 || product.imageGallery[0].image !== reusable || product.imageGallery[0].provenance?.kind !== 'manual-upload') fail('Product.imageGallery não sobreviveu ao round-trip');
if (presentation.imageVariants.p1?.length !== 1 || presentation.imageVariants.p1[0].image !== local) fail('variante local do catálogo não sobreviveu ao round-trip');
if (presentation.imageVariants.p1[0].provenance?.resultSha256 !== '4'.repeat(64)) fail('proveniência externa não sobreviveu ao round-trip');
if (presentation.imageSelections.p1?.source !== 'catalog' || presentation.imageSelections.p1?.id !== 'external-job-a') fail('seleção editorial da variante não sobreviveu ao round-trip');
if (presentation.imageFrames.p1?.zoom !== 1.35 || presentation.imageFrames.p1?.x !== 35 || presentation.imageFrames.p1?.y !== 60) fail('framing não sobreviveu ao round-trip');

// Persistência de sessão é deliberadamente separada do ProductStore: produtos não são duplicados no localStorage,
// mas o catálogo em elaboração precisa preservar a apresentação local, inclusive variantes importadas.
Core.setState(restored);
const session = JSON.parse(storage.get(Core.STORAGE_KEY) || 'null');
if (!session || session.products?.length !== 0) fail('sessão local não deve duplicar a base remota de produtos');
if (session.catalog?.presentation?.imageVariants?.p1?.[0]?.image !== local) fail('sessão local perdeu variante externa do catálogo');
if (session.catalog?.presentation?.imageSelections?.p1?.id !== 'external-job-a') fail('sessão local perdeu seleção da variante');

const [app, productStore] = await Promise.all([
  readFile('src/app.js', 'utf8'),
  readFile('src/product-store.js', 'utf8')
]);
const backupHandlerStart = app.indexOf("$('#btnExportBackup').addEventListener('click'");
const backupImportStart = app.indexOf("$('#backupFile').addEventListener('change'");
const backupImportEnd = app.indexOf("window.addEventListener('catalogotop:products-updated'", backupImportStart);
const backupHandler = backupHandlerStart >= 0 && backupImportStart > backupHandlerStart ? app.slice(backupHandlerStart, backupImportStart) : '';
const backupImportHandler = backupImportStart >= 0 && backupImportEnd > backupImportStart ? app.slice(backupImportStart, backupImportEnd) : '';
if (!backupHandler.includes('JSON.stringify(state(), null, 2)') || !backupHandler.includes("'application/json'")) fail('export de backup deve continuar serializando o estado completo');
if (!backupImportHandler.includes('Core.setState(parsed)')) fail('import de backup deve continuar passando pelo migrador/normalizador Core');
if (!backupImportHandler.includes('await publishProducts()')) fail('publicação opcional após backup deve continuar explícita');
if (!app.includes('return ProductStore.publishCurrent()')) fail('app deve publicar a base atual somente pela fronteira ProductStore');
if (!productStore.includes('publishCurrent: () => publishProducts(Core.getState().products)')) fail('ProductStore.publishCurrent deve continuar limitado a Core.products, nunca ao catálogo editorial');

console.log('PASS image variants backup fixture: schema 7, Original, gallery, local variants, selection, framing, sessão e publicação product-only');
