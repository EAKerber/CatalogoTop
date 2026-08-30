import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ console, Date, Object, Array, String, Map, Set });
context.window = context;
context.window.CatalogoTop = {};
vm.runInContext(fs.readFileSync(new URL('../src/product-domain.js', import.meta.url), 'utf8'), context, { filename: 'src/product-domain.js' });

const { ProductDomain } = context.window.CatalogoTop;
assert.ok(ProductDomain);
assert.equal(ProductDomain.codeKey('  AbC-10  '), 'abc-10');
assert.equal(ProductDomain.codeKey('A B'), 'a b', 'canonicalização de código não deve remover espaço interno silenciosamente');

const products = [
  { id: 'p1', code: ' ABC-10 ' },
  { id: 'p2', code: 'XYZ' }
];
assert.equal(ProductDomain.findCodeConflict(products, 'abc-10')?.id, 'p1');
assert.equal(ProductDomain.findCodeConflict(products, 'ABC-10', { exceptId: 'p1' }), null);
assert.throws(() => ProductDomain.assertCodeAvailable(products, ' abc-10 '), error => error?.code === 'product_code_duplicate' && error.conflictId === 'p1');
assert.throws(() => ProductDomain.assertUniqueCodes([
  { id: 'a', code: 'Code' },
  { id: 'b', code: ' code ' }
]), error => error?.code === 'product_code_duplicate' && error.firstIndex === 0 && error.index === 1);
assert.equal(ProductDomain.assertUniqueCodes([{ id: 'draft-a', code: '' }, { id: 'draft-b', code: '   ' }]), true, 'drafts sem código não colidem entre si');

const source = {
  id: 'source-id',
  folderId: 'folder-deep',
  code: '1265',
  description: 'Corrediça telescópica',
  category: 'Ferragens',
  subcategory: 'Corrediças / Telescópicas',
  price: 'R$ 10,00',
  quantityPrice: { minQuantity: 15, price: 'R$ 8,00' },
  status: 'Ativo',
  notes: 'Nota',
  image: '/api/assets/sha256/source',
  imageGallery: [{ id: 'g1', label: 'Frente', image: '/api/assets/sha256/gallery', provenance: { kind: 'approved' } }],
  specs: [{ label: 'Carga', value: '35 kg' }],
  variants: [{ id: 'v1', label: 'Preto', image: '/api/assets/sha256/variant' }],
  tableRows: [{ id: 'r1', variant: '300 mm', code: '1265-300', price: 'R$ 12,00', quantityPrice: { minQuantity: 15, price: 'R$ 9,00' } }],
  updatedAt: '2025-01-01T00:00:00.000Z',
  catalogMembership: ['must-not-copy']
};

const clone = ProductDomain.cloneAsNewProduct(source, {
  idFactory: () => 'clone-id',
  now: () => '2026-08-30T22:00:00.000Z'
});
assert.equal(clone.id, 'clone-id');
assert.equal(clone.code, '');
assert.equal(clone.folderId, source.folderId);
assert.equal(clone.description, source.description);
assert.equal(clone.image, source.image, 'asset content-addressed deve ser referenciado, não duplicado');
assert.equal(clone.imageGallery[0].image, source.imageGallery[0].image);
assert.equal(clone.updatedAt, '2026-08-30T22:00:00.000Z');
assert.equal('catalogMembership' in clone, false, 'clone deve usar whitelist factual, não spread do produto inteiro');
assert.equal('presentation' in clone, false);

clone.specs[0].value = 'alterado';
clone.imageGallery[0].provenance.kind = 'changed';
clone.tableRows[0].quantityPrice.price = 'R$ 1,00';
assert.equal(source.specs[0].value, '35 kg', 'clone deve desacoplar estruturas mutáveis do draft');
assert.equal(source.imageGallery[0].provenance.kind, 'approved');
assert.equal(source.tableRows[0].quantityPrice.price, 'R$ 9,00');

assert.throws(() => ProductDomain.cloneAsNewProduct(source), error => error?.code === 'product_clone_id_factory_required');

console.log('PASS product domain fixture: code key/uniqueness and explicit clone-as-new contract');
