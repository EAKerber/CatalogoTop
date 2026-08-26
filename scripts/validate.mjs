import { readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const requiredFiles = [
  'index.html',
  'styles.css',
  'cards.css',
  'category-browser.css',
  'shell-responsive.css',
  'mobile-header.css',
  'src/core.js',
  'src/importer.js',
  'src/templates.js',
  'src/icons.js',
  'src/render.js',
  'src/form-steps.js',
  'src/mobile-workspace.js',
  'src/app.js',
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
  'docs/responsive-shell.md'
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
const css = `${await readFile('styles.css', 'utf8')}\n${cardsCss}\n${await readFile('category-browser.css', 'utf8')}\n${shellCss}\n${mobileHeaderCss}`;
const templates = await readFile('src/templates.js', 'utf8');
const importer = await readFile('src/importer.js', 'utf8');
const icons = await readFile('src/icons.js', 'utf8');
const core = await readFile('src/core.js', 'utf8');
const render = await readFile('src/render.js', 'utf8');
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
  ['shell possui aba Produtos', html.includes('data-tab="products"')],
  ['shell possui aba Catálogo', html.includes('data-tab="catalog"')],
  ['shell possui aba Templates', html.includes('data-tab="templates"')],
  ['tabs, importação e backup compartilham o header sticky', headerHtml.includes('class="app-tabs"') && headerHtml.includes('id="importProductsFile"') && headerHtml.includes('id="importMode"') && headerHtml.includes('id="backupFile"') && shellCss.includes('position: sticky')],
  ['override mobile carrega após shell responsivo', html.indexOf('shell-responsive.css') < html.indexOf('mobile-header.css')],
  ['importação não ocupa faixa permanente na aba Produtos', !html.includes('class="import-panel compact-import card"') && html.includes('class="import-report shell-import-report hidden"')],
  ['ação novo produto saiu do cabeçalho da seção', !productHeadingHtml.includes('id="btnNewProduct"') && html.indexOf('id="btnNewProduct"') > html.indexOf('id="productForm"')],
  ['heading de Produtos usa variante compacta', html.includes('class="section-heading product-section-heading"') && shellCss.includes('.product-section-heading h2')],
  ['biblioteca de ícones carrega antes do renderer', html.indexOf('src/icons.js') < html.indexOf('src/render.js')],
  ['etapas do formulário carregam antes do app', html.indexOf('src/form-steps.js') < html.indexOf('src/app.js')],
  ['workspace mobile carrega antes do app', html.indexOf('src/mobile-workspace.js') < html.indexOf('src/app.js')],
  ['editor leve de detalhes carrega depois do app', html.indexOf('src/app.js') < html.indexOf('src/product-details.js')],
  ['navegador de categorias carrega depois do app', html.indexOf('src/app.js') < html.indexOf('src/category-browser.js')],
  ['cadastro de produto possui três etapas', (html.match(/data-form-step="/g) || []).length === 3 && formSteps.includes('Etapa ${current} de ${steps.length}')],
  ['enter avança sem salvar antes da etapa final', formSteps.includes('stopImmediatePropagation') && formSteps.includes('current < steps.length')],
  ['mobile alterna cadastro e biblioteca por tabs', html.includes('data-mobile-workspace-target="form"') && html.includes('data-mobile-workspace-target="library"') && html.includes('data-mobile-workspace-panel="form"') && html.includes('data-mobile-workspace-panel="library"')],
  ['mobile possui swipe horizontal com limiar', mobileWorkspace.includes("touchstart") && mobileWorkspace.includes("touchend") && mobileWorkspace.includes('Math.abs(dx) < 56') && mobileWorkspace.includes("show('library')") && mobileWorkspace.includes("show('form')")],
  ['mobile reserva linha inferior apenas às tabs primárias', mobileHeaderCss.includes('.app-primary-tools { display: contents; }') && mobileHeaderCss.includes('.app-shell-header .app-tabs') && mobileHeaderCss.includes('order: 3;') && mobileHeaderCss.includes('grid-template-columns: repeat(3, minmax(0, 1fr))')],
  ['utilidades mobile possuem scroll horizontal próprio', mobileHeaderCss.includes('.header-product-import') && mobileHeaderCss.includes('.app-header-actions') && (mobileHeaderCss.match(/overflow-x: auto;/g) || []).length >= 2],
  ['categoria usa seletor sobrescrevível', html.includes('id="category" list="categoryOptions" required') && html.includes('id="categoryOptions"')],
  ['biblioteca possui pastas de categoria', html.includes('id="categoryFolders"') && categoryBrowser.includes('data-category-folder')],
  ['produtos sem categoria recebem pasta explícita', core.includes("|| 'Sem categoria'")],
  ['workspace desktop usa scroll interno', shellCss.includes('body { overflow: hidden; }') && shellCss.includes('.category-browser { min-height: 0; overflow: auto; }') && shellCss.includes('.table-wrap { height: 100%; max-height: none; overflow: auto; }')],
  ['breakpoints de tablet e mobile existem', shellCss.includes('@media (max-width: 959px)') && shellCss.includes('@media (max-width: 639px)')],
  ['importação permanece junto às tabs no breakpoint tablet', shellCss.includes('.app-primary-tools') && shellCss.includes('overflow-x: auto')],
  ['logo canônica substitui reconstrução', logo.includes('viewBox="0 0 481 270"') && !logo.includes('recriada a partir da referência')],
  ['impressão declara A4', css.includes('@page { size: A4 portrait;')],
  ['página contém rodapé', css.includes('.catalog-page-footer')],
  ['template técnico registrado', templates.includes("id: 'technical'")],
  ['template compacto registrado', templates.includes("id: 'compact'")],
  ['template destaque registrado', templates.includes("id: 'showcase'")],
  ['importador exige código/descrição', importer.includes('Código e descrição são obrigatórios.')],
  ['ícones institucionais incluem WhatsApp', icons.includes('whatsapp')],
  ['Netlify executa smoke test', netlify.includes('command = "npm test"')],
  ['Netlify publica site estático da raiz', netlify.includes('publish = "."')],
  ['modelo preserva variações visuais', core.includes('variants: normalizeVariants(product.variants)')],
  ['modelo preserva linhas comerciais', core.includes('tableRows: normalizeTableRows(product.tableRows)')],
  ['formulário possui entrada simples de variações', html.includes('id="variants"') && detailEditor.includes('parseVariantsText')],
  ['formulário possui entrada simples de tabela', html.includes('id="commercialRows"') && detailEditor.includes('parseTableRowsText')],
  ['renderer dispõe múltiplas imagens no card', render.includes('catalog-variant-image-grid')],
  ['renderer materializa tabela comercial', render.includes('catalog-card-table')],
  ['tabela usa pesos fixos de coluna', render.includes('function weightedColumns') && render.includes('<colgroup>')],
  ['cards com tabela cedem largura a referências', cardsCss.includes('.catalog-card.has-table:not(.has-variant-images)')],
  ['harness cobre quatro formatos de card', (cardCases.match(/name: '/g) || []).length === 4],
  ['harness amplia o card do renderer real', cardCases.includes("scratch.querySelector('.catalog-card')")]
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  failed.forEach(([name]) => console.error(`FAIL ${name}`));
  process.exit(1);
}
checks.forEach(([name]) => console.log(`PASS ${name}`));
