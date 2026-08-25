import { readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const requiredFiles = [
  'index.html',
  'styles.css',
  'src/core.js',
  'src/importer.js',
  'src/templates.js',
  'src/render.js',
  'src/app.js',
  'assets/logo-top-mobili.svg',
  'examples/produtos-modelo.csv'
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
const css = await readFile('styles.css', 'utf8');
const templates = await readFile('src/templates.js', 'utf8');
const importer = await readFile('src/importer.js', 'utf8');

const checks = [
  ['shell possui aba Produtos', html.includes('data-tab="products"')],
  ['shell possui aba Catálogo', html.includes('data-tab="catalog"')],
  ['shell possui aba Templates', html.includes('data-tab="templates"')],
  ['impressão declara A4', css.includes('@page { size: A4 portrait;')],
  ['página contém rodapé', css.includes('.catalog-page-footer')],
  ['template técnico registrado', templates.includes("id: 'technical'")],
  ['template compacto registrado', templates.includes("id: 'compact'")],
  ['template destaque registrado', templates.includes("id: 'showcase'")],
  ['importador exige código/descrição', importer.includes('Código e descrição são obrigatórios.')]
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  failed.forEach(([name]) => console.error(`FAIL ${name}`));
  process.exit(1);
}
checks.forEach(([name]) => console.log(`PASS ${name}`));
