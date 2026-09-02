import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const files = [
  'src/composition.js',
  'src/catalog-order.js',
  'src/templates.js',
  'src/collection.js',
  'src/table-block.js',
  'src/catalog-document.js',
  'src/preflight.js'
];
const context = { window: { CatalogoTop: {} }, console, Object, Array, Map, Set, Math, Number, String, Date, Intl };
context.window.window = context.window;
for (const file of files) vm.runInNewContext(await readFile(file, 'utf8'), context, { filename: file });

const NS = context.window.CatalogoTop;
const { Composition, Preflight } = NS;
const fail = message => { throw new Error(message); };
const image = label => `data:image/png;fixture,${label}`;

function product(id, overrides = {}) {
  return {
    id,
    code: id.toUpperCase(),
    description: `Produto ${id}`,
    category: 'Ferragens',
    subcategory: '',
    price: '',
    status: 'Ativo',
    notes: '',
    image: image(`${id}-original`),
    imageGallery: [],
    specs: [],
    variants: [],
    tableRows: [],
    ...overrides
  };
}

function state(products, selectedIds = products.map(item => item.id), presentation = {}) {
  return {
    products,
    selectedIds,
    catalog: {
      title: 'Preflight fixture',
      templateId: 'technical',
      templateVersion: 1,
      showPrices: true,
      createdAt: '2026-09-02T00:00:00.000Z',
      presentation: Composition.normalizePresentation({ order: selectedIds, ...presentation })
    }
  };
}

function codes(report) { return report.issues.map(item => item.code); }
function issue(report, code) { return report.issues.find(item => item.code === code); }

const clean = state([product('p1')]);
const cleanBefore = JSON.stringify(clean);
const cleanReport = Preflight.inspect(clean);
if (cleanReport.status !== 'ready' || cleanReport.issues.length) fail(`estado limpo deveria estar ready: ${JSON.stringify(cleanReport)}`);
if (JSON.stringify(clean) !== cleanBefore) fail('Preflight mutou o estado limpo');

const unavailable = state([product('p1')]);
unavailable.catalog.templateId = 'missing-template';
unavailable.catalog.templateVersion = 77;
const unavailableReport = Preflight.inspect(unavailable);
if (unavailableReport.status !== 'blocked' || !issue(unavailableReport, 'template_unavailable')) fail('template exato indisponível não virou blocker');
if (issue(unavailableReport, 'template_unavailable').resourceId !== 'missing-template@77') fail('binding exato não foi preservado no issue');

const missingSelected = state([product('p1')], ['p1', 'gone']);
const missingSelectedReport = Preflight.inspect(missingSelected);
if (!issue(missingSelectedReport, 'selected_product_missing') || missingSelectedReport.status !== 'blocked') fail('selected_product_missing ausente');

const inactive = state([product('p1'), product('p2', { status: 'Inativo' })], ['p1', 'p2']);
const inactiveReport = Preflight.inspect(inactive);
if (!issue(inactiveReport, 'selected_product_inactive') || issue(inactiveReport, 'catalog_empty')) fail('produto inativo deveria gerar warning sem esvaziar catálogo que ainda tem ativo');

const missingFacts = state([product('p1', { code: '', description: '' })]);
const missingFactsBefore = JSON.stringify(missingFacts);
const missingFactsReport = Preflight.inspect(missingFacts);
const factsIssue = issue(missingFactsReport, 'required_product_fact_missing');
if (!factsIssue || missingFactsReport.status !== 'blocked' || factsIssue.missingFields.join(',') !== 'código,descrição') fail(`facts obrigatórios não detectados: ${JSON.stringify(missingFactsReport)}`);
if (JSON.stringify(missingFacts) !== missingFactsBefore) fail('Preflight mutou estado com facts ausentes');

const staleBlockProducts = [product('p1'), product('p2'), product('p3')];
const staleBlock = state(staleBlockProducts, ['p1', 'p2', 'p3'], {
  blocks: [{ id: 'collection-stale', type: 'collection', memberIds: ['p1', 'p3'], columns: 2, itemPreset: 'visual' }]
});
const staleBlockReport = Preflight.inspect(staleBlock);
if (codes(staleBlockReport).filter(code => code === 'editorial_block_not_materialized').length !== 1) fail(`block stale deveria gerar um warning: ${JSON.stringify(staleBlockReport)}`);

const staleSelection = state([product('p1')], ['p1'], {
  imageSelections: { p1: { source: 'product', id: 'gone-image' } }
});
const staleSelectionReport = Preflight.inspect(staleSelection);
if (!issue(staleSelectionReport, 'image_selection_fallback') || issue(staleSelectionReport, 'visible_image_missing')) fail(`fallback com Original disponível inválido: ${JSON.stringify(staleSelectionReport)}`);

const noImage = state([product('p1', { image: '' })]);
const noImageReport = Preflight.inspect(noImage);
if (!issue(noImageReport, 'visible_image_missing') || noImageReport.status !== 'review') fail(`imagem ausente deveria ser warning: ${JSON.stringify(noImageReport)}`);

const variantGrid = state([product('p1', { image: '', variants: [{ id: 'black', label: 'Preto', image: image('variant-black') }] })]);
const variantGridReport = Preflight.inspect(variantGrid);
if (issue(variantGridReport, 'visible_image_missing')) fail('Card com grade real de variantes não pode exigir imagem principal');

const tableProducts = [product('p1', { image: '' }), product('p2', { image: '' })];
const tableNoImageColumn = state(tableProducts, ['p1', 'p2'], {
  blocks: [{ id: 'table-no-image', type: 'table', memberIds: ['p1', 'p2'], rowSource: 'products', columns: ['code', 'description'], density: 'compact' }]
});
const tableNoImageColumnReport = Preflight.inspect(tableNoImageColumn);
if (issue(tableNoImageColumnReport, 'visible_image_missing')) fail('Table products sem coluna Imagem não pode gerar warning de imagem');

const commercialProducts = [
  product('p1', { image: '', tableRows: [{ id: 'r1', code: 'P1-A', variant: 'A', package: 'CX', price: '' }] }),
  product('p2', { image: '', tableRows: [{ id: 'r2', code: 'P2-A', variant: 'A', package: 'CX', price: '' }] })
];
const commercialTable = state(commercialProducts, ['p1', 'p2'], {
  blocks: [{ id: 'table-commercial', type: 'table', memberIds: ['p1', 'p2'], rowSource: 'commercialRows', columns: ['variant', 'code', 'package'], density: 'compact' }]
});
const commercialReport = Preflight.inspect(commercialTable);
if (issue(commercialReport, 'visible_image_missing') || issue(commercialReport, 'image_selection_fallback')) fail('commercialRows ganhou semântica de imagem indevida');

const mixed = state([product('p1', { image: '' }), product('p2', { status: 'Inativo' })], ['p1', 'p2', 'gone'], {
  imageSelections: { p1: { source: 'catalog', id: 'missing-local' } }
});
const beforeMixed = JSON.stringify(mixed);
const first = Preflight.inspect(mixed);
const second = Preflight.inspect(mixed);
if (JSON.stringify(first) !== JSON.stringify(second)) fail('Preflight não é determinístico para estado idêntico');
if (JSON.stringify(mixed) !== beforeMixed) fail('Preflight mutou estado durante inspeção composta');
const severityOrder = first.issues.map(item => item.severity).join(',');
if (severityOrder.includes('warning,blocker')) fail(`ordem de severidade inválida: ${severityOrder}`);

console.log('PASS R6a preflight fixture: structural issues, placement-aware images, determinism and non-mutation');
