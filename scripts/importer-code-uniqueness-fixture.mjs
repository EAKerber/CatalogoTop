import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

let id = 0;
const context = vm.createContext({ console, TextDecoder, Uint8Array, Map, Set, Object, Array, String, Number });
context.window = context;
context.window.CatalogoTop = {
  Core: {
    normalizeProduct(product) {
      return {
        ...product,
        id: product.id || `import-${++id}`,
        code: String(product.code || '').trim(),
        description: String(product.description || '').trim(),
        category: String(product.category || '').trim() || 'Sem categoria',
        subcategory: String(product.subcategory || '').trim(),
        specs: Array.isArray(product.specs) ? product.specs : []
      };
    }
  }
};
for (const file of ['product-domain.js', 'importer.js']) {
  vm.runInContext(fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'), context, { filename: `src/${file}` });
}

const { Importer } = context.window.CatalogoTop;
const unique = Importer.sheetRowsFromMatrix([
  ['Código', 'Descrição', 'Categoria'],
  ['ABC', 'Produto A', 'Ferragens'],
  ['DEF', 'Produto B', 'Ferragens']
]);
assert.equal(unique.products.length, 2);

assert.throws(() => Importer.sheetRowsFromMatrix([
  ['Código', 'Descrição'],
  ['ABC', 'Primeiro'],
  [' abc ', 'Segundo']
]), error => error?.code === 'product_code_duplicate' && error.productCode === 'abc' && error.firstIndex === 0 && error.index === 1);

console.log('PASS importer code uniqueness fixture: duplicate normalized codes fail the whole batch before merge');
