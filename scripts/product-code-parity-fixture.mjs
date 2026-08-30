import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { productCodeKey, validateUniqueProductCodes } from '../netlify/lib/product-codes.mts';

const context = vm.createContext({ window: {}, console, Object, Array, String, Map, Set, Date });
vm.runInContext(fs.readFileSync(new URL('../src/product-domain.js', import.meta.url), 'utf8'), context, { filename: 'src/product-domain.js' });
const { ProductDomain } = context.window.CatalogoTop;

for (const value of ['ABC', ' abc ', 'ÁBC', 'A B', 'ＡＢＣ']) {
  assert.equal(productCodeKey(value), ProductDomain.codeKey(value), `browser/server divergiram para ${value}`);
}

const valid = [
  { id: 'p1', code: 'ABC', description: 'Um' },
  { id: 'p2', code: 'DEF', description: 'Dois' }
];
assert.equal(validateUniqueProductCodes(valid), '');
assert.match(validateUniqueProductCodes([
  { id: 'p1', code: 'ABC', description: 'Um' },
  { id: 'p2', code: ' abc ', description: 'Dois' }
]), /Código de produto duplicado/);
assert.equal(ProductDomain.duplicateCodes(valid).length, 0);
assert.equal(ProductDomain.duplicateCodes([
  { id: 'p1', code: 'ABC' },
  { id: 'p2', code: ' abc ' }
]).length, 1);

console.log('PASS product code parity fixture: browser/server use trim + case-insensitive canonical code identity');
