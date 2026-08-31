import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile('src/templates.js', 'utf8');
const context = { window: { CatalogoTop: {} }, console, Object, Array, Math, Number, String, Map, Set, Error };
context.window.window = context.window;
vm.runInNewContext(source, context, { filename: 'src/templates.js' });

const { TemplateContract, Templates } = context.window.CatalogoTop;
const fail = message => { throw new Error(message); };
const expectCode = (fn, code) => {
  try { fn(); } catch (error) { if (error?.code === code) return; throw error; }
  fail(`esperava erro ${code}`);
};

if (!TemplateContract || !Templates) fail('TemplateContract e Templates devem ser exportados');
if (Templates.templates.length !== 3) fail('registry deve conter três built-ins');
for (const template of Templates.templates) {
  if (template.version !== 1) fail(`${template.id} deve iniciar em v1`);
  if (template.perPage !== template.columns * template.rows) fail(`${template.id} perPage deve ser derivado`);
  if (template.page.size !== 'A4' || template.page.orientation !== 'portrait') fail(`${template.id} deve manter A4 portrait`);
  if (template.page.header !== 'top-mobili-v1' || template.page.footer !== 'top-mobili-v1') fail(`${template.id} deve reutilizar chrome institucional`);
}
if (Templates.resolve('technical', 1).perPage !== 8) fail('technical@1 deve ser 2x4');
if (Templates.resolve('compact', 1).perPage !== 12) fail('compact@1 deve ser 3x4');
if (Templates.resolve('showcase', 1).perPage !== 6) fail('showcase@1 deve ser 2x3');
expectCode(() => Templates.resolve('technical', 2), 'template_unavailable');
expectCode(() => TemplateContract.normalize({ ...Templates.builtIns[0], html: '<div />' }), 'template_executable_field_forbidden');
expectCode(() => TemplateContract.normalize({ ...Templates.builtIns[0], css: '.x{}' }), 'template_executable_field_forbidden');
expectCode(() => TemplateContract.normalize({ ...Templates.builtIns[0], layout: { columns: 4, rows: 4 } }), 'template_number_invalid');
expectCode(() => TemplateContract.normalize({ ...Templates.builtIns[0], page: { ...Templates.builtIns[0].page, orientation: 'landscape' } }), 'template_choice_invalid');

console.log('PASS template contract fixture: built-ins v1, bounded declarative schema, derived capacity and executable fields blocked');
