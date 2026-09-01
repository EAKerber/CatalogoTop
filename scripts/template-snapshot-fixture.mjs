import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const context = { window: { CatalogoTop: {} }, console, Object, Array, Math, Number, String, Map, Set, Error, Date };
context.window.window = context.window;
vm.runInNewContext(await readFile('src/templates.js', 'utf8'), context, { filename: 'src/templates.js' });
vm.runInNewContext(await readFile('src/template-snapshot.js', 'utf8'), context, { filename: 'src/template-snapshot.js' });

const { Templates, TemplateSnapshot } = context.window.CatalogoTop;
const fail = message => { throw new Error(message); };
const expectCode = (fn, code) => {
  try { fn(); } catch (error) { if (error?.code === code) return; throw error; }
  fail(`esperava erro ${code}`);
};
const plain = value => JSON.parse(JSON.stringify(value));

const source = plain(Templates.resolve('technical', 1));
delete source.columns; delete source.rows; delete source.perPage; delete source.className;
const v1 = { ...source, id: 'custom-fixture', version: 1, name: 'Fixture custom' };
let snapshot = TemplateSnapshot.forWrite();
snapshot = TemplateSnapshot.appendVersion(snapshot, v1, { createdAt: '2026-08-31T00:00:00.000Z' });
if (snapshot.templates.length !== 1 || snapshot.templates[0].versions.length !== 1) fail('custom v1 não foi materializado');
Templates.installCustomResources(snapshot.templates);
if (Templates.resolve('custom-fixture', 1).name !== 'Fixture custom') fail('registry não resolveu custom v1');
if (Templates.templates.length !== 4) fail('latest registry deve unir 3 built-ins + custom');

const beforeV2 = plain(snapshot);
const v2 = { ...plain(v1), version: 2, name: 'Fixture custom v2', layout: { columns: 2, rows: 3 } };
snapshot = TemplateSnapshot.appendVersion(snapshot, v2, { createdAt: '2026-08-31T01:00:00.000Z' });
if (TemplateSnapshot.transitionError(beforeV2, snapshot)) fail('append v2 válido foi rejeitado');
Templates.installCustomResources(snapshot.templates);
if (Templates.resolve('custom-fixture', 1).name !== 'Fixture custom') fail('v1 deixou de resolver após v2');
if (Templates.resolve('custom-fixture', 2).perPage !== 6) fail('v2 custom não resolveu layout novo');
if (Templates.latest('custom-fixture').version !== 2) fail('latest custom deveria ser v2');

const rewritten = plain(snapshot);
rewritten.templates[0].versions[0].contract.name = 'Reescrito';
if (!TemplateSnapshot.transitionError(snapshot, rewritten).includes('reescrita')) fail('reescrita histórica precisa falhar');
const removed = plain(snapshot); removed.templates = [];
if (!TemplateSnapshot.transitionError(snapshot, removed).includes('removido')) fail('remoção de recurso publicado precisa falhar');
expectCode(() => TemplateSnapshot.appendVersion(TemplateSnapshot.forWrite(), { ...v1, id: 'technical' }), 'template_builtin_id_reserved');
expectCode(() => TemplateSnapshot.appendVersion(TemplateSnapshot.forWrite(), { ...v1, version: 2 }), 'template_version_sequence_invalid');

console.log('PASS template snapshot fixture: custom append-only versions, built-in reservation and historical exact resolution');
