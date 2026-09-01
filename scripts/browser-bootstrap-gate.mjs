import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.csv': 'text/csv; charset=utf-8' };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) { response.writeHead(404, { 'content-type': 'application/json' }); response.end(JSON.stringify({ error: 'fixture_offline' })); return; }
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors = [];
  const failedRequests = [];
  page.on('pageerror', error => pageErrors.push(error.stack || error.message || String(error)));
  page.on('requestfailed', request => failedRequests.push(`${request.url()} :: ${request.failure()?.errorText || 'failed'}`));
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  const globals = await page.evaluate(() => {
    const NS = window.CatalogoTop || {};
    const names = ['FolderTree','ProductFolderMigration','ProductDomain','ProductSnapshot','Core','Templates','CatalogDocument','App'];
    return Object.fromEntries(names.map(name => [name, Boolean(NS[name])]));
  });
  const missing = Object.entries(globals).filter(([, present]) => !present).map(([name]) => name);
  if (missing.length) {
    throw new Error(`browser bootstrap incompleto: missing=${missing.join(',')} globals=${JSON.stringify(globals)} pageErrors=${JSON.stringify(pageErrors)} failedRequests=${JSON.stringify(failedRequests.slice(0, 20))}`);
  }
  console.log(`PASS browser bootstrap gate: ${JSON.stringify(globals)}`);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
