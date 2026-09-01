import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const fail = message => { throw new Error(message); };
const files = {
  store: await readFile('src/template-store.js', 'utf8'),
  library: await readFile('src/template-library.js', 'utf8'),
  shell: await readFile('src/library-shell.js', 'utf8'),
  document: await readFile('src/catalog-document.js', 'utf8'),
  api: await readFile('netlify/functions/templates.mts', 'utf8'),
  server: await readFile('netlify/lib/template-snapshot.mts', 'utf8')
};

for (const [name, source] of Object.entries({ store: files.store, library: files.library, shell: files.shell, document: files.document })) {
  try { new vm.Script(source, { filename: name }); }
  catch (error) { throw new Error(`${name} não compila: ${error.message}`); }
}

if (!files.api.includes("path: '/api/templates'")) fail('API de templates não possui path próprio');
if (!files.api.includes('expectedRevision') || !files.api.includes('validateTemplateSnapshotTransition')) fail('API precisa validar revisão e transição append-only');
if (!files.api.includes("history/${String(current.revision).padStart(8, '0')}")) fail('API precisa preservar history independente');
if (!files.server.includes('Versão histórica reescrita') || !files.server.includes('Template publicado não pode ser removido')) fail('server não protege histórico/remoção');

for (const forbidden of ['ProductStore.publishCurrent', 'ProductStore.publishSnapshot', 'CatalogStore.publish', 'AssetIndexStore.publish']) {
  if (files.store.includes(forbidden) || files.library.includes(forbidden)) fail(`TemplateStore/Library não pode chamar ${forbidden}`);
}
if (/deleteTemplate|deleteTemplates|removeTemplate|DELETE/.test(files.store + files.library + files.api)) fail('R4b não pode introduzir delete de templates');
if (!files.store.includes("fetch('/api/templates'")) fail('TemplateStore deve persistir somente em /api/templates');
if (!files.store.includes('getTemplateSnapshot') || !files.store.includes('setTemplateSnapshot')) fail('TemplateStore precisa cache independente');
if (!files.store.includes('duplicateAsDraft') || !files.store.includes('editAsDraft') || !files.store.includes('appendVersion')) fail('draft/publish append-only não está exposto');
if (!files.shell.includes("data-library-provider = 'templates'") && !files.shell.includes("dataset.libraryProvider = 'templates'")) fail('Biblioteca não injeta provider Templates');
if (!files.shell.includes('templateLibraryRoot')) fail('provider Templates não possui root próprio');
if (!files.library.includes('Publicar nova versão') || !files.library.includes('Criar template')) fail('editor não diferencia criação e nova versão');
if (!files.library.includes('A4 portrait') || !files.library.includes('capabilities')) fail('editor precisa explicitar campos herdados/read-only');
if (!files.store.includes('draft.catalog.templateId = option.value') || !files.store.includes('draft.catalog.templateVersion = version')) fail('bridge do seletor precisa gravar id+version atomicamente');
if (!files.store.includes("event.target !== select") || !files.store.includes("addEventListener('change'")) fail('bridge de mudança do seletor não está instalado');
if (!files.document.includes('catalogotop:templates-registry:v1') || !files.document.includes('installCustomResources')) fail('bootstrap síncrono de template customizado não está protegido');

console.log('PASS template store static fixture: isolated authority, no delete, append-only server gate, Library provider and atomic selector binding');
