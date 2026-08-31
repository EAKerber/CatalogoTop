import assert from 'node:assert/strict';
import { CATALOG_SNAPSHOT_VERSION, validateCatalogSnapshot } from '../netlify/lib/catalog-snapshot.mts';

assert.equal(CATALOG_SNAPSHOT_VERSION, 1);

const folders = [
  { id: 'root', parentId: null, name: 'Campanhas' },
  { id: 'f1', parentId: 'root', name: '2026' }
];
const catalog = {
  id: 'catalog-1',
  folderId: 'f1',
  createdAt: '2026-08-31T02:00:00.000Z',
  updatedAt: '2026-08-31T02:00:00.000Z',
  selectedIds: ['p1', 'missing-product'],
  catalog: {
    title: 'Catálogo agosto',
    templateId: 'technical',
    showPrices: true,
    dateOverride: '2026-08-31',
    createdAt: '2026-08-31T12:00:00.000Z',
    presentation: { order: ['p1', 'missing-product'], blocks: [] }
  }
};

assert.equal(validateCatalogSnapshot(folders, [catalog]), '');
assert.equal(validateCatalogSnapshot([], [{ ...catalog, folderId: null }]), '', 'root virtual deve aceitar catálogo sem pasta explícita');
assert.match(validateCatalogSnapshot(folders, [{ ...catalog, folderId: 'missing' }]), /folderId inexistente/);
assert.match(validateCatalogSnapshot(folders, [catalog, { ...catalog }]), /ID de catálogo duplicado/);
assert.match(validateCatalogSnapshot(folders, [{ ...catalog, selectedIds: ['p1', 'p1'] }]), /referência de produto duplicada/);
assert.match(validateCatalogSnapshot(folders, [{ ...catalog, catalog: { ...catalog.catalog, title: '' } }]), /título inválido/);
assert.match(validateCatalogSnapshot(folders, [{ ...catalog, catalog: { ...catalog.catalog, presentation: [] } }]), /presentation inválida/);
assert.match(validateCatalogSnapshot([
  { id: 'a', parentId: null, name: 'Campanhas' },
  { id: 'b', parentId: null, name: 'campanhas' }
], []), /duplicado entre irmãos/, 'provider de catálogo deve reutilizar os mesmos guards estruturais de FolderTree');

console.log('PASS server catalog snapshot fixture: separate catalog provider validation, folder guards and stale product references');
