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
  'collection-block.css',
  'src/composition.js',
  'src/core.js',
  'src/collection.js',
  'src/indexed-cache.js',
  'src/asset-client.js',
  'src/product-store.js',
  'src/importer.js',
  'src/templates.js',
  'src/icons.js',
  'src/catalog-document.js',
  'src/collection-document.js',
  'src/render.js',
  'src/render-document-adapter.js',
  'src/collection-render.js',
  'src/print.js',
  'src/form-steps.js',
  'src/mobile-workspace.js',
  'src/preview-zoom.js',
  'src/app.js',
  'src/catalog-selection-order.js',
  'src/collection-controls.js',
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
  'docs/document-pipeline-v0.8.1.md',
  'docs/card-span-model-v0.9.md',
  'docs/collection-block-v0.10.1.md'
];

for (const file of requiredFiles) await access(file);

for (const file of requiredFiles.filter(file => file.endsWith('.js'))) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `Falha de sintaxe em ${file}\n`);
    process.exit(result.status || 1);
  }
}

const files = Object.fromEntries(await Promise.all([
  'index.html', 'styles.css', 'cards.css', 'shell-responsive.css', 'mobile-header.css',
  'editorial-composition.css', 'catalog-page.css', 'composer-layout.css', 'preview-viewport.css',
  'print.css', 'collection-block.css', 'src/composition.js', 'src/core.js', 'src/collection.js',
  'src/catalog-document.js', 'src/collection-document.js', 'src/render.js', 'src/collection-render.js',
  'src/print.js', 'src/app.js', 'src/catalog-selection-order.js', 'src/collection-controls.js',
  'src/importer.js', 'src/templates.js', 'src/icons.js', 'src/form-steps.js', 'src/mobile-workspace.js',
  'src/preview-zoom.js', 'src/product-details.js', 'src/category-browser.js', 'examples/card-cases.js',
  'netlify.toml', 'assets/logo-top-mobili.svg', 'docs/collection-block-v0.10.1.md'
].map(async file => [file, await readFile(file, 'utf8')])));

const html = files['index.html'];
const core = files['src/core.js'];
const composition = files['src/composition.js'];
const collection = files['src/collection.js'];
const collectionDocument = files['src/collection-document.js'];
const collectionRender = files['src/collection-render.js'];
const collectionControls = files['src/collection-controls.js'];
const orderBootstrap = files['src/catalog-selection-order.js'];
const render = files['src/render.js'];
const printJs = files['src/print.js'];
const editorialCss = files['editorial-composition.css'];
const collectionCss = files['collection-block.css'];
const previewCss = files['preview-viewport.css'];
const printCss = files['print.css'];
const catalogPageCss = files['catalog-page.css'];
const shellCss = files['shell-responsive.css'];
const mobileHeaderCss = files['mobile-header.css'];
const composerCss = files['composer-layout.css'];
const templates = files['src/templates.js'];
const importer = files['src/importer.js'];
const icons = files['src/icons.js'];
const formSteps = files['src/form-steps.js'];
const mobileWorkspace = files['src/mobile-workspace.js'];
const previewZoom = files['src/preview-zoom.js'];
const detailEditor = files['src/product-details.js'];
const categoryBrowser = files['src/category-browser.js'];
const cardCases = files['examples/card-cases.js'];
const netlify = files['netlify.toml'];
const logo = files['assets/logo-top-mobili.svg'];
const collectionDocs = files['docs/collection-block-v0.10.1.md'];

const headerStart = html.indexOf('<header class="app-shell-header">');
const headerEnd = html.indexOf('</header>', headerStart);
const headerHtml = html.slice(headerStart, headerEnd);
const productHeadingStart = html.indexOf('class="section-heading product-section-heading"');
const productWorkspaceStart = html.indexOf('class="product-workspace"');
const productHeadingHtml = html.slice(productHeadingStart, productWorkspaceStart);

const checks = [
  ['shell possui três abas primárias', ['products','catalog','templates'].every(tab => html.includes(`data-tab="${tab}"`))],
  ['tabs, importação e backup compartilham header sticky', headerHtml.includes('class="app-tabs"') && headerHtml.includes('id="importProductsFile"') && headerHtml.includes('id="backupFile"') && shellCss.includes('position: sticky')],
  ['ação novo produto fica no formulário, não no heading', !productHeadingHtml.includes('id="btnNewProduct"') && html.indexOf('id="btnNewProduct"') > html.indexOf('id="productForm"')],
  ['mobile mantém breakpoints principais', shellCss.includes('@media (max-width: 959px)') && shellCss.includes('@media (max-width: 639px)')],
  ['mobile preserva tabs primárias e utilidades roláveis', mobileHeaderCss.includes('grid-template-columns: repeat(3, minmax(0, 1fr))') && mobileHeaderCss.includes('overflow-x: auto')],
  ['workspace mobile usa swipe com limiar', mobileWorkspace.includes('touchstart') && mobileWorkspace.includes('touchend') && mobileWorkspace.includes('Math.abs(dx) < 56')],
  ['formulário permanece em três etapas', (html.match(/data-form-step="/g) || []).length === 3 && formSteps.includes('Etapa ${current} de ${steps.length}')],
  ['categoria manual continua sobrescrevível', html.includes('id="category" list="categoryOptions" required') && html.includes('id="categoryOptions"')],
  ['biblioteca mantém pastas de categoria', html.includes('id="categoryFolders"') && categoryBrowser.includes('data-category-folder')],
  ['logo canônica preserva viewBox oficial', logo.includes('viewBox="0 0 481 270"')],

  ['estado local usa schema v4 e preserva blocks', core.includes('SCHEMA_VERSION = 4') && core.includes('preservedBlocks') && core.includes('blocks: []')],
  ['produto continua preservando variações e tabela comercial', core.includes('variants: normalizeVariants(product.variants)') && core.includes('tableRows: normalizeTableRows(product.tableRows)')],
  ['formulário continua oferecendo variações e tabela simples', html.includes('id="variants"') && detailEditor.includes('parseVariantsText') && html.includes('id="commercialRows"') && detailEditor.includes('parseTableRowsText')],

  ['planner v0.9 mantém largura em slots independente de ênfase', composition.includes('function slotSpanFor') && composition.includes('function microSpanForSlots') && !composition.includes('function emphasisRank')],
  ['larguras simples/larga/full permanecem disponíveis', ['simple','wide','full'].every(id => composition.includes(`id: '${id}'`)) && composition.includes('WIDTH_PRESETS')],
  ['Hero segue apenas como migração legada', composition.includes("legacyHero ? 'feature'") && composition.includes("legacyHero ? 'full'") && !composition.includes("{ id: 'hero', name: 'Hero' }")],
  ['renderer base continua expondo card markup e grid 6 colunas', render.includes('cardMarkup') && editorialCss.includes('grid-template-columns: repeat(6') && !editorialCss.includes('grid-auto-flow: dense')],

  ['Collection é normalizada como bloco local fechado', collection.includes("type: 'collection'") && collection.includes('MAX_MEMBERS = 12') && collection.includes('normalizeBlocks')],
  ['Collection preserva presentation.blocks', collection.includes('__collectionBlocksWrapped') && collection.includes('blocks: normalizeBlocks(raw?.blocks)')],
  ['Collection calcula grade interna e rowSpan antes do DOM', collection.includes('function planCollection') && collection.includes('localRowCount') && collection.includes('rowSpan')],
  ['Collection pagina como unidade atômica full-width', collection.includes('function paginateNodes') && collection.includes("node.type === 'collection'") && collection.includes('span: 6')],
  ['Collection exige membros contíguos', collection.includes('function contiguousMemberRun') && collection.includes('validBlocksForProducts')],
  ['CatalogDocument materializa collection e todos os memberIds', collectionDocument.includes("type: 'collection'") && collectionDocument.includes('memberIds') && collectionDocument.includes('memberEffectiveOrders')],
  ['CatalogDocument mantém orderedIds de todos os produtos', collectionDocument.includes('orderedIds.push(id)') && collectionDocument.includes('selectedCount: selected.length')],
  ['renderer de coleção consome documento e não calcula páginas', collectionRender.includes('NS.CatalogDocument.build(state)') && collectionRender.includes('catalog-collection') && !collectionRender.includes('paginateNodes(')],
  ['coleção ocupa full-width e rowSpan materializado', collectionRender.includes('grid-column:1 / span 6') && collectionRender.includes('grid-row:${item.row} / span ${item.rowSpan}')],
  ['temas claro/escuro e grade local estão isolados em CSS próprio', collectionCss.includes('.catalog-collection.theme-dark') && collectionCss.includes('repeat(var(--collection-cols)') && collectionCss.includes('.catalog-collection-grid')],
  ['UI oferece criar/desagrupar e overrides locais', collectionControls.includes('Agrupar em coleção') && collectionControls.includes('data-dissolve-collection') && collectionControls.includes('data-collection-member-width') && collectionControls.includes('data-collection-member-emphasis')],
  ['runtime de coleção carrega como extensão sem build frontend', orderBootstrap.includes("'src/collection.js'") && orderBootstrap.includes("'src/collection-document.js'") && orderBootstrap.includes("'src/collection-render.js'") && orderBootstrap.includes("'src/collection-controls.js'")],
  ['documentação fixa Card Collection Table como vocabulário pretendido', collectionDocs.includes('Card') && collectionDocs.includes('Collection') && collectionDocs.includes('Table (recorte seguinte)')],

  ['CatalogDocument base continua disponível', files['src/catalog-document.js'].includes('orderedIds') && files['src/catalog-document.js'].includes('effectiveOrderById')],
  ['impressão continua isolando apenas catalog-page', printJs.includes("querySelectorAll('.catalog-page')") && printJs.includes('body class="catalog-print-document"')],
  ['print físico permanece A4 210 × 297', printCss.includes('size: A4 portrait') && printCss.includes('width: 210mm !important') && printCss.includes('height: 297mm !important')],
  ['quebra física continua somente antes das páginas seguintes', printCss.includes('.catalog-page + .catalog-page') && printCss.includes('break-before: page !important')],
  ['linhas institucionais críticas usam borda', catalogPageCss.includes('border-top: .45mm solid var(--brand)') && catalogPageCss.includes('.footer-line')],
  ['preview mantém Fit/zoom e pan vertical', html.includes('id="catalogPreviewViewport"') && previewZoom.includes('210 * 96 / 25.4') && previewCss.includes('overscroll-behavior-y: auto')],
  ['CSS mobile segue sem print/compositor acoplado', !mobileHeaderCss.includes('@media print') && !mobileHeaderCss.includes('bulk-presentation-controls')],
  ['compositor responde à largura real do painel', composerCss.includes('container-type: inline-size') && composerCss.includes('@container catalog-selection-panel')],

  ['templates técnico/compacto/showcase permanecem registrados', ['technical','compact','showcase'].every(id => templates.includes(`id: '${id}'`))],
  ['importador continua exigindo código/descrição', importer.includes('Código e descrição são obrigatórios.')],
  ['ícones institucionais incluem WhatsApp', icons.includes('whatsapp')],
  ['Netlify continua executando npm test', netlify.includes('command = "npm test"')],
  ['Netlify continua publicando raiz estática', netlify.includes('publish = "."')],
  ['harness de cards continua usando renderer real', (cardCases.match(/name: '/g) || []).length === 4 && cardCases.includes("scratch.querySelector('.catalog-card')")]
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  failed.forEach(([name]) => console.error(`FAIL ${name}`));
  process.exit(1);
}
checks.forEach(([name]) => console.log(`PASS ${name}`));
