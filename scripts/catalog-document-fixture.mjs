import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const compositionSource = await readFile('src/composition.js', 'utf8');
const documentSource = await readFile('src/catalog-document.js', 'utf8');
const context = {
  window: { CatalogoTop: {} },
  console,
  Object,
  Array,
  Map,
  Set,
  Math,
  Number,
  String
};
context.window.window = context.window;
vm.runInNewContext(compositionSource, context, { filename: 'src/composition.js' });
vm.runInNewContext(documentSource, context, { filename: 'src/catalog-document.js' });

const { Composition, CatalogDocument } = context.window.CatalogoTop;
const fail = message => { throw new Error(message); };
const product = (id, category) => ({
  id,
  code: id.toUpperCase(),
  description: `Produto ${id}`,
  category,
  status: 'Ativo',
  specs: [],
  variants: [],
  tableRows: []
});

const products = [
  product('a-normal', 'Dobradiças'),
  product('a-feature', 'Dobradiças'),
  product('a-full', 'Dobradiças'),
  product('b-1', 'Corrediças'),
  product('b-2', 'Corrediças'),
  product('b-3', 'Corrediças')
];
const state = {
  products,
  selectedIds: products.map(item => item.id),
  catalog: {
    templateId: 'technical',
    showPrices: true,
    createdAt: '2026-08-26T00:00:00.000Z',
    presentation: Composition.normalizePresentation({
      distribution: 'balanced',
      itemStyles: {
        'a-feature': { emphasis: 'feature', contentPreset: 'visual', width: 'simple' },
        'a-full': { emphasis: 'feature', contentPreset: 'visual', width: 'full' }
      }
    })
  }
};
const template = { id: 'technical', columns: 2, rows: 4, perPage: 8, className: 'template-technical' };
const doc = CatalogDocument.build(state, template);

if (doc.schemaVersion !== 2) fail('CatalogDocument deve expor contrato v2 com largura em slots');
if (doc.pageCount !== 2) fail(`fixture deve materializar 2 páginas, recebeu ${doc.pageCount}`);
if (doc.categoryCount !== 2) fail('fixture deve preservar duas categorias');
if (doc.orderedIds.slice(0, 3).join(',') !== 'a-normal,a-feature,a-full') fail('ordem materializada deve preservar a ordem factual da seleção');
if (doc.pages[0].category !== 'Dobradiças' || doc.pages[1].category !== 'Corrediças') fail('categorias devem preservar ordem da primeira aparição');
if (doc.effectiveOrderById['a-normal'] !== 1 || doc.effectiveOrderById['a-full'] !== 3) fail('ordem efetiva deve ser endereçável por id sem prioridade implícita');

const full = doc.pages[0].items.find(item => item.productId === 'a-full');
if (!full || full.width !== 'full' || full.slotSpan !== 2 || full.span !== 6) fail('CatalogDocument deve materializar largura full em slots e micrograde');
const feature = doc.pages[0].items.find(item => item.productId === 'a-feature');
if (!feature || feature.emphasis !== 'feature' || feature.width !== 'simple' || feature.slotSpan !== 1) fail('ênfase visual e largura precisam permanecer independentes');

const reordered = CatalogDocument.withEffectiveOrder(state, doc);
if (reordered.selectedIds.slice(0, 3).join(',') !== 'a-normal,a-feature,a-full') fail('state derivado deve refletir a mesma ordem efetiva sem mutar o original');
if (state.selectedIds[0] !== 'a-normal') fail('CatalogDocument não pode mutar a ordem factual do state');

const legacyState = {
  ...state,
  catalog: {
    ...state.catalog,
    presentation: { itemStyles: { 'a-full': { emphasis: 'hero', contentPreset: 'visual' } } }
  }
};
const legacyDoc = CatalogDocument.build(legacyState, template);
const legacyFull = legacyDoc.pages[0].items.find(item => item.productId === 'a-full');
if (!legacyFull || legacyFull.emphasis !== 'feature' || legacyFull.width !== 'full') fail('Hero legado deve migrar sem manter semântica estrutural especial');

console.log('PASS catalog document fixture');
