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

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  const result = await page.evaluate(() => {
    const NS = window.CatalogoTop;
    const svg = label => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="white"/><text x="300" y="215" text-anchor="middle" font-family="Arial" font-size="48">${label}</text></svg>`)}`;
    const products = [
      {
        id: 'p1', code: 'P1', description: 'Produto externo', category: 'Teste', subcategory: '', price: '', status: 'Ativo', notes: '',
        image: svg('ORIGINAL-P1'), imageGallery: [{ id: 'gallery-p1', label: 'Gallery', image: svg('GALLERY-P1'), provenance: { kind: 'manual-upload' } }], specs: [], variants: [], tableRows: []
      },
      {
        id: 'p2', code: 'P2', description: 'Produto gallery', category: 'Teste', subcategory: '', price: '', status: 'Ativo', notes: '',
        image: svg('ORIGINAL-P2'), imageGallery: [{ id: 'gallery-p2', label: 'Gallery', image: svg('GALLERY-P2'), provenance: { kind: 'manual-upload' } }], specs: [], variants: [], tableRows: []
      }
    ];

    NS.Core.setState({
      schemaVersion: 7,
      products,
      selectedIds: ['p1', 'p2'],
      catalog: {
        title: 'V1 retirement gate', templateId: 'technical', showPrices: true, createdAt: '2026-08-30T00:00:00.000Z',
        presentation: {
          order: ['p1', 'p2'], itemStyles: {}, blocks: [], imageFrames: {},
          imageVariants: {
            p1: [
              { id: 'external-p1', label: 'External', image: svg('EXTERNAL-P1'), provenance: { kind: 'external-variation', requestId: 'r1' } },
              { id: 'manual-local-p1', label: 'Manual local', image: svg('MANUAL-LOCAL-P1'), provenance: { kind: 'manual-local' } }
            ]
          },
          imageSelections: {
            p1: { source: 'catalog', id: 'external-p1' },
            p2: { source: 'product', id: 'gallery-p2' }
          }
        }
      }
    }, { persist: false });

    const state = NS.Core.getState();
    const p1 = state.products.find(product => product.id === 'p1');
    const p2 = state.products.find(product => product.id === 'p2');
    const presentation = state.catalog.presentation;
    const resolvedP1 = NS.ImageVariants.resolveImage(p1, presentation);
    const resolvedP2 = NS.ImageVariants.resolveImage(p2, presentation);
    const featureSection = document.querySelector('[data-retired-feature="external-image-variations"]');

    return {
      hiddenAttribute: Boolean(featureSection?.hidden),
      display: featureSection ? getComputedStyle(featureSection).display : 'missing',
      p1Variants: presentation.imageVariants?.p1 || [],
      p1Selection: presentation.imageSelections?.p1 || null,
      p2Selection: presentation.imageSelections?.p2 || null,
      resolvedP1: { source: resolvedP1.source, id: resolvedP1.id },
      resolvedP2: { source: resolvedP2.source, id: resolvedP2.id },
      galleryP1: p1.imageGallery,
      galleryP2: p2.imageGallery
    };
  });

  if (!result.hiddenAttribute || result.display !== 'none') throw new Error(`seção externa não está realmente hidden: ${JSON.stringify(result)}`);
  if (result.p1Variants.length !== 1 || result.p1Variants[0].id !== 'manual-local-p1') throw new Error(`limpeza de external-variation incorreta: ${JSON.stringify(result.p1Variants)}`);
  if (result.p1Selection !== null) throw new Error(`seleção externa deveria voltar ao Original: ${JSON.stringify(result.p1Selection)}`);
  if (result.resolvedP1.source !== 'original' || result.resolvedP1.id !== 'original') throw new Error(`fallback Original não ocorreu: ${JSON.stringify(result.resolvedP1)}`);
  if (result.p2Selection?.source !== 'product' || result.resolvedP2.source !== 'product' || result.resolvedP2.id !== 'gallery-p2') throw new Error(`imageGallery reutilizável foi afetada: ${JSON.stringify(result)}`);
  if (result.galleryP1.length !== 1 || result.galleryP2.length !== 1) throw new Error('product.imageGallery não foi preservada');

  console.log('PASS browser V1 retirement gate: fluxo externo hidden, derivados externos limpos, Original fallback e imageGallery preservada');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
