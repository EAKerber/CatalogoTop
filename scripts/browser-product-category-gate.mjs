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

function installFixture() {
  const NS = window.CatalogoTop;
  NS.ProductStore.publishCurrent = async () => true;
  NS.Core.setState({
    schemaVersion: 8,
    folders: [
      { id: 'f-ferragens', parentId: null, name: 'Ferragens' },
      { id: 'f-corredicas', parentId: 'f-ferragens', name: 'Corrediças' },
      { id: 'f-telescopicas', parentId: 'f-corredicas', name: 'Telescópicas' },
      { id: 'f-dobradicas', parentId: 'f-ferragens', name: 'Dobradiças' }
    ],
    products: [
      { id: 'p1', folderId: 'f-telescopicas', code: 'ABC-100', description: 'Corrediça telescópica', category: 'Ferragens', subcategory: 'Corrediças / Telescópicas', price: 'R$ 10,00', status: 'Ativo', notes: '', image: '', specs: [{ label: 'Carga', value: '35 kg' }], variants: [], tableRows: [] },
      { id: 'p2', folderId: 'f-corredicas', code: 'ABC-200', description: 'Corrediça comum', category: 'Ferragens', subcategory: 'Corrediças', price: '', status: 'Ativo', notes: '', image: '', specs: [], variants: [], tableRows: [] },
      { id: 'p3', folderId: 'f-dobradicas', code: 'DOB-1', description: 'Dobradiça', category: 'Ferragens', subcategory: 'Dobradiças', price: '', status: 'Ativo', notes: '', image: '', specs: [], variants: [], tableRows: [] }
    ],
    selectedIds: [],
    catalog: {
      title: 'Cadastro R1 final gate',
      templateId: 'technical',
      showPrices: true,
      createdAt: '2026-08-30T00:00:00.000Z',
      presentation: { order: [], blocks: [] }
    }
  }, { persist: false });
  window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
}

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}/`;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const dialogs = [];
  page.on('dialog', async dialog => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.CatalogoTop?.CadastroSurface && document.querySelector('#productFolderPath')));
  await page.evaluate(installFixture);
  await page.waitForFunction(() => document.querySelectorAll('#cadastroProductRows tr').length === 3);

  const shell = await page.evaluate(() => {
    const panel = document.querySelector('#cadastroContextPanel');
    const category = document.querySelector('#category');
    const subcategory = document.querySelector('#subcategory');
    const destructive = [...(panel?.querySelectorAll('[data-delete-product-direct], [data-delete-category], [data-library-delete-products]') || [])];
    const editActions = document.querySelector('#productForm .editing-context-actions');
    return {
      categoryHidden: category?.type === 'hidden',
      subcategoryHidden: subcategory?.type === 'hidden',
      deleteAbsent: !document.querySelector('#btnDeleteProduct'),
      mobileLabel: document.querySelector('[data-mobile-workspace-target="context"]')?.textContent?.trim(),
      legacyAbsent: !document.querySelector('[data-r1d-legacy-product-list-compat], #categoryFolders, #productRows'),
      destructiveVisible: destructive.some(node => getComputedStyle(node).display !== 'none' && node.getClientRects().length > 0),
      rowActionsAbsent: !panel?.querySelector('[data-cadastro-edit], [data-cadastro-clone], [data-cadastro-library]'),
      formActionsHidden: Boolean(editActions?.hidden)
    };
  });
  if (!shell.categoryHidden || !shell.subcategoryHidden || !shell.deleteAbsent || shell.mobileLabel !== 'Existentes' || !shell.legacyAbsent || shell.destructiveVisible || !shell.rowActionsAbsent || !shell.formActionsHidden) {
    throw new Error(`Cadastro final ainda expõe responsabilidades legadas/destrutivas ou ações fora de contexto: ${JSON.stringify(shell)}`);
  }

  await page.fill('#productFolderPath', 'Ferragens / Corrediças');
  await page.waitForFunction(() => document.querySelectorAll('#cadastroProductRows tr').length === 2);
  let scope = await page.evaluate(() => [...document.querySelectorAll('#cadastroProductRows tr')].map(row => row.dataset.cadastroProduct));
  if (scope.join(',') !== 'p1,p2') throw new Error(`scope recursivo inesperado: ${scope.join(',')}`);

  await page.fill('#cadastroProductSearch', 'ABC-100');
  await page.waitForFunction(() => document.querySelectorAll('#cadastroProductRows tr').length === 1);
  scope = await page.evaluate(() => [...document.querySelectorAll('#cadastroProductRows tr')].map(row => row.dataset.cadastroProduct));
  if (scope.join(',') !== 'p1') throw new Error(`busca contextual não priorizou código exato: ${scope.join(',')}`);
  await page.fill('#cadastroProductSearch', '');

  await page.click('[data-cadastro-product="p1"]');
  await page.waitForFunction(() => document.querySelector('#productId')?.value === 'p1');
  const editingActions = await page.evaluate(() => {
    const actions = document.querySelector('#productForm .editing-context-actions');
    return {
      visible: Boolean(actions && !actions.hidden && getComputedStyle(actions).display !== 'none'),
      clone: Boolean(actions?.querySelector('[data-cadastro-clone="p1"]')),
      library: Boolean(actions?.querySelector('[data-cadastro-library="p1"]'))
    };
  });
  if (!editingActions.visible || !editingActions.clone || !editingActions.library) throw new Error(`ações do produto em edição não foram materializadas: ${JSON.stringify(editingActions)}`);

  await page.click('#productForm [data-cadastro-clone="p1"]');
  const cloneDraft = await page.evaluate(() => ({
    productId: document.querySelector('#productId').value,
    code: document.querySelector('#code').value,
    path: document.querySelector('#productFolderPath').value,
    title: document.querySelector('#formTitle').textContent,
    sourceCount: window.CatalogoTop.Core.getState().products.length,
    deleteAbsent: !document.querySelector('#btnDeleteProduct'),
    editActionsHidden: document.querySelector('#productForm .editing-context-actions')?.hidden === true
  }));
  if (!cloneDraft.productId || cloneDraft.productId === 'p1' || cloneDraft.code !== '' || cloneDraft.path !== 'Ferragens / Corrediças / Telescópicas' || cloneDraft.sourceCount !== 3 || !cloneDraft.deleteAbsent || !cloneDraft.editActionsHidden || !cloneDraft.title.includes('ABC-100')) {
    throw new Error(`Usar como base não ficou como draft desacoplado: ${JSON.stringify(cloneDraft)}`);
  }

  await page.fill('#code', ' abc-100 ');
  await page.locator('#productForm').evaluate(form => form.requestSubmit());
  await page.waitForTimeout(50);
  const duplicate = await page.evaluate(() => ({
    count: window.CatalogoTop.Core.getState().products.length,
    validity: document.querySelector('#code').validationMessage
  }));
  if (duplicate.count !== 3 || !duplicate.validity) throw new Error(`código duplicado não bloqueou o submit sem mutação: ${JSON.stringify(duplicate)}`);

  await page.click('#btnNewProduct');
  await page.waitForTimeout(0);
  await page.fill('#productFolderPath', 'Ferragens / Corrediças / Telescópicas / Premium');
  await page.fill('#code', 'NEW-1');
  await page.fill('#description', 'Corrediça premium');
  await page.click('#btnNextFormStep');
  await page.click('#btnNextFormStep');
  await page.click('#btnSaveProduct');
  await page.waitForTimeout(100);
  const created = await page.evaluate(() => {
    const NS = window.CatalogoTop;
    const product = NS.Core.getState().products.find(item => item.code === 'NEW-1');
    return product ? {
      exists: true,
      count: NS.Core.getState().products.length,
      path: NS.FolderTree.pathOf(NS.Core.getState().folders, product.folderId).map(item => item.name),
      category: product.category,
      subcategory: product.subcategory
    } : {
      exists: false,
      count: NS.Core.getState().products.length,
      invalidFields: [...document.querySelectorAll('#productForm :invalid')].map(field => ({ id: field.id, message: field.validationMessage })),
      codeValidity: document.querySelector('#code').validationMessage,
      pathValidity: document.querySelector('#productFolderPath').validationMessage,
      category: document.querySelector('#category').value,
      subcategory: document.querySelector('#subcategory').value,
      productId: document.querySelector('#productId').value
    };
  });
  if (!created.exists) throw new Error(`criação profunda pelo Cadastro não materializou produto: ${JSON.stringify({ ...created, dialogs })}`);
  if (created.count !== 4 || created.path.join(' / ') !== 'Ferragens / Corrediças / Telescópicas / Premium' || created.category !== 'Ferragens' || created.subcategory !== 'Corrediças / Telescópicas / Premium') {
    throw new Error(`criação profunda pelo Cadastro não preservou hierarquia/mirrors: ${JSON.stringify(created)}`);
  }

  await page.fill('#productFolderPath', 'Ferragens / Corrediças');
  await page.fill('#cadastroProductSearch', 'ABC-200');
  await page.waitForFunction(() => document.querySelectorAll('#cadastroProductRows tr').length === 1);
  await page.click('[data-cadastro-product="p2"]');
  const edit = await page.evaluate(() => ({
    productId: document.querySelector('#productId').value,
    path: document.querySelector('#productFolderPath').value,
    code: document.querySelector('#code').value,
    libraryAction: Boolean(document.querySelector('#productForm [data-cadastro-library="p2"]'))
  }));
  if (edit.productId !== 'p2' || edit.path !== 'Ferragens / Corrediças' || edit.code !== 'ABC-200' || !edit.libraryAction) throw new Error(`Editar contextual perdeu identidade/pasta/handoff: ${JSON.stringify(edit)}`);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('[data-mobile-workspace-target="context"]');
  const mobile = await page.evaluate(() => ({
    selected: document.querySelector('[data-mobile-workspace-target="context"]')?.getAttribute('aria-selected'),
    panelActive: document.querySelector('#cadastroContextPanel')?.classList.contains('mobile-workspace-active'),
    display: getComputedStyle(document.querySelector('#cadastroContextPanel')).display
  }));
  if (mobile.selected !== 'true' || !mobile.panelActive || mobile.display === 'none') throw new Error(`mobile não abriu Existentes de forma explícita: ${JSON.stringify(mobile)}`);

  console.log('PASS browser Cadastro R1 final gate: folder path, recursive context, row editing, contextual clone/Library actions, duplicate guard, deep create and mobile existing-products surface');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
