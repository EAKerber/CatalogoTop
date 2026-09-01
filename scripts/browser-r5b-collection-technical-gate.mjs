import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';

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

function seedState() {
  const NS = window.CatalogoTop;
  const svg = label => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="white"/><rect x="60" y="70" width="480" height="260" rx="26" fill="#e0e3e7"/><text x="300" y="218" text-anchor="middle" font-family="Arial" font-size="40" fill="#222">${label}</text></svg>`)}`;
  const product = (id, specs = []) => ({
    id,
    folderId: 'f-technical',
    code: id.toUpperCase(),
    description: `Produto ${id}`,
    category: 'Ferragens',
    subcategory: '',
    price: 'R$ 39,90',
    status: 'Ativo',
    notes: '',
    image: svg(id),
    imageGallery: [],
    specs,
    variants: [],
    tableRows: [],
    updatedAt: '2026-09-01T00:00:00.000Z'
  });
  const products = [
    product('p1', [
      { label: 'Capacidade', value: '35 kg' },
      { label: 'Ignorar', value: '' },
      { label: 'Ciclos', value: '40 mil' },
      { label: 'Aplicação', value: 'Inferior' }
    ]),
    product('p2', [
      { label: 'Abertura', value: 'Total' },
      { label: 'Montagem', value: 'Inferior' },
      { label: 'Carga', value: '35 kg' }
    ]),
    product('p3', []),
    product('p4', [
      { label: 'Material', value: 'Aço' },
      { label: 'Curso', value: '450 mm' },
      { label: 'Acabamento', value: 'Zincado' }
    ])
  ];
  NS.Core.setState({
    schemaVersion: 9,
    folders: [{ id: 'f-technical', parentId: null, name: 'Ferragens' }],
    products,
    selectedIds: products.map(item => item.id),
    catalog: {
      title: 'R5b Collection Technical Detail',
      templateId: 'technical',
      templateVersion: 1,
      showPrices: true,
      createdAt: '2026-09-01T00:00:00.000Z',
      presentation: NS.Composition.normalizePresentation({
        order: products.map(item => item.id),
        imageFrames: { p2: { fit: 'cover', zoom: 1.25, x: 20, y: 80 } },
        blocks: [{
          id: 'collection-r5b',
          type: 'collection',
          memberIds: products.map(item => item.id),
          title: 'Família técnica',
          subtitle: 'Resumo factual',
          theme: 'light',
          columns: 4,
          itemPreset: 'technical',
          itemStyles: {
            p2: { width: 'wide', emphasis: 'feature' },
            p4: { width: 'full' }
          }
        }]
      })
    }
  }, { persist: false });
  window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
  return products.map(productItem => ({ id: productItem.id, specs: productItem.specs.map(spec => ({ ...spec })) }));
}

function readCollection(rootSelector = '#catalogPreview') {
  const block = document.querySelector(`${rootSelector} .catalog-collection[data-collection-id="collection-r5b"]`);
  const member = id => block?.querySelector(`.catalog-collection-item[data-product-id="${id}"]`);
  const specs = id => Array.from(member(id)?.querySelectorAll('.catalog-collection-specs li') || []).map(node => node.textContent.trim().replace(/\s+/g, ' '));
  const p2Image = member('p2')?.querySelector('.catalog-collection-image > img');
  return {
    exists: Boolean(block),
    pageCount: document.querySelectorAll(`${rootSelector} .catalog-page`).length,
    rowSpan: block?.dataset.rowSpan || '',
    localRows: block?.dataset.localRows || '',
    p1Count: Number(member('p1')?.dataset.technicalSpecCount || 0),
    p2Count: Number(member('p2')?.dataset.technicalSpecCount || 0),
    p3Count: Number(member('p3')?.dataset.technicalSpecCount || 0),
    p4Count: Number(member('p4')?.dataset.technicalSpecCount || 0),
    p1Specs: specs('p1'),
    p2Specs: specs('p2'),
    p3Specs: specs('p3'),
    p4Specs: specs('p4'),
    p2Width: member('p2')?.dataset.memberWidth || '',
    p2Feature: member('p2')?.classList.contains('emphasis-feature') || false,
    p2Fit: p2Image?.style.objectFit || '',
    p2Transform: p2Image?.style.transform || '',
    duplicateCards: ['p1','p2','p3','p4'].filter(id => document.querySelector(`${rootSelector} .catalog-card[data-product-id="${id}"]`)).length
  };
}

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(
    window.CatalogoTop?.Collection
    && window.CatalogoTop?.CollectionControls
    && window.CatalogoTop?.ComposerSelection
    && window.CatalogoTop?.Print
  ));

  const factualBefore = await page.evaluate(seedState);
  await page.click('[data-tab="catalog"]');
  await page.waitForSelector('#catalogPreview .catalog-collection[data-collection-id="collection-r5b"]');

  const preview = await page.evaluate(readCollection);
  if (!preview.exists || preview.pageCount !== 1 || preview.rowSpan !== '2' || preview.localRows !== '2') throw new Error(`geometria técnica alterou Collection: ${JSON.stringify(preview)}`);
  if (preview.p1Count !== 1 || preview.p2Count !== 2 || preview.p3Count !== 0 || preview.p4Count !== 2) throw new Error(`orçamento técnico divergente: ${JSON.stringify(preview)}`);
  if (preview.p1Specs.join('|') !== 'Capacidade35 kg') throw new Error(`simple deve mostrar somente primeira spec factual: ${JSON.stringify(preview.p1Specs)}`);
  if (preview.p2Specs.join('|') !== 'AberturaTotal|MontagemInferior') throw new Error(`wide deve mostrar duas specs em ordem: ${JSON.stringify(preview.p2Specs)}`);
  if (preview.p3Specs.length) throw new Error('membro sem specs não pode receber placeholder técnico');
  if (preview.p4Specs.join('|') !== 'MaterialAço|Curso450 mm') throw new Error(`full deve permanecer bounded em duas specs: ${JSON.stringify(preview.p4Specs)}`);
  if (preview.p2Width !== 'wide' || !preview.p2Feature) throw new Error('preset técnico não pode apagar largura/ênfase locais');
  if (preview.p2Fit !== 'cover' || preview.p2Transform !== 'scale(1.25)') throw new Error(`framing deixou de alcançar membro técnico: ${JSON.stringify(preview)}`);
  if (preview.duplicateCards) throw new Error('membros técnicos não podem aparecer também como cards');

  await page.evaluate(() => window.CatalogoTop.ComposerSelection.select({ kind: 'collection', blockId: 'collection-r5b' }));
  await page.waitForSelector('#contextualInspector [data-inspector-collection-field="itemPreset"] option[value="technical"]');
  const inspectorOption = await page.$eval('#contextualInspector [data-inspector-collection-field="itemPreset"] option[value="technical"]', option => option.textContent.trim());
  if (inspectorOption !== 'Técnico') throw new Error(`inspector não derivou preset técnico: ${inspectorOption}`);

  await page.selectOption('#contextualInspector [data-inspector-collection-field="itemPreset"]', 'visual');
  await page.waitForFunction(() => !document.querySelector('#catalogPreview .catalog-collection[data-collection-id="collection-r5b"] .catalog-collection-specs'));
  await page.selectOption('#contextualInspector [data-inspector-collection-field="itemPreset"]', 'technical');
  await page.waitForFunction(() => document.querySelectorAll('#catalogPreview .catalog-collection[data-collection-id="collection-r5b"] .catalog-collection-specs').length === 3);

  const factualAfter = await page.evaluate(() => window.CatalogoTop.Core.getState().products.map(product => ({ id: product.id, specs: product.specs.map(spec => ({ ...spec })) })));
  if (JSON.stringify(factualAfter) !== JSON.stringify(factualBefore)) throw new Error('alternar preset técnico alterou product.specs');

  const printableHtml = await page.evaluate(() => window.CatalogoTop.Print.buildPrintableHtml(window.CatalogoTop.Core.getState()));
  const printPage = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await printPage.setContent(printableHtml, { waitUntil: 'networkidle' });
  const printState = await printPage.evaluate(readCollection, 'body');
  if (!printState.exists || printState.pageCount !== 1 || printState.p1Count !== 1 || printState.p2Count !== 2 || printState.p3Count !== 0 || printState.p4Count !== 2) {
    throw new Error(`preview/print divergem no resumo técnico: ${JSON.stringify(printState)}`);
  }
  if (printState.p2Fit !== 'cover' || printState.p2Transform !== 'scale(1.25)' || printState.duplicateCards) throw new Error(`print perdeu framing/atomicidade: ${JSON.stringify(printState)}`);
  if (await printPage.locator('#contextualInspector').count()) throw new Error('documento print não pode carregar chrome do inspector');

  const pdfBytes = await printPage.pdf({ format: 'A4', printBackground: false, preferCSSPageSize: true });
  const pdf = await PDFDocument.load(pdfBytes);
  if (pdf.getPageCount() !== 1) throw new Error(`uma página lógica deve gerar uma página física; recebeu ${pdf.getPageCount()}`);
  const { width, height } = pdf.getPage(0).getSize();
  const mmWidth = width * 25.4 / 72;
  const mmHeight = height * 25.4 / 72;
  if (Math.abs(mmWidth - 210) > 0.7 || Math.abs(mmHeight - 297) > 0.7) throw new Error(`página física não é A4: ${mmWidth.toFixed(2)} × ${mmHeight.toFixed(2)} mm`);
  await printPage.close();

  console.log('PASS R5b Collection technical gate: budget, inspector, factual immutability, framing, print e A4');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
