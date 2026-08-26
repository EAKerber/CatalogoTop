import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const runtimeFiles = [
  'src/table-block.js',
  'src/table-document.js',
  'src/table-render.js',
  'src/table-controls.js',
  'src/product-actions.js',
  'src/product-delete-ui.js',
  'src/block-overlap-guard.js'
];

for (const file of runtimeFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `Falha de sintaxe em ${file}\n`);
    process.exit(result.status || 1);
  }
}

const bootstrap = await readFile('src/catalog-selection-order.js', 'utf8');
const model = await readFile('src/table-block.js', 'utf8');
const documentAdapter = await readFile('src/table-document.js', 'utf8');
const renderer = await readFile('src/table-render.js', 'utf8');
const controls = await readFile('src/table-controls.js', 'utf8');
const deletion = await readFile('src/product-actions.js', 'utf8');
const deleteUi = await readFile('src/product-delete-ui.js', 'utf8');
const collectionControls = await readFile('src/collection-controls.js', 'utf8');
const print = await readFile('src/print.js', 'utf8');
const css = await readFile('table-block.css', 'utf8');
const docs = await readFile('docs/table-block-v0.10.2.md', 'utf8');

const checks = [
  ['runtime Table carrega após Collection e antes da ordenação', bootstrap.indexOf("'src/collection-render.js'") < bootstrap.indexOf("'src/table-block.js'") && bootstrap.indexOf("'src/table-render.js'") < bootstrap.indexOf('init();')],
  ['modelo Table é full-width fragmentável sem nesting', model.includes("type: 'table'") && model.includes('fragmentTable') && model.includes('capacityForUnit') && !model.includes('children:')],
  ['fontes de linha são Produtos e Linhas comerciais', model.includes("id: 'products'") && model.includes("id: 'commercialRows'") && model.includes('rowsForBlock')],
  ['documento materializa fragmentos sem duplicar ordem factual', documentAdapter.includes("type: 'table-fragment'") && documentAdapter.includes("type: 'table'") && documentAdapter.includes('orderedIds = selected.map')],
  ['renderer repete thead e marca continuação', renderer.includes('<thead><tr>') && renderer.includes('catalog-table-continuation') && renderer.includes('is-continuation')],
  ['UI oferece agrupar tabela, fonte, densidade, colunas e desagrupar', controls.includes('Agrupar em tabela') && controls.includes('data-table-field="rowSource"') && controls.includes('data-table-field="density"') && controls.includes('data-table-column') && controls.includes('data-dissolve-table')],
  ['Collection preserva blocos de outros tipos durante edição', collectionControls.includes('mergeCollections') && collectionControls.includes("block?.type !== 'collection'")],
  ['exclusão usa operação única e limpa seleção/estilos/blocos', deletion.includes('cleanupDraftForDeletedProduct') && deletion.includes('draft.selectedIds') && deletion.includes('presentation.itemStyles') && deletion.includes('presentation.blocks')],
  ['biblioteca expõe exclusão direta e formulário reutiliza mesma operação', deleteUi.includes('dataDeleteProductDirect') || deleteUi.includes('deleteProductDirect') && deleteUi.includes('ProductActions.deleteProduct') && deleteUi.includes('btnDeleteProduct')],
  ['print isolado inclui stylesheet Table', print.includes('table-block.css')],
  ['CSS Table é full-width visual e evita overflow', css.includes('.catalog-table-block') && css.includes('overflow: hidden') && css.includes('table-layout: fixed')],
  ['documentação fixa vocabulário Card Collection Table', docs.includes('Card') && docs.includes('Collection') && docs.includes('Table') && docs.includes('Profundidade máxima')]
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  failed.forEach(([name]) => console.error(`FAIL ${name}`));
  process.exit(1);
}
checks.forEach(([name]) => console.log(`PASS ${name}`));
