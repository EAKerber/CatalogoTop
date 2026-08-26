import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const files = [
  'src/composition.js',
  'src/collection.js',
  'src/catalog-document.js',
  'src/collection-document.js'
];
const context = {
  window: { CatalogoTop: {} },
  console,
  Date,
  Map,
  Set,
  Math,
  String,
  Array,
  Number,
  Object,
  Intl,
  encodeURIComponent
};
context.window.window = context.window;
for (const file of files) vm.runInNewContext(await readFile(file, 'utf8'), context, { filename: file });

const NS = context.window.CatalogoTop;
const { Composition, Collection, CatalogDocument } = NS;
const fail = message => { throw new Error(message); };
const template = { id: 'technical', columns: 2, rows: 4, perPage: 8, className: 'template-technical' };
const product = id => ({ id, code: id.toUpperCase(), description: `Produto ${id}`, category: 'Elétrica', status: 'Ativo', image: '', specs: [], variants: [], tableRows: [], price: `R$ ${id.length},90` });
const products = Array.from({ length: 10 }, (_, index) => product(`p${index + 1}`));
const selectedIds = products.map(item => item.id);

const block = {
  id: 'collection-main',
  type: 'collection',
  memberIds: ['p3', 'p4', 'p5', 'p6'],
  title: 'Tomadas e interruptores',
  subtitle: '35 mm',
  theme: 'dark',
  columns: 4,
  itemPreset: 'commercial',
  itemStyles: { p6: { emphasis: 'feature', width: 'wide' } }
};

const presentation = Composition.normalizePresentation({
  distribution: 'balanced',
  typography: 'neutral',
  itemStyles: {},
  blocks: [block]
});
if (!Array.isArray(presentation.blocks) || presentation.blocks.length !== 1) fail('normalizePresentation deve preservar blocos locais');

const collectionPlan = Collection.planCollection(block, products.slice(2, 6), template);
if (collectionPlan.columns !== 4 || collectionPlan.localRowCount !== 2) fail(`grade interna inesperada: ${JSON.stringify(collectionPlan)}`);
if (collectionPlan.items.find(item => item.productId === 'p6')?.slotSpan !== 2) fail('override Largo deve ocupar dois slots locais');
if (collectionPlan.rowSpan !== 2) fail('rowSpan deve derivar deterministicamente das linhas internas no caso nominal');

const state = {
  products,
  selectedIds,
  catalog: {
    title: 'Elétrica',
    templateId: 'technical',
    showPrices: true,
    createdAt: '2026-08-26T12:00:00Z',
    presentation
  }
};
const doc = CatalogDocument.build(state, template);
if (doc.schemaVersion !== 3) fail('CatalogDocument com blocos deve expor contrato v3');
if (doc.pageCount !== 2) fail(`fixture deve produzir 2 páginas, recebeu ${doc.pageCount}`);
if (doc.orderedIds.join(',') !== selectedIds.join(',')) fail(`coleção não pode reordenar selectedIds: ${doc.orderedIds.join(',')}`);
const collectionItem = doc.pages.flatMap(page => page.items).find(item => item.type === 'collection');
if (!collectionItem) fail('CatalogDocument deve materializar a coleção como unidade top-level');
if (collectionItem.memberIds.join(',') !== 'p3,p4,p5,p6') fail('membros devem preservar ordem factual');
if (collectionItem.span !== 6 || collectionItem.start !== 1) fail('coleção v0.10.1 deve ocupar linha inteira da micrograde');
if (collectionItem.rowSpan !== 2) fail('coleção deve carregar rowSpan materializado');
if (collectionItem.block.theme !== 'dark' || collectionItem.block.itemPreset !== 'commercial') fail('tema e preset precisam sobreviver ao CatalogDocument');
if (doc.selectedCount !== 10) fail('agrupar não pode reduzir contagem factual de produtos selecionados');

const reversedPresentation = Composition.normalizePresentation({
  ...presentation,
  blocks: [{ ...block, memberIds: ['p6', 'p5', 'p4', 'p3'] }]
});
const reversedDoc = CatalogDocument.build({ ...state, catalog: { ...state.catalog, presentation: reversedPresentation } }, template);
const reversedCollection = reversedDoc.pages.flatMap(page => page.items).find(item => item.type === 'collection');
if (!reversedCollection) fail('memberIds invertidos mas contíguos ainda devem materializar a mesma coleção');
if (reversedCollection.memberIds.join(',') !== 'p3,p4,p5,p6') fail('ordem do backup não pode vencer a ordem factual da seleção');
if (reversedDoc.orderedIds.join(',') !== selectedIds.join(',')) fail('memberIds invertidos não podem reordenar o catálogo');

const noBlockState = {
  ...state,
  catalog: { ...state.catalog, presentation: Composition.normalizePresentation({ ...presentation, blocks: [] }) }
};
const noBlockDoc = CatalogDocument.build(noBlockState, template);
if (noBlockDoc.orderedIds.join(',') !== selectedIds.join(',')) fail('desagrupar deve ser reversível sem alterar ordem');
if (noBlockDoc.pages.flatMap(page => page.items).some(item => item.type === 'collection')) fail('desagrupar deve restaurar somente cards');

const invalidGap = Composition.normalizePresentation({
  blocks: [{ ...block, memberIds: ['p2', 'p4'] }]
});
const invalidDoc = CatalogDocument.build({ ...state, catalog: { ...state.catalog, presentation: invalidGap } }, template);
if (invalidDoc.pages.flatMap(page => page.items).some(item => item.type === 'collection')) fail('membros não contíguos não podem ser agrupados silenciosamente');
if (invalidDoc.orderedIds.join(',') !== selectedIds.join(',')) fail('bloco inválido deve falhar para cards sem perda de produtos');

const overlapping = Composition.normalizePresentation({
  blocks: [
    { ...block, id: 'first', memberIds: ['p2', 'p3', 'p4'] },
    { ...block, id: 'second', memberIds: ['p4', 'p5', 'p6'] }
  ]
});
const overlapDoc = CatalogDocument.build({ ...state, catalog: { ...state.catalog, presentation: overlapping } }, template);
const overlapCollections = overlapDoc.pages.flatMap(page => page.items).filter(item => item.type === 'collection');
if (overlapCollections.length !== 1 || overlapCollections[0].blockId !== 'first') fail('blocos sobrepostos devem aceitar deterministicamente o primeiro e ignorar o segundo');
if (overlapDoc.orderedIds.join(',') !== selectedIds.join(',')) fail('bloco sobreposto ignorado não pode duplicar ou perder produtos');

const capped = Collection.normalizeBlock({ ...block, memberIds: Array.from({ length: 20 }, (_, index) => `x${index}`) });
if (capped.memberIds.length !== Collection.MAX_MEMBERS) fail('primeiro recorte deve limitar coleção a 12 membros');

console.log('PASS collection block fixture');
