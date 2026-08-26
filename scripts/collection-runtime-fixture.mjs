import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const runtimeFiles = [
  'src/collection.js',
  'src/collection-document.js',
  'src/collection-render.js',
  'src/collection-controls.js'
];

for (const file of runtimeFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `Falha de sintaxe em ${file}\n`);
    process.exit(result.status || 1);
  }
}

const core = await readFile('src/core.js', 'utf8');
const orderBootstrap = await readFile('src/catalog-selection-order.js', 'utf8');
const model = await readFile('src/collection.js', 'utf8');
const documentAdapter = await readFile('src/collection-document.js', 'utf8');
const renderer = await readFile('src/collection-render.js', 'utf8');
const controls = await readFile('src/collection-controls.js', 'utf8');
const css = await readFile('collection-block.css', 'utf8');
const docs = await readFile('docs/collection-block-v0.10.1.md', 'utf8');

const checks = [
  ['estado local preserva blocks e limpa no reset', core.includes('blocks: preservedBlocks') || core.includes('preservedBlocks(value)') && core.includes('blocks: []')],
  ['schema local foi versionado para coleção', core.includes('SCHEMA_VERSION = 4')],
  ['runtime de coleção é carregado antes do observador de ordem', orderBootstrap.indexOf("'src/collection.js'") < orderBootstrap.indexOf('init();') && orderBootstrap.includes('src/collection-document.js') && orderBootstrap.includes('src/collection-render.js')],
  ['modelo limita coleção e impede nesting implícito', model.includes('MAX_MEMBERS = 12') && model.includes("type: 'collection'") && !model.includes('children:')],
  ['coleção usa rowSpan top-level e slots locais', model.includes('localRowCount') && model.includes('rowSpan') && model.includes('slotSpan')],
  ['documento materializa collection sem remover memberIds', documentAdapter.includes("type: 'collection'") && documentAdapter.includes('memberIds') && documentAdapter.includes('orderedIds.push(id)')],
  ['renderer produz bloco full-width e membros endereçáveis', renderer.includes('catalog-collection') && renderer.includes('grid-column:1 / span 6') && renderer.includes('data-product-id')],
  ['UI oferece agrupar, editar e desagrupar', controls.includes('Agrupar em coleção') && controls.includes('data-dissolve-collection') && controls.includes('data-collection-member-width')],
  ['CSS cobre temas claro/escuro e grade local', css.includes('.catalog-collection.theme-dark') && css.includes('repeat(var(--collection-cols)') && css.includes('.catalog-collection-grid')],
  ['documentação registra Card Collection Table', docs.includes('Card') && docs.includes('Collection') && docs.includes('Table (recorte seguinte)')]
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  failed.forEach(([name]) => console.error(`FAIL ${name}`));
  process.exit(1);
}
checks.forEach(([name]) => console.log(`PASS ${name}`));
