import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { TextDecoder } from 'node:util';

const sources = await Promise.all([
  readFile('src/core.js', 'utf8'),
  readFile('src/importer.js', 'utf8'),
  readFile('src/table-block.js', 'utf8')
]);
const storage = new Map();
const context = {
  window: { CatalogoTop: {}, crypto: { randomUUID: () => 'fixture-id' } },
  localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value)
  },
  console,
  Object,
  Array,
  Map,
  Set,
  String,
  Math,
  Number,
  Date,
  Intl,
  JSON,
  TextDecoder,
  structuredClone
};
context.window.window = context.window;
for (const [index, source] of sources.entries()) vm.runInNewContext(source, context, { filename: ['src/core.js', 'src/importer.js', 'src/table-block.js'][index] });

const { Core, Importer, TableBlock } = context.window.CatalogoTop;
const fail = message => { throw new Error(message); };

if (Core.SCHEMA_VERSION !== 7) fail(`schema esperado 7, recebeu ${Core.SCHEMA_VERSION}`);

const normalized = Core.normalizeProduct({
  id: 'p1', code: '1', description: 'Produto', category: 'Teste', price: '54,9',
  quantityPrice: { minQuantity: '10', price: '49.9' },
  tableRows: [
    { id: 'r1', variant: 'A', code: 'A', package: 'CX 10', price: '40', quantityPrice: { minQuantity: 5, price: '35,5' } },
    { id: 'r2', variant: 'B', code: 'B', package: 'CX 10', price: '42' }
  ]
});
if (normalized.quantityPrice?.minQuantity !== 10 || normalized.quantityPrice?.price !== 'R$ 49,90') fail(`quantityPrice do produto não normalizou: ${JSON.stringify(normalized.quantityPrice)}`);
if (normalized.tableRows[0]?.quantityPrice?.price !== 'R$ 35,50') fail(`quantityPrice da linha não normalizou: ${JSON.stringify(normalized.tableRows[0])}`);
if (normalized.tableRows[1]?.quantityPrice !== null) fail('linha sem preço em quantidade ganhou condição indevida');

for (const invalid of [
  { minQuantity: 1, price: '10' },
  { minQuantity: 2.5, price: '10' },
  { minQuantity: 2, price: 'consultar' },
  { minQuantity: '', price: '10' }
]) {
  if (Core.normalizeQuantityPrice(invalid) !== null) fail(`condição inválida aceita: ${JSON.stringify(invalid)}`);
}

const oldRows = Core.parseTableRowsText('Branco | A | CX 10 | 17,64');
if (oldRows[0]?.price !== 'R$ 17,64' || oldRows[0]?.quantityPrice !== null) fail(`linha legada de 4 campos quebrou: ${JSON.stringify(oldRows)}`);
const newRows = Core.parseTableRowsText('Preto | B | CX 10 | 18,20 | 10 | 16,90');
if (newRows[0]?.quantityPrice?.minQuantity !== 10 || newRows[0]?.quantityPrice?.price !== 'R$ 16,90') fail(`linha de 6 campos não normalizou: ${JSON.stringify(newRows)}`);
if (!Core.tableRowsToText(newRows).includes('10 | R$ 16,90')) fail(`round-trip textual perdeu condição: ${Core.tableRowsToText(newRows)}`);

const migrated = Core.migrate({
  schemaVersion: 5,
  products: [{ id: 'legacy', code: 'L', description: 'Legado', price: '10' }],
  selectedIds: [],
  catalog: {}
});
if (migrated.schemaVersion !== 7 || migrated.products[0]?.quantityPrice !== null) fail(`migração v5→v7 inesperada: ${JSON.stringify(migrated)}`);

Core.setState({
  schemaVersion: 7,
  products: [{ id: 'merge', code: 'M', description: 'Antes', price: '20', quantityPrice: { minQuantity: 10, price: '18' } }],
  selectedIds: [],
  catalog: {}
}, { persist: false });
Core.mergeProducts([{ code: 'M', description: 'Depois', price: '21' }]);
let merged = Core.getState().products[0];
if (merged.quantityPrice?.price !== 'R$ 18,00') fail(`merge sem campo apagou condição existente: ${JSON.stringify(merged)}`);
Core.mergeProducts([{ code: 'M', description: 'Depois 2', price: '22', quantityPrice: { minQuantity: 20, price: '17.5' } }]);
merged = Core.getState().products[0];
if (merged.quantityPrice?.minQuantity !== 20 || merged.quantityPrice?.price !== 'R$ 17,50') fail(`merge explícito não atualizou condição: ${JSON.stringify(merged)}`);
Core.mergeProducts([{ code: 'M', description: 'Depois 3', price: '22', quantityPrice: null }]);
if (Core.getState().products[0]?.quantityPrice !== null) fail('merge explícito null não removeu condição');

const imported = Importer.sheetRowsFromMatrix([
  ['Código', 'Descrição', 'Preço', 'Qtd. mínima', 'Preço qtd.'],
  ['A', 'Válido', '20', '10', '18,5'],
  ['B', 'Par incompleto', '20', '10', ''],
  ['C', 'Mínimo inválido', '20', '1', '18'],
  ['D', 'Sem condição', '20', '', '']
]);
if (imported.products.length !== 2) fail(`import deveria manter A e D: ${JSON.stringify(imported.report)}`);
if (imported.products[0]?.quantityPrice?.price !== 'R$ 18,50') fail(`import não normalizou preço em quantidade: ${JSON.stringify(imported.products[0])}`);
if (Object.prototype.hasOwnProperty.call(imported.products[1], 'quantityPrice')) fail('par vazio de import deveria sinalizar ausência para merge conservador');
if (imported.report.invalid.length !== 2 || imported.report.invalid[0]?.row !== 3 || imported.report.invalid[1]?.row !== 4) fail(`relatório de import inesperado: ${JSON.stringify(imported.report.invalid)}`);

const tableProducts = [normalized, Core.normalizeProduct({ id: 'p2', code: '2', description: 'Produto 2', category: 'Teste', price: '60', quantityPrice: { minQuantity: 12, price: '55' } })];
const productBlock = TableBlock.normalizeBlock({ id: 't1', memberIds: ['p1', 'p2'], rowSource: 'products', columns: ['code', 'price', 'minQuantity', 'quantityPrice'] });
const productRows = TableBlock.rowsForBlock(productBlock, tableProducts);
if (productRows[0]?.minQuantity !== '10' || productRows[0]?.quantityPrice !== 'R$ 49,90') fail(`Table products perdeu condição: ${JSON.stringify(productRows)}`);

const commercialBlock = TableBlock.normalizeBlock({ id: 't2', memberIds: ['p1', 'p2'], rowSource: 'commercialRows', columns: ['variant', 'price', 'minQuantity', 'quantityPrice'] });
const commercialRows = TableBlock.rowsForBlock(commercialBlock, tableProducts);
const rowA = commercialRows.find(row => row.rowId === 'p1:r1');
const rowB = commercialRows.find(row => row.rowId === 'p1:r2');
if (rowA?.quantityPrice !== 'R$ 35,50' || rowA?.minQuantity !== '5') fail(`Table commercialRows perdeu preço da linha: ${JSON.stringify(rowA)}`);
if (rowB?.quantityPrice) fail(`Table commercialRows herdou condição do produto indevidamente: ${JSON.stringify(rowB)}`);

console.log('PASS quantity pricing fixture: schema 7, normalização, merge conservador, importação e Table sem herança indevida');
