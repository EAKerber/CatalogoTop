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
  await page.waitForFunction(() => Boolean(window.CatalogoTop?.TableBlock && window.CatalogoTop?.TableDocument && window.CatalogoTop?.ProductActions && window.CatalogoTop?.Print));

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
    const products = Array.from({ length: 12 }, (_, index) => product(`p${index + 1}`));
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
            id: 'table-electric',
            type: 'table',
            memberIds: ['p5','p6','p7','p8','p9','p10','p11','p12'],
            title: 'Tomadas e interruptores',
            subtitle: 'Referências',
            rowSource: 'products',
            density: 'compact',
            columns: ['code','description','price']
          }]
        }
      }
    });
    window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
    const doc = NS.CatalogDocument.build(NS.Core.getState());
    return {
      pageCount: doc.pageCount,
      orderedIds: doc.orderedIds,
      tables: doc.pages.flatMap((catalogPage, pageIndex) => catalogPage.items.filter(item => item.type === 'table').map(item => ({
        page: pageIndex + 1,
        row: item.row,
        rowSpan: item.rowSpan,
        rows: item.rows.length,
        fragmentStart: item.fragmentStart,
        fragmentEnd: item.fragmentEnd
      })))
    };
  });

  if (materialized.pageCount !== 2) throw new Error(`tabela fragmentável deveria produzir 2 páginas; recebeu ${materialized.pageCount}`);
  if (materialized.orderedIds.join(',') !== 'p1,p2,p3,p4,p5,p6,p7,p8,p9,p10,p11,p12') throw new Error(`tabela alterou ordem factual: ${materialized.orderedIds.join(',')}`);
  if (materialized.tables.length !== 2) throw new Error(`esperados dois segmentos físicos de tabela: ${JSON.stringify(materialized.tables)}`);
  if (materialized.tables[0].page !== 1 || materialized.tables[0].row !== 3 || materialized.tables[0].rowSpan !== 2 || materialized.tables[0].rows !== 7) throw new Error(`segmento inicial incorreto: ${JSON.stringify(materialized.tables[0])}`);
  if (materialized.tables[1].page !== 2 || materialized.tables[1].row !== 1 || materialized.tables[1].rows !== 1 || materialized.tables[1].fragmentStart !== 2) throw new Error(`continuação incorreta: ${JSON.stringify(materialized.tables[1])}`);

  await page.waitForSelector('[data-delete-product-direct="p6"]');
  const directDelete = await page.evaluate(() => {
    const button = document.querySelector('[data-delete-product-direct="p6"]');
    return Boolean(button && button.getAttribute('aria-label') === 'Excluir produto');
  });
  if (!directDelete) throw new Error('biblioteca deve expor exclusão direta por produto');

  await page.click('[data-tab="catalog"]');
  await page.waitForSelector('#catalogPreview .catalog-table-block[data-table-block-id="table-electric"]');
  const preview = await page.evaluate(() => {
    const tables = Array.from(document.querySelectorAll('#catalogPreview .catalog-table-block[data-table-block-id="table-electric"]'));
    return {
      pages: document.querySelectorAll('#catalogPreview .catalog-page').length,
      tables: tables.length,
      rows: tables.map(table => table.querySelectorAll('tbody tr').length),
      continuation: tables[1]?.classList.contains('is-continuation') || false,
      continuationLabel: Boolean(tables[1]?.querySelector('.catalog-table-continuation')),
      duplicateMemberCards: ['p5','p6','p7','p8','p9','p10','p11','p12'].filter(id => document.querySelector(`#catalogPreview .catalog-card[data-product-id="${id}"]`)).length,
      display: tables[0] ? getComputedStyle(tables[0]).display : '',
      overflow: tables[0] ? getComputedStyle(tables[0]).overflow : ''
    };
  });
  if (preview.pages !== 2 || preview.tables !== 2 || preview.rows.join(',') !== '7,1') throw new Error(`preview da tabela divergiu do documento: ${JSON.stringify(preview)}`);
  if (!preview.continuation || !preview.continuationLabel) throw new Error('segunda página deve indicar continuação e repetir o cabeçalho tabular');
  if (preview.duplicateMemberCards) throw new Error('membros da tabela não podem reaparecer como cards independentes');
  if (preview.display !== 'grid' || preview.overflow !== 'hidden') throw new Error(`CSS da tabela não foi aplicado: ${JSON.stringify(preview)}`);

  const printableHtml = await page.evaluate(() => window.CatalogoTop.Print.buildPrintableHtml(window.CatalogoTop.Core.getState()));
  if (!printableHtml.includes('table-block.css')) throw new Error('documento print precisa carregar table-block.css');

  const printPage = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await printPage.setContent(printableHtml, { waitUntil: 'networkidle' });
  const printState = await printPage.evaluate(() => ({
    pages: document.querySelectorAll('.catalog-page').length,
    tables: document.querySelectorAll('.catalog-table-block').length,
    shell: Boolean(document.querySelector('.app-shell-header')),
    continuationHeaders: document.querySelectorAll('.catalog-table-block.is-continuation thead').length
  }));
  if (printState.pages !== 2 || printState.tables !== 2 || printState.shell || printState.continuationHeaders !== 1) throw new Error(`print da tabela contaminado ou incompleto: ${JSON.stringify(printState)}`);

  const pdfBytes = await printPage.pdf({ format: 'A4', printBackground: false, preferCSSPageSize: true });
  const pdf = await PDFDocument.load(pdfBytes);
  if (pdf.getPageCount() !== 2) throw new Error(`2 páginas lógicas devem gerar 2 físicas; recebeu ${pdf.getPageCount()}`);
  for (const pdfPage of pdf.getPages()) {
    const { width, height } = pdfPage.getSize();
    const mmWidth = width * 25.4 / 72;
    const mmHeight = height * 25.4 / 72;
    if (Math.abs(mmWidth - 210) > 0.7 || Math.abs(mmHeight - 297) > 0.7) throw new Error(`página física não é A4: ${mmWidth.toFixed(2)} × ${mmHeight.toFixed(2)} mm`);
  }

  console.log('PASS browser table gate: fragmentação, continuação, exclusão direta, print isolado e A4 físico');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
