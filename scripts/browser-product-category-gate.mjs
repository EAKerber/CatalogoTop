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
  const groups = [
    ['Corrediças', 5],
    ['Dobradiças', 4],
    ['Pistões', 3],
    ['Puxadores', 2],
    ['Parafusos', 1]
  ];
  let serial = 0;
  const products = groups.flatMap(([category, count]) => Array.from({ length: count }, () => {
    serial += 1;
    return NS.Core.normalizeProduct({
      id: `p${serial}`,
      code: `P${serial}`,
      description: `${category} ${serial}`,
      category,
      subcategory: '',
      price: '',
      status: 'Ativo',
      notes: '',
      image: '',
      specs: [],
      variants: [],
      tableRows: [],
      updatedAt: '2026-08-27T00:00:00.000Z'
    });
  }));

  NS.ProductStore.publishCurrent = async () => true;
  window.confirm = () => true;
  NS.Core.setState({
    schemaVersion: 7,
    products,
    selectedIds: products.slice(0, 4).map(product => product.id),
    catalog: {
      title: 'Product/category UX gate',
      templateId: 'technical',
      showPrices: true,
      createdAt: '2026-08-27T00:00:00.000Z',
      presentation: NS.Composition.normalizePresentation({
        order: products.slice(0, 4).map(product => product.id),
        blocks: [],
        itemStyles: {},
        imageFrames: {}
      })
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
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(
    window.CatalogoTop?.Core
    && window.CatalogoTop?.ProductActions?.deleteCategory
    && document.querySelector('#categoryPicker')
  ));

  await page.evaluate(installFixture);
  await page.waitForFunction(() => document.querySelectorAll('#categoryFolders [data-category-folder]').length === 6);

  const categoryInput = page.locator('#category');
  await categoryInput.focus();
  await page.waitForSelector('#categoryPicker:not([hidden])');

  let picker = await page.evaluate(() => ({
    suggestions: [...document.querySelectorAll('#categoryPicker .category-picker-option.suggested [data-unused], #categoryPicker .category-picker-option.suggested > span')].map(node => node.textContent.trim()),
    allChoices: [...document.querySelectorAll('#categoryPicker [data-category-choice]')].map(node => node.dataset.categoryChoice),
    maxHeight: getComputedStyle(document.querySelector('#categoryPicker')).maxHeight,
    overflowY: getComputedStyle(document.querySelector('#categoryPicker')).overflowY
  }));
  if (picker.suggestions.join(',') !== 'Corrediças,Dobradiças,Pistões') throw new Error(`3 recomendações iniciais inesperadas: ${JSON.stringify(picker)}`);
  if (new Set(picker.allChoices).size !== 5) throw new Error(`lista completa deveria expor 5 categorias: ${JSON.stringify(picker)}`);
  if (picker.overflowY !== 'auto') throw new Error(`seletor deve ser rolável: ${JSON.stringify(picker)}`);

  await categoryInput.fill('cor');
  await page.waitForFunction(() => document.querySelector('#categoryPicker .category-picker-option.suggested > span')?.textContent === 'Corrediças');
  picker = await page.evaluate(() => ({
    firstSuggestion: document.querySelector('#categoryPicker .category-picker-option.suggested > span')?.textContent?.trim(),
    allCount: new Set([...document.querySelectorAll('#categoryPicker [data-category-choice]')].map(node => node.dataset.categoryChoice)).size
  }));
  if (picker.firstSuggestion !== 'Corrediças' || picker.allCount !== 5) throw new Error(`busca deveria priorizar correspondência e manter acesso a todas: ${JSON.stringify(picker)}`);

  await categoryInput.fill('Dob');
  await page.click('#categoryPicker [data-category-choice="Dobradiças"]');
  let categoryState = await page.evaluate(() => ({
    value: document.querySelector('#category').value,
    mode: document.querySelector('#category').dataset.categoryMode,
    hidden: document.querySelector('#categoryPicker').hidden
  }));
  if (categoryState.value !== 'Dobradiças' || categoryState.mode !== 'existing' || !categoryState.hidden) throw new Error(`seleção de categoria existente falhou: ${JSON.stringify(categoryState)}`);

  await categoryInput.fill('Nova Linha');
  await page.waitForSelector('#categoryPicker [data-category-create="Nova Linha"]');
  await page.click('#categoryPicker [data-category-create="Nova Linha"]');
  categoryState = await page.evaluate(() => ({ value: document.querySelector('#category').value, mode: document.querySelector('#category').dataset.categoryMode }));
  if (categoryState.value !== 'Nova Linha' || categoryState.mode !== 'new') throw new Error(`criação de nova categoria não ficou explícita: ${JSON.stringify(categoryState)}`);

  const productDelete = await page.evaluate(() => {
    const button = document.querySelector('[data-delete-product-direct]');
    return button ? {
      aria: button.getAttribute('aria-label'),
      pseudo: getComputedStyle(button, '::after').content
    } : null;
  });
  if (!productDelete || productDelete.aria !== 'Excluir produto' || !productDelete.pseudo.includes('Excluir')) throw new Error(`exclusão de produto não está explícita: ${JSON.stringify(productDelete)}`);

  const parafusoId = await page.evaluate(() => window.CatalogoTop.Core.getState().products.find(product => product.category === 'Parafusos')?.id);
  await page.click(`[data-delete-product-direct="${parafusoId}"]`);
  await page.waitForFunction(id => !window.CatalogoTop.Core.getState().products.some(product => product.id === id), parafusoId);

  const beforeCategoryDelete = await page.evaluate(() => window.CatalogoTop.Core.getState().products.filter(product => product.category === 'Puxadores').length);
  if (beforeCategoryDelete !== 2) throw new Error(`fixture de Puxadores inesperada: ${beforeCategoryDelete}`);
  await page.click('#categoryFolders [data-delete-category="Puxadores"]');
  await page.waitForFunction(() => !window.CatalogoTop.Core.getState().products.some(product => product.category === 'Puxadores'));
  const deletionState = await page.evaluate(() => ({
    remaining: window.CatalogoTop.Core.getState().products.filter(product => product.category === 'Puxadores').length,
    folder: Boolean(document.querySelector('#categoryFolders [data-category-folder="Puxadores"]')),
    deleteControl: Boolean(document.querySelector('#categoryFolders [data-delete-category="Puxadores"]'))
  }));
  if (deletionState.remaining || deletionState.folder || deletionState.deleteControl) throw new Error(`categoria excluída permaneceu na UI/estado: ${JSON.stringify(deletionState)}`);

  console.log('PASS browser product/category gate: exclusões explícitas e combobox com 3 sugestões + lista completa');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
