import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const app = read('src/app.js');
const cadastro = read('src/cadastro-surface.js');
const html = read('index.html');
const snapshot = read('src/product-snapshot.js');
const migration = read('src/product-folder-migration.js');

assert.ok(
  app.includes('NS.CadastroSurface?.assignProduct') && app.includes('NS.CadastroSurface.assignProduct(draft, product)'),
  'submit do Cadastro deve preferir a autoridade explícita de assignment da superfície R1'
);
assert.ok(
  cadastro.includes('function assignProduct(draft, product)') && cadastro.includes('ProductSnapshot.assignPathProduct'),
  'CadastroSurface deve materializar intenção de caminho via ProductSnapshot, não reinterpretar mirrors legados'
);
assert.ok(
  snapshot.includes('function resolvePath(folders, segments') && snapshot.includes('function assignPathProduct'),
  'ProductSnapshot deve expor contrato explícito para caminhos V2 profundos'
);
assert.ok(
  snapshot.includes('resolvePath(folders, legacySegments(product), options)'),
  'adaptador legado deve continuar separado da operação explícita de path'
);
assert.ok(
  migration.includes('const subcategory = FolderTree.displayName(product?.subcategory);') &&
  migration.includes('return subcategory ? [category, subcategory] : [category];'),
  'migração V1 deve continuar tratando subcategory histórica como um único segmento'
);
assert.ok(
  !migration.includes('.split(/\\s+\\/\\s+/)') && !migration.includes('legacySubcategorySegments'),
  'migração histórica não pode inferir profundidade V2 a partir do texto legado'
);
assert.ok(
  cadastro.includes('ProductQuery.query') && cadastro.includes('recursive: true') && cadastro.includes('ProductDomain.cloneAsNewProduct'),
  'consulta contextual e Usar como base devem reutilizar autoridades de R1c'
);
assert.ok(
  cadastro.includes('data-cadastro-library') && cadastro.includes('NS.ProductLibrary?.openProduct?.(id)'),
  'Cadastro deve oferecer handoff explícito para a Biblioteca sem incorporar administração destrutiva'
);
assert.ok(
  !cadastro.includes('data-r1d-legacy-product-list-compat') && !html.includes('data-r1d-legacy-product-list-compat') &&
  !html.includes('category-browser.css') && !html.includes('src/category-browser.js') && !html.includes('src/product-delete-ui.js'),
  'R1f deve retirar o shim/filesystem V1 do bootstrap, não apenas escondê-lo'
);
assert.deepEqual(
  [...html.matchAll(/data-tab="([^"]+)"/g)].map(match => match[1]),
  ['products', 'catalog', 'library'],
  'navegação primária final de R1 deve ser Cadastro | Catálogo | Biblioteca'
);
assert.equal(html.includes('id="templates"'), false, 'Templates não deve permanecer como painel top-level');
assert.ok(html.includes('id="catalogTemplate"'), 'seleção de template deve continuar dentro de Catálogo');

console.log('PASS Cadastro surface static fixture: shell R1 final, explicit V2 paths, R1c reuse, Library handoff and no legacy shim');
