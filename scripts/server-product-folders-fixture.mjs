import assert from 'node:assert/strict';
import { validateProductFolders, PRODUCT_SNAPSHOT_VERSION } from '../netlify/lib/product-folders.mts';

assert.equal(PRODUCT_SNAPSHOT_VERSION, 2);

const folders = [
  { id: 'a', parentId: null, name: 'Ferragens' },
  { id: 'b', parentId: 'a', name: 'Corrediças' },
  { id: 'c', parentId: 'b', name: 'Telescópicas' }
];
const products = [
  { id: 'p1', code: '1265', description: 'Corrediça', folderId: 'c', category: 'Ferragens', subcategory: 'Corrediças / Telescópicas' }
];

assert.equal(validateProductFolders(folders, products), '');
assert.match(validateProductFolders(folders, [{ ...products[0], folderId: 'missing' }]), /folderId inexistente/);
assert.match(validateProductFolders(folders, [{ ...products[0], category: 'Outro' }]), /divergentes de folderId/);
assert.match(validateProductFolders([
  { id: 'a', parentId: null, name: 'Corrediças' },
  { id: 'b', parentId: null, name: 'corredicas' }
], []), /duplicado entre irmãos/);
assert.match(validateProductFolders([
  { id: 'a', parentId: 'b', name: 'A' },
  { id: 'b', parentId: 'a', name: 'B' }
], []), /Ciclo/);
assert.match(validateProductFolders([{ id: 'a', parentId: 'missing', name: 'A' }], []), /Pasta pai ausente/);
assert.match(validateProductFolders([{ id: ' a ', parentId: null, name: 'A' }], []), /ID de pasta inválido/);
assert.match(validateProductFolders([{ id: 'a', parentId: null, name: ' A ' }], []), /Nome de pasta inválido/);

console.log('PASS server product folders fixture: ProductSnapshot v2 folder/reference/mirror validation');
