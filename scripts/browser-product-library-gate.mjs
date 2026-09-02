import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.csv': 'text/csv; charset=utf-8'
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
    if (!(await stat(file)).isFile()) throw new Error('not file');
    response.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404);
    response.end('not found');
  }
});

function seedLibrary() {
  const NS = window.CatalogoTop;
  const current = NS.Core.getState();
  const folders = [
    { id: 'hardware', parentId: null, name: 'Ferragens' },
    { id: 'slides', parentId: 'hardware', name: 'Corrediças' },
    { id: 'telescopic', parentId: 'slides', name: 'Telescópicas' },
    { id: 'profiles', parentId: null, name: 'Perfis' },
    { id: 'empty', parentId: null, name: 'Vazia' }
  ];
  const thumb = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><rect width="160" height="120" fill="white"/><rect x="20" y="42" width="120" height="36" rx="8" fill="#d9dde2"/></svg>')}`;
  const base = (id, folderId, extras = {}) => ({
    id,
    code: id.toUpperCase(),
    description: `Produto ${id.toUpperCase()}`,
    folderId,
    category: '',
    subcategory: '',
    price: 'R$ 10,00',
    status: 'Ativo',
    notes: '',
    image: thumb,
    imageGallery: [],
    specs: [],
    variants: [],
    tableRows: [],
    updatedAt: '2026-08-31T00:00:00.000Z',
    ...extras
  });
  const products = NS.ProductSnapshot.reprojectProducts(folders, [
    base('p1', 'telescopic'),
    base('p2', 'slides'),
    base('p3', 'profiles')
  ]).map(NS.Core.normalizeProduct);
  const presentation = NS.Composition.normalizePresentation({
    ...current.catalog.presentation,
    order: ['p1', 'p2'],
    itemStyles: {},
    imageFrames: {},
    imageSelections: { p1: { source: 'original', id: 'original' } },
    imageVariants: { p1: [{ id: 'local', label: 'Local', image: 'data:image/png;base64,AA==' }] },
    blocks: [{ id: 'collection-library', type: 'collection', memberIds: ['p1', 'p2'], title: 'Teste', subtitle: '', theme: 'light', columns: 2, itemPreset: 'visual', itemStyles: {} }]
  });
  NS.Core.setState({
    ...current,
    schemaVersion: 8,
    folders,
    products,
    selectedIds: ['p1', 'p2'],
    catalog: { ...current.catalog, presentation }
  }, { persist: false });
  NS.ProductStore.publishCurrent = async () => true;
  window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
}

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.CatalogoTop?.ProductLibrary && window.CatalogoTop?.ProductSnapshot && window.CatalogoTop?.ProductActions));
  await page.evaluate(seedLibrary);

  await page.click('[data-tab="library"]');
  await page.waitForSelector('#library.active #productLibraryAdmin');
  const initial = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('#libraryProductList [data-library-product]'));
    const controls = ['libraryProductSearch', 'libraryMoveDestination', 'catalogLibraryMoveDestination', 'assetLibraryUsageFilter'].map(id => {
      const node = document.getElementById(id);
      const style = node ? getComputedStyle(node) : null;
      return { id, radius: style?.borderRadius || '', minHeight: style?.minHeight || '' };
    });
    return {
      rows: rows.length,
      thumbnails: rows.filter(row => {
        const image = row.querySelector('.library-product-thumb');
        const rect = image?.getBoundingClientRect();
        return Boolean(image?.getAttribute('src') && rect?.width >= 50 && rect?.height >= 45);
      }).length,
      folderButtons: document.querySelectorAll('#libraryFolderTree [data-library-folder]').length,
      activePanel: document.getElementById('library')?.classList.contains('active'),
      controls
    };
  });
  if (!initial.activePanel || initial.rows !== 3 || initial.thumbnails !== 3 || initial.folderButtons < 6) throw new Error(`Biblioteca inicial inválida: ${JSON.stringify(initial)}`);
  if (initial.controls.some(control => control.radius !== '9px' || Number.parseFloat(control.minHeight) < 38)) {
    throw new Error(`controles compartilhados da Biblioteca fora da linha visual: ${JSON.stringify(initial.controls)}`);
  }

  await page.click('[data-library-folder="hardware"]');
  await page.waitForFunction(() => document.querySelectorAll('#libraryProductList [data-library-product]').length === 2);
  const scoped = await page.evaluate(() => Array.from(document.querySelectorAll('#libraryProductList [data-library-product]'), node => node.dataset.libraryProduct));
  if (scoped.join(',') !== 'p1,p2') throw new Error(`escopo recursivo da Biblioteca divergiu: ${scoped.join(',')}`);

  await page.fill('#libraryProductSearch', 'P1');
  await page.waitForFunction(() => document.querySelectorAll('#libraryProductList [data-library-product]').length === 1);
  if (await page.getAttribute('#libraryProductList [data-library-product]', 'data-library-product') !== 'p1') throw new Error('busca da Biblioteca não encontrou P1 no escopo');
  await page.fill('#libraryProductSearch', '');
  await page.waitForFunction(() => document.querySelectorAll('#libraryProductList [data-library-product]').length === 2);

  await page.check('[data-library-select="p1"]');
  await page.check('[data-library-select="p2"]');
  await page.selectOption('#libraryMoveDestination', 'profiles');
  await page.click('#libraryMoveProducts');
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().products.filter(product => ['p1', 'p2'].includes(product.id)).every(product => product.folderId === 'profiles'));
  const afterMove = await page.evaluate(() => {
    const current = window.CatalogoTop.Core.getState();
    return {
      ids: current.products.map(product => product.id),
      selectedIds: current.selectedIds.slice(),
      order: current.catalog.presentation.order.slice(),
      mirrors: current.products.filter(product => ['p1', 'p2'].includes(product.id)).map(product => [product.category, product.subcategory])
    };
  });
  if (afterMove.ids.join(',') !== 'p1,p2,p3' || afterMove.selectedIds.join(',') !== 'p1,p2' || afterMove.order.join(',') !== 'p1,p2') {
    throw new Error(`move alterou identidade/editorial state: ${JSON.stringify(afterMove)}`);
  }
  if (afterMove.mirrors.some(([category, subcategory]) => category !== 'Perfis' || subcategory !== '')) throw new Error(`move não reprojectou mirrors: ${JSON.stringify(afterMove.mirrors)}`);

  await page.click('[data-library-folder="profiles"]');
  page.once('dialog', dialog => dialog.accept('Perfis e Alumínio'));
  await page.click('#libraryRenameFolder');
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().folders.find(folder => folder.id === 'profiles')?.name === 'Perfis e Alumínio');
  const renamed = await page.evaluate(() => {
    const current = window.CatalogoTop.Core.getState();
    return {
      folderId: current.folders.find(folder => folder.name === 'Perfis e Alumínio')?.id,
      mirrors: current.products.map(product => [product.id, product.category, product.subcategory])
    };
  });
  if (renamed.folderId !== 'profiles' || renamed.mirrors.some(([, category]) => category !== 'Perfis e Alumínio')) throw new Error(`rename perdeu identidade/mirrors: ${JSON.stringify(renamed)}`);

  page.once('dialog', dialog => dialog.accept('Novos'));
  await page.click('#libraryCreateFolder');
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().folders.some(folder => folder.name === 'Novos'));
  const createdFolderId = await page.evaluate(() => window.CatalogoTop.Core.getState().folders.find(folder => folder.name === 'Novos')?.id || '');
  if (!createdFolderId) throw new Error('Biblioteca não criou pasta');
  const createdParent = await page.evaluate(id => window.CatalogoTop.Core.getState().folders.find(folder => folder.id === id)?.parentId, createdFolderId);
  if (createdParent !== 'profiles') throw new Error(`pasta nova criada no parent errado: ${createdParent}`);

  await page.selectOption('#libraryFolderParent', '');
  await page.click('#libraryMoveFolder');
  await page.waitForFunction(id => window.CatalogoTop.Core.getState().folders.find(folder => folder.id === id)?.parentId == null, createdFolderId);

  page.once('dialog', dialog => dialog.accept());
  await page.click('#libraryDeleteFolder');
  await page.waitForFunction(id => !window.CatalogoTop.Core.getState().folders.some(folder => folder.id === id), createdFolderId);

  await page.click('[data-library-folder="profiles"]');
  await page.check('[data-library-select="p1"]');
  page.once('dialog', dialog => dialog.accept());
  await page.click('#libraryDeleteProducts');
  await page.waitForFunction(() => !window.CatalogoTop.Core.getState().products.some(product => product.id === 'p1'));
  const afterDelete = await page.evaluate(() => {
    const current = window.CatalogoTop.Core.getState();
    return {
      productIds: current.products.map(product => product.id),
      selectedIds: current.selectedIds.slice(),
      order: current.catalog.presentation.order.slice(),
      blocks: current.catalog.presentation.blocks.length,
      frame: current.catalog.presentation.imageFrames?.p1,
      selection: current.catalog.presentation.imageSelections?.p1,
      variants: current.catalog.presentation.imageVariants?.p1
    };
  });
  if (afterDelete.productIds.includes('p1') || afterDelete.selectedIds.includes('p1') || afterDelete.order.includes('p1') || afterDelete.blocks !== 0 || afterDelete.frame || afterDelete.selection || afterDelete.variants) {
    throw new Error(`delete bulk não limpou identidade editorial: ${JSON.stringify(afterDelete)}`);
  }

  await page.setViewportSize({ width: 390, height: 900 });
  await page.click('[data-tab="library"]');
  await page.click('[data-library-mobile-view="folders"]');
  await page.click('[data-library-folder="profiles"]');
  await page.waitForFunction(() => document.getElementById('productLibraryAdmin')?.dataset.mobileView === 'products');
  const mobile = await page.evaluate(() => {
    const edit = document.querySelector('[data-library-edit="p2"]');
    const style = edit ? getComputedStyle(edit) : null;
    const rect = edit?.getBoundingClientRect();
    const thumb = document.querySelector('[data-library-product="p2"] .library-product-thumb');
    const thumbRect = thumb?.getBoundingClientRect();
    return {
      view: document.getElementById('productLibraryAdmin')?.dataset.mobileView,
      editVisible: Boolean(edit && style?.display !== 'none' && style?.visibility !== 'hidden' && rect?.width && rect?.height),
      thumbVisible: Boolean(thumb && thumbRect?.width >= 48 && thumbRect?.height >= 44),
      overflowX: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      switchVisible: getComputedStyle(document.querySelector('.library-mobile-switch')).display !== 'none'
    };
  });
  if (mobile.view !== 'products' || !mobile.editVisible || !mobile.thumbVisible || !mobile.switchVisible || mobile.overflowX > 2) throw new Error(`Biblioteca mobile regrediu: ${JSON.stringify(mobile)}`);

  await page.click('[data-library-edit="p2"]');
  await page.waitForFunction(() => document.getElementById('products')?.classList.contains('active') && document.getElementById('productId')?.value === 'p2');
  const editContext = await page.evaluate(() => {
    const actions = document.querySelector('#productForm .editing-context-actions');
    const clone = actions?.querySelector('[data-cadastro-clone="p2"]');
    const library = actions?.querySelector('[data-cadastro-library="p2"]');
    return {
      visible: Boolean(actions && !actions.hidden && getComputedStyle(actions).display !== 'none'),
      clone: Boolean(clone),
      library: Boolean(library)
    };
  });
  if (!editContext.visible || !editContext.clone || !editContext.library) throw new Error(`ações contextuais do Cadastro ausentes: ${JSON.stringify(editContext)}`);

  await page.click('[data-mobile-workspace-target="context"]');
  await page.waitForSelector('#cadastroProductRows [data-cadastro-product="p2"]');
  const cadastroRows = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('#cadastroProductRows [data-cadastro-product]'));
    return {
      rows: rows.length,
      thumbs: rows.filter(row => row.querySelector('.product-thumb')?.getAttribute('src')).length,
      rowButtons: rows.reduce((sum, row) => sum + row.querySelectorAll('button').length, 0),
      p2Editing: document.querySelector('[data-cadastro-product="p2"]')?.classList.contains('is-editing') || false
    };
  });
  if (cadastroRows.rows !== 2 || cadastroRows.thumbs !== 2 || cadastroRows.rowButtons !== 0 || !cadastroRows.p2Editing) {
    throw new Error(`lista contextual do Cadastro inválida: ${JSON.stringify(cadastroRows)}`);
  }

  await page.click('[data-cadastro-product="p3"]');
  await page.waitForFunction(() => document.getElementById('productId')?.value === 'p3');
  await page.click('[data-mobile-workspace-target="context"]');
  await page.focus('[data-cadastro-product="p2"]');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('productId')?.value === 'p2');
  await page.click('#productForm [data-cadastro-clone="p2"]');
  await page.waitForFunction(() => document.getElementById('code')?.value === '' && document.getElementById('formTitle')?.textContent?.includes('Novo produto baseado em P2'));
  const cloneContext = await page.evaluate(() => ({
    productId: document.getElementById('productId')?.value || '',
    actionsHidden: document.querySelector('#productForm .editing-context-actions')?.hidden === true,
    productPersisted: window.CatalogoTop.Core.getState().products.some(product => String(product.id) === String(document.getElementById('productId')?.value || ''))
  }));
  if (!cloneContext.productId || !cloneContext.actionsHidden || cloneContext.productPersisted) throw new Error(`Usar como base não virou novo draft isolado: ${JSON.stringify(cloneContext)}`);

  console.log('PASS browser Product Library R1e gate: controls, thumbnails, recursive tree/search, multi-move, folder lifecycle, bulk delete cleanup, mobile and Cadastro row/context actions');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
