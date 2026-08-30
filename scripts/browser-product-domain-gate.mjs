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
    window.CatalogoTop?.ProductDomain &&
    window.CatalogoTop?.ProductQuery &&
    window.CatalogoTop?.Importer
  ));

  const result = await page.evaluate(() => {
    const NS = window.CatalogoTop;
    const { Core, ProductDomain, ProductQuery, Importer } = NS;
    const folders = [
      { id: 'root', parentId: null, name: 'Ferragens' },
      { id: 'slides', parentId: 'root', name: 'Corrediças' },
      { id: 'telescopic', parentId: 'slides', name: 'Telescópicas' }
    ];
    const products = [
      { id: 'p1', folderId: 'telescopic', code: 'ABC', description: 'Corrediça reforçada', category: 'Ferragens', subcategory: 'Corrediças / Telescópicas', status: 'Ativo', specs: [{ label: 'Carga', value: '35 kg' }], imageGallery: [{ id: 'g1', label: 'Frente', image: '/asset/a', provenance: { kind: 'approved' } }], variants: [], tableRows: [] },
      { id: 'p2', folderId: 'slides', code: 'ABC-200', description: 'Modelo comum', category: 'Ferragens', subcategory: 'Corrediças', status: 'Ativo', specs: [], imageGallery: [], variants: [], tableRows: [] }
    ];
    Core.setState({
      schemaVersion: 8,
      folders,
      products,
      selectedIds: [],
      catalog: { title: 'R1c', templateId: 'technical', showPrices: true, presentation: { order: [], blocks: [] } }
    }, { persist: false });

    let duplicateMutationCode = '';
    try {
      Core.mutate(draft => {
        draft.products.push({ ...draft.products[0], id: 'dup', code: ' abc ' });
      });
    } catch (error) {
      duplicateMutationCode = error?.code || '';
    }
    const countAfterRejectedMutation = Core.getState().products.length;

    let importDuplicateCode = '';
    try {
      Importer.sheetRowsFromMatrix([
        ['Código', 'Descrição'],
        ['XYZ', 'Primeiro'],
        [' xyz ', 'Segundo']
      ]);
    } catch (error) {
      importDuplicateCode = error?.code || '';
    }

    const clone = ProductDomain.cloneAsNewProduct(Core.getState().products[0], {
      idFactory: () => 'clone-id',
      now: () => '2026-08-30T23:00:00.000Z'
    });
    clone.specs[0].value = 'alterado';
    clone.imageGallery[0].provenance.kind = 'changed';

    const queryIds = ProductQuery.query({
      products: Core.getState().products,
      folders: Core.getState().folders,
      folderId: 'root',
      recursive: true,
      text: 'abc'
    }).map(product => product.id);

    return {
      duplicateMutationCode,
      countAfterRejectedMutation,
      importDuplicateCode,
      cloneId: clone.id,
      cloneCode: clone.code,
      cloneFolderId: clone.folderId,
      cloneUpdatedAt: clone.updatedAt,
      sourceSpec: Core.getState().products[0].specs[0].value,
      sourceProvenance: Core.getState().products[0].imageGallery[0].provenance.kind,
      queryIds
    };
  });

  if (result.duplicateMutationCode !== 'product_code_duplicate' || result.countAfterRejectedMutation !== 2) {
    throw new Error(`mutação manual duplicada não falhou atomicamente: ${JSON.stringify(result)}`);
  }
  if (result.importDuplicateCode !== 'product_code_duplicate') {
    throw new Error(`import duplicado não falhou antes do merge: ${JSON.stringify(result)}`);
  }
  if (result.cloneId !== 'clone-id' || result.cloneCode !== '' || result.cloneFolderId !== 'telescopic' || result.cloneUpdatedAt !== '2026-08-30T23:00:00.000Z') {
    throw new Error(`clone-as-new violou identidade/draft: ${JSON.stringify(result)}`);
  }
  if (result.sourceSpec !== '35 kg' || result.sourceProvenance !== 'approved') {
    throw new Error(`clone compartilhou estruturas mutáveis com a origem: ${JSON.stringify(result)}`);
  }
  if (result.queryIds.join(',') !== 'p1,p2') {
    throw new Error(`ProductQuery não priorizou exact/prefix no scope recursivo: ${JSON.stringify(result)}`);
  }

  console.log('PASS browser product domain gate: code uniqueness, import fail-closed, clone draft and recursive ProductQuery');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
