import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.csv': 'text/csv; charset=utf-8'
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'fixture_offline' }));
      return;
    }
    const rawPath = decodeURIComponent(url.pathname);
    const relative = rawPath === '/' ? 'index.html' : rawPath.replace(/^\/+/, '');
    const safe = normalize(relative).replace(/^(\.\.[/\\])+/, '');
    const file = join(root, safe);
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not file');
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
    response.end(body);
  } catch (_) {
    response.writeHead(404);
    response.end('not found');
  }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}/`;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(
    window.CatalogoTop?.Core &&
    window.CatalogoTop?.FolderTree &&
    window.CatalogoTop?.ProductFolderMigration &&
    window.CatalogoTop?.ProductSnapshot
  ));

  const result = await page.evaluate(() => {
    const NS = window.CatalogoTop;
    const { Core, FolderTree, ProductSnapshot } = NS;
    const catalog = {
      title: 'R1b browser gate',
      templateId: 'technical',
      showPrices: true,
      presentation: { order: [], blocks: [] }
    };
    const folders = [
      { id: 'f-root', parentId: null, name: 'Ferragens' },
      { id: 'f-mid', parentId: 'f-root', name: 'Corrediças' },
      { id: 'f-leaf', parentId: 'f-mid', name: 'Telescópicas' }
    ];

    Core.setState({
      schemaVersion: 8,
      folders,
      products: [{
        id: 'current',
        folderId: 'f-leaf',
        code: 'CUR-1',
        description: 'Produto atual',
        category: 'Ferragens',
        subcategory: 'Corrediças / Telescópicas',
        status: 'Ativo'
      }],
      selectedIds: [],
      catalog
    }, { persist: false });

    const currentBeforeMerge = Core.getState();
    const currentPath = FolderTree.pathOf(currentBeforeMerge.folders, currentBeforeMerge.products[0].folderId).map(item => item.name);

    Core.mergeProducts([{ code: 'CUR-1', description: 'Produto atualizado', price: '25' }]);
    const afterPartialMerge = Core.getState();
    const partialFolderId = afterPartialMerge.products[0].folderId;
    const partialPath = FolderTree.pathOf(afterPartialMerge.folders, partialFolderId).map(item => item.name);
    const flattenedAfterPartial = afterPartialMerge.folders.some(folder => folder.name === 'Corrediças / Telescópicas');

    Core.mergeProducts([{
      code: 'CUR-1',
      description: 'Produto atualizado novamente',
      category: 'Ferragens',
      subcategory: 'Corrediças / Telescópicas'
    }]);
    const afterMirrorMerge = Core.getState();
    const mirrorFolderId = afterMirrorMerge.products[0].folderId;
    const flattenedAfterMirror = afterMirrorMerge.folders.some(folder => folder.name === 'Corrediças / Telescópicas');

    let invalidCurrentCode = '';
    try {
      ProductSnapshot.read({
        schemaVersion: 2,
        folders: [],
        products: [{ id: 'invalid', code: 'BAD', description: 'Sem pasta' }]
      });
    } catch (error) {
      invalidCurrentCode = error?.code || '';
    }

    const projected = ProductSnapshot.read({
      schemaVersion: 2,
      folders,
      products: [{
        id: 'projected',
        folderId: 'f-leaf',
        code: 'PRJ',
        description: 'Projeção',
        category: 'Mirror incorreto',
        subcategory: 'Mirror incorreto'
      }]
    }).snapshot.products[0];

    Core.setState({
      schemaVersion: 7,
      products: [{
        id: 'legacy',
        code: 'LEG-1',
        description: 'Produto legado',
        category: 'Perfis',
        subcategory: 'Alumínio'
      }],
      selectedIds: [],
      catalog
    }, { persist: false });
    const migrated = Core.getState();
    const migratedPath = FolderTree.pathOf(migrated.folders, migrated.products[0].folderId).map(item => item.name);

    return {
      schemaVersion: currentBeforeMerge.schemaVersion,
      currentFolderId: currentBeforeMerge.products[0].folderId,
      currentPath,
      partialFolderId,
      partialPath,
      flattenedAfterPartial,
      mirrorFolderId,
      flattenedAfterMirror,
      invalidCurrentCode,
      projectedCategory: projected.category,
      projectedSubcategory: projected.subcategory,
      migratedSchemaVersion: migrated.schemaVersion,
      migratedHasFolderId: Boolean(migrated.products[0].folderId),
      migratedPath
    };
  });

  if (result.schemaVersion !== 8 || result.currentFolderId !== 'f-leaf') {
    throw new Error(`snapshot atual não preservou folderId: ${JSON.stringify(result)}`);
  }
  if (result.currentPath.join(' / ') !== 'Ferragens / Corrediças / Telescópicas') {
    throw new Error(`snapshot atual perdeu hierarquia profunda: ${JSON.stringify(result)}`);
  }
  if (result.partialFolderId !== 'f-leaf' || result.partialPath.join(' / ') !== 'Ferragens / Corrediças / Telescópicas' || result.flattenedAfterPartial) {
    throw new Error(`merge parcial achatou/moveu pasta profunda: ${JSON.stringify(result)}`);
  }
  if (result.mirrorFolderId !== 'f-leaf' || result.flattenedAfterMirror) {
    throw new Error(`mirrors idênticos achatam/movem pasta profunda: ${JSON.stringify(result)}`);
  }
  if (result.invalidCurrentCode !== 'product_folder_invalid') {
    throw new Error(`ProductSnapshot v2 precisa falhar fechado sem folderId válido: ${JSON.stringify(result)}`);
  }
  if (result.projectedCategory !== 'Ferragens' || result.projectedSubcategory !== 'Corrediças / Telescópicas') {
    throw new Error(`folderId não permaneceu autoridade dos mirrors: ${JSON.stringify(result)}`);
  }
  if (result.migratedSchemaVersion !== 8 || !result.migratedHasFolderId || result.migratedPath.join(' / ') !== 'Perfis / Alumínio') {
    throw new Error(`entrada schema 7 não migrou deterministicamente no browser: ${JSON.stringify(result)}`);
  }

  console.log('PASS browser ProductSnapshot gate: schema 8 estrito, folderId autoritativo, merge profundo e migração v7→v8');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
