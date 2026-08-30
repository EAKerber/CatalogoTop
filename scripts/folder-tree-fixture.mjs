import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadFolderTree() {
  const context = vm.createContext({ window: {}, console });
  vm.runInContext(fs.readFileSync(new URL('../src/folder-tree.js', import.meta.url), 'utf8'), context, { filename: 'src/folder-tree.js' });
  return context.window.CatalogoTop.FolderTree;
}

const FolderTree = loadFolderTree();

assert.equal(FolderTree.displayName('  Corrediças   Telescópicas  '), 'Corrediças Telescópicas');
assert.equal(FolderTree.nameKey(' Corrediças '), 'corredicas');
assert.equal(FolderTree.nameKey('CORREDICAS'), 'corredicas');

const base = [
  { id: 'ferragens', parentId: null, name: 'Ferragens' },
  { id: 'corredicas', parentId: 'ferragens', name: 'Corrediças' },
  { id: 'telescopicas', parentId: 'corredicas', name: 'Telescópicas' },
  { id: 'invisiveis', parentId: 'corredicas', name: 'Invisíveis' },
  { id: 'dobradicas', parentId: 'ferragens', name: 'Dobradiças' }
];

assert.deepEqual(Array.from(FolderTree.childrenOf(base, 'ferragens'), item => item.id), ['corredicas', 'dobradicas']);
assert.deepEqual(Array.from(FolderTree.descendantsOf(base, 'ferragens'), item => item.id), ['corredicas', 'dobradicas', 'telescopicas', 'invisiveis']);
assert.deepEqual(Array.from(FolderTree.ancestorsOf(base, 'telescopicas'), item => item.id), ['ferragens', 'corredicas']);
assert.deepEqual(Array.from(FolderTree.pathOf(base, 'telescopicas'), item => item.name), ['Ferragens', 'Corrediças', 'Telescópicas']);
assert.equal(FolderTree.contains(base, 'ferragens', 'telescopicas'), true);
assert.equal(FolderTree.contains(base, 'telescopicas', 'ferragens'), false);
assert.equal(FolderTree.contains(base, 'corredicas', 'corredicas'), true);

const renamed = FolderTree.renameFolder(base, 'corredicas', 'Guias');
assert.equal(renamed.find(item => item.id === 'corredicas').name, 'Guias');
assert.equal(renamed.find(item => item.id === 'telescopicas').parentId, 'corredicas');

const moved = FolderTree.moveFolder(base, 'corredicas', null);
assert.equal(moved.find(item => item.id === 'corredicas').parentId, null);
assert.equal(moved.find(item => item.id === 'telescopicas').parentId, 'corredicas');
assert.deepEqual(Array.from(FolderTree.pathOf(moved, 'telescopicas'), item => item.id), ['corredicas', 'telescopicas']);

const created = FolderTree.createFolder(base, { id: 'pistoes', parentId: 'ferragens', name: 'Pistões' });
assert.equal(created.some(item => item.id === 'pistoes'), true);
const removed = FolderTree.deleteEmptyFolder(created, 'pistoes');
assert.equal(removed.some(item => item.id === 'pistoes'), false);

assert.throws(() => FolderTree.normalize([
  { id: 'a', parentId: null, name: 'Corrediças' },
  { id: 'b', parentId: null, name: 'corredicas' }
]), error => error?.code === 'folder_sibling_name_duplicate');

assert.throws(() => FolderTree.normalize([
  { id: 'a', parentId: 'missing', name: 'A' }
]), error => error?.code === 'folder_parent_missing');

assert.throws(() => FolderTree.normalize([
  { id: 'a', parentId: 'b', name: 'A' },
  { id: 'b', parentId: 'a', name: 'B' }
]), error => error?.code === 'folder_cycle');

assert.throws(() => FolderTree.moveFolder(base, 'corredicas', 'telescopicas'), error => error?.code === 'folder_cycle');
assert.throws(() => FolderTree.deleteEmptyFolder(base, 'corredicas'), error => error?.code === 'folder_not_empty');
assert.throws(() => FolderTree.deleteEmptyFolder(base, 'dobradicas', { occupiedFolderIds: ['dobradicas'] }), error => error?.code === 'folder_not_empty');

console.log('PASS folder tree fixture: normalization, hierarchy, stable moves/renames and fail-closed guards');
