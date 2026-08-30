import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('index.html');
const domain = read('src/product-domain.js');
const query = read('src/product-query.js');
const snapshot = read('src/product-snapshot.js');
const importer = read('src/importer.js');
const storage = read('netlify/lib/storage.mts');
const serverCodes = read('netlify/lib/product-codes.mts');
const app = read('src/app.js');

const migrationIndex = html.indexOf('src/product-folder-migration.js');
const domainIndex = html.indexOf('src/product-domain.js');
const snapshotIndex = html.indexOf('src/product-snapshot.js');
const queryIndex = html.indexOf('src/product-query.js');
const coreIndex = html.indexOf('src/core.js');

assert.ok(migrationIndex >= 0 && domainIndex > migrationIndex, 'ProductDomain deve ter bootstrap estático após migration');
assert.ok(snapshotIndex > domainIndex, 'ProductSnapshot deve consumir ProductDomain já materializado');
assert.ok(queryIndex > snapshotIndex && coreIndex > queryIndex, 'ProductQuery deve estar estático antes do Core sem loader dinâmico');
assert.equal((html.match(/src\/product-domain\.js/g) || []).length, 1, 'ProductDomain deve carregar uma vez');
assert.equal((html.match(/src\/product-query\.js/g) || []).length, 1, 'ProductQuery deve carregar uma vez');
assert.ok(!domain.includes('MutationObserver') && !query.includes('MutationObserver'), 'domínio/query não devem observar DOM');
assert.ok(!domain.includes('Core.mutate') && !query.includes('Core.mutate'), 'domínio/query devem ser puros e read-only sobre estado recebido');

assert.ok(domain.includes('function cloneAsNewProduct') && domain.includes("code: ''"), 'clone-as-new deve ser autoridade explícita e limpar código');
assert.ok(domain.includes('findCodeConflict') && domain.includes('assertUniqueCodes'), 'ProductDomain deve centralizar identidade por código');
assert.ok(query.includes('FolderTree.descendantsOf') && query.includes('matchScore'), 'ProductQuery deve consultar árvore recursiva e ranking explícito');
assert.ok(snapshot.includes('ProductDomain.assertUniqueCodes(products)'), 'ProductSnapshot v2 deve bloquear colisões antes de aceitar snapshot');
assert.ok(importer.includes('NS.ProductDomain.duplicateCodes(products)') && importer.indexOf('assertUniqueImportCodes(products)') < importer.indexOf('return {\n      products,'), 'importador deve falhar lote duplicado antes de entregar merge');
assert.ok(storage.includes("from './product-codes.mts'") && storage.includes('validateUniqueProductCodes(products)'), 'storage deve usar helper puro de código, não regra ad hoc');
assert.ok(serverCodes.includes("trim().toLowerCase()") && domain.includes("trim().toLowerCase()"), 'browser/server devem compartilhar semântica trim + case-insensitive');

const saveStart = app.indexOf('function save(mutator)');
const saveEnd = app.indexOf('\n  async function publishProducts()', saveStart);
const saveSource = app.slice(saveStart, saveEnd);
assert.ok(saveStart >= 0 && saveSource.includes('try {') && saveSource.includes('Core.mutate(mutator)') && saveSource.includes('catch (error)') && saveSource.includes('alert(error.message'), 'mutação manual rejeitada deve continuar apresentando erro controlado na UI existente');
assert.ok(!domain.includes('selectedIds') && !domain.includes('presentation.imageSelections') && !domain.includes('catalog.presentation'), 'clone/domínio não podem copiar estado editorial do catálogo');

console.log('PASS product domain static fixture: bootstrap, purity, code authority, importer/server wiring and clone boundaries');
