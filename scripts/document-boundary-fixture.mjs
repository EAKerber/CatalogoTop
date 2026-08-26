import { access, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const required=['src/catalog-document.js','src/catalog-renderer.js','src/render-document-adapter.js','src/print.js','src/catalog-selection-order.js','catalog-page.css','composer-layout.css','print.css'];
for(const file of required) await access(file);
for(const file of required.filter(file=>file.endsWith('.js'))){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(result.status!==0) throw new Error(result.stderr||`Falha de sintaxe em ${file}`);}
const html=await readFile('index.html','utf8'); const mobileHeader=await readFile('mobile-header.css','utf8'); const composer=await readFile('composer-layout.css','utf8'); const printCss=await readFile('print.css','utf8'); const printJs=await readFile('src/print.js','utf8'); const adapter=await readFile('src/render-document-adapter.js','utf8');
const fail=m=>{throw new Error(m)};
if(!html.includes('src/catalog-document.js')||!html.includes('src/catalog-renderer.js')||!html.includes('src/print.js')) fail('pipeline materializado deve estar carregado no app');
if(html.indexOf('src/catalog-document.js')>html.indexOf('src/render.js')) fail('CatalogDocument deve carregar antes do renderer');
if(html.indexOf('src/catalog-renderer.js')<html.indexOf('src/render.js')) fail('renderer canônico deve carregar depois do renderer base');
if(adapter.includes('renderCatalog =')) fail('adapter legado não pode voltar a substituir renderCatalog');
if(mobileHeader.includes('bulk-presentation-controls')||mobileHeader.includes('catalog-title-block')||mobileHeader.includes('@media print')) fail('mobile-header.css não pode carregar regras de compositor ou impressão');
if(!composer.includes('container-type: inline-size')||!composer.includes('grid-template-columns: minmax(0, 1fr) auto')) fail('compositor deve responder à largura real do painel');
if(!printCss.includes('.catalog-page + .catalog-page')||printCss.includes('break-after: page !important')) fail('print deve quebrar antes das páginas subsequentes');
if(!printJs.includes("querySelectorAll('.catalog-page')")||!printJs.includes('buildPrintableHtml')) fail('print deve materializar somente páginas A4');
if(printJs.includes('window.print()')) fail('print não pode voltar a imprimir a aplicação inteira');
console.log('PASS document boundary fixture: canonical document + renderer');
