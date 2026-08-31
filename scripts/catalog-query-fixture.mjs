import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ console, Object, Array, String, Map, Set });
context.window = context;
context.window.CatalogoTop = {};
for (const file of ['folder-tree.js', 'catalog-query.js']) {
  vm.runInContext(fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'), context, { filename: `src/${file}` });
}

const { CatalogQuery } = context.window.CatalogoTop;
const folders = [
  { id: 'clients', parentId: null, name: 'Clientes' },
  { id: 'acme', parentId: 'clients', name: 'Ácme' },
  { id: 'q3', parentId: 'acme', name: '2026 Q3' },
  { id: 'archive', parentId: null, name: 'Arquivo' }
];
const catalogs = [
  { id: 'root', folderId: null, selectedIds: ['P-ROOT'], catalog: { title: 'Sem pasta' } },
  { id: 'acme-main', folderId: 'acme', selectedIds: ['P-10'], catalog: { title: 'Catálogo Ácme' } },
  { id: 'q3-price', folderId: 'q3', selectedIds: ['P-20', 'P-21'], catalog: { title: 'Tabela Setembro' } },
  { id: 'archive-old', folderId: 'archive', selectedIds: ['LEG-9'], catalog: { title: 'Catálogo antigo' } }
];

assert.deepEqual(
  Array.from(CatalogQuery.query({ catalogs, folders, folderId: 'clients', recursive: true }), record => record.id),
  ['acme-main', 'q3-price'],
  'escopo recursivo deve incluir catálogos em descendentes'
);
assert.deepEqual(
  Array.from(CatalogQuery.query({ catalogs, folders, folderId: 'acme', recursive: false }), record => record.id),
  ['acme-main'],
  'escopo direto deve limitar à pasta selecionada'
);
assert.equal(CatalogQuery.query({ catalogs, folders }).length, catalogs.length, 'sem folderId deve consultar todos os catálogos, inclusive raiz');
assert.deepEqual(
  Array.from(CatalogQuery.query({ catalogs, folders, text: 'acme' }), record => record.id),
  ['acme-main', 'q3-price'],
  'busca deve ser accent-insensitive e considerar título antes do path de descendentes'
);
assert.deepEqual(
  Array.from(CatalogQuery.query({ catalogs, folders, text: '2026 q3' }), record => record.id),
  ['q3-price'],
  'path de pasta deve participar da busca'
);
assert.deepEqual(
  Array.from(CatalogQuery.query({ catalogs, folders, text: 'p-21' }), record => record.id),
  ['q3-price'],
  'IDs de produtos referenciados devem participar da busca'
);
assert.throws(
  () => CatalogQuery.query({ catalogs, folders, folderId: 'missing' }),
  error => error?.code === 'folder_not_found',
  'scope de pasta inexistente deve falhar fechado'
);

console.log('PASS catalog query fixture: recursive/direct folder scope, accent-insensitive title/path, stale product refs and fail-closed scope');
