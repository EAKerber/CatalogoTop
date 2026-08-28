import { readFile, access, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const requiredFiles = [
  'index.html','styles.css','cards.css','category-browser.css','shell-responsive.css','mobile-header.css',
  'editorial-composition.css','catalog-page.css','composer-layout.css','preview-viewport.css','contextual-inspector.css','grouping-controls.css','print.css',
  'collection-block.css','table-block.css','product-actions.css','commercial-presentation.css',
  'src/composition.js','src/core.js','src/catalog-order.js','src/collection.js','src/table-block.js','src/catalog-document.js',
  'src/collection-document.js','src/table-document.js','src/render.js','src/collection-render.js','src/table-render.js',
  'src/catalog-renderer.js','src/render-document-adapter.js','src/print.js','src/app.js','src/catalog-selection-order.js',
  'src/composer-selection.js','src/presentation-actions.js','src/contextual-inspector.js','src/grouping-controls.js',
  'src/collection-controls.js','src/table-controls.js','src/product-actions.js','src/product-delete-ui.js','src/block-overlap-guard.js',
  'src/indexed-cache.js','src/asset-client.js','src/product-store.js','src/importer.js','src/templates.js','src/icons.js',
  'src/form-steps.js','src/mobile-workspace.js','src/preview-zoom.js','src/product-details.js','src/category-browser.js',
  'assets/logo-top-mobili.svg','examples/produtos-modelo.csv','examples/card-cases.html','examples/card-cases.js',
  'netlify.toml','docs/netlify.md','docs/reuse-from-gerador-v1.md','docs/card-model.md','docs/category-browser.md',
  'docs/responsive-shell.md','docs/editorial-composition-v0.8.md','docs/document-pipeline-v0.8.1.md',
  'docs/card-span-model-v0.9.md','docs/collection-block-v0.10.1.md','docs/table-block-v0.10.2.md',
  'docs/editor-runtime-boundaries-v0.11.0.md','docs/contextual-inspector-v0.11.1.md','docs/grouping-mode-compact-inspector-v0.11.1.7.md'
];
for (const file of requiredFiles) await access(file);

const srcJs = (await readdir('src')).filter(file => file.endsWith('.js')).map(file => `src/${file}`);
for (const file of srcJs) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `Falha de sintaxe em ${file}\n`);
    process.exit(result.status || 1);
  }
}

const names = [
  'index.html','shell-responsive.css','mobile-header.css','editorial-composition.css','catalog-page.css','composer-layout.css','preview-viewport.css','contextual-inspector.css','grouping-controls.css','commercial-presentation.css','print.css','collection-block.css','table-block.css',
  'src/composition.js','src/core.js','src/catalog-order.js','src/collection.js','src/table-block.js','src/catalog-document.js','src/collection-document.js','src/table-document.js','src/render.js','src/collection-render.js','src/table-render.js','src/catalog-renderer.js','src/render-document-adapter.js','src/print.js','src/app.js','src/catalog-selection-order.js','src/composer-selection.js','src/presentation-actions.js','src/contextual-inspector.js','src/grouping-controls.js','src/collection-controls.js','src/table-controls.js','src/product-actions.js','src/product-delete-ui.js','src/block-overlap-guard.js','src/importer.js','src/templates.js','src/icons.js','src/form-steps.js','src/mobile-workspace.js','src/preview-zoom.js','src/product-details.js','src/category-browser.js','examples/card-cases.js','netlify.toml','assets/logo-top-mobili.svg','docs/editor-runtime-boundaries-v0.11.0.md','docs/contextual-inspector-v0.11.1.md','docs/grouping-mode-compact-inspector-v0.11.1.7.md'
];
const files = Object.fromEntries(await Promise.all(names.map(async file => [file, await readFile(file, 'utf8')])));
const html = files['index.html'];
const core = files['src/core.js'];
const composition = files['src/composition.js'];
const catalogOrder = files['src/catalog-order.js'];
const collection = files['src/collection.js'];
const table = files['src/table-block.js'];
const documentModel = files['src/catalog-document.js'];
const collectionDocument = files['src/collection-document.js'];
const tableDocument = files['src/table-document.js'];
const collectionRender = files['src/collection-render.js'];
const tableRender = files['src/table-render.js'];
const catalogRenderer = files['src/catalog-renderer.js'];
const renderAdapter = files['src/render-document-adapter.js'];
const app = files['src/app.js'];
const order = files['src/catalog-selection-order.js'];
const composerSelection = files['src/composer-selection.js'];
const presentationActions = files['src/presentation-actions.js'];
const inspector = files['src/contextual-inspector.js'];
const groupingControls = files['src/grouping-controls.js'];
const collectionControls = files['src/collection-controls.js'];
const tableControls = files['src/table-controls.js'];
const deleteUi = files['src/product-delete-ui.js'];
const overlapGuard = files['src/block-overlap-guard.js'];
const printJs = files['src/print.js'];
const logo = files['assets/logo-top-mobili.svg'];
const checks = [
  ['shell possui três abas primárias', ['products','catalog','templates'].every(tab => html.includes(`data-tab="${tab}"`))],
  ['runtime editorial é bootstrap estático', html.includes('collection-block.css') && html.includes('table-block.css') && html.includes('contextual-inspector.css') && html.includes('grouping-controls.css') && html.indexOf('src/catalog-order.js') < html.indexOf('src/catalog-document.js') && html.indexOf('src/collection.js') < html.indexOf('src/catalog-document.js') && html.indexOf('src/table-block.js') < html.indexOf('src/catalog-document.js')],
  ['ações/seleção carregam antes da aplicação e modos/inspector depois', html.indexOf('src/product-actions.js') < html.indexOf('src/app.js') && html.indexOf('src/composer-selection.js') < html.indexOf('src/app.js') && html.indexOf('src/presentation-actions.js') < html.indexOf('src/app.js') && html.indexOf('src/grouping-controls.js') > html.indexOf('src/app.js') && html.indexOf('src/grouping-controls.js') < html.indexOf('src/collection-controls.js') && html.indexOf('src/contextual-inspector.js') > html.indexOf('src/app.js')],
  ['renderer canônico carrega após helpers', html.indexOf('src/collection-render.js') < html.indexOf('src/catalog-renderer.js') && html.indexOf('src/table-render.js') < html.indexOf('src/catalog-renderer.js')],
  ['logo canônica preserva viewBox oficial', logo.includes('viewBox="0 0 481 270"')],
  ['estado local migra para schema v6', core.includes('SCHEMA_VERSION = 6') && core.includes('order: []') && core.includes('blocks: []')],
  ['Composition preserva order/blocks/imageFrames sem painel bulk legado', composition.includes('order: uniqueIds(source.order)') && composition.includes('blocks: normalizeBlocks(source.blocks)') && composition.includes('imageFrames: normalizeImageFrames(source.imageFrames)') && !composition.includes('setupBulkControls') && !composition.includes('bulkPresentationControls')],
  ['CatalogOrder separa membership de ordem editorial', catalogOrder.includes('function effectiveIds') && catalogOrder.includes('function moveUnit') && catalogOrder.includes('source.category !== target.category') && !catalogOrder.includes('CatalogDocument')],
  ['largura por slots continua independente da ênfase', composition.includes('function slotSpanFor') && composition.includes('WIDTH_PRESETS') && !composition.includes('function emphasisRank')],
  ['Hero segue somente como migração legada', composition.includes("legacyHero ? 'feature'") && composition.includes("legacyHero ? 'full'")],
  ['Collection é modelo fechado com priceStyle local', collection.includes("type: 'collection'") && collection.includes('MAX_MEMBERS = 12') && collection.includes('planCollection') && collection.includes('priceStyle') && !collection.includes('Composition.normalizePresentation =')],
  ['Table é modelo fragmentável e adapta colunas por conteúdo', table.includes("type: 'table'") && table.includes('fragmentTable') && table.includes('capacityForUnit') && table.includes('columnDemand') && table.includes('planColumnWidths') && table.includes('elasticBounds') && !table.includes('Composition.normalizePresentation =')],
  ['CatalogDocument consome CatalogOrder e segue autoridade mista única', documentModel.includes('NS.CatalogOrder?.effectiveProducts') && documentModel.includes('function resolveBlocks') && documentModel.includes("type: 'collection'") && documentModel.includes("type: 'table-fragment'") && documentModel.includes('orderedIds = selected.map') && documentModel.includes('columnDemand')],
  ['adapters de documento não substituem build', !collectionDocument.includes('CatalogDocument.build =') && !tableDocument.includes('CatalogDocument.build =')],
  ['helpers de render não substituem renderCatalog', !collectionRender.includes('renderCatalog =') && !tableRender.includes('renderCatalog =') && !renderAdapter.includes('renderCatalog =')],
  ['somente renderer canônico instala renderCatalog uma vez', (catalogRenderer.match(/Render\.renderCatalog\s*=/g) || []).length === 1 && catalogRenderer.includes("item.type === 'collection'") && catalogRenderer.includes("item.type === 'table'")],
  ['lista é renderizada explicitamente sem observers de decoração', app.includes('function blockMembership') && app.includes('data-order-handle') && app.includes('catalogotop:selection-rendered') && !order.includes('MutationObserver') && !groupingControls.includes('MutationObserver') && !collectionControls.includes('MutationObserver') && !tableControls.includes('MutationObserver')],
  ['SelectionOrder não depende do CatalogDocument', !order.includes('CatalogDocument') && !order.includes('loadScript(') && !order.includes('ensureStyle(') && order.includes('CatalogOrder?.effectiveIds')],
  ['ComposerSelection é efêmero, múltiplo e reconhece linhas de Table', composerSelection.includes('let current = null') && composerSelection.includes('selectedProductIds = new Set()') && composerSelection.includes("kind === 'table-row'") && composerSelection.includes('selectProduct') && composerSelection.includes('reconcile') && !composerSelection.includes('Core.mutate')],
  ['PresentationActions centraliza mutações editoriais', presentationActions.includes('setCardStyle') && presentationActions.includes('setCollectionMemberStyle') && presentationActions.includes('updateTable') && presentationActions.includes('moveOrderUnit') && presentationActions.includes('moveBlockMember')],
  ['inspector contextual seleciona preview e long-press sem capturar scroll', inspector.includes('targetFromPreviewNode') && inspector.includes("kind: 'table-row'") && inspector.includes('bindLongPress') && inspector.includes("root.addEventListener('pointerdown'") && inspector.includes("root.addEventListener('pointermove'") && inspector.includes('Math.hypot') && inspector.includes('passive: true') && !inspector.includes('touchstart') && !inspector.includes('setPointerCapture') && inspector.includes('PresentationActions.moveBlockMember')],
  ['GroupingControls deriva candidatos da seleção editorial sem estado/aliases paralelos', groupingControls.includes('ComposerSelection?.ids') && groupingControls.includes('candidateIds') && groupingControls.includes('catalogotop:grouping-selection-changed') && !groupingControls.includes('BlockSelection') && !groupingControls.includes("mode:") && !groupingControls.includes('ensureStylesheet') && !groupingControls.includes('Core.mutate')],
  ['Collection/Table list controls são creation-only', collectionControls.includes('createCollection') && tableControls.includes('createTable') && collectionControls.includes('GroupingControls?.candidateIds') && tableControls.includes('GroupingControls?.candidateIds') && !collectionControls.includes('data-block-pick') && !tableControls.includes('data-block-pick') && !collectionControls.includes('data-block-member-delta') && !tableControls.includes('data-block-member-delta') && !collectionControls.includes('collection-manager') && !tableControls.includes('table-block-manager')],
  ['exclusão direta nasce no render e usa operação de domínio', app.includes('data-delete-product-direct') && app.includes('NS.ProductActions.deleteProduct') && files['src/product-actions.js'].includes('cleanupDraftForDeletedProduct') && files['src/product-actions.js'].includes('presentation.order')],
  ['compatibilidade de delete/overlap não observa DOM', !deleteUi.includes('MutationObserver') && !overlapGuard.includes('MutationObserver')],
  ['print continua isolado com CSS documental completo', printJs.includes("querySelectorAll('.catalog-page')") && printJs.includes('collection-block.css') && printJs.includes('table-block.css') && printJs.includes('commercial-presentation.css') && printJs.includes('grouping-controls.css')],
  ['print físico permanece A4', files['print.css'].includes('size: A4 portrait') && files['print.css'].includes('width: 210mm !important') && files['print.css'].includes('height: 297mm !important')],
  ['preview mantém Fit/zoom e pan vertical', html.includes('id="catalogPreviewViewport"') && files['src/preview-zoom.js'].includes('210 * 96 / 25.4') && files['preview-viewport.css'].includes('overscroll-behavior-y: auto')],
  ['chrome do inspector é editor-only', files['contextual-inspector.css'].includes('#catalogPreview .editor-selected') && files['grouping-controls.css'].includes('@media print') && files['grouping-controls.css'].includes('.editor-multi-selected')],
  ['mobile não incorpora print/compositor', !files['mobile-header.css'].includes('@media print') && !files['mobile-header.css'].includes('bulk-presentation-controls')],
  ['compositor segue container-aware sem painel bulk legado', files['composer-layout.css'].includes('container-type: inline-size') && !files['composer-layout.css'].includes('bulk-presentation-controls') && !files['grouping-controls.css'].includes('.selectable-products.is-grouping')],
  ['templates técnico/compacto/showcase permanecem', ['technical','compact','showcase'].every(id => files['src/templates.js'].includes(`id: '${id}'`))],
  ['importador continua exigindo código/descrição', files['src/importer.js'].includes('Código e descrição são obrigatórios.')],
  ['ícones institucionais incluem WhatsApp', files['src/icons.js'].includes('whatsapp')],
  ['Netlify continua executando npm test', files['netlify.toml'].includes('command = "npm test"')],
  ['documentação registra fronteiras v0.11.0/v0.11.1/v0.11.1.7', files['docs/editor-runtime-boundaries-v0.11.0.md'].includes('CatalogDocument') && files['docs/editor-runtime-boundaries-v0.11.0.md'].includes('MutationObserver') && files['docs/contextual-inspector-v0.11.1.md'].includes('Browser Inspector Gate') && files['docs/grouping-mode-compact-inspector-v0.11.1.7.md'].includes('BlockSelection')]
];
const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  failed.forEach(([name]) => console.error(`FAIL ${name}`));
  process.exit(1);
}
checks.forEach(([name]) => console.log(`PASS ${name}`));
