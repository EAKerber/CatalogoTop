import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const storage = new Map();
const context = {
  window: { CatalogoTop: {}, dispatchEvent() {}, crypto: { randomUUID: () => 'uuid-test' } },
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

const { Core, Composition, ImageVariants } = context.window.CatalogoTop;
const fail = message => { throw new Error(message); };

const legacy = Core.migrate({
  schemaVersion: 6,
  products: [{
    id: 'p1', code: 'P1', description: 'Produto legado', category: 'Teste', image: '/original.webp',
    specs: [], variants: [{ id: 'white', label: 'Branco', image: '/white.webp' }], tableRows: []
  }],
  selectedIds: ['p1'],
  catalog: {
    title: 'Legado', templateId: 'technical', showPrices: true,
    presentation: { order: ['p1'], imageFrames: { p1: { fit: 'cover', zoom: 1.2, x: 50, y: 50 } } }
  }
});
if (legacy.schemaVersion !== 8) fail(`schema legado não migrou para v8: ${legacy.schemaVersion}`);
if (legacy.products[0].imageGallery.length !== 0) fail('produto legado deve migrar com imageGallery vazia');
if (Object.keys(legacy.catalog.presentation.imageSelections).length || Object.keys(legacy.catalog.presentation.imageVariants).length) fail('estado legado deve migrar com mapas de variantes vazios');
if (legacy.products[0].variants.length !== 1 || legacy.products[0].variants[0].id !== 'white') fail('variantes comerciais não podem ser confundidas com imageGallery');

const normalizedProduct = Core.normalizeProduct({
  id: 'p2', code: 'P2', description: 'Produto com galeria', category: 'Teste', image: '/p2-original.webp',
  imageGallery: [
    { id: 'front', label: 'Frente', image: '/front.webp', provenance: { kind: 'manual' } },
    { id: 'front', label: 'Duplicada', image: '/duplicate.webp' },
    { label: 'Sem imagem', image: '' }
  ]
});
if (normalizedProduct.imageGallery.length !== 2) fail(`galeria deveria conter 2 imagens válidas: ${JSON.stringify(normalizedProduct.imageGallery)}`);
if (normalizedProduct.imageGallery[0].id !== 'front') fail('id explícito da primeira imagem deve ser preservado');
if (normalizedProduct.imageGallery[1].id === 'front') fail('ids duplicados devem ser normalizados deterministicamente');
if (normalizedProduct.imageGallery[0].provenance?.kind !== 'manual') fail('proveniência deve ser preservada');

const presentation = Composition.normalizePresentation({
  imageSelections: {
    p2: { source: 'product', id: 'front' },
    invalidSource: { source: 'other', id: 'x' },
    invalidId: { source: 'product', id: '' }
  },
  imageVariants: {
    p2: [{ id: 'catalog-a', label: 'Catálogo A', image: '/catalog-a.webp', provenance: { kind: 'derived' } }],
    empty: [{ id: 'x', image: '' }]
  }
});
if (Object.keys(presentation.imageSelections).length !== 1) fail('seleções inválidas devem ser descartadas');
if (presentation.imageVariants.p2?.length !== 1 || presentation.imageVariants.empty) fail('variantes locais devem normalizar somente entradas válidas');

let resolved = ImageVariants.resolveImage(normalizedProduct, presentation);
if (resolved.source !== 'product' || resolved.id !== 'front' || resolved.image !== '/front.webp') fail(`seleção da galeria não resolveu: ${JSON.stringify(resolved)}`);

const catalogPresentation = Composition.normalizePresentation({
  imageSelections: { p2: { source: 'catalog', id: 'catalog-a' } },
  imageVariants: presentation.imageVariants
});
resolved = ImageVariants.resolveImage(normalizedProduct, catalogPresentation);
if (resolved.source !== 'catalog' || resolved.image !== '/catalog-a.webp') fail(`variante local não resolveu: ${JSON.stringify(resolved)}`);

const stalePresentation = Composition.normalizePresentation({
  imageSelections: { p2: { source: 'product', id: 'missing' } },
  imageVariants: presentation.imageVariants
});
resolved = ImageVariants.resolveImage(normalizedProduct, stalePresentation);
if (resolved.source !== 'original' || resolved.image !== '/p2-original.webp' || !resolved.isFallback) fail('seleção obsoleta deve cair para Original explicitamente');

Core.setState({
  schemaVersion: 7,
  products: [normalizedProduct],
  selectedIds: [],
  catalog: { title: 'Merge', templateId: 'technical', showPrices: true, presentation: {} }
}, { persist: false });
Core.mergeProducts([{ code: 'P2', description: 'Atualizado', category: 'Teste' }]);
if (Core.getState().products[0].imageGallery.length !== 2) fail('importação sem imageGallery não pode apagar galeria existente');
Core.mergeProducts([{ code: 'P2', description: 'Atualizado', category: 'Teste', imageGallery: [] }]);
if (Core.getState().products[0].imageGallery.length !== 0) fail('imageGallery explícita vazia deve permitir limpeza intencional');

console.log('PASS image variants fixture: schema 8, galeria, seleção local e fallback Original');
