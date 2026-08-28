import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const runtimeFiles=['src/table-block.js','src/table-document.js','src/table-render.js','src/grouping-controls.js','src/table-controls.js','src/product-actions.js','src/product-delete-ui.js','src/block-overlap-guard.js','src/catalog-renderer.js'];
for(const file of runtimeFiles){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(result.status!==0){process.stderr.write(result.stderr||`Falha de sintaxe em ${file}\n`);process.exit(result.status||1);}}
const names=['index.html','src/table-block.js','src/table-document.js','src/table-render.js','src/grouping-controls.js','src/table-controls.js','src/product-actions.js','src/product-delete-ui.js','src/block-overlap-guard.js','src/catalog-document.js','src/catalog-renderer.js','src/collection-controls.js','src/print.js','table-block.css','docs/table-block-v0.10.2.md'];
const files=Object.fromEntries(await Promise.all(names.map(async file=>[file,await readFile(file,'utf8')])));
const checks=[
['runtime Table é carregado estaticamente antes do documento',files['index.html'].indexOf('src/table-block.js')<files['index.html'].indexOf('src/catalog-document.js')],
['modelo Table não monkey-patcha Composition',files['src/table-block.js'].includes('fragmentTable')&&!files['src/table-block.js'].includes('Composition.normalizePresentation =')],
['fontes de linha permanecem Produtos/Linhas comerciais',files['src/table-block.js'].includes("id: 'products'")&&files['src/table-block.js'].includes("id: 'commercialRows'")],
['CatalogDocument canônico materializa fragmentos Table',files['src/catalog-document.js'].includes("type: 'table-fragment'")&&files['src/catalog-document.js'].includes("type: 'table'")&&files['src/catalog-document.js'].includes('orderedIds = selected.map')],
['adapter Table não substitui build',files['src/table-document.js'].includes('TableDocument')&&!files['src/table-document.js'].includes('CatalogDocument.build =')],
['renderer Table é helper e renderer canônico faz dispatch',!files['src/table-render.js'].includes('renderCatalog =')&&files['src/catalog-renderer.js'].includes("item.type === 'table'")],
['UI Table é creation-only e usa candidatos da seleção editorial',files['src/table-controls.js'].includes('createTable')&&files['src/table-controls.js'].includes('GroupingControls?.candidateIds')&&!files['src/table-controls.js'].includes('MutationObserver')&&!files['src/table-controls.js'].includes('data-block-member-delta')],
['GroupingControls deriva seleção efêmera e não muta domínio',files['src/grouping-controls.js'].includes('ComposerSelection?.ids')&&files['src/grouping-controls.js'].includes('candidateIds')&&!files['src/grouping-controls.js'].includes('BlockSelection')&&!files['src/grouping-controls.js'].includes('const markedIds = new Set()')&&!files['src/grouping-controls.js'].includes('Core.mutate')],
['Collection também não observa lista',!files['src/collection-controls.js'].includes('MutationObserver')],
['exclusão continua operação única',files['src/product-actions.js'].includes('cleanupDraftForDeletedProduct')&&files['src/product-actions.js'].includes('presentation.blocks')],
['delete UI legado não observa DOM',!files['src/product-delete-ui.js'].includes('MutationObserver')],
['overlap guard legado não observa DOM',!files['src/block-overlap-guard.js'].includes('MutationObserver')],
['print inclui stylesheet Table',files['src/print.js'].includes('table-block.css')],
['CSS Table permanece fixed/sem overflow',files['table-block.css'].includes('overflow: hidden')&&files['table-block.css'].includes('table-layout: fixed')],
['documentação mantém Card Collection Table',files['docs/table-block-v0.10.2.md'].includes('Card')&&files['docs/table-block-v0.10.2.md'].includes('Collection')&&files['docs/table-block-v0.10.2.md'].includes('Table')]
];
const failed=checks.filter(([,ok])=>!ok);if(failed.length){failed.forEach(([name])=>console.error(`FAIL ${name}`));process.exit(1);}checks.forEach(([name])=>console.log(`PASS ${name}`));
