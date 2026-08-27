import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const runtimeFiles=['src/collection.js','src/collection-document.js','src/collection-render.js','src/collection-controls.js','src/contextual-inspector.js','src/catalog-renderer.js'];
for(const file of runtimeFiles){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(result.status!==0){process.stderr.write(result.stderr||`Falha de sintaxe em ${file}\n`);process.exit(result.status||1);}}
const [html,core,composition,model,documentAdapter,renderer,controls,inspector,orderBootstrap,catalogDocument,catalogRenderer,css,docs]=await Promise.all([
'index.html','src/core.js','src/composition.js','src/collection.js','src/collection-document.js','src/collection-render.js','src/collection-controls.js','src/contextual-inspector.js','src/catalog-selection-order.js','src/catalog-document.js','src/catalog-renderer.js','collection-block.css','docs/collection-block-v0.10.1.md'].map(readFileUtf8));
function readFileUtf8(file){return readFile(file,'utf8');}
const checks=[
['estado local preserva blocks e ordem',core.includes('SCHEMA_VERSION = 5')&&core.includes('blocks: []')&&core.includes('order: []')],
['bootstrap de Collection é estático',html.includes('src/collection.js')&&html.indexOf('src/collection.js')<html.indexOf('src/catalog-document.js')&&!orderBootstrap.includes('loadScript(')],
['modelo não monkey-patcha Composition',model.includes('MAX_MEMBERS = 12')&&!model.includes('Composition.normalizePresentation =')],
['Composition preserva blocks nativamente',composition.includes('blocks: normalizeBlocks(source.blocks)')],
['CatalogDocument canônico materializa Collection',catalogDocument.includes("type: 'collection'")&&catalogDocument.includes('memberEffectiveOrders')],
['adapter Collection é compatibilidade sem override',documentAdapter.includes('CollectionDocument')&&!documentAdapter.includes('CatalogDocument.build =')],
['renderer Collection é helper puro',renderer.includes('catalog-collection')&&!renderer.includes('renderCatalog =')],
['renderer canônico é único dispatch',catalogRenderer.includes("item.type === 'collection'")&&catalogRenderer.includes('Render.renderCatalog = renderDocument')],
['UI de criação Collection não usa MutationObserver nem manager paralelo',controls.includes('Agrupar em coleção')&&!controls.includes('MutationObserver')&&!controls.includes('collection-manager')],
['override de membro migrou para inspector',inspector.includes('data-inspector-member-field="width"')&&inspector.includes('setCollectionMemberStyle')],
['CSS Collection mantém temas e grade',css.includes('.catalog-collection.theme-dark')&&css.includes('repeat(var(--collection-cols)')],
['documentação preserva vocabulário',docs.includes('Card')&&docs.includes('Collection')&&docs.includes('Table')]
];
const failed=checks.filter(([,ok])=>!ok);if(failed.length){failed.forEach(([name])=>console.error(`FAIL ${name}`));process.exit(1);}checks.forEach(([name])=>console.log(`PASS ${name}`));
