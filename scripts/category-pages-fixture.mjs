import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile('src/render.js', 'utf8');
const context = {
  window: { CatalogoTop: {} },
  console,
  Intl,
  Date,
  Map,
  Math,
  String,
  Array,
  Number,
  encodeURIComponent
};
context.window.window = context.window;
vm.runInNewContext(source, context, { filename: 'src/render.js' });

const { buildCategoryPages } = context.window.CatalogoTop.Render;
const products = [
  { id: 'd1', code: 'D1', description: 'Dobradiça A', category: 'Dobradiças', status: 'Ativo' },
  { id: 'c1', code: 'C1', description: 'Corrediça A', category: 'Corrediças', status: 'Ativo' },
  { id: 'd2', code: 'D2', description: 'Dobradiça B', category: 'Dobradiças', status: 'Ativo' },
  { id: 'p1', code: 'P1', description: 'Pistão A', category: 'Pistões', status: 'Ativo' },
  { id: 'd3', code: 'D3', description: 'Dobradiça C', category: 'Dobradiças', status: 'Ativo' },
  { id: 'd4', code: 'D4', description: 'Dobradiça D', category: 'Dobradiças', status: 'Ativo' },
  { id: 'd5', code: 'D5', description: 'Dobradiça E', category: 'Dobradiças', status: 'Ativo' },
  { id: 'x1', code: 'X1', description: 'Inativo', category: 'Outros', status: 'Inativo' }
];
const state = {
  products,
  selectedIds: ['d1', 'c1', 'd2', 'p1', 'd3', 'd4', 'd5', 'x1'],
  catalog: { title: 'Catálogo', templateId: 'technical', showPrices: true, createdAt: '2026-08-25T12:00:00Z' }
};

const result = buildCategoryPages(state, 3);
const fail = message => { throw new Error(message); };

if (result.selected.length !== 7) fail('inativos devem ser ignorados');
if (result.groups.map(group => group.category).join('|') !== 'Dobradiças|Corrediças|Pistões') fail('ordem de categorias deve seguir primeira aparição');
if (result.groups[0].products.map(product => product.id).join('|') !== 'd1|d2|d3|d4|d5') fail('ordem interna da categoria deve preservar seleção');
if (result.pages.length !== 4) fail('paginação por categoria deve produzir 4 páginas com perPage=3');
if (result.pages.map(page => page.category).join('|') !== 'Dobradiças|Dobradiças|Corrediças|Pistões') fail('nenhuma página pode misturar categorias');
if (result.pages[0].products.length !== 3 || result.pages[1].products.length !== 2) fail('categoria deve paginar independentemente');
if (result.pages[2].categoryPageIndex !== 0 || result.pages[3].categoryPageIndex !== 0) fail('nova categoria deve iniciar nova sequência de página');
if (result.pages.some(page => page.products.some(product => product.category !== page.category))) fail('produto não pode aparecer em página de outra categoria');

console.log('PASS category pagination fixture');
