import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile('src/composition.js', 'utf8');
const context = {
  window: { CatalogoTop: {} },
  console,
  Object,
  Array,
  Math,
  Number,
  String
};
context.window.window = context.window;
vm.runInNewContext(source, context, { filename: 'src/composition.js' });

const Composition = context.window.CatalogoTop.Composition;
const fail = message => { throw new Error(message); };
const product = (id, extra = {}) => ({ id, code: id.toUpperCase(), description: `Produto ${id}`, specs: [], variants: [], tableRows: [], ...extra });

const compact = { id: 'compact', columns: 3, rows: 4, perPage: 12 };
const technical = { id: 'technical', columns: 2, rows: 4, perPage: 8 };
const showcase = { id: 'showcase', columns: 2, rows: 3, perPage: 6 };
const balanced = Composition.normalizePresentation({ distribution: 'balanced' });

const defaultStyle = Composition.styleFor(balanced, 'novo');
if (defaultStyle.contentPreset !== 'visual') fail('cards sem override devem usar Visual como padrão');
if (defaultStyle.emphasis !== 'normal') fail('ênfase padrão deve ser visualmente normal');
if (defaultStyle.width !== 'simple') fail('largura padrão deve ocupar um slot');
if (!Composition.WIDTH_PRESETS.some(item => item.id === 'wide') || !Composition.WIDTH_PRESETS.some(item => item.id === 'full')) fail('larguras devem cobrir simples, largo e linha inteira');
if (Composition.EMPHASIS_PRESETS.some(item => item.id === 'hero')) fail('Hero não pode continuar como primitiva estrutural de ênfase');

const legacyHero = Composition.normalizeItemStyle({ emphasis: 'hero', contentPreset: 'visual' });
if (legacyHero.emphasis !== 'feature' || legacyHero.width !== 'full') fail('Hero legado deve migrar para Destaque visual + Linha inteira');

const technicalSimple = Composition.planProducts([product('a'), product('b')], technical, balanced);
if (technicalSimple.rowCount !== 1) fail('dois cards simples devem preencher uma linha técnica');
if (technicalSimple.rows[0].map(item => item.slotSpan).join(',') !== '1,1') fail('cards simples devem preservar um slot cada');
if (technicalSimple.rows[0].map(item => item.span).join(',') !== '3,3') fail('um slot técnico deve equivaler a 3/6 da micrograde');

const compactMixed = Composition.normalizePresentation({
  itemStyles: {
    a: { width: 'simple' },
    b: { width: 'wide' }
  }
});
const compactRow = Composition.planProducts([product('a'), product('b')], compact, compactMixed);
if (compactRow.rowCount !== 1) fail('simples + largo devem preencher uma linha compacta');
if (compactRow.rows[0].map(item => item.slotSpan).join(',') !== '1,2') fail('compacto deve materializar 1 + 2 slots');
if (compactRow.rows[0].map(item => item.span).join(',') !== '2,4') fail('compacto deve converter slots para 2/6 + 4/6');

const fullAfterResidualPresentation = Composition.normalizePresentation({
  itemStyles: {
    c: { width: 'full', emphasis: 'feature', contentPreset: 'visual' }
  }
});
const fullAfterResidual = Composition.planProducts([product('a'), product('b'), product('c')], compact, fullAfterResidualPresentation);
if (fullAfterResidual.rowCount !== 2) fail('linha inteira deve iniciar nova linha quando não couber no residual');
if (fullAfterResidual.rows[0].map(item => item.product.id).join(',') !== 'a,b') fail('conteúdo anterior deve permanecer acima do card de linha inteira');
const full = fullAfterResidual.items.find(item => item.product.id === 'c');
if (!full || full.row !== 2 || full.slotSpan !== 3 || full.span !== 6) fail('linha inteira compacta deve ocupar todos os três slots / 6 colunas');

const featurePresentation = Composition.normalizePresentation({
  itemStyles: {
    b: { emphasis: 'feature', width: 'simple' }
  }
});
const featurePlan = Composition.planProducts([product('a'), product('b'), product('c')], technical, featurePresentation);
if (featurePlan.items.map(item => item.product.id).join(',') !== 'a,b,c') fail('ênfase visual não deve reordenar produtos');
const feature = featurePlan.items.find(item => item.product.id === 'b');
if (feature.slotSpan !== 1 || feature.span !== 3) fail('Destaque visual não pode alterar largura física');

const wideTechnical = Composition.normalizePresentation({ itemStyles: { wide: { width: 'wide' } } });
const wideTechnicalPlan = Composition.planProducts([product('wide')], technical, wideTechnical);
if (wideTechnicalPlan.items[0].slotSpan !== 2 || wideTechnicalPlan.items[0].span !== 6) fail('Largo em template de duas colunas deve ocupar a linha inteira naturalmente');

const fullCompactPresentation = Composition.normalizePresentation({ itemStyles: { full: { width: 'full' } } });
const paginated = Composition.paginateProducts([
  product('a'), product('b'), product('c'), product('d'), product('e'), product('f'), product('full'), product('g')
], compact, fullCompactPresentation);
if (paginated.length !== 1) fail('seis simples + full + simples devem caber em quatro linhas compactas');
if (paginated[0].layout.items.map(item => item.product.id).join(',') !== 'a,b,c,d,e,f,full,g') fail('paginação deve preservar ordem factual da seleção');
if (paginated[0].layout.items.find(item => item.product.id === 'full').row !== 3) fail('card full deve ocupar a terceira linha após seis simples');

const oneRowPresentation = Composition.normalizePresentation({ itemStyles: { b: { width: 'full' } } });
const oneRowPages = Composition.paginateProducts([
  product('a'), product('b'), product('c')
], { id: 'one-row', columns: 2, rows: 1, perPage: 2 }, oneRowPresentation);
if (oneRowPages.length !== 3) fail('largura explícita deve participar da paginação física por linhas');

const autoTechnical = Composition.resolveContentPreset(product('t', { specs: [1,2,3,4,5].map(value => ({ label: 'x', value })) }), 'auto');
const autoDetailed = Composition.resolveContentPreset(product('d', { specs: [1,2,3].map(value => ({ label: 'x', value })) }), 'auto');
const autoCommercial = Composition.resolveContentPreset(product('p', { price: 'R$ 10,00', specs: [{ label: 'x', value: 'y' }] }), 'auto');
const autoVisual = Composition.resolveContentPreset(product('v', { variants: [1,2,3,4].map(index => ({ id: String(index), label: `Cor ${index}` })) }), 'auto');
const autoSimple = Composition.resolveContentPreset(product('s'), 'auto');
if (autoTechnical !== 'technical' || autoDetailed !== 'detailed' || autoCommercial !== 'commercial' || autoVisual !== 'visual' || autoSimple !== 'visual') fail('preset Auto deve ser determinístico e tender a Visual quando o conteúdo é simples');

for (const template of [technical, compact, showcase]) {
  const style = Composition.normalizePresentation({ itemStyles: { x: { width: 'full' } } });
  const layout = Composition.planProducts([product('x')], template, style);
  if (layout.items[0].slotSpan !== template.columns || layout.items[0].span !== 6) fail(`Linha inteira deve ocupar todos os slots em ${template.id}`);
}

console.log('PASS editorial composition fixture');
