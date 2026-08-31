import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp'
};
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) { response.writeHead(404, { 'content-type': 'application/json' }); response.end('{}'); return; }
    const relative = decodeURIComponent(url.pathname) === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const file = join(root, normalize(relative).replace(/^(\.\.[/\\])+/, ''));
    if (!(await stat(file)).isFile()) throw new Error('not file');
    response.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
    response.end(await readFile(file));
  } catch (_) { response.writeHead(404); response.end('not found'); }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.CatalogoTop?.App && window.CatalogoTop?.Templates?.resolveCatalog && window.CatalogoTop?.CatalogDocument && window.CatalogoTop?.DocumentChrome && window.CatalogoTop?.ContextualInspector));

  await page.evaluate(() => {
    const NS = window.CatalogoTop;
    NS.Core.setState({
      schemaVersion: 7,
      products: [{
        id: 'broken-image', code: 'IMG-404', description: 'Produto com referência de imagem indisponível', category: 'Teste', subcategory: '',
        price: 'R$ 10,00', status: 'Ativo', notes: '', image: '/asset-que-nao-existe-r4a.webp', specs: [], variants: [], tableRows: [], updatedAt: '2026-08-31T00:00:00.000Z'
      }],
      selectedIds: [],
      catalog: { title: 'R4a gate', templateId: 'technical', showPrices: true, createdAt: '2026-08-31T00:00:00.000Z', presentation: NS.Composition.normalizePresentation({ order: [], blocks: [] }) }
    }, { persist: false });
    window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
    NS.App.renderAll();
  });

  await page.waitForSelector('#selectableProducts [data-product-row="broken-image"] img', { state: 'attached' });
  await page.waitForFunction(() => document.querySelector('#selectableProducts [data-product-row="broken-image"] img')?.dataset.catalogoFallbackApplied === 'true');
  const thumbnail = await page.evaluate(() => {
    const image = document.querySelector('#selectableProducts [data-product-row="broken-image"] img');
    return { fallback: image?.dataset.catalogoFallbackApplied, src: image?.src || '', complete: image?.complete || false, naturalWidth: image?.naturalWidth || 0 };
  });
  if (thumbnail.fallback !== 'true' || !thumbnail.src.startsWith('data:image/') || !thumbnail.complete || thumbnail.naturalWidth < 1) {
    throw new Error(`thumbnail indisponível expôs broken-image nativo: ${JSON.stringify(thumbnail)}`);
  }

  await page.click('[data-tab="catalog"]');
  await page.waitForSelector('#catalog.panel.active .catalog-page[data-template-id="technical"][data-template-version="1"]');
  await page.waitForFunction(() => document.querySelector('#catalog .preview-toolbar > .heading-actions'));
  await page.waitForTimeout(80);

  const desktop = await page.evaluate(() => {
    const toolbar = document.querySelector('#catalog .preview-toolbar');
    const actions = toolbar?.querySelector('.heading-actions');
    const meta = toolbar?.querySelector('.preview-toolbar-meta');
    const zoom = toolbar?.querySelector('.preview-zoom-controls');
    const rect = node => {
      const value = node?.getBoundingClientRect();
      return value ? { left: value.left, right: value.right, top: value.top, bottom: value.bottom, width: value.width, height: value.height } : null;
    };
    const overlaps = (a, b) => Boolean(a && b && a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1);
    const toolbarRect = rect(toolbar); const actionsRect = rect(actions); const metaRect = rect(meta); const zoomRect = rect(zoom);
    return {
      toolbarRect, actionsRect, metaRect, zoomRect,
      actionsMetaOverlap: overlaps(actionsRect, metaRect), actionsZoomOverlap: overlaps(actionsRect, zoomRect), metaZoomOverlap: overlaps(metaRect, zoomRect),
      horizontalOverflow: toolbar ? Math.max(0, toolbar.scrollWidth - toolbar.clientWidth) : -1,
      binding: {
        id: document.querySelector('#catalogPreview .catalog-page')?.dataset.templateId || '',
        version: document.querySelector('#catalogPreview .catalog-page')?.dataset.templateVersion || ''
      }
    };
  });
  if (!desktop.toolbarRect || !desktop.actionsRect || !desktop.metaRect || !desktop.zoomRect) throw new Error(`toolbar R4a incompleta: ${JSON.stringify(desktop)}`);
  if (desktop.actionsMetaOverlap || desktop.actionsZoomOverlap || desktop.metaZoomOverlap || desktop.horizontalOverflow > 2) throw new Error(`toolbar R4a colidiu/estourou: ${JSON.stringify(desktop)}`);
  if (desktop.actionsRect.bottom > desktop.metaRect.top + 2 || desktop.actionsRect.bottom > desktop.zoomRect.top + 2) throw new Error(`toolbar R4a não quebrou em duas linhas: ${JSON.stringify(desktop)}`);
  if (desktop.binding.id !== 'technical' || desktop.binding.version !== '1') throw new Error(`binding físico não materializou technical@1: ${JSON.stringify(desktop.binding)}`);

  // O inspector de Card só existe para um membro efetivo do catálogo. O estado vazio acima
  // é deliberado para exercitar a toolbar; daqui em diante a fixture entra pelo fluxo real.
  await page.check('#selectableProducts [data-select-product="broken-image"]');
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().selectedIds.includes('broken-image'));
  await page.waitForSelector('#catalogPreview .catalog-card[data-product-id="broken-image"]');
  await page.evaluate(() => window.CatalogoTop.ContextualInspector.selectProductFromList('broken-image'));
  await page.waitForSelector('#contextualInspector [data-commercial-card-price-editor]');
  await page.waitForTimeout(40);
  const priceControl = await page.evaluate(() => {
    const editor = document.querySelector('#contextualInspector [data-inspector-card]');
    const fieldset = editor?.querySelector('[data-commercial-card-price-editor]');
    const segmented = fieldset?.querySelector('.inspector-segmented');
    const editorRect = editor?.getBoundingClientRect();
    const fieldsetRect = fieldset?.getBoundingClientRect();
    const chips = Array.from(segmented?.querySelectorAll('span') || []).map(node => ({
      text: node.textContent.trim(),
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth,
      clientHeight: node.clientHeight,
      scrollHeight: node.scrollHeight
    }));
    return {
      editorWidth: editorRect?.width || 0,
      fieldsetWidth: fieldsetRect?.width || 0,
      gridColumns: segmented ? getComputedStyle(segmented).gridTemplateColumns : '',
      chips,
      segmentedClientWidth: segmented?.clientWidth || 0,
      segmentedScrollWidth: segmented?.scrollWidth || 0
    };
  });
  if (priceControl.chips.length !== 4 || priceControl.fieldsetWidth < priceControl.editorWidth * .85) {
    throw new Error(`controle PREÇO não recebeu território responsivo: ${JSON.stringify(priceControl)}`);
  }
  // Inputs radio são absolutos/invisíveis e podem ampliar scrollWidth alguns pixels. A
  // propriedade física relevante é cada chip visível caber integralmente no seu track.
  if (priceControl.chips.some(chip => chip.scrollWidth > chip.clientWidth + 1 || chip.scrollHeight > chip.clientHeight + 1)) {
    throw new Error(`controle PREÇO truncou rótulo: ${JSON.stringify(priceControl)}`);
  }

  const strict = await page.evaluate(() => {
    const NS = window.CatalogoTop;
    const state = NS.Core.getState();
    let code = '';
    try { NS.CatalogDocument.build({ ...state, catalog: { ...state.catalog, templateVersion: 999 } }); }
    catch (error) { code = error?.code || ''; }
    const technical = NS.Templates.resolve('technical', 1);
    const compact = NS.Templates.resolve('compact', 1);
    return {
      code,
      technicalBudget: NS.Render.limitsFor(technical, false, 'standard'),
      compactBudget: NS.Render.limitsFor(compact, false, 'standard'),
      chrome: Boolean(NS.DocumentChrome.CHROME['top-mobili-v1'])
    };
  });
  if (strict.code !== 'template_unavailable') throw new Error(`binding desconhecido não falhou fechado: ${JSON.stringify(strict)}`);
  if (strict.technicalBudget.variants !== 4 || strict.technicalBudget.rows !== 6 || strict.technicalBudget.specs !== 3) throw new Error(`budget technical@1 não veio do contrato: ${JSON.stringify(strict)}`);
  if (strict.compactBudget.variants !== 3 || strict.compactBudget.rows !== 3 || strict.compactBudget.specs !== 2) throw new Error(`budget compact@1 não veio do contrato: ${JSON.stringify(strict)}`);
  if (!strict.chrome) throw new Error('chrome institucional top-mobili-v1 não está registrado como primitive app-owned');

  await page.selectOption('#catalogTemplate', 'compact');
  await page.waitForSelector('#catalogPreview .catalog-page[data-template-id="compact"][data-template-version="1"]');

  await page.click('[data-tab="products"]');
  await page.waitForSelector('#products.panel.active #cadastroContextPanel');
  const existingHeader = await page.evaluate(() => {
    const card = document.querySelector('#cadastroContextPanel');
    const head = card?.querySelector(':scope > .form-head');
    const eyebrow = head?.querySelector('.eyebrow');
    const count = head?.querySelector('.counter');
    const search = card?.querySelector('.list-toolbar');
    const rect = node => {
      const value = node?.getBoundingClientRect();
      return value ? { left: value.left, right: value.right, top: value.top, bottom: value.bottom, width: value.width, height: value.height } : null;
    };
    return { card: rect(card), head: rect(head), eyebrow: rect(eyebrow), count: rect(count), search: rect(search) };
  });
  if (!existingHeader.card || !existingHeader.head || !existingHeader.eyebrow || !existingHeader.count || !existingHeader.search) {
    throw new Error(`cabeçalho Existentes incompleto: ${JSON.stringify(existingHeader)}`);
  }
  if (existingHeader.head.left < existingHeader.card.left + 10 || existingHeader.head.right > existingHeader.card.right - 10 || existingHeader.head.top < existingHeader.card.top + 10) {
    throw new Error(`cabeçalho Existentes encostou no recorte do card: ${JSON.stringify(existingHeader)}`);
  }
  if (existingHeader.eyebrow.left < existingHeader.card.left + 10 || existingHeader.count.right > existingHeader.card.right - 10 || existingHeader.search.top < existingHeader.head.bottom - 1) {
    throw new Error(`conteúdo de Existentes ficou cortado/colidido: ${JSON.stringify(existingHeader)}`);
  }

  console.log('PASS browser R4a gate: image fallback, toolbar sem colisão, preço sem clipping, Existentes com inset, exact id@version, contract budgets e app-owned chrome');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
