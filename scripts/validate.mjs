import { readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const requiredFiles = [
  'index.html',
  'styles.css',
  'cards.css',
  'category-browser.css',
  'shell-responsive.css',
  'mobile-header.css',
  'editorial-composition.css',
  'catalog-page.css',
  'composer-layout.css',
  'preview-viewport.css',
  'print.css',
  'src/core.js',
  'src/composition.js',
  'src/indexed-cache.js',
  'src/asset-client.js',
  'src/product-store.js',
  'src/importer.js',
  'src/templates.js',
  'src/icons.js',
  'src/catalog-document.js',
  'src/render.js',
  'src/render-document-adapter.js',
  'src/print.js',
  'src/form-steps.js',
  'src/mobile-workspace.js',
  'src/preview-zoom.js',
  'src/app.js',
  'src/catalog-selection-order.js',
  'src/product-details.js',
  'src/category-browser.js',
  'assets/logo-top-mobili.svg',
  'examples/produtos-modelo.csv',
  'examples/card-cases.html',
  'examples/card-cases.js',
  'netlify.toml',
  'docs/netlify.md',
  'docs/reuse-from-gerador-v1.md',
  'docs/card-model.md',
  'docs/category-browser.md',
  'docs/responsive-shell.md',
  'docs/editorial-composition-v0.8.md',
  'docs/document-pipeline-v0.8.1.md'
];

for (const file of requiredFiles) await access(file);

for (const file of requiredFiles.filter(file => file.endsWith('.js'))) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `Falha de sintaxe em ${file}\n`);
    process.exit(result.status || 1);
  }
}

const html = await readFile('index.html', 'utf8');
const cardsCss = await readFile('cards.css', 'utf8');
const shellCss = await readFile('shell-responsive.css', 'utf8');
const mobileHeaderCss = await readFile('mobile-header.css', 'utf8');
const editorialCss = await readFile('editorial-composition.css', 'utf8');
const catalogPageCss = await readFile('catalog-page.css', 'utf8');
const composerCss = await readFile('composer-layout.css', 'utf8');
const previewCss = await readFile('preview-viewport.css', 'utf8');
const printCss = await readFile('print.css', 'utf8');
const css = `${await readFile('styles.css', 'utf8')}\n${cardsCss}\n${await readFile('category-browser.css', 'utf8')}\n${shellCss}\n${mobileHeaderCss}\n${editorialCss}\n${catalogPageCss}\n${composerCss}\n${previewCss}`;
const templates = await readFile('src/templates.js', 'utf8');
const importer = await readFile('src/importer.js', 'utf8');
const icons = await readFile('src/icons.js', 'utf8');
const core = await readFile('src/core.js', 'utf8');
const composition = await readFile('src/composition.js', 'utf8');
const catalogDocument = await readFile('src/catalog-document.js', 'utf8');
const render = await readFile('src/render.js', 'utf8');
const printJs = await readFile('src/print.js', 'utf8');
const previewZoom = await readFile('src/preview-zoom.js', 'utf8');
const app = await readFile('src/app.js', 'utf8');
const formSteps = await readFile('src/form-steps.js', 'utf8');
const mobileWorkspace = await readFile('src/mobile-workspace.js', 'utf8');
const detailEditor = await readFile('src/product-details.js', 'utf8');
const categoryBrowser = await readFile('src/category-browser.js', 'utf8');
const cardCases = await readFile('examples/card-cases.js', 'utf8');
const netlify = await readFile('netlify.toml', 'utf8');
const logo = await readFile('assets/logo-top-mobili.svg', 'utf8');

const headerStart = html.indexOf('<header class="app-shell-header">');
const headerEnd = html.indexOf('</header>', headerStart);
const headerHtml = html.slice(headerStart, headerEnd);
const productHeadingStart = html.indexOf('class="section-heading product-section-heading"');
const productWorkspaceStart = html.indexOf('class="product-workspace"');
const productHeadingHtml = html.slice(productHeadingStart, productWorkspaceStart);

const checks = [
  ['shell possui três abas primárias', ['products','catalog','templates'].every(tab => html.includes(`data-tab="${tab}"`))],
  ['tabs, importação e backup compartilham o header sticky', headerHtml.includes('class="app-tabs"') && headerHtml.includes('id="importProductsFile"') && headerHtml.includes('id="importMode"') && headerHtml.includes('id="backupFile"') && shellCss.includes('position: sticky')],
  ['override mobile carrega após shell responsivo', html.indexOf('shell-responsive.css') < html.indexOf('mobile-header.css')],
  ['estilos de documento/compositor/preview carregam após composição editorial', html.indexOf('editorial-composition.css') < html.indexOf('catalog-page.css') && html.indexOf('catalog-page.css') < html.indexOf('composer-layout.css') && html.indexOf('composer-layout.css') < html.indexOf('preview-viewport.css')],
  ['print exclusivo carrega separado em media print', html.includes('href="print.css" media="print"')],
  ['importação não ocupa faixa permanente na aba Produtos', !html.includes('class="import-panel compact-import card"') && html.includes('class="import-report shell-import-report hidden"')],
  ['ação novo produto saiu do cabeçalho da seção', !productHeadingHtml.includes('id="btnNewProduct"') && html.indexOf('id="btnNewProduct"') > html.indexOf('id="productForm"')],
  ['biblioteca de composição carrega antes do core e renderer', html.indexOf('src/composition.js') < html.indexOf('src/core.js') && html.indexOf('src/composition.js') < html.indexOf('src/render.js')],
  ['CatalogDocument carrega antes do renderer', html.indexOf('src/catalog-document.js') < html.indexOf('src/render.js')],
  ['renderer adapter e print carregam antes do app', html.indexOf('src/render-document-adapter.js') < html.indexOf('src/app.js') && html.indexOf('src/print.js') < html.indexOf('src/app.js')],
  ['zoom de preview carrega antes do app', html.indexOf('src/preview-zoom.js') < html.indexOf('src/app.js')],
  ['etapas do formulário carregam antes do app', html.indexOf('src/form-steps.js') < html.indexOf('src/app.js')],
  ['workspace mobile carrega antes do app', html.indexOf('src/mobile-workspace.js') < html.indexOf('src/app.js')],
  ['cadastro de produto possui três etapas', (html.match(/data-form-step="/g) || []).length === 3 && formSteps.includes('Etapa ${current} de ${steps.length}')],
  ['enter avança sem salvar antes da etapa final', formSteps.includes('stopImmediatePropagation') && formSteps.includes('current < steps.length')],
  ['mobile alterna cadastro e biblioteca por tabs', html.includes('data-mobile-workspace-target="form"') && html.includes('data-mobile-workspace-target="library"')],
  ['mobile possui swipe horizontal com limiar', mobileWorkspace.includes('touchstart') && mobileWorkspace.includes('touchend') && mobileWorkspace.includes('Math.abs(dx) < 56')],
  ['mobile reserva linha inferior apenas às tabs primárias', mobileHeaderCss.includes('.app-primary-tools { display: contents; }') && mobileHeaderCss.includes('grid-template-columns: repeat(3, minmax(0, 1fr))')],
  ['utilidades mobile possuem scroll horizontal próprio', (mobileHeaderCss.match(/overflow-x: auto;/g) || []).length >= 2],
  ['categoria usa seletor sobrescrevível', html.includes('id="category" list="categoryOptions" required') && html.includes('id="categoryOptions"')],
  ['biblioteca possui pastas de categoria', html.includes('id="categoryFolders"') && categoryBrowser.includes('data-category-folder')],
  ['produtos sem categoria recebem pasta explícita', core.includes("|| 'Sem categoria'")],
  ['workspace desktop usa scroll interno', shellCss.includes('body { overflow: hidden; }') && shellCss.includes('.category-browser { min-height: 0; overflow: auto; }')],
  ['breakpoints de tablet e mobile existem', shellCss.includes('@media (max-width: 959px)') && shellCss.includes('@media (max-width: 639px)')],
  ['logo canônica substitui reconstrução', logo.includes('viewBox="0 0 481 270"') && !logo.includes('recriada a partir da referência')],

  ['CatalogDocument materializa páginas, ordem e largura', catalogDocument.includes('pageCount') && catalogDocument.includes('orderedIds') && catalogDocument.includes('effectiveOrder') && catalogDocument.includes('slotSpan') && catalogDocument.includes('width:')],
  ['impressão isolada usa apenas páginas do catálogo', printJs.includes("querySelectorAll('.catalog-page')") && printJs.includes('body class="catalog-print-document"')],
  ['impressão isolada declara A4 210 × 297', printCss.includes('size: A4 portrait') && printCss.includes('width: 210mm !important') && printCss.includes('height: 297mm !important')],
  ['quebra física ocorre somente antes das páginas subsequentes', printCss.includes('.catalog-page + .catalog-page') && printCss.includes('break-before: page !important') && !printCss.includes('break-after: page !important')],
  ['linhas institucionais críticas usam borda', catalogPageCss.includes('border-top: .45mm solid var(--brand)') && catalogPageCss.includes('.footer-line')],
  ['CSS mobile não contém correções de print/compositor', !mobileHeaderCss.includes('@media print') && !mobileHeaderCss.includes('bulk-presentation-controls') && !mobileHeaderCss.includes('catalog-title-block')],
  ['compositor responde à largura real da lateral', composerCss.includes('container-type: inline-size') && composerCss.includes('@container catalog-selection-panel')],
  ['bulk desktop usa duas colunas campo + ação', composerCss.includes('grid-template-columns: minmax(0, 1fr) auto')],

  ['preview possui viewport e controles de fit/zoom', html.includes('id="catalogPreviewViewport"') && html.includes('id="btnPreviewFit"') && html.includes('id="btnPreviewZoomOut"') && html.includes('id="btnPreviewZoomIn"')],
  ['preview mobile calcula fit sobre A4 sem alterar documento', previewZoom.includes('210 * 96 / 25.4') && previewZoom.includes("mode = window.matchMedia('(max-width: 959px)').matches ? 'fit' : 'actual'") && previewCss.includes('zoom: var(--preview-scale)')],
  ['preview preserva pan vertical e contenção horizontal', previewCss.includes('overflow: auto') && previewCss.includes('overscroll-behavior-x: contain') && previewCss.includes('overscroll-behavior-y: auto')],

  ['template técnico registrado', templates.includes("id: 'technical'")],
  ['template compacto registrado', templates.includes("id: 'compact'")],
  ['template destaque registrado', templates.includes("id: 'showcase'")],
  ['importador exige código/descrição', importer.includes('Código e descrição são obrigatórios.')],
  ['ícones institucionais incluem WhatsApp', icons.includes('whatsapp')],
  ['Netlify executa smoke test', netlify.includes('command = "npm test"')],
  ['Netlify publica site estático da raiz', netlify.includes('publish = "."')],
  ['modelo preserva variações visuais', core.includes('variants: normalizeVariants(product.variants)')],
  ['modelo preserva linhas comerciais', core.includes('tableRows: normalizeTableRows(product.tableRows)')],
  ['estado local possui apresentação editorial', core.includes('presentation: normalizePresentation') && core.includes('SCHEMA_VERSION = 3')],
  ['formulário possui entrada simples de variações', html.includes('id="variants"') && detailEditor.includes('parseVariantsText')],
  ['formulário possui entrada simples de tabela', html.includes('id="commercialRows"') && detailEditor.includes('parseTableRowsText')],
  ['renderer dispõe múltiplas imagens no card', render.includes('catalog-variant-image-grid')],
  ['renderer materializa tabela comercial', render.includes('catalog-card-table')],
  ['tabela usa pesos fixos de coluna', render.includes('function weightedColumns') && render.includes('<colgroup>')],
  ['cards com tabela cedem largura a referências', cardsCss.includes('.catalog-card.has-table:not(.has-variant-images)')],
  ['planner usa slots e converte para micrograde de seis colunas', composition.includes('function slotSpanFor') && composition.includes('function microSpanForSlots') && composition.includes('function microStartForSlot') && editorialCss.includes('grid-template-columns: repeat(6') && !editorialCss.includes('grid-auto-flow: dense')],
  ['largura possui modos simples, largo e linha inteira', ['simple','wide','full'].every(id => composition.includes(`id: '${id}'`)) && composition.includes('WIDTH_PRESETS')],
  ['largura não depende de ênfase', composition.includes('slotSpanFor(style, template)') && !composition.includes('function emphasisRank')],
  ['ordem factual não é reclassificada por ênfase', composition.includes('function orderProductsForLayout(products)') && composition.includes('products.slice()')],
  ['Hero legado migra para Destaque + Linha inteira', composition.includes("legacyHero ? 'feature'") && composition.includes("legacyHero ? 'full'") && !composition.includes("{ id: 'hero', name: 'Hero' }")],
  ['presets cobrem densidades editoriais', ['visual','essential','standard','detailed','technical','commercial','auto'].every(id => composition.includes(`id: '${id}'`))],
  ['Visual é o padrão de cards sem override', composition.includes("CONTENT_PRESETS, 'visual'") && render.includes("contentPreset: 'visual'" )],
  ['ênfase visual inclui normal e destaque sem Hero estrutural', composition.includes("id: 'feature'") && !composition.includes("id: 'hero'") && render.includes('data-emphasis')],
  ['Destaque + Linha inteira possui composição focal própria', editorialCss.includes('.catalog-card.width-full.emphasis-feature') && editorialCss.includes('58%') && editorialCss.includes('font-size: 6.4mm')],
  ['UI oferece distribuição e tipografia globais', html.includes('id="catalogDistribution"') && html.includes('id="catalogTypography"') && app.includes('catalogDistribution') && app.includes('catalogTypography')],
  ['UI oferece conteúdo, ênfase e largura por item selecionado', app.includes('data-content-preset') && app.includes('data-emphasis') && app.includes('data-card-width')],
  ['bulk oferece aplicação de largura', composition.includes('bulkWidth') && composition.includes('btnApplyBulkWidth')],
  ['renderer expõe largura e slot span no DOM', render.includes('data-card-width') && render.includes('data-slot-span') && render.includes('width-${width}')],
  ['tipografia varia por preset sem contaminar header institucional', editorialCss.includes('.catalog-page.type-technical .catalog-card') && editorialCss.includes('.catalog-page.type-editorial .catalog-card h3')],
  ['renderer pagina por linhas planejadas quando recebe template', render.includes('paginateProducts(group.products, template, presentation)')],
  ['harness cobre quatro formatos de card', (cardCases.match(/name: '/g) || []).length === 4],
  ['harness amplia o card do renderer real', cardCases.includes("scratch.querySelector('.catalog-card')")]
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  failed.forEach(([name]) => console.error(`FAIL ${name}`));
  process.exit(1);
}
checks.forEach(([name]) => console.log(`PASS ${name}`));
