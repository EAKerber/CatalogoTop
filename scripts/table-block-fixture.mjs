import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const files = [
  'src/composition.js',
  'src/collection.js',
  'src/catalog-document.js',
  'src/collection-document.js',
  'src/table-block.js',
  'src/table-document.js',
  'src/product-actions.js'
];
const context = {
  window: { CatalogoTop: {}, confirm: () => true },
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
const { Composition, TableBlock, CatalogDocument, ProductActions } = NS;
const fail = message => { throw new Error(message); };
const template = { id: 'technical', columns: 2, rows: 4, perPage: 8, className: 'template-technical' };
const product = id => ({
  id,
  code: id.toUpperCase(),
  description: `Produto ${id}`,
  category: 'Elétrica',
  subcategory: '35 mm',
  status: 'Ativo',
  image: '',
  specs: [],
  variants: [],
  tableRows: [],
  price: `R$ ${Number(id.slice(1)) + 5},90`
});
const products = Array.from({ length: 12 }, (_, index) => product(`p${index + 1}`));
const selectedIds = products.map(item => item.id);

const tableBlock = {
  id: 'table-electric',
  type: 'table',
  memberIds: ['p5','p6','p7','p8','p9','p10','p11','p12'],
  title: 'Tomadas e interruptores',
  subtitle: 'Referências',
  rowSource: 'products',
  density: 'compact',
  columns: ['code','description','price']
};

const mixed = Composition.normalizePresentation({
  blocks: [
    { id: 'collection-a', type: 'collection', memberIds: ['p1','p2'], columns: 2, itemPreset: 'visual' },
    tableBlock
  ]
});
if (mixed.blocks.length !== 2 || mixed.blocks[0].type !== 'collection' || mixed.blocks[1].type !== 'table') fail('normalizePresentation deve preservar ordem de Collection + Table');

const state = {
  products,
  selectedIds,
  catalog: {
    title: 'Elétrica',
    templateId: 'technical',
    showPrices: true,
    createdAt: '2026-08-26T12:00:00Z',
    presentation: Composition.normalizePresentation({
      distribution: 'balanced',
      typography: 'neutral',
      itemStyles: {},
      blocks: [tableBlock]
    })
  }
};

const fragments = TableBlock.fragmentTable(tableBlock, products.slice(4));
if (fragments.rows.length !== 8 || fragments.fragments.length !== 3) fail(`tabela compacta com título deveria gerar 3 unidades: ${JSON.stringify(fragments.fragments)}`);
if (fragments.fragments.map(fragment => fragment.rows.length).join(',') !== '3,4,1') fail('capacidades devem ser 3,4,1 para título compacto');

const doc = CatalogDocument.build(state, template);
if (doc.schemaVersion !== 4) fail('CatalogDocument com tabela deve expor contrato v4');
if (doc.pageCount !== 2) fail(`tabela fragmentável deveria produzir 2 páginas; recebeu ${doc.pageCount}`);
if (doc.orderedIds.join(',') !== selectedIds.join(',')) fail('Table não pode alterar ordem factual da seleção');
const tables = doc.pages.flatMap(page => page.items.filter(item => item.type === 'table'));
if (tables.length !== 2) fail(`tabela deveria materializar um segmento por página; recebeu ${tables.length}`);
if (tables[0].row !== 3 || tables[0].rowSpan !== 2 || tables[0].rows.length !== 7) fail(`primeiro segmento deveria ocupar linhas 3-4 com 7 linhas: ${JSON.stringify(tables[0])}`);
if (tables[1].row !== 1 || tables[1].rowSpan !== 1 || tables[1].rows.length !== 1 || tables[1].fragmentStart !== 2) fail('segundo segmento deve continuar na página seguinte com cabeçalho repetível');
if (doc.selectedCount !== 12) fail('agrupar em tabela não pode alterar contagem factual');

const commercialProducts = [product('x1'), product('x2')];
commercialProducts[0].tableRows = [
  { id: 'a', variant: 'Branco', code: 'X1-BR', package: 'CX 10', price: 'R$ 10,00' },
  { id: 'b', variant: 'Preto', code: 'X1-PT', package: 'CX 10', price: 'R$ 11,00' }
];
commercialProducts[1].tableRows = [];
const commercialBlock = TableBlock.normalizeBlock({
  id: 'commercial', type: 'table', memberIds: ['x1','x2'], rowSource: 'commercialRows', columns: ['variant','code','package','price']
});
const commercialRows = TableBlock.rowsForBlock(commercialBlock, commercialProducts);
if (commercialRows.length !== 3) fail('fonte Linhas comerciais deve achatar tableRows e preservar produto sem linhas como fallback vazio');
if (commercialRows[0].code !== 'X1-BR' || commercialRows[2].code !== 'X2') fail('linhas comerciais devem usar referência específica e fallback factual do produto');

const draft = JSON.parse(JSON.stringify(state));
draft.catalog.presentation.itemStyles.p6 = { contentPreset: 'visual', emphasis: 'normal', width: 'simple' };
ProductActions.cleanupDraftForDeletedProduct(draft, 'p6');
if (draft.products.some(item => item.id === 'p6') || draft.selectedIds.includes('p6')) fail('exclusão deve remover produto e seleção');
if (draft.catalog.presentation.itemStyles.p6) fail('exclusão deve remover override editorial do produto');
const survivingTable = draft.catalog.presentation.blocks.find(block => block.id === 'table-electric');
if (!survivingTable || survivingTable.memberIds.includes('p6') || survivingTable.memberIds.length !== 7) fail('exclusão deve limpar participação na tabela sem dissolvê-la prematuramente');

const dissolveDraft = {
  products: [product('z1'), product('z2')],
  selectedIds: ['z1','z2'],
  catalog: { presentation: { itemStyles: {}, blocks: [{ id: 'z', type: 'table', memberIds: ['z1','z2'], columns: ['code'] }] } }
};
ProductActions.cleanupDraftForDeletedProduct(dissolveDraft, 'z1');
if (dissolveDraft.catalog.presentation.blocks.length !== 0) fail('tabela com apenas um membro deve ser dissolvida ao excluir produto');

console.log('PASS table block fixture: mixed blocks, fragmentation, commercial rows and safe deletion');
