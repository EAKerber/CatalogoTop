import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const context = {
  window: { CatalogoTop: {} },
  console,
  Object,
  Array,
  Map,
  Set,
  String,
  Math,
  Number
};
context.window.window = context.window;
vm.runInNewContext(await readFile('src/table-block.js', 'utf8'), context, { filename: 'src/table-block.js' });

const { TableBlock } = context.window.CatalogoTop;
const fail = message => { throw new Error(message); };

const core = TableBlock.columnWidths(['image', 'code', 'description', 'price']);
const byId = Object.fromEntries(core.map(column => [column.id, column]));
const total = core.reduce((sum, column) => sum + column.percent, 0);
if (Math.abs(total - 100) > 0.05) fail(`larguras devem normalizar para 100%; recebeu ${total}`);
if (!(byId.description.percent > byId.price.percent && byId.description.percent > byId.image.percent && byId.description.percent > byId.code.percent)) {
  fail(`Produto deve ser a coluna dominante: ${JSON.stringify(core)}`);
}
if (!(byId.code.percent < byId.description.percent / 2)) fail(`Código deve ser substancialmente mais estreito que Produto: ${JSON.stringify(core)}`);

const quantity = TableBlock.columnWidths(['description', 'minQuantity', 'price', 'quantityPrice']);
const quantityById = Object.fromEntries(quantity.map(column => [column.id, column]));
if (!(quantityById.minQuantity.percent < quantityById.price.percent && quantityById.minQuantity.percent < quantityById.description.percent)) {
  fail(`Qtd. mín. deve permanecer estreita: ${JSON.stringify(quantity)}`);
}

const fallback = TableBlock.columnWidths(['unknown', 'description']);
if (fallback.length !== 2 || Math.abs(fallback.reduce((sum, column) => sum + column.percent, 0) - 100) > 0.05) {
  fail('coluna desconhecida deve receber peso seguro sem quebrar normalização');
}

console.log('PASS render fidelity fixture: Table usa pesos semânticos normalizados por conjunto de colunas');
