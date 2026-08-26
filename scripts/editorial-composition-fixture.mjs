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

if (Composition.styleFor(balanced, 'novo').contentPreset !== 'visual') fail('cards sem override devem usar Visual como padrão');
if (!Composition.CONTENT_PRESETS.some(item => item.id === 'essential') || !Composition.CONTENT_PRESETS.some(item => item.id === 'detailed')) fail('presets devem cobrir densidade essencial e detalhada');

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
if (emphasized.items.map(item => item.product.id).join(',') !== 'a,b,c') fail('Destaque deve liderar o fluxo e Hero deve ancorar o final da página');
const a = emphasized.items.find(item => item.product.id === 'a');
const b = emphasized.items.find(item => item.product.id === 'b');
const c = emphasized.items.find(item => item.product.id === 'c');
if (a.span !== 4 || b.span !== 2 || a.row !== 1 || b.row !== 1) fail('Destaque deve formar 4+2 acima do Hero');
if (c.span !== 6 || c.row !== 2) fail('Hero deve ocupar linha inteira depois do fluxo residual');

const heroPresentation = Composition.normalizePresentation({
  distribution: 'balanced',
  itemStyles: { hero: { emphasis: 'hero', contentPreset: 'visual' } }
});
const heroWithFive = Composition.paginateProducts([
  product('n1'), product('n2'), product('n3'), product('n4'), product('n5'), product('hero')
], technical, heroPresentation);
if (heroWithFive.length !== 1) fail('cinco normais + Hero devem caber em uma página técnica');
const heroPage = heroWithFive[0].layout;
const heroItem = heroPage.items.find(item => item.product.id === 'hero');
if (heroItem.row !== heroPage.rowCount || heroItem.row !== 4) fail('Hero deve ser a última linha usada e a sobra deve ficar acima');
if (heroPage.rows[2].reduce((sum, item) => sum + item.span, 0) !== 6) fail('linha residual acima do Hero deve ser rebalanceada, sem vazio horizontal evitável');

for (const [template, count] of [[compact, 7], [showcase, 3]]) {
  const products = Array.from({ length: count }, (_, index) => product(`p${index + 1}`)).concat(product('hero'));
  const pages = Composition.paginateProducts(products, template, heroPresentation);
  const first = pages[0].layout;
  const hero = first.items.find(item => item.product.id === 'hero');
  if (!hero || hero.row !== first.rowCount) fail(`Hero deve ancorar a última linha em ${template.id}`);
}

const multiHeroPresentation = Composition.normalizePresentation({
  distribution: 'balanced',
  itemStyles: {
    h1: { emphasis: 'hero', contentPreset: 'visual' },
    h2: { emphasis: 'hero', contentPreset: 'visual' }
  }
});
const multiHero = Composition.paginateProducts([
  product('a'), product('b'), product('c'), product('d'), product('h1'), product('h2')
], technical, multiHeroPresentation);
if (multiHero.length !== 2) fail('dois Heroes devem gerar ao menos uma página por âncora');
if (multiHero.some(page => page.layout.items.filter(item => item.style.emphasis === 'hero').length !== 1)) fail('cada página pode materializar no máximo um Hero');
if (multiHero.some(page => page.layout.items.at(-1)?.style.emphasis !== 'hero')) fail('Hero deve ser o último item materializado da página');

const autoTechnical = Composition.resolveContentPreset(product('t', { specs: [1,2,3,4,5].map(value => ({ label: 'x', value })) }), 'auto');
const autoDetailed = Composition.resolveContentPreset(product('d', { specs: [1,2,3].map(value => ({ label: 'x', value })) }), 'auto');
const autoCommercial = Composition.resolveContentPreset(product('p', { price: 'R$ 10,00', specs: [{ label: 'x', value: 'y' }] }), 'auto');
const autoVisual = Composition.resolveContentPreset(product('v', { variants: [1,2,3,4].map(index => ({ id: String(index), label: `Cor ${index}` })) }), 'auto');
const autoSimple = Composition.resolveContentPreset(product('s'), 'auto');
if (autoTechnical !== 'technical' || autoDetailed !== 'detailed' || autoCommercial !== 'commercial' || autoVisual !== 'visual' || autoSimple !== 'visual') fail('preset Auto deve ser determinístico e tender a Visual quando o conteúdo é simples');

const paginated = Composition.paginateProducts([
  product('h1'), product('h2'), product('h3'), product('h4'), product('h5')
], { id: 'one-row', columns: 2, rows: 1, perPage: 2 }, Composition.normalizePresentation({ distribution: 'balanced' }));
if (paginated.length !== 3) fail('planner deve paginar por linhas físicas, não apenas por perPage nominal');

console.log('PASS editorial composition fixture');
