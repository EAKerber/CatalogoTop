import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ console, Object, Array, String, Map, Set });
context.window = context;
context.window.CatalogoTop = {};
for (const file of ['folder-tree.js', 'product-domain.js', 'product-query.js']) {
  vm.runInContext(fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'), context, { filename: `src/${file}` });
}

const { ProductQuery } = context.window.CatalogoTop;
const folders = [
  { id: 'root', parentId: null, name: 'Ferragens' },
  { id: 'slides', parentId: 'root', name: 'Corrediças' },
  { id: 'telescopic', parentId: 'slides', name: 'Telescópicas' },
  { id: 'hidden', parentId: 'slides', name: 'Invisíveis' },
  { id: 'profiles', parentId: null, name: 'Perfis' }
];
const products = [
  { id: 'root-product', folderId: 'root', code: 'FER-1', description: 'Ferragem geral', category: 'Ferragens', subcategory: '', notes: '', specs: [] },
  { id: 'description-hit', folderId: 'telescopic', code: 'SLD-200', description: 'Corrediça telescópica reforçada', category: 'Ferragens', subcategory: 'Corrediças / Telescópicas', notes: '', specs: [] },
  { id: 'prefix-hit', folderId: 'telescopic', code: 'ABC-200', description: 'Modelo comum', category: 'Ferragens', subcategory: 'Corrediças / Telescópicas', notes: '', specs: [] },
  { id: 'exact-hit', folderId: 'hidden', code: 'ABC', description: 'Modelo invisível', category: 'Ferragens', subcategory: 'Corrediças / Invisíveis', notes: '', specs: [] },
  { id: 'path-hit', folderId: 'telescopic', code: 'ZZZ', description: 'Modelo comum', category: 'Ferragens', subcategory: 'Corrediças / Telescópicas', notes: '', specs: [] },
  { id: 'spec-hit', folderId: 'hidden', code: 'OTHER', description: 'Outro', category: 'Ferragens', subcategory: 'Corrediças / Invisíveis', notes: '', specs: [{ label: 'Linha', value: 'ABC especial' }] },
  { id: 'outside', folderId: 'profiles', code: 'ABC-OUT', description: 'Perfil ABC', category: 'Perfis', subcategory: '', notes: '', specs: [] }
];

assert.deepEqual(
  Array.from(ProductQuery.query({ products, folders, folderId: 'root', recursive: true, text: '' }), product => product.id),
  ['root-product', 'description-hit', 'prefix-hit', 'exact-hit', 'path-hit', 'spec-hit'],
  'pasta recursiva deve incluir diretos + todos os descendentes preservando ordem de origem sem texto'
);
assert.deepEqual(
  Array.from(ProductQuery.query({ products, folders, folderId: 'root', recursive: false, text: '' }), product => product.id),
  ['root-product'],
  'modo direto deve limitar à pasta selecionada'
);
assert.equal(ProductQuery.query({ products, folders, text: '' }).length, products.length, 'sem folderId deve consultar todos os produtos');

const ranked = ProductQuery.query({ products, folders, folderId: 'root', recursive: true, text: 'abc' });
assert.deepEqual(
  Array.from(ranked, product => product.id),
  ['exact-hit', 'prefix-hit', 'spec-hit'],
  'ranking deve priorizar código exato, prefixo e só depois metadados adicionais'
);

const description = ProductQuery.query({ products, folders, folderId: 'slides', text: 'reforcada' });
assert.deepEqual(Array.from(description, product => product.id), ['description-hit'], 'busca textual deve ser accent-insensitive na descrição');
const path = ProductQuery.query({ products, folders, folderId: 'root', text: 'telescopicas' });
assert.deepEqual(Array.from(path, product => product.id), ['description-hit', 'prefix-hit', 'path-hit'], 'path metadata deve participar após descrição/código');
assert.throws(
  () => ProductQuery.query({ products, folders, folderId: 'missing', text: '' }),
  error => error?.code === 'folder_not_found',
  'scope inexistente deve falhar fechado em vez de virar consulta global'
);

console.log('PASS product query fixture: recursive scope depth>2, direct scope, ranking, path metadata and fail-closed folder');
