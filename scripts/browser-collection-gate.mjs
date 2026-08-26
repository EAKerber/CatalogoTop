import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';

const root = process.cwd();
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};

const server = createServer(async (request, response) => {
  try {
    const rawPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.CatalogoTop?.Collection && window.CatalogoTop?.CatalogDocument && window.CatalogoTop?.Print));

  const materialized = await page.evaluate(() => {
    const NS = window.CatalogoTop;
    const product = id => ({
      id,
      code: id.toUpperCase(),
      description: `Produto elétrico ${id}`,
      category: 'Elétrica',
      subcategory: '35 mm',
      price: `R$ ${Number(id.slice(1)) + 4},90`,
      status: 'Ativo',
      notes: '',
      image: '',
      specs: [],
      variants: [],
      tableRows: [],
      updatedAt: new Date().toISOString()
    });
    const products = Array.from({ length: 8 }, (_, index) => product(`p${index + 1}`));
    NS.Core.setState({
      schemaVersion: 4,
      products,
      selectedIds: products.map(item => item.id),
      catalog: {
        title: 'Elétrica',
        templateId: 'technical',
        showPrices: true,
        createdAt: '2026-08-26T12:00:00Z',
        presentation: {
          distribution: 'balanced',
          typography: 'neutral',
          itemStyles: {},
          blocks: [{
            id: 'collection-electric',
            type: 'collection',
            memberIds: ['p2', 'p3', 'p4', 'p5'],
            title: 'Tomadas e interruptores',
            subtitle: '35 mm',
            theme: 'dark',
            columns: 4,
            itemPreset: 'commercial',
            itemStyles: { p5: { emphasis: 'feature', width: 'wide' } }
          }]
        }
      }
    });
    window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
    const doc = NS.CatalogDocument.build(NS.Core.getState());
    return {
      pageCount: doc.pageCount,
      orderedIds: doc.orderedIds,
      collection: doc.pages.flatMap(page => page.items).find(item => item.type === 'collection'),
      p8Page: doc.pages.findIndex(page => page.products.some(product => product.id === 'p8')) + 1
    };
  });

  if (materialized.pageCount !== 2) throw new Error(`coleção atômica deveria produzir 2 páginas; recebeu ${materialized.pageCount}`);
  if (materialized.orderedIds.join(',') !== 'p1,p2,p3,p4,p5,p6,p7,p8') throw new Error(`coleção alterou ordem factual: ${materialized.orderedIds.join(',')}`);
  if (!materialized.collection || materialized.collection.row !== 2 || materialized.collection.rowSpan !== 2) throw new Error(`rowSpan da coleção incorreto: ${JSON.stringify(materialized.collection)}`);
  if (materialized.p8Page !== 2) throw new Error('item posterior deve ir para a página seguinte sem dividir a coleção');

  await page.click('[data-tab="catalog"]');
  await page.waitForSelector('#catalogPreview .catalog-collection[data-collection-id="collection-electric"]');
  const preview = await page.evaluate(() => {
    const block = document.querySelector('#catalogPreview .catalog-collection[data-collection-id="collection-electric"]');
    const firstPage = block?.closest('.catalog-page');
    return {
      pages: document.querySelectorAll('#catalogPreview .catalog-page').length,
      memberCount: block?.querySelectorAll('.catalog-collection-item').length || 0,
      cols: getComputedStyle(block?.querySelector('.catalog-collection-grid')).gridTemplateColumns,
      row: getComputedStyle(block).gridRowStart,
      rowSpan: block?.dataset.rowSpan || '',
      theme: block?.classList.contains('theme-dark') || false,
      duplicateMemberCards: ['p2','p3','p4','p5'].filter(id => firstPage?.querySelector(`.catalog-card[data-product-id="${id}"]`)).length,
      p5Width: block?.querySelector('[data-product-id="p5"]')?.dataset.memberWidth || ''
    };
  });
  if (preview.pages !== 2 || preview.memberCount !== 4) throw new Error(`preview de coleção incompleto: ${JSON.stringify(preview)}`);
  if (preview.cols.trim().split(/\s+/).length !== 4) throw new Error(`coleção deveria ter 4 colunas: ${preview.cols}`);
  if (preview.row !== '2' || preview.rowSpan !== '2' || !preview.theme) throw new Error(`geometria/tema divergiram do documento: ${JSON.stringify(preview)}`);
  if (preview.duplicateMemberCards) throw new Error('membros da coleção não podem aparecer também como cards independentes');
  if (preview.p5Width !== 'wide') throw new Error('override Largo do membro não chegou ao DOM');

  const printableHtml = await page.evaluate(() => window.CatalogoTop.Print.buildPrintableHtml(window.CatalogoTop.Core.getState()));
  if (!printableHtml.includes('collection-block.css')) throw new Error('documento print precisa carregar o stylesheet da coleção');

  const printPage = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await printPage.setContent(printableHtml, { waitUntil: 'networkidle' });
  const printState = await printPage.evaluate(() => {
    const block = document.querySelector('.catalog-collection[data-collection-id="collection-electric"]');
    return {
      pages: document.querySelectorAll('.catalog-page').length,
      collections: document.querySelectorAll('.catalog-collection').length,
      members: block?.querySelectorAll('.catalog-collection-item').length || 0,
      shell: Boolean(document.querySelector('.app-shell-header')),
      display: block ? getComputedStyle(block).display : '',
      overflow: block ? getComputedStyle(block).overflow : ''
    };
  });
  if (printState.pages !== 2 || printState.collections !== 1 || printState.members !== 4) throw new Error(`print perdeu a coleção: ${JSON.stringify(printState)}`);
  if (printState.shell || printState.display !== 'grid' || printState.overflow !== 'hidden') throw new Error(`print da coleção contaminado ou sem CSS: ${JSON.stringify(printState)}`);

  const pdfBytes = await printPage.pdf({ format: 'A4', printBackground: false, preferCSSPageSize: true });
  const pdf = await PDFDocument.load(pdfBytes);
  if (pdf.getPageCount() !== 2) throw new Error(`2 páginas lógicas devem gerar 2 físicas; recebeu ${pdf.getPageCount()}`);
  for (const pdfPage of pdf.getPages()) {
    const { width, height } = pdfPage.getSize();
    const mmWidth = width * 25.4 / 72;
    const mmHeight = height * 25.4 / 72;
    if (Math.abs(mmWidth - 210) > 0.7 || Math.abs(mmHeight - 297) > 0.7) throw new Error(`página física não é A4: ${mmWidth.toFixed(2)} × ${mmHeight.toFixed(2)} mm`);
  }

  console.log('PASS browser collection gate: ordem factual, coleção atômica, rowSpan, CSS print e A4 físico');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
