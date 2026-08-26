import { readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const requiredFiles = [
  'index.html',
  'styles.css',
  'cards.css',
  'category-browser.css',
  'src/core.js',
  'src/importer.js',
  'src/templates.js',
  'src/icons.js',
  'src/render.js',
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
  'docs/category-browser.md'
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
const css = `${await readFile('styles.css', 'utf8')}\n${await readFile('cards.css', 'utf8')}\n${await readFile('category-browser.css', 'utf8')}`;
const templates = await readFile('src/templates.js', 'utf8');
const importer = await readFile('src/importer.js', 'utf8');
const icons = await readFile('src/icons.js', 'utf8');
const core = await readFile('src/core.js', 'utf8');
const render = await readFile('src/render.js', 'utf8');
const detailEditor = await readFile('src/product-details.js', 'utf8');
const categoryBrowser = await readFile('src/category-browser.js', 'utf8');
const cardCases = await readFile('examples/card-cases.js', 'utf8');
const netlify = await readFile('netlify.toml', 'utf8');

const checks = [
  ['shell possui aba Produtos', html.includes('data-tab="products"')],
  ['shell possui aba Catálogo', html.includes('data-tab="catalog"')],
  ['shell possui aba Templates', html.includes('data-tab="templates"')],
  ['biblioteca de ícones carrega antes do renderer', html.indexOf('src/icons.js') < html.indexOf('src/render.js')],
  ['editor leve de detalhes carrega depois do app', html.indexOf('src/app.js') < html.indexOf('src/product-details.js')],
  ['navegador de categorias carrega depois do app', html.indexOf('src/app.js') < html.indexOf('src/category-browser.js')],
  ['categoria usa seletor sobrescrevível', html.includes('id="category" list="categoryOptions" required') && html.includes('id="categoryOptions"')],
  ['biblioteca possui pastas de categoria', html.includes('id="categoryFolders"') && categoryBrowser.includes('data-category-folder')],
  ['produtos sem categoria recebem pasta explícita', core.includes("|| 'Sem categoria'"))],
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
  ['renderer dispõe múltiplas imagens no card', render.includes('catalog-card-visuals multi')],
  ['renderer materializa tabela comercial', render.includes('catalog-card-table')],
  ['harness cobre quatro formatos de card', (cardCases.match(/name: '/g) || []).length === 4]
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  failed.forEach(([name]) => console.error(`FAIL ${name}`));
  process.exit(1);
}
checks.forEach(([name]) => console.log(`PASS ${name}`));
