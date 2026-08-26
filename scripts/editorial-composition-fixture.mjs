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
const balanced = Composition.normalizePresentation({ distribution: 'balanced' });

const five = Composition.planProducts(['a', 'b', 'c', 'd', 'e'].map(id => product(id)), compact, balanced);
if (five.rowCount !== 2) fail('cinco produtos compactos devem ocupar duas linhas balanceadas');
if (five.rows[0].map(item => item.span).join(',') !== '2,2,2') fail('primeira linha compacta deve preservar três cards');
if (five.rows[1].map(item => item.span).join(',') !== '3,3') fail('último par deve ocupar metade da linha cada');
if (five.rows.some(row => row.reduce((sum, item) => sum + item.span, 0) !== 6)) fail('linhas balanceadas não podem deixar colunas vazias evitáveis');

const seven = Composition.planProducts(['a','b','c','d','e','f','g'].map(id => product(id)), compact, balanced);
if (seven.rowCount !== 3) fail('sete produtos compactos devem usar três linhas');
if (seven.rows.some(row => row.reduce((sum, item) => sum + item.span, 0) !== 6)) fail('sete produtos devem preencher todas as linhas planejadas');

const presentation = Composition.normalizePresentation({
  distribution: 'editorial',
  typography: 'editorial',
  itemStyles: {
    a: { emphasis: 'feature', contentPreset: 'visual' },
    c: { emphasis: 'hero', contentPreset: 'technical' }
  }
});
const emphasized = Composition.planProducts([product('a'), product('b'), product('c')], technical, presentation);
const a = emphasized.items.find(item => item.product.id === 'a');
const b = emphasized.items.find(item => item.product.id === 'b');
const c = emphasized.items.find(item => item.product.id === 'c');
if (a.span !== 4 || b.span !== 2) fail('destaque deve aceitar card normal reduzido para completar seis colunas');
if (c.span !== 6) fail('hero deve ocupar a linha inteira');
if (c.row <= a.row) fail('hero deve iniciar linha própria preservando ordem');

const autoTechnical = Composition.resolveContentPreset(product('t', { specs: [1,2,3,4,5].map(value => ({ label: 'x', value })) }), 'auto');
const autoCommercial = Composition.resolveContentPreset(product('p', { price: 'R$ 10,00', specs: [{ label: 'x', value: 'y' }] }), 'auto');
const autoVisual = Composition.resolveContentPreset(product('v', { variants: [1,2,3,4].map(index => ({ id: String(index), label: `Cor ${index}` })) }), 'auto');
if (autoTechnical !== 'technical' || autoCommercial !== 'commercial' || autoVisual !== 'visual') fail('preset Auto deve ser determinístico por conteúdo');

const paginated = Composition.paginateProducts([
  product('h1'), product('h2'), product('h3'), product('h4'), product('h5')
], { id: 'one-row', columns: 2, rows: 1, perPage: 2 }, Composition.normalizePresentation({ distribution: 'balanced' }));
if (paginated.length !== 3) fail('planner deve paginar por linhas físicas, não apenas por perPage nominal');

console.log('PASS editorial composition fixture');
