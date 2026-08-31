import { readFile } from 'node:fs/promises';

const names = [
  'src/templates.js',
  'src/catalog-document.js',
  'src/catalog-renderer.js',
  'src/render.js',
  'src/icons.js',
  'editor-command-layout.css'
];
const files = Object.fromEntries(await Promise.all(names.map(async file => [file, await readFile(file, 'utf8')])));
const templates = files['src/templates.js'];
const documentModel = files['src/catalog-document.js'];
const renderer = files['src/catalog-renderer.js'];
const render = files['src/render.js'];
const icons = files['src/icons.js'];
const chromeCss = files['editor-command-layout.css'];
const fail = message => { throw new Error(message); };

for (const id of ['technical', 'compact', 'showcase']) {
  if (!templates.includes(`id: '${id}', version: 1`)) fail(`built-in ${id}@1 ausente`);
}
if (!templates.includes('function resolveCatalog(catalog)') || !templates.includes('catalog?.templateVersion')) fail('registry não expõe binding exato de catálogo');
if (!templates.includes('function compatibilityClass(template)') || templates.includes('className: `template-${template.id}`')) fail('classe física continua derivada da identidade do template');
if (!documentModel.includes('NS.Templates.resolveCatalog(state?.catalog)') || documentModel.includes('getTemplate(state?.catalog?.templateId)')) fail('CatalogDocument não resolve binding exato');
if (!documentModel.includes('templateBinding: Object.freeze')) fail('CatalogDocument não materializa binding de template');
if (!renderer.includes('dataset.templateVersion') || !renderer.includes('templateVersion: Number(template.version')) fail('renderer canônico não preserva templateVersion no skeleton');
if (/template\.id\s*===/.test(render)) fail('Render ainda ramifica comportamento por template.id');
if (!render.includes('template?.card?.contentBudget')) fail('budget de Card não vem do TemplateContract');
if (!render.includes('NS.DocumentChrome.renderHeader') || !render.includes('NS.DocumentChrome.renderFooter')) fail('Render ainda possui chrome institucional próprio');
if (!icons.includes("'top-mobili-v1': TOP_MOBILI_V1") || !icons.includes('NS.DocumentChrome = Object.freeze')) fail('DocumentChrome app-owned ausente');
if (!icons.includes("image.closest('#selectableProducts,#catalogPreview')") || !icons.includes('catalogoFallbackApplied')) fail('fallback de imagem quebrada não está limitado às superfícies autorais');
if (!chromeCss.includes('grid-template-rows: auto auto') || !chromeCss.includes('.preview-toolbar .heading-actions') || !chromeCss.includes('.preview-toolbar-meta')) fail('toolbar desktop não possui reflow sem colisão');

console.log('PASS R4a static gate: exact binding, contract budgets, app-owned chrome, token-derived compatibility and authoring UI hardening');
