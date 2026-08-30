import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const app = read('src/app.js');
const cadastro = read('src/category-browser.js');
const snapshot = read('src/product-snapshot.js');
const migration = read('src/product-folder-migration.js');

assert.ok(
  app.includes('NS.CadastroSurface?.assignProduct') && app.includes('NS.CadastroSurface.assignProduct(draft, product)'),
  'submit do Cadastro deve preferir a autoridade explícita de assignment da superfície R1d'
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
  cadastro.includes('if (deleteButton) deleteButton.hidden = true') && cadastro.includes('data-r1d-legacy-product-list-compat'),
  'Cadastro não deve reexpor exclusão; shim legado permanece explicitamente hidden até R1f'
);

console.log('PASS Cadastro surface static fixture: explicit V2 paths, R1c reuse, hidden legacy shim and V1 migration preservation');
