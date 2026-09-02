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
    const relative = decodeURIComponent(url.pathname) === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
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

const CARD_WORDS = 'CORREDIÇA TELESCÓPICA REFORÇADA AMORTECIMENTO ABERTURA TOTAL DESLIZAMENTO SUAVE DURABILIDADE ACABAMENTO ZINCADO MÓVEIS RESIDENCIAIS CORPORATIVOS COZINHAS DORMITÓRIOS PROJETOS FERRAGENS GUIA INTEGRADA PRECISÃO MOVIMENTO SILENCIOSO'.split(' ');
const LONG_COLLECTION = 'SISTEMA DESLIZANTE REFORÇADO COM AMORTECIMENTO INTEGRADO ABERTURA TOTAL GUIA TELESCÓPICA DESLIZAMENTO SUAVE ALTA DURABILIDADE ACABAMENTO ZINCADO PARA MÓVEIS RESIDENCIAIS CORPORATIVOS COZINHAS DORMITÓRIOS E PROJETOS SOB MEDIDA';
const LONG_TABLE = 'LINHA COMERCIAL MUITO LONGA PARA CONTROLE NEGATIVO DE TABELA SEM CONTRATO TEXTFIT NESTE RECORTE';

function seedState({ longCollection, longTable }) {
  const NS = window.CatalogoTop;
  const image = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="white"/><rect x="70" y="80" width="460" height="240" fill="#ddd"/></svg>')}`;
  const product = (id, code, description) => ({
    id, folderId: 'f-ferragens', code, description, category: 'Ferragens', subcategory: '', price: '', quantityPrice: null,
    status: 'Ativo', notes: '', image, imageGallery: [], specs: [], variants: [], tableRows: [], updatedAt: '2026-09-02T00:00:00.000Z'
  });
  const products = [
    product('p1', 'P1', 'Corrediça simples'),
    product('p2', 'P2', 'Descrição a calibrar'),
    product('p3', 'P3', longCollection),
    product('p4', 'P4', 'Membro curto'),
    product('p5', 'P5', longTable),
    product('p6', 'P6', 'Linha curta')
  ];
  const order = products.map(item => item.id);
  const presentation = NS.Composition.normalizePresentation({
    order,
    itemStyles: {
      p2: { contentPreset: 'visual', emphasis: 'normal', width: 'simple', priceStyle: 'standard' }
    },
    blocks: [
      {
        id: 'collection-r6b', type: 'collection', memberIds: ['p3', 'p4'], title: 'Família', subtitle: '',
        theme: 'light', columns: 2, itemPreset: 'visual', itemStyles: {}
      },
      {
        id: 'table-r6b', type: 'table', memberIds: ['p5', 'p6'], title: 'Tabela', subtitle: '',
        rowSource: 'products', density: 'compact', columns: ['code', 'description'], priceStyle: 'standard'
      }
    ],
    imageSelections: {}, imageFrames: {}, imageVariants: {}
  });

  NS.Core.setState({
    schemaVersion: 9,
    folders: [{ id: 'f-ferragens', parentId: null, name: 'Ferragens' }],
    products,
    selectedIds: order,
    catalog: {
      title: 'R6b truncation gate', templateId: 'technical', templateVersion: 1, showPrices: true,
      createdAt: '2026-09-02T00:00:00.000Z', presentation
    }
  }, { persist: false });
  NS.App.renderAll();
}

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(
    window.CatalogoTop?.Preflight && window.CatalogoTop?.PreflightRender && window.CatalogoTop?.PreflightControls &&
    window.CatalogoTop?.TextFit && window.CatalogoTop?.App && window.CatalogoTop?.Print
  ));

  await page.evaluate(seedState, { longCollection: LONG_COLLECTION, longTable: LONG_TABLE });
  await page.click('[data-tab="catalog"]');

  const calibratedCard = await page.evaluate(cardWords => {
    const NS = window.CatalogoTop;
    const words = Array.isArray(cardWords) ? cardWords : [];
    const setCard = (description, width) => {
      NS.Core.mutate(draft => {
        const product = draft.products.find(item => item.id === 'p2');
        product.description = description;
        const presentation = NS.Composition.normalizePresentation(draft.catalog.presentation);
        presentation.itemStyles.p2 = { ...NS.Composition.styleFor(presentation, 'p2'), width };
        draft.catalog.presentation = presentation;
      });
      NS.App.renderAll();
      const node = document.querySelector('#catalogPreview .catalog-card[data-product-id="p2"] h3');
      return node?.dataset.descriptionTruncated === 'true';
    };

    const candidates = [];
    for (let repeat = 1; repeat <= 3; repeat += 1) {
      for (let count = 5; count <= words.length; count += 1) {
        candidates.push(Array.from({ length: repeat }, () => words.slice(0, count)).flat().join(' '));
      }
    }

    for (const candidate of candidates) {
      const simpleTruncated = setCard(candidate, 'simple');
      const fullTruncated = setCard(candidate, 'full');
      if (simpleTruncated && !fullTruncated) {
        setCard(candidate, 'simple');
        return candidate;
      }
    }
    throw new Error('Fixture R6b não encontrou descrição com simple truncado e full íntegro.');
  }, CARD_WORDS);

  await page.waitForFunction(() => {
    const card = document.querySelector('#catalogPreview .catalog-card[data-product-id="p2"] h3');
    const member = document.querySelector('#catalogPreview .catalog-collection-item[data-product-id="p3"] .catalog-collection-copy b');
    return card?.dataset.descriptionTruncated === 'true' && member?.dataset.descriptionTruncated === 'true';
  });

  const initial = await page.evaluate(() => {
    const NS = window.CatalogoTop;
    const stateBefore = JSON.stringify(NS.Core.getState());
    const root = document.getElementById('catalogPreview');
    const directIssues = NS.PreflightRender.inspect(root);
    const report = NS.PreflightControls.getLastReport();
    const card = root.querySelector('.catalog-card[data-product-id="p2"] h3');
    const member = root.querySelector('.catalog-collection-item[data-product-id="p3"] .catalog-collection-copy b');
    const shortCard = root.querySelector('.catalog-card[data-product-id="p1"] h3');
    const table = root.querySelector('.catalog-table-block[data-table-block-id="table-r6b"]');
    return {
      stateBefore,
      stateAfter: JSON.stringify(NS.Core.getState()),
      directIssues,
      report,
      card: { text: card?.textContent || '', full: card?.dataset.fullDescription || '', lines: card?.dataset.fitLines, truncated: card?.dataset.descriptionTruncated },
      member: { text: member?.textContent || '', full: member?.dataset.fullDescription || '', lines: member?.dataset.fitLines, truncated: member?.dataset.descriptionTruncated },
      shortTruncated: shortCard?.dataset.descriptionTruncated,
      tableHasTextFitSignal: Boolean(table?.querySelector('[data-description-truncated="true"]')),
      panelCount: document.querySelectorAll('#preflightPanel [data-preflight-issue="description_truncated"]').length,
      statusText: document.getElementById('preflightStatus')?.textContent.trim() || ''
    };
  });

  if (initial.stateBefore !== initial.stateAfter) throw new Error('PreflightRender mutou Core state');
  if (initial.shortTruncated !== 'false') throw new Error(`Card curto recebeu fitting inesperado: ${JSON.stringify(initial)}`);
  if (initial.tableHasTextFitSignal) throw new Error('Table ganhou sinal TextFit fora do contrato R6b');
  const ids = initial.directIssues.map(item => item.resourceId).sort();
  if (JSON.stringify(ids) !== JSON.stringify(['p2', 'p3'])) throw new Error(`issues render-aware inesperadas: ${JSON.stringify(initial.directIssues)}`);
  if (!initial.directIssues.every(item => item.code === 'description_truncated' && item.severity === 'warning')) throw new Error(`contrato de issue inválido: ${JSON.stringify(initial.directIssues)}`);
  if (initial.directIssues.find(item => item.resourceId === 'p2')?.placement !== 'card') throw new Error('placement Card não foi preservado');
  const collectionIssue = initial.directIssues.find(item => item.resourceId === 'p3');
  if (collectionIssue?.placement !== 'collection' || collectionIssue?.blockId !== 'collection-r6b') throw new Error(`placement Collection inválido: ${JSON.stringify(collectionIssue)}`);
  if (initial.panelCount !== 2 || initial.report?.counts?.warnings !== 2 || initial.report?.status !== 'review' || initial.statusText !== 'Revisar · 2') {
    throw new Error(`merge/UI inicial R6b inválido: ${JSON.stringify(initial)}`);
  }
  if (initial.card.text.includes('…') || initial.card.text.includes('...') || initial.member.text.includes('…') || initial.member.text.includes('...')) {
    throw new Error('TextFit introduziu reticências na cópia publicada');
  }
  if (initial.card.full !== calibratedCard || initial.member.full !== LONG_COLLECTION) throw new Error(`full description factual não foi preservada: ${JSON.stringify({ calibratedCard, initial })}`);

  const noSecondFit = await page.evaluate(() => {
    const NS = window.CatalogoTop;
    const original = NS.TextFit.fitCatalog;
    let calls = 0;
    NS.TextFit.fitCatalog = (...args) => { calls += 1; return original(...args); };
    try {
      const before = calls;
      NS.PreflightControls.refresh(true);
      NS.PreflightControls.refresh(true);
      const after = calls;
      const report = NS.PreflightControls.getLastReport();
      return { before, after, warnings: report?.counts?.warnings, ids: report?.issues?.map(item => item.id) || [] };
    } finally {
      NS.TextFit.fitCatalog = original;
    }
  });
  if (noSecondFit.after !== noSecondFit.before) throw new Error(`Preflight executou TextFit novamente: ${JSON.stringify(noSecondFit)}`);
  if (noSecondFit.warnings !== 2 || new Set(noSecondFit.ids).size !== noSecondFit.ids.length) throw new Error(`refresh duplicou issues: ${JSON.stringify(noSecondFit)}`);

  const geometryFree = await page.evaluate(() => {
    const NS = window.CatalogoTop;
    const root = document.getElementById('catalogPreview');
    const originalRect = Element.prototype.getBoundingClientRect;
    const originalComputed = window.getComputedStyle;
    const originalFit = NS.TextFit.fitCatalog;
    Element.prototype.getBoundingClientRect = () => { throw new Error('geometry read forbidden'); };
    window.getComputedStyle = () => { throw new Error('computed style read forbidden'); };
    NS.TextFit.fitCatalog = () => { throw new Error('fitting forbidden'); };
    try {
      return NS.PreflightRender.inspect(root).map(item => item.resourceId).sort();
    } finally {
      Element.prototype.getBoundingClientRect = originalRect;
      window.getComputedStyle = originalComputed;
      NS.TextFit.fitCatalog = originalFit;
    }
  });
  if (JSON.stringify(geometryFree) !== JSON.stringify(['p2', 'p3'])) throw new Error(`PreflightRender dependeu de geometria/fitting: ${JSON.stringify(geometryFree)}`);

  const beforePanel = await page.evaluate(() => {
    const node = document.querySelector('#catalogPreview .catalog-card[data-product-id="p2"] h3');
    return { text: node.textContent, truncated: node.dataset.descriptionTruncated, visibleWords: node.dataset.visibleWords, state: JSON.stringify(window.CatalogoTop.Core.getState()) };
  });
  await page.click('#preflightStatus');
  await page.waitForFunction(() => !document.getElementById('preflightPanel')?.hidden);
  await page.click('#preflightPanel [data-preflight-close]');
  const afterPanel = await page.evaluate(() => {
    const node = document.querySelector('#catalogPreview .catalog-card[data-product-id="p2"] h3');
    return { text: node.textContent, truncated: node.dataset.descriptionTruncated, visibleWords: node.dataset.visibleWords, state: JSON.stringify(window.CatalogoTop.Core.getState()) };
  });
  if (JSON.stringify(beforePanel) !== JSON.stringify(afterPanel)) throw new Error(`abrir/fechar Preflight alterou fitting/state: ${JSON.stringify({ beforePanel, afterPanel })}`);

  await page.evaluate(() => {
    const NS = window.CatalogoTop;
    NS.Core.mutate(draft => {
      const presentation = NS.Composition.normalizePresentation(draft.catalog.presentation);
      presentation.itemStyles.p2 = { ...NS.Composition.styleFor(presentation, 'p2'), width: 'full' };
      draft.catalog.presentation = presentation;
    });
    NS.App.renderAll();
  });
  await page.waitForFunction(() => document.querySelector('#catalogPreview .catalog-card[data-product-id="p2"] h3')?.dataset.descriptionTruncated === 'false');
  await page.waitForFunction(() => window.CatalogoTop.PreflightControls.getLastReport()?.issues?.filter(item => item.code === 'description_truncated').length === 1);
  const afterWidth = await page.evaluate(() => ({
    status: document.getElementById('preflightStatus')?.textContent.trim(),
    truncations: window.CatalogoTop.PreflightControls.getLastReport()?.issues?.filter(item => item.code === 'description_truncated').map(item => item.resourceId),
    width: document.querySelector('#catalogPreview .catalog-card[data-product-id="p2"]')?.dataset.cardWidth
  }));
  if (afterWidth.status !== 'Revisar · 1' || JSON.stringify(afterWidth.truncations) !== JSON.stringify(['p3']) || afterWidth.width !== 'full') {
    throw new Error(`warning não respondeu ao bounded width rerender: ${JSON.stringify(afterWidth)}`);
  }

  await page.evaluate(() => {
    const NS = window.CatalogoTop;
    NS.Core.mutate(draft => { draft.selectedIds = [...draft.selectedIds, 'missing-product']; });
    NS.App.renderAll();
  });
  await page.waitForFunction(() => window.CatalogoTop.PreflightControls.getLastReport()?.status === 'blocked');
  const blocked = await page.evaluate(() => {
    const report = window.CatalogoTop.PreflightControls.getLastReport();
    window.CatalogoTop.PreflightControls.refresh(true);
    window.CatalogoTop.PreflightControls.refresh(true);
    const refreshed = window.CatalogoTop.PreflightControls.getLastReport();
    return {
      statusText: document.getElementById('preflightStatus')?.textContent.trim(),
      status: refreshed.status,
      blockers: refreshed.counts.blockers,
      warnings: refreshed.counts.warnings,
      codes: refreshed.issues.map(item => item.code),
      idsUnique: new Set(refreshed.issues.map(item => item.id)).size === refreshed.issues.length,
      beforeCount: report.issues.length,
      afterCount: refreshed.issues.length
    };
  });
  if (blocked.status !== 'blocked' || blocked.statusText !== 'Bloqueios · 1' || blocked.blockers !== 1 || blocked.warnings !== 1 || !blocked.idsUnique || blocked.beforeCount !== blocked.afterCount) {
    throw new Error(`merge estrutural/render-aware inválido com blocker: ${JSON.stringify(blocked)}`);
  }
  if (blocked.codes[0] !== 'selected_product_missing' || !blocked.codes.includes('description_truncated')) throw new Error(`ordenação/códigos inválidos: ${JSON.stringify(blocked)}`);

  await page.evaluate(() => {
    const NS = window.CatalogoTop;
    NS.Core.mutate(draft => { draft.selectedIds = draft.selectedIds.filter(id => id !== 'missing-product'); });
    NS.App.renderAll();
  });
  await page.waitForFunction(() => window.CatalogoTop.PreflightControls.getLastReport()?.status === 'review');

  await page.evaluate(async () => {
    window.__r6bPrintFrame = await window.CatalogoTop.Print.createPrintFrame(window.CatalogoTop.Core.getState());
  });
  const parity = await page.evaluate(() => {
    const preview = document.querySelector('#catalogPreview .catalog-collection-item[data-product-id="p3"] .catalog-collection-copy b');
    const printDoc = window.__r6bPrintFrame.contentDocument;
    const printed = printDoc.querySelector('.catalog-collection-item[data-product-id="p3"] .catalog-collection-copy b');
    return {
      preview: { text: preview?.textContent || '', full: preview?.dataset.fullDescription || '', truncated: preview?.dataset.descriptionTruncated, lines: preview?.dataset.fitLines },
      printed: { text: printed?.textContent || '', full: printed?.dataset.fullDescription || '', truncated: printed?.dataset.descriptionTruncated, lines: printed?.dataset.fitLines },
      chrome: printDoc.querySelectorAll('#preflightStatus,#preflightPanel,[data-preflight-issue]').length
    };
  });
  if (parity.chrome) throw new Error('chrome de Preflight vazou para print');
  if (parity.preview.full !== LONG_COLLECTION || parity.printed.full !== LONG_COLLECTION || parity.preview.truncated !== 'true' || parity.printed.truncated !== 'true') {
    throw new Error(`truncamento controlado não permaneceu no print: ${JSON.stringify(parity)}`);
  }
  if (parity.preview.text !== parity.printed.text || parity.preview.lines !== parity.printed.lines) throw new Error(`preview/print divergiram no fitting R6b: ${JSON.stringify(parity)}`);
  await page.evaluate(() => window.__r6bPrintFrame?.remove());

  await page.setViewportSize({ width: 390, height: 844 });
  if (await page.evaluate(() => document.getElementById('preflightPanel')?.hidden)) await page.click('#preflightStatus');
  const overflow = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth, client: document.documentElement.clientWidth,
    catalog: document.getElementById('catalog').scrollWidth, catalogClient: document.getElementById('catalog').clientWidth
  }));
  if (overflow.doc > overflow.client + 2 || overflow.catalog > overflow.catalogClient + 2) throw new Error(`R6b criou overflow mobile: ${JSON.stringify(overflow)}`);

  console.log('PASS R6b rendered description truncation: explicit TextFit signal, Card/Collection only, canonical merge, reactive width, no second fit, preview-print parity and mobile geometry');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}