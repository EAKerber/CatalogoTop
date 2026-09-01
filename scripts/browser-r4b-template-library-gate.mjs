import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { validateTemplateSnapshot, validateTemplateSnapshotTransition } from '../netlify/lib/template-snapshot.mts';

const root = process.cwd();
const mime = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp' };
let templateState = { schemaVersion: 1, revision: 0, updatedAt: '', writeId: '', templates: [] };
let templatePuts = 0;
const emptyProducts = { schemaVersion: 2, revision: 0, updatedAt: '', writeId: '', folders: [], products: [] };
const emptyCatalogs = { schemaVersion: 2, revision: 0, updatedAt: '', writeId: '', folders: [], catalogs: [] };

const json = (response, body, status = 200) => { response.writeHead(status, { 'content-type':'application/json', 'cache-control':'no-store' }); response.end(JSON.stringify(body)); };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/api/templates') {
      if (request.method === 'GET') return json(response, templateState);
      if (request.method === 'PUT') {
        let raw = ''; for await (const chunk of request) raw += chunk;
        const body = JSON.parse(raw || '{}');
        if (body.expectedRevision !== templateState.revision) return json(response, { error:'revision_conflict', currentRevision:templateState.revision }, 409);
        const validation = validateTemplateSnapshot(body.templates || []);
        if (validation) return json(response, { error:'invalid_template_snapshot', message:validation }, 422);
        const transition = validateTemplateSnapshotTransition(templateState.templates, body.templates || []);
        if (transition) return json(response, { error:'invalid_template_transition', message:transition }, 422);
        templatePuts += 1;
        templateState = { schemaVersion:1, revision:templateState.revision + 1, updatedAt:new Date().toISOString(), writeId:String(body.writeId || ''), templates:body.templates };
        return json(response, templateState);
      }
      return json(response, { error:'method_not_allowed' }, 405);
    }
    if (url.pathname === '/api/products' && request.method === 'GET') return json(response, emptyProducts);
    if (url.pathname === '/api/catalogs' && request.method === 'GET') return json(response, emptyCatalogs);
    if (url.pathname === '/api/write-session' && request.method === 'GET') return json(response, { writable:true });
    if (url.pathname.startsWith('/api/')) return json(response, { error:'fixture_offline' }, 404);
    const relative = decodeURIComponent(url.pathname) === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const file = join(root, normalize(relative).replace(/^(\.\.[/\\])+/, ''));
    if (!(await stat(file)).isFile()) throw new Error('not file');
    response.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
    response.end(await readFile(file));
  } catch (error) { response.writeHead(404); response.end(String(error?.message || 'not found')); }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless:true });

try {
  const page = await browser.newPage({ viewport:{ width:1440, height:900 } });
  await page.goto(baseUrl, { waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.CatalogoTop?.App && window.CatalogoTop?.TemplateStore && window.CatalogoTop?.TemplateLibrary && window.CatalogoTop?.CatalogDocument && window.CatalogoTop?.Print));
  await page.waitForFunction(() => window.CatalogoTop.TemplateStore.getRevision() === 0);
  await page.click('[data-tab="library"]');
  await page.waitForSelector('[data-library-provider="templates"]');
  await page.click('[data-library-provider="templates"]');
  await page.waitForSelector('#templateLibraryRoot [data-template-resource="technical"]');
  const initialRows = await page.locator('#templateLibraryRoot [data-template-resource]').count();
  if (initialRows !== 3 || templatePuts !== 0) throw new Error(`inventory inicial deveria ter só 3 built-ins e zero writes: rows=${initialRows} puts=${templatePuts}`);

  const technical = page.locator('#templateLibraryRoot [data-template-resource="technical"]');
  await technical.locator('[data-template-duplicate]').click();
  await page.waitForSelector('#templateEditorForm');
  if (templatePuts !== 0) throw new Error('duplicar built-in escreveu antes da publicação');
  await page.fill('#templateDraftName', 'R4b <custom> & literal');
  await page.fill('#templateDraftDescription', 'Template customizado do gate R4b.');
  await page.selectOption('#templateDraftRows', '3');
  await page.click('#templateEditorForm button[type="submit"]');
  await page.waitForFunction(() => window.CatalogoTop.TemplateStore.getSnapshot().templates.length === 1);
  await page.waitForFunction(() => window.CatalogoTop.TemplateStore.getRevision() === 1);
  if (templatePuts !== 1) throw new Error(`publicar v1 deveria gerar um PUT; recebeu ${templatePuts}`);

  const v1 = await page.evaluate(() => {
    const NS = window.CatalogoTop;
    const resource = NS.TemplateStore.getSnapshot().templates[0];
    const contract = resource.versions[0].contract;
    return { id:resource.id, contract:JSON.parse(JSON.stringify(contract)), resolved:JSON.parse(JSON.stringify(NS.Templates.resolve(resource.id, 1))) };
  });
  if (v1.contract.version !== 1 || v1.resolved.rows !== 3) throw new Error(`custom v1 inválido: ${JSON.stringify(v1)}`);

  await page.waitForSelector(`#templateLibraryRoot [data-template-resource="${v1.id}"]`);
  let custom = page.locator(`#templateLibraryRoot [data-template-resource="${v1.id}"]`);
  await custom.locator('[data-template-use]').click();
  await page.waitForFunction(({ id }) => { const c = window.CatalogoTop.Core.getState().catalog; return c.templateId === id && c.templateVersion === 1; }, { id:v1.id });
  const bindingV1 = await page.evaluate(() => window.CatalogoTop.CatalogDocument.build(window.CatalogoTop.Core.getState()).templateBinding);
  if (bindingV1.id !== v1.id || bindingV1.version !== 1) throw new Error(`CatalogDocument não preservou v1: ${JSON.stringify(bindingV1)}`);

  await page.click('[data-tab="library"]');
  await page.click('[data-library-provider="templates"]');
  custom = page.locator(`#templateLibraryRoot [data-template-resource="${v1.id}"]`);
  await custom.locator('[data-template-edit]').click();
  await page.fill('#templateDraftName', 'R4b <v2> & literal');
  await page.selectOption('#templateDraftRows', '4');
  await page.click('#templateEditorForm button[type="submit"]');
  await page.waitForFunction(() => window.CatalogoTop.TemplateStore.getSnapshot().templates[0]?.versions?.length === 2);
  await page.waitForFunction(() => window.CatalogoTop.TemplateStore.getRevision() === 2);
  if (templatePuts !== 2) throw new Error(`publicar v2 deveria gerar segundo PUT; recebeu ${templatePuts}`);

  const versions = await page.evaluate(({ id }) => {
    const NS = window.CatalogoTop;
    const resource = NS.TemplateStore.getResource(id);
    return {
      v1: JSON.parse(JSON.stringify(resource.versions[0].contract)),
      v2: JSON.parse(JSON.stringify(resource.versions[1].contract)),
      exact1: NS.Templates.resolve(id,1).name,
      exact2: NS.Templates.resolve(id,2).name,
      latest: NS.Templates.latest(id).version
    };
  }, { id:v1.id });
  if (JSON.stringify(versions.v1) !== JSON.stringify(v1.contract)) throw new Error('publicar v2 reescreveu v1');
  if (versions.v2.version !== 2 || versions.latest !== 2 || versions.exact1 !== 'R4b <custom> & literal' || versions.exact2 !== 'R4b <v2> & literal') throw new Error(`resolução histórica/latest inválida: ${JSON.stringify(versions)}`);

  custom = page.locator(`#templateLibraryRoot [data-template-resource="${v1.id}"]`);
  await custom.locator('[data-template-version]').selectOption('1');
  await custom.locator('[data-template-use]').click();
  await page.waitForFunction(({ id }) => { const c = window.CatalogoTop.Core.getState().catalog; return c.templateId === id && c.templateVersion === 1; }, { id:v1.id });
  await page.waitForTimeout(40);
  const selector = await page.evaluate(({ id }) => {
    const select = document.getElementById('catalogTemplate');
    const options = Array.from(select?.options || []).filter(option => option.value === id).map(option => ({ version:Number(option.dataset.templateVersion || 0), selected:option.selected, text:option.textContent }));
    return { options, injectedMarkup:Boolean(select?.querySelector('b,script,img,svg')) };
  }, { id:v1.id });
  const selectedHistorical = selector.options.find(option => option.version === 1 && option.selected);
  if (!selector.options.some(option => option.version === 2) || !selectedHistorical) throw new Error(`seletor não mostrou latest + v1 em uso: ${JSON.stringify(selector)}`);
  if (selector.injectedMarkup || !selectedHistorical.text.includes('R4b <custom> & literal')) throw new Error(`nome de template não permaneceu texto literal: ${JSON.stringify(selector)}`);

  await page.evaluate(({ id }) => {
    const NS = window.CatalogoTop;
    NS.Core.mutate(state => {
      state.folders = [{ id:'r4b-folder', parentId:null, name:'Teste' }];
      state.products = [{ id:'r4b-product', folderId:'r4b-folder', code:'R4B-1', description:'Produto R4b', category:'Teste', subcategory:'', price:'R$ 10,00', status:'Ativo', notes:'', image:'', specs:[], variants:[], tableRows:[], updatedAt:'2026-09-01T00:00:00.000Z' }];
      state.selectedIds = ['r4b-product'];
      state.catalog.templateId = id;
      state.catalog.templateVersion = 1;
    });
    NS.App.renderAll();
  }, { id:v1.id });
  await page.click('[data-tab="catalog"]');
  await page.waitForSelector(`#catalogPreview .catalog-page[data-template-id="${v1.id}"][data-template-version="1"]`);
  const logicalPages = await page.evaluate(() => window.CatalogoTop.CatalogDocument.build(window.CatalogoTop.Core.getState()).pageCount);
  const printableHtml = await page.evaluate(() => window.CatalogoTop.Print.buildPrintableHtml(window.CatalogoTop.Core.getState()));
  const printPage = await browser.newPage({ viewport:{ width:794, height:1123 } });
  await printPage.setContent(printableHtml, { waitUntil:'networkidle' });
  await printPage.emulateMedia({ media:'print' });
  const pdfBytes = await printPage.pdf({ format:'A4', printBackground:false, preferCSSPageSize:true, margin:{ top:'0', right:'0', bottom:'0', left:'0' } });
  const pdf = await PDFDocument.load(pdfBytes);
  if (pdf.getPageCount() !== logicalPages) throw new Error(`custom template logical/physical divergiu: logical=${logicalPages} physical=${pdf.getPageCount()}`);
  const expectedWidth = 210 * 72 / 25.4, expectedHeight = 297 * 72 / 25.4;
  for (const [index, pdfPage] of pdf.getPages().entries()) {
    const { width, height } = pdfPage.getSize();
    if (Math.abs(width-expectedWidth) > .6 || Math.abs(height-expectedHeight) > .6) throw new Error(`custom PDF página ${index+1} não é A4: ${width}x${height}`);
  }
  await printPage.close();

  const mobile = await browser.newContext({ viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true, deviceScaleFactor:1 });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(baseUrl, { waitUntil:'domcontentloaded' });
  await mobilePage.waitForFunction(() => Boolean(window.CatalogoTop?.TemplateStore && window.CatalogoTop?.TemplateLibrary));
  await mobilePage.waitForFunction(({ id }) => Boolean(window.CatalogoTop.Templates.latest(id)), { id:v1.id });
  await mobilePage.click('[data-tab="library"]');
  await mobilePage.click('[data-library-provider="templates"]');
  await mobilePage.waitForSelector(`#templateLibraryRoot [data-template-resource="${v1.id}"]`);
  const mobileLayout = await mobilePage.evaluate(() => ({ viewport:document.documentElement.clientWidth, scrollWidth:document.documentElement.scrollWidth, rootScroll:document.getElementById('templateLibraryRoot')?.scrollWidth || 0, rootClient:document.getElementById('templateLibraryRoot')?.clientWidth || 0 }));
  if (mobileLayout.scrollWidth > mobileLayout.viewport + 2 || mobileLayout.rootScroll > mobileLayout.rootClient + 2) throw new Error(`Template Library tem overflow mobile: ${JSON.stringify(mobileLayout)}`);
  await mobile.close();

  console.log(`PASS browser R4b gate: draft zero-write, immutable v1→v2, exact historical binding, literal labels, A4 parity and mobile provider (${v1.id})`);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
