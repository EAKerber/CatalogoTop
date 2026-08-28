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

function installFixture(mode = 'clean') {
  const NS = window.CatalogoTop;
  const descriptions = [
    'CORREDIÇA TELESCÓPICA REFORÇADA 250 MM',
    'CORREDIÇA TELESCÓPICA REFORÇADA C/ AMORTECIMENTO 300 MM',
    'CORREDIÇA TELESCÓPICA REFORÇADA C/ AMORTECIMENTO 350 MM',
    'CORREDIÇA TELESCÓPICA REFORÇADA 400 MM',
    'CORREDIÇA TELESCÓPICA REFORÇADA 450 MM',
    'CORREDIÇA TELESCÓPICA REFORÇADA 500 MM',
    'CORREDIÇA TELESCÓPICA REFORÇADA 550 MM',
    'CORREDIÇA TELESCÓPICA REFORÇADA 600 MM'
  ];
  const products = descriptions.map((description, index) => ({
    id: `p${index + 1}`,
    code: String(1265 + index),
    description,
    category: 'CORREDIÇAS',
    subcategory: 'TELESCÓPICAS',
    price: `R$ ${10 + index * 3},90`,
    quantityPrice: { minQuantity: 10, price: `R$ ${9 + index * 3},50` },
    status: 'Ativo', notes: '', image: '', specs: [], variants: [], tableRows: [],
    updatedAt: '2026-08-28T00:00:00.000Z'
  }));

  let blocks = [];
  if (mode === 'collection') {
    blocks = [{
      id: 'collection-fixture', type: 'collection', memberIds: ['p2', 'p3'], title: 'CORREDIÇAS', subtitle: '', theme: 'light', columns: 4,
      itemPreset: 'visual', itemStyles: {
        p2: { emphasis: 'feature', width: 'full', priceStyle: 'block' },
        p3: { emphasis: 'normal', width: 'simple', priceStyle: 'standard' }
      }
    }];
  }
  if (mode === 'text') {
    blocks = [{
      id: 'collection-text', type: 'collection', memberIds: ['p1', 'p2', 'p3', 'p4', 'p5'], title: 'CORREDIÇAS', subtitle: '', theme: 'light', columns: 4,
      itemPreset: 'visual', itemStyles: {
        p1: { emphasis: 'feature', width: 'full', priceStyle: 'red' }
      }
    }];
  }
  if (mode === 'table') {
    blocks = [{
      id: 'table-fixture', type: 'table', memberIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'], title: 'CORREDIÇAS', subtitle: '',
      rowSource: 'products', density: 'compact', columns: ['image', 'code', 'description', 'price', 'minQuantity', 'quantityPrice'], priceStyle: 'label'
    }];
  }

  NS.Core.setState({
    schemaVersion: NS.Core.SCHEMA_VERSION,
    products,
    selectedIds: products.map(product => product.id),
    catalog: {
      title: 'Composer v0.11.2.3 gate', templateId: 'technical', showPrices: true, dateOverride: '', createdAt: '2026-08-28T00:00:00.000Z',
      presentation: NS.Composition.normalizePresentation({ order: products.map(product => product.id), blocks, itemStyles: {}, imageFrames: {} })
    }
  }, { persist: false });
  NS.ComposerSelection?.clear?.();
  window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
}

async function waitReady(page) {
  await page.waitForFunction(() => Boolean(
    window.CatalogoTop?.Core && window.CatalogoTop?.ComposerSelection && window.CatalogoTop?.GroupingControls
    && window.CatalogoTop?.EditorOrder && window.CatalogoTop?.PresentationActions && window.CatalogoTop?.Print
  ));
}

async function setFixture(page, mode) {
  await page.evaluate(installFixture, mode);
  await page.click('[data-tab="catalog"]');
  await page.waitForSelector('#selectableProducts [data-product-row="p2"]');
  await page.waitForTimeout(50);
}

async function clickProduct(page, id, modifiers = []) {
  await page.locator(`#selectableProducts [data-product-row="${id}"] > span strong`).click({ modifiers });
}

async function effectiveOrder(page) {
  return page.evaluate(() => window.CatalogoTop.CatalogOrder.effectiveIds(window.CatalogoTop.Core.getState()));
}

async function readCollectionDescription(page, productId = 'p2') {
  return page.evaluate(id => {
    const node = document.querySelector(`#catalogPreview .catalog-collection-item[data-product-id="${id}"] .catalog-collection-copy b`);
    return node ? {
      text: node.textContent.trim(),
      words: node.dataset.visibleWords || '',
      truncated: node.dataset.descriptionTruncated || '',
      lines: node.dataset.fitLines || ''
    } : null;
  }, productId);
}

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  // Multiseleção: clicar de novo num item já selecionado troca apenas o primário.
  await setFixture(page, 'clean');
  await clickProduct(page, 'p2');
  await clickProduct(page, 'p4', ['Control']);
  await clickProduct(page, 'p2');
  let selection = await page.evaluate(() => ({ ids: window.CatalogoTop.ComposerSelection.ids(), target: window.CatalogoTop.ComposerSelection.get(), candidates: window.CatalogoTop.GroupingControls.candidateIds(12) }));
  if (selection.ids.join(',') !== 'p2,p4' || selection.target?.productId !== 'p2' || selection.candidates.join(',') !== 'p2,p4') {
    throw new Error(`trocar target primário colapsou multiseleção: ${JSON.stringify(selection)}`);
  }

  // Alterações compatíveis no inspector atingem todos os selecionados.
  await page.selectOption('#contextualInspector select[data-inspector-card-field="width"]', 'full');
  await page.waitForFunction(() => {
    const NS = window.CatalogoTop; const p = NS.Composition.normalizePresentation(NS.Core.getState().catalog.presentation);
    return NS.Composition.styleFor(p, 'p2').width === 'full' && NS.Composition.styleFor(p, 'p4').width === 'full';
  });
  const blockSegment = '#contextualInspector label:has(input[data-commercial-price-style][value="block"]) span';
  await page.waitForSelector(blockSegment);
  await page.click(blockSegment);
  await page.waitForFunction(() => {
    const NS = window.CatalogoTop; const p = NS.Composition.normalizePresentation(NS.Core.getState().catalog.presentation);
    return NS.Composition.styleFor(p, 'p2').priceStyle === 'block' && NS.Composition.styleFor(p, 'p4').priceStyle === 'block';
  });

  // Estado misto é representado explicitamente, em vez de usar o valor do primário como se fosse comum.
  await page.evaluate(() => window.CatalogoTop.PresentationActions.mutatePresentation(presentation => {
    presentation.itemStyles.p2 = { ...window.CatalogoTop.Composition.styleFor(presentation, 'p2'), width: 'simple' };
    presentation.itemStyles.p4 = { ...window.CatalogoTop.Composition.styleFor(presentation, 'p4'), width: 'wide' };
  }));
  await page.waitForSelector('#contextualInspector select[data-inspector-card-field="width"] option[data-bulk-mixed]', { state: 'attached' });
  const mixedValue = await page.locator('#contextualInspector select[data-inspector-card-field="width"]').inputValue();
  if (mixedValue !== '__mixed__') throw new Error(`estado misto de largura não foi explicitado: ${mixedValue}`);

  // Itens não contíguos válidos são reunidos automaticamente antes de criar Collection.
  await page.keyboard.press('Escape');
  await clickProduct(page, 'p2');
  await clickProduct(page, 'p4', ['Control']);
  await clickProduct(page, 'p6', ['Control']);
  const groupingBefore = await page.evaluate(() => ({
    candidates: window.CatalogoTop.GroupingControls.candidateIds(12),
    status: document.querySelector('#blockSelectionStatus')?.textContent || '',
    disabled: document.querySelector('#btnCreateCollection')?.disabled
  }));
  if (groupingBefore.candidates.join(',') !== 'p2,p4,p6' || groupingBefore.disabled || !groupingBefore.status.includes('serão reunidos')) {
    throw new Error(`seleção não contígua não ficou agrupável: ${JSON.stringify(groupingBefore)}`);
  }
  await page.click('#btnCreateCollection');
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().catalog.presentation.blocks.some(block => block.type === 'collection'));
  const collection = await page.evaluate(() => {
    const NS = window.CatalogoTop; const state = NS.Core.getState(); const block = state.catalog.presentation.blocks.find(item => item.type === 'collection');
    return { id: block.id, members: block.memberIds.slice(), order: NS.CatalogOrder.effectiveIds(state) };
  });
  if (collection.members.join(',') !== 'p2,p4,p6' || collection.order.join(',') !== 'p1,p2,p4,p6,p3,p5,p7,p8') {
    throw new Error(`consolidação antes do agrupamento incorreta: ${JSON.stringify(collection)}`);
  }

  // Reorder interno preserva o estilo relativo à posição.
  await page.evaluate(collectionId => window.CatalogoTop.PresentationActions.mutatePresentation(presentation => {
    const block = presentation.blocks.find(item => item.id === collectionId);
    block.itemStyles = {
      p2: { emphasis: 'feature', width: 'full', priceStyle: 'block' },
      p4: { emphasis: 'normal', width: 'simple', priceStyle: 'standard' },
      p6: { emphasis: 'normal', width: 'wide', priceStyle: 'red' }
    };
  }), collection.id);
  await page.click(`#catalogPreview .catalog-collection[data-collection-id="${collection.id}"] .catalog-collection-item[data-product-id="p2"]`);
  await page.waitForSelector('#contextualInspector [data-inspector-collection-member="p2"]');
  await page.waitForSelector('#contextualInspector [data-editor-move="1"]');
  await page.click('#contextualInspector [data-editor-move="1"]');
  await page.waitForFunction(collectionId => {
    const NS = window.CatalogoTop; const state = NS.Core.getState();
    const unit = NS.CatalogOrder.allUnits(state).find(item => item.blockId === collectionId);
    return unit?.memberIds?.join(',') === 'p4,p2,p6';
  }, collection.id);
  const relativeStyles = await page.evaluate(collectionId => {
    const NS = window.CatalogoTop; const block = NS.Core.getState().catalog.presentation.blocks.find(item => item.id === collectionId);
    return { p2: NS.Collection.memberStyleFor(block, 'p2'), p4: NS.Collection.memberStyleFor(block, 'p4'), order: NS.CatalogOrder.effectiveIds(NS.Core.getState()) };
  }, collection.id);
  if (relativeStyles.p4.width !== 'full' || relativeStyles.p4.priceStyle !== 'block' || relativeStyles.p2.width !== 'simple' || relativeStyles.p2.priceStyle !== 'standard') {
    throw new Error(`estilo não permaneceu na posição após reorder: ${JSON.stringify(relativeStyles)}`);
  }

  // Selecionar o bloco e usar a mesma seta move a Collection inteira.
  await page.click(`#catalogPreview .catalog-collection[data-collection-id="${collection.id}"] .catalog-collection-header`);
  await page.waitForFunction(collectionId => window.CatalogoTop.ComposerSelection.get()?.kind === 'collection' && window.CatalogoTop.ComposerSelection.get()?.blockId === collectionId, collection.id);
  await page.waitForSelector('#contextualInspector [data-editor-move="1"]:not([disabled])');
  await page.click('#contextualInspector [data-editor-move="1"]');
  const blockMoved = await effectiveOrder(page);
  if (blockMoved.join(',') !== 'p1,p3,p4,p2,p6,p5,p7,p8') throw new Error(`Collection não moveu como unidade: ${blockMoved.join(',')}`);

  // Setas do teclado movem todos os selecionados e não sequestram controles de formulário.
  await setFixture(page, 'clean');
  await clickProduct(page, 'p2');
  await clickProduct(page, 'p4', ['Control']);
  await page.locator('#selectableProducts [data-product-row="p4"]').focus();
  await page.keyboard.press('ArrowDown');
  let order = await effectiveOrder(page);
  if (order.join(',') !== 'p1,p3,p2,p5,p4,p6,p7,p8') throw new Error(`ArrowDown não moveu todos os selecionados: ${order.join(',')}`);
  const beforeControlArrow = order.join(',');
  await page.locator('#contextualInspector select[data-inspector-card-field="width"]').focus();
  await page.keyboard.press('ArrowUp');
  order = await effectiveOrder(page);
  if (order.join(',') !== beforeControlArrow) throw new Error(`ArrowUp dentro de select reordenou catálogo: ${order.join(',')}`);

  // TextFit precisa produzir as mesmas palavras em escala 100%, zoom reduzido, mobile e print.
  await setFixture(page, 'text');
  const desktopFit = await readCollectionDescription(page, 'p2');
  if (!desktopFit?.text.includes('C/ AMORTECIMENTO')) throw new Error(`descrição desktop ainda perde C/ AMORTECIMENTO: ${JSON.stringify(desktopFit)}`);
  await page.click('#btnPreviewZoomOut');
  await page.click('#btnPreviewZoomOut');
  await page.click('#btnPreviewZoomOut');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('catalogotop:products-updated')));
  await page.waitForTimeout(80);
  const zoomedFit = await readCollectionDescription(page, 'p2');
  if (JSON.stringify(zoomedFit) !== JSON.stringify(desktopFit)) throw new Error(`TextFit variou com zoom do preview: ${JSON.stringify({ desktopFit, zoomedFit })}`);
  const printFit = await page.evaluate(async () => {
    const NS = window.CatalogoTop; const frame = await NS.Print.createPrintFrame(NS.Core.getState());
    const node = frame.contentDocument.querySelector('.catalog-collection-item[data-product-id="p2"] .catalog-collection-copy b');
    const result = node ? { text: node.textContent.trim(), words: node.dataset.visibleWords || '', truncated: node.dataset.descriptionTruncated || '', lines: node.dataset.fitLines || '' } : null;
    frame.remove(); return result;
  });
  if (JSON.stringify(printFit) !== JSON.stringify(desktopFit)) throw new Error(`TextFit preview/print divergiu: ${JSON.stringify({ desktopFit, printFit })}`);

  // Table compacta tem tipografia maior e preço permanece idêntico no documento de impressão.
  await setFixture(page, 'table');
  const tableTypography = await page.evaluate(async () => {
    const NS = window.CatalogoTop;
    const body = document.querySelector('#catalogPreview .catalog-table-block tbody td:not(.table-cell-image)');
    const price = document.querySelector('#catalogPreview .catalog-table-block .table-cell-price');
    const preview = { body: parseFloat(getComputedStyle(body).fontSize), price: parseFloat(getComputedStyle(price).fontSize) };
    const frame = await NS.Print.createPrintFrame(NS.Core.getState());
    const printBody = frame.contentDocument.querySelector('.catalog-table-block tbody td:not(.table-cell-image)');
    const printPrice = frame.contentDocument.querySelector('.catalog-table-block .table-cell-price');
    const printed = { body: parseFloat(frame.contentWindow.getComputedStyle(printBody).fontSize), price: parseFloat(frame.contentWindow.getComputedStyle(printPrice).fontSize) };
    frame.remove(); return { preview, printed };
  });
  if (tableTypography.preview.body < 8.7 || tableTypography.preview.price < 10 || Math.abs(tableTypography.preview.body - tableTypography.printed.body) > .1 || Math.abs(tableTypography.preview.price - tableTypography.printed.price) > .1) {
    throw new Error(`tipografia da Table insuficiente ou divergente no print: ${JSON.stringify(tableTypography)}`);
  }

  // Mobile: ↑ / Ajustes / ↓ usam o mesmo contexto editorial sem alterar a semântica de reorder.
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await waitReady(mobilePage);
  await setFixture(mobilePage, 'clean');
  await clickProduct(mobilePage, 'p2');
  await mobilePage.waitForSelector('#editorOrderFloater:not([hidden])');
  const floatingButtons = await mobilePage.locator('#editorOrderFloater button').count();
  const settingsButtons = await mobilePage.locator('#editorOrderFloater [data-editor-settings]').count();
  if (floatingButtons !== 3 || settingsButtons !== 1) throw new Error(`mobile deveria expor ↑ / Ajustes / ↓: ${JSON.stringify({ floatingButtons, settingsButtons })}`);
  await mobilePage.click('#editorOrderFloater [data-editor-move="1"]');
  let mobileOrder = await effectiveOrder(mobilePage);
  if (mobileOrder.join(',') !== 'p1,p3,p2,p4,p5,p6,p7,p8') throw new Error(`seta flutuante não moveu item: ${mobileOrder.join(',')}`);

  await setFixture(mobilePage, 'collection');
  await mobilePage.click('#catalogPreview .catalog-collection[data-collection-id="collection-fixture"] .catalog-collection-header');
  await mobilePage.waitForSelector('#editorOrderFloater:not([hidden])');
  await mobilePage.click('#editorOrderFloater [data-editor-move="1"]');
  mobileOrder = await effectiveOrder(mobilePage);
  if (mobileOrder.join(',') !== 'p1,p4,p2,p3,p5,p6,p7,p8') throw new Error(`seta flutuante não moveu agrupamento inteiro: ${mobileOrder.join(',')}`);

  // Inspector grande rola dentro de si e mantém ações/lista dentro do painel mobile.
  await setFixture(mobilePage, 'table');
  await mobilePage.click('#catalogPreview .catalog-table-block[data-table-block-id="table-fixture"] .catalog-table-heading');
  await mobilePage.waitForSelector('#contextualInspector [data-inspector-table="table-fixture"]');
  const containment = await mobilePage.evaluate(() => {
    const panel = document.querySelector('.selection-panel');
    const inspector = document.querySelector('#contextualInspector');
    const browse = document.querySelector('#selectionBrowseActions');
    const grouping = document.querySelector('#groupingActions');
    const list = document.querySelector('#selectableProducts');
    const panelRect = panel.getBoundingClientRect();
    return {
      overflowY: getComputedStyle(inspector).overflowY,
      inspectorHeight: inspector.clientHeight,
      inspectorScrollHeight: inspector.scrollHeight,
      listHeight: list.clientHeight,
      browseBottom: browse.getBoundingClientRect().bottom,
      groupingBottom: grouping.getBoundingClientRect().bottom,
      panelBottom: panelRect.bottom
    };
  });
  if (containment.overflowY !== 'auto' || containment.inspectorScrollHeight <= containment.inspectorHeight || containment.listHeight < 40 || containment.browseBottom > containment.panelBottom + 1 || containment.groupingBottom > containment.panelBottom + 1) {
    throw new Error(`inspector mobile ainda empurra controles para fora: ${JSON.stringify(containment)}`);
  }

  // Re-renderizar já em Fit mobile não pode mudar as palavras escolhidas pelo TextFit.
  await setFixture(mobilePage, 'text');
  await mobilePage.evaluate(() => {
    window.CatalogoTop.PreviewZoom.fit();
    window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
  });
  await mobilePage.waitForTimeout(100);
  const mobileFit = await readCollectionDescription(mobilePage, 'p2');
  if (JSON.stringify(mobileFit) !== JSON.stringify(desktopFit)) throw new Error(`TextFit mobile/desktop divergiu: ${JSON.stringify({ desktopFit, mobileFit })}`);

  await mobile.close();
  console.log('PASS Browser Composer Order/Legibility Gate');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
