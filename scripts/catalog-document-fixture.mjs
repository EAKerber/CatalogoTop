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
  product('a-hero', 'Dobradiças'),
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
        'a-feature': { emphasis: 'feature', contentPreset: 'visual' },
        'a-hero': { emphasis: 'hero', contentPreset: 'visual' }
      }
    })
  }
};
const template = { id: 'technical', columns: 2, rows: 4, perPage: 8, className: 'template-technical' };
const doc = CatalogDocument.build(state, template);

if (doc.pageCount !== 2) fail(`fixture deve materializar 2 páginas, recebeu ${doc.pageCount}`);
if (doc.categoryCount !== 2) fail('fixture deve preservar duas categorias');
if (doc.orderedIds.slice(0, 3).join(',') !== 'a-feature,a-normal,a-hero') fail('ordem materializada deve priorizar Destaque e ancorar Hero no fim da página');
if (doc.pages[0].items.at(-1)?.productId !== 'a-hero') fail('Hero deve ser o último item materializado de sua página');
if (doc.pages[0].items.at(-1)?.row !== doc.pages[0].layout.rowCount) fail('Hero deve ocupar a última linha usada');
if (doc.pages[0].category !== 'Dobradiças' || doc.pages[1].category !== 'Corrediças') fail('categorias devem preservar ordem da primeira aparição');
if (doc.effectiveOrderById['a-feature'] !== 1 || doc.effectiveOrderById['a-hero'] !== 3) fail('ordem efetiva deve refletir âncora Hero por id');

const reordered = CatalogDocument.withEffectiveOrder(state, doc);
if (reordered.selectedIds.slice(0, 3).join(',') !== 'a-feature,a-normal,a-hero') fail('state derivado deve refletir ordem efetiva sem mutar o original');
if (state.selectedIds[0] !== 'a-normal') fail('CatalogDocument não pode mutar a ordem factual do state');

console.log('PASS catalog document fixture');
