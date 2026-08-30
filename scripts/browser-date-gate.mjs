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

function fixtureStateScript() {
  const NS = window.CatalogoTop;
  const product = {
    id: 'date-product',
    code: 'DATE-1',
    description: 'Produto de teste da data',
    category: 'Teste',
    subcategory: '',
    price: 'R$ 10,00',
    status: 'Ativo',
    notes: '',
    image: '',
    specs: [],
    variants: [],
    tableRows: [],
    updatedAt: '2026-08-26T00:00:00.000Z'
  };
  NS.Core.setState({
    schemaVersion: 7,
    products: [product],
    selectedIds: [product.id],
    catalog: {
      title: 'Gate de data',
      templateId: 'technical',
      showPrices: true,
      createdAt: '2020-01-02T12:00:00.000Z',
      dateOverride: '',
      presentation: NS.Composition.normalizePresentation({ order: [product.id], blocks: [] })
    }
  }, { persist: false });
  window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
}

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}/`;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.CatalogoTop?.Core && window.CatalogoTop?.CatalogDate && window.CatalogoTop?.Print));
  await page.evaluate(fixtureStateScript);
  await page.click('[data-tab="catalog"]');
  await page.waitForSelector('#catalogDateMenu');
  await page.waitForSelector('#catalogPreview .footer-date strong');

  const automatic = await page.evaluate(() => {
    const NS = window.CatalogoTop;
    const current = NS.Core.getState();
    const today = NS.CatalogDate.formatValue(NS.CatalogDate.todayValue());
    return {
      today,
      override: current.catalog.dateOverride,
      stateDate: NS.Render.formatDate(current.catalog.createdAt),
      label: document.getElementById('catalogCreatedAt')?.textContent || '',
      mode: document.getElementById('catalogDateMode')?.textContent || '',
      footer: document.querySelector('#catalogPreview .footer-date strong')?.textContent || ''
    };
  });
  if (automatic.override) throw new Error(`modo automático não deve persistir override: ${JSON.stringify(automatic)}`);
  if (automatic.stateDate !== automatic.today || automatic.footer !== automatic.today) throw new Error(`createdAt antigo deve ser substituído pela data local atual: ${JSON.stringify(automatic)}`);
  if (automatic.label !== `Hoje · ${automatic.today}` || automatic.mode !== 'Automático') throw new Error(`controle automático deve ser explícito e compacto: ${JSON.stringify(automatic)}`);

  await page.click('#catalogDateMenu > summary');
  await page.fill('#catalogDateOverride', '2025-12-31');
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().catalog.dateOverride === '2025-12-31');
  await page.waitForFunction(() => document.querySelector('#catalogPreview .footer-date strong')?.textContent === '31/12/2025');

  const overridden = await page.evaluate(() => {
    const NS = window.CatalogoTop;
    const current = NS.Core.getState();
    const migrated = NS.Core.migrate(current);
    const printable = NS.Print.buildPrintableHtml(current);
    return {
      override: current.catalog.dateOverride,
      stateDate: NS.Render.formatDate(current.catalog.createdAt),
      label: document.getElementById('catalogCreatedAt')?.textContent || '',
      footer: document.querySelector('#catalogPreview .footer-date strong')?.textContent || '',
      migratedOverride: migrated.catalog.dateOverride,
      migratedDate: NS.Render.formatDate(migrated.catalog.createdAt),
      printableHasDate: printable.includes('31/12/2025'),
      printableHasPicker: printable.includes('catalogDateMenu') || printable.includes('catalog-date-popover')
    };
  });
  if (overridden.override !== '2025-12-31' || overridden.stateDate !== '31/12/2025' || overridden.footer !== '31/12/2025') throw new Error(`override não chegou ao estado/preview: ${JSON.stringify(overridden)}`);
  if (overridden.label !== '31/12/2025' || overridden.migratedOverride !== '2025-12-31' || overridden.migratedDate !== '31/12/2025') throw new Error(`override não sobreviveu à normalização: ${JSON.stringify(overridden)}`);
  if (!overridden.printableHasDate || overridden.printableHasPicker) throw new Error(`print deve usar a data escolhida sem chrome do picker: ${JSON.stringify(overridden)}`);

  await page.click('#catalogDateMenu > summary');
  await page.click('#catalogDateAuto');
  await page.waitForFunction(() => !window.CatalogoTop.Core.getState().catalog.dateOverride);
  const restored = await page.evaluate(() => {
    const NS = window.CatalogoTop;
    const today = NS.CatalogDate.formatValue(NS.CatalogDate.todayValue());
    const current = NS.Core.getState();
    return {
      today,
      stateDate: NS.Render.formatDate(current.catalog.createdAt),
      label: document.getElementById('catalogCreatedAt')?.textContent || '',
      footer: document.querySelector('#catalogPreview .footer-date strong')?.textContent || ''
    };
  });
  if (restored.stateDate !== restored.today || restored.footer !== restored.today || restored.label !== `Hoje · ${restored.today}`) throw new Error(`retorno ao automático falhou: ${JSON.stringify(restored)}`);

  console.log('PASS browser date gate: hoje automático, override persistido e print sem chrome');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
