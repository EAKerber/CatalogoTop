import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
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

function installFixture() {
  const NS = window.CatalogoTop;
  const categories = ['CORREDIÇAS', 'DOBRADIÇAS', 'SUPORTES', 'PUXADORES LONGOS', 'PERFIS DE ALUMÍNIO', 'PISTÕES', 'RODÍZIOS', 'ACESSÓRIOS', 'FECHADURAS'];
  const products = Array.from({ length: 22 }, (_, index) => ({
    id: `p${index + 1}`,
    code: String(1265 + index),
    description: `PRODUTO ${index + 1} PARA TESTE DE COMANDOS E HISTÓRICO`,
    category: index < 3 ? 'CORREDIÇAS' : categories[(index - 2) % categories.length],
    subcategory: '', price: `R$ ${10 + index},90`, status: 'Ativo', notes: '', image: '', specs: [], variants: [], tableRows: [], updatedAt: '2026-08-29T00:00:00.000Z'
  }));
  NS.Core.setState({
    schemaVersion: 7,
    products,
    selectedIds: products.map(product => product.id),
    catalog: {
      title: 'Command gate', templateId: 'technical', showPrices: true, createdAt: '2026-08-29T00:00:00.000Z',
      presentation: NS.Composition.normalizePresentation({ order: products.map(product => product.id), itemStyles: {}, imageFrames: {}, blocks: [] })
    }
  }, { persist: false });
  NS.ComposerSelection?.clear?.();
  window.__dispatchEditorShortcut = (key, options = {}) => window.dispatchEvent(new KeyboardEvent('keydown', {
    key, ctrlKey: true, altKey: Boolean(options.altKey), shiftKey: Boolean(options.shiftKey), bubbles: true, cancelable: true
  }));
  window.__tabLifecycle = [];
  window.addEventListener('catalogotop:tab-changed', event => window.__tabLifecycle.push(event.detail?.tabId || ''));
  window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
  NS.App.renderAll();
}

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.CatalogoTop?.Core && window.CatalogoTop?.App && window.CatalogoTop?.GroupingControls && window.CatalogoTop?.EditorHistory));
  await page.waitForFunction(() => Boolean(document.querySelector('link[rel="stylesheet"][href="editor-command-layout.css"]')?.sheet));
  await page.evaluate(installFixture);
  await page.click('[data-tab="catalog"]');
  await page.waitForSelector('#catalog.panel.active .desktop-editor-actions');
  await page.waitForFunction(() => document.querySelector('.selection-category-rail')?.children.length >= 8);

  const desktopChrome = await page.evaluate(() => {
    const search = document.querySelector('#searchSelection').getBoundingClientRect();
    const actions = document.querySelector('.desktop-editor-actions').getBoundingClientRect();
    const collection = document.querySelector('#btnCreateCollection');
    const table = document.querySelector('#btnCreateTableBlock');
    const rail = document.querySelector('.selection-category-rail');
    const railRect = rail.getBoundingClientRect();
    const history = document.querySelector('.editor-history-controls');
    const newCatalog = document.querySelector('#btnNewCatalog');
    return {
      panelWidth: document.querySelector('.selection-panel').getBoundingClientRect().width,
      sameFilterRow: Math.abs(search.top - actions.top) < 5,
      actionsBottom: actions.bottom,
      railTop: railRect.top,
      railOverflow: rail.scrollWidth - rail.clientWidth,
      railPaddingRight: parseFloat(getComputedStyle(rail).paddingRight) || 0,
      collectionWidth: collection.getBoundingClientRect().width,
      tableWidth: table.getBoundingClientRect().width,
      collectionGlyph: getComputedStyle(collection.querySelector('.group-action-glyph')).display,
      tableGlyph: getComputedStyle(table.querySelector('.group-action-glyph')).display,
      collectionDisabled: collection.disabled,
      tableDisabled: table.disabled,
      historyParent: history.parentElement?.className || '',
      historyBeforeNew: Boolean(history.compareDocumentPosition(newCatalog) & Node.DOCUMENT_POSITION_FOLLOWING),
      undoDisabled: history.querySelector('[data-editor-history="undo"]').disabled
    };
  });
  if (desktopChrome.panelWidth < 515) throw new Error(`painel autoral não cresceu: ${JSON.stringify(desktopChrome)}`);
  if (!desktopChrome.sameFilterRow || desktopChrome.railTop < desktopChrome.actionsBottom + 3) throw new Error(`filtro/ações/rail não respeitam duas linhas: ${JSON.stringify(desktopChrome)}`);
  if (desktopChrome.railOverflow <= 10 || desktopChrome.railPaddingRight < 48) throw new Error(`rail precisa rolar horizontalmente com margem final: ${JSON.stringify(desktopChrome)}`);
  if (desktopChrome.collectionWidth > 40 || desktopChrome.tableWidth > 40 || desktopChrome.collectionGlyph === 'none' || desktopChrome.tableGlyph === 'none') throw new Error(`ações de grupo/tabela não viraram ícones compactos: ${JSON.stringify(desktopChrome)}`);
  if (!desktopChrome.collectionDisabled || !desktopChrome.tableDisabled || !desktopChrome.historyParent.includes('heading-actions') || !desktopChrome.historyBeforeNew || !desktopChrome.undoDisabled) throw new Error(`estado inicial dos comandos/histórico inválido: ${JSON.stringify(desktopChrome)}`);

  await page.evaluate(() => {
    const NS = window.CatalogoTop;
    NS.ComposerSelection.selectProduct(NS.Core.getState(), 'p1');
    NS.ComposerSelection.selectProduct(NS.Core.getState(), 'p2', { additive: true });
  });
  await page.waitForFunction(() => !document.querySelector('#btnCreateCollection').disabled && !document.querySelector('#btnCreateTableBlock').disabled);
  const validButtons = await page.evaluate(() => ({
    collectionCount: document.querySelector('#btnCreateCollection').dataset.count,
    tableCount: document.querySelector('#btnCreateTableBlock').dataset.count,
    collectionBadge: getComputedStyle(document.querySelector('#btnCreateCollection .group-action-badge')).display,
    badgeColor: getComputedStyle(document.querySelector('#btnCreateCollection .group-action-badge')).backgroundColor,
    collectionTitle: document.querySelector('#btnCreateCollection').title,
    tableTitle: document.querySelector('#btnCreateTableBlock').title
  }));
  if (validButtons.collectionCount !== '2' || validButtons.tableCount !== '2' || validButtons.collectionBadge === 'none' || !validButtons.badgeColor.includes('239, 23, 27')) throw new Error(`badges de ações inválidos: ${JSON.stringify(validButtons)}`);
  if (!validButtons.collectionTitle.includes('Ctrl+G') || !validButtons.tableTitle.includes('Ctrl+T')) throw new Error(`tooltips não documentam atalhos: ${JSON.stringify(validButtons)}`);

  await page.evaluate(() => window.__dispatchEditorShortcut('g'));
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().catalog.presentation.blocks.some(block => block.type === 'collection'));
  await page.waitForSelector('#contextualInspector [data-inspector-collection]');
  const collectionLayout = await page.evaluate(() => {
    const editor = document.querySelector('[data-inspector-collection]');
    const theme = editor.querySelector('[data-inspector-collection-field="theme"]').closest('label').getBoundingClientRect();
    const columns = editor.querySelector('[data-inspector-collection-field="columns"]').closest('label').getBoundingClientRect();
    const presentation = editor.querySelector('[data-inspector-collection-field="itemPreset"]').closest('label').getBoundingClientRect();
    return { tops: [theme.top, columns.top, presentation.top], canUndo: window.CatalogoTop.EditorHistory.canUndo(), blockCount: window.CatalogoTop.Core.getState().catalog.presentation.blocks.length };
  });
  if (Math.max(...collectionLayout.tops) - Math.min(...collectionLayout.tops) > 6 || !collectionLayout.canUndo || collectionLayout.blockCount !== 1) throw new Error(`Collection não compactou ou histórico não registrou: ${JSON.stringify(collectionLayout)}`);

  await page.click('[data-editor-history="undo"]');
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().catalog.presentation.blocks.length === 0);
  const afterUndo = await page.evaluate(() => ({ canRedo: window.CatalogoTop.EditorHistory.canRedo(), redoDisabled: document.querySelector('[data-editor-history="redo"]').disabled }));
  if (!afterUndo.canRedo || afterUndo.redoDisabled) throw new Error(`undo não habilitou redo: ${JSON.stringify(afterUndo)}`);
  await page.click('[data-editor-history="redo"]');
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().catalog.presentation.blocks.some(block => block.type === 'collection'));
  await page.click('[data-editor-history="undo"]');
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().catalog.presentation.blocks.length === 0);

  await page.evaluate(() => {
    const NS = window.CatalogoTop;
    NS.ComposerSelection.clear();
    NS.ComposerSelection.selectProduct(NS.Core.getState(), 'p1');
    NS.ComposerSelection.selectProduct(NS.Core.getState(), 'p2', { additive: true });
    window.__dispatchEditorShortcut('t');
  });
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().catalog.presentation.blocks.some(block => block.type === 'table'));
  await page.waitForSelector('#contextualInspector [data-inspector-table] [data-commercial-table-price-editor]');
  const tableLayout = await page.evaluate(() => {
    const editor = document.querySelector('[data-inspector-table]');
    const lines = editor.querySelector('[data-inspector-table-field="rowSource"]').closest('label').getBoundingClientRect();
    const density = editor.querySelector('[data-inspector-table-field="density"]').closest('label').getBoundingClientRect();
    const price = editor.querySelector('[data-commercial-table-price-editor]').getBoundingClientRect();
    const columns = editor.querySelector('.inspector-columns').getBoundingClientRect();
    return { tops: [lines.top, density.top, price.top], columnsTop: columns.top, rowBottom: Math.max(lines.bottom, density.bottom, price.bottom) };
  });
  if (Math.max(...tableLayout.tops) - Math.min(...tableLayout.tops) > 8 || tableLayout.columnsTop < tableLayout.rowBottom - 2) throw new Error(`Linhas/Densidade/Preço não compartilham uma linha: ${JSON.stringify(tableLayout)}`);

  const beforeInvalid = await page.evaluate(() => {
    window.CatalogoTop.ComposerSelection.clear();
    return JSON.stringify(window.CatalogoTop.Core.getState().catalog.presentation.blocks);
  });
  await page.waitForFunction(() => document.querySelector('#btnCreateCollection').disabled && document.querySelector('#btnCreateTableBlock').disabled);
  await page.evaluate(() => { window.__dispatchEditorShortcut('g'); window.__dispatchEditorShortcut('t'); });
  const afterInvalid = await page.evaluate(() => JSON.stringify(window.CatalogoTop.Core.getState().catalog.presentation.blocks));
  if (afterInvalid !== beforeInvalid) throw new Error('atalho inválido não pode executar ação desabilitada');

  await page.click('[data-tab="products"]');
  await page.waitForSelector('#products.panel.active');
  await page.waitForTimeout(60);
  const outsideCatalog = await page.evaluate(() => ({ historyHidden: document.querySelector('.editor-history-controls').hidden, before: window.CatalogoTop.EditorHistory.snapshot() }));
  await page.evaluate(() => { window.__dispatchEditorShortcut('z'); window.__dispatchEditorShortcut('y'); });
  const outsideAfter = await page.evaluate(() => ({ hidden: document.querySelector('.editor-history-controls').hidden, after: window.CatalogoTop.EditorHistory.snapshot() }));
  if (!outsideCatalog.historyHidden || !outsideAfter.hidden || JSON.stringify(outsideCatalog.before) !== JSON.stringify(outsideAfter.after)) throw new Error(`histórico vazou para outra aba: ${JSON.stringify({ outsideCatalog, outsideAfter })}`);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('[data-tab="catalog"]');
  await page.waitForSelector('#catalog.panel.active');
  await page.waitForTimeout(80);
  const mobile = await page.evaluate(() => {
    const header = document.querySelector('.app-shell-header');
    const history = document.querySelector('.editor-history-controls');
    const tabs = document.querySelector('.app-tabs');
    const h = history.getBoundingClientRect();
    const t = tabs.getBoundingClientRect();
    return {
      parentClass: history.parentElement?.className || '',
      historyHidden: history.hidden,
      historyTop: h.top,
      tabsTop: t.top,
      tabsRight: t.right,
      historyLeft: h.left,
      headerBottom: header.getBoundingClientRect().bottom,
      headerHeight: header.getBoundingClientRect().height
    };
  });
  if (!mobile.parentClass.includes('app-primary-tools') || mobile.historyHidden || Math.abs(mobile.historyTop - mobile.tabsTop) > 8 || mobile.tabsRight > mobile.historyLeft + 2) throw new Error(`undo/redo mobile não ocupa a segunda linha do header: ${JSON.stringify(mobile)}`);

  const mobileSnapshot = await page.evaluate(() => JSON.stringify(window.CatalogoTop.EditorHistory.snapshot()));
  for (const tabId of ['products', 'library']) {
    await page.click(`[data-tab="${tabId}"]`);
    await page.waitForSelector(`#${tabId}.panel.active`);
    await page.waitForTimeout(50);
    const outsideMobile = await page.evaluate(() => {
      const history = document.querySelector('.editor-history-controls');
      const rect = history.getBoundingClientRect();
      return {
        hidden: history.hidden,
        display: getComputedStyle(history).display,
        width: rect.width,
        height: rect.height,
        parentClass: history.parentElement?.className || '',
        snapshot: JSON.stringify(window.CatalogoTop.EditorHistory.snapshot())
      };
    });
    if (!outsideMobile.hidden || outsideMobile.display !== 'none' || outsideMobile.width !== 0 || outsideMobile.height !== 0 || !outsideMobile.parentClass.includes('heading-actions')) throw new Error(`histórico mobile vazou visualmente fora de Catálogo em ${tabId}: ${JSON.stringify(outsideMobile)}`);
    await page.evaluate(() => { window.__dispatchEditorShortcut('z'); window.__dispatchEditorShortcut('y'); });
    const afterShortcut = await page.evaluate(() => JSON.stringify(window.CatalogoTop.EditorHistory.snapshot()));
    if (outsideMobile.snapshot !== mobileSnapshot || afterShortcut !== mobileSnapshot) throw new Error(`atalho de histórico alterou estado fora de Catálogo em ${tabId}`);
    await page.click('[data-tab="catalog"]');
    await page.waitForSelector('#catalog.panel.active');
    await page.waitForTimeout(50);
    const restored = await page.evaluate(() => {
      const header = document.querySelector('.app-shell-header');
      const history = document.querySelector('.editor-history-controls');
      const tabs = document.querySelector('.app-tabs');
      const h = history.getBoundingClientRect();
      const t = tabs.getBoundingClientRect();
      return {
        hidden: history.hidden,
        parentClass: history.parentElement?.className || '',
        historyTop: h.top,
        tabsTop: t.top,
        headerHeight: header.getBoundingClientRect().height,
        snapshot: JSON.stringify(window.CatalogoTop.EditorHistory.snapshot())
      };
    });
    if (restored.hidden || !restored.parentClass.includes('app-primary-tools') || Math.abs(restored.historyTop - restored.tabsTop) > 8 || restored.headerHeight > mobile.headerHeight + 2 || restored.snapshot !== mobileSnapshot) throw new Error(`histórico mobile não restaurou corretamente após ${tabId}: ${JSON.stringify(restored)}`);
  }

  const lifecycle = await page.evaluate(() => window.__tabLifecycle.slice());
  const expectedTail = ['products', 'catalog', 'products', 'catalog', 'library', 'catalog'];
  if (expectedTail.some((tabId, index) => lifecycle[lifecycle.length - expectedTail.length + index] !== tabId)) throw new Error(`lifecycle de abas incompleto: ${JSON.stringify(lifecycle)}`);

  console.log('PASS editor shortcut/history gate: ações compactas, rail, Ctrl+G/T, undo/redo, lifecycle mobile e densidade contextual');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
