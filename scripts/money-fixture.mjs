import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { TextDecoder } from 'node:util';

const coreSource = await readFile('src/core.js', 'utf8');
const importerSource = await readFile('src/importer.js', 'utf8');
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
  TextDecoder
};
context.window.window = context.window;
vm.runInNewContext(coreSource, context, { filename: 'src/core.js' });
vm.runInNewContext(importerSource, context, { filename: 'src/importer.js' });

const { Money, Core, Importer } = context.window.CatalogoTop;
const fail = message => { throw new Error(message); };

const cases = [
  ['54,9', 'R$ 54,90', 5490],
  ['54.90', 'R$ 54,90', 5490],
  ['R$54,90', 'R$ 54,90', 5490],
  ['R$ 54,90', 'R$ 54,90', 5490],
  ['1.234,56', 'R$ 1.234,56', 123456],
  ['1234.56', 'R$ 1.234,56', 123456],
  ['1,234.56', 'R$ 1.234,56', 123456],
  ['1234', 'R$ 1.234,00', 123400],
  ['0,5', 'R$ 0,50', 50],
  ['0', 'R$ 0,00', 0]
];

for (const [input, expected, cents] of cases) {
  const parsed = Money.parse(input);
  if (!parsed.ok || parsed.canonical !== expected || parsed.cents !== cents) {
    fail(`${input} deveria virar ${expected}/${cents}, recebeu ${JSON.stringify(parsed)}`);
  }
  if (Money.normalize(expected) !== expected) fail(`round-trip não idempotente para ${expected}`);
}

for (const input of ['consultar', 'R$ R$ 39,90', '-10,00', '12,3456']) {
  const parsed = Money.parse(input);
  if (parsed.ok) fail(`entrada inválida aceita: ${input}`);
  if (Money.normalize(input) !== input) fail(`entrada legada inválida não foi preservada: ${input}`);
}

const product = Core.normalizeProduct({
  id: 'p1', code: '1253', description: 'Corrediça', category: 'CORREDIÇAS', price: '54,9',
  tableRows: [{ variant: '350 mm', code: '1253', package: 'CX 10', price: '39.90' }]
});
if (product.price !== 'R$ 54,90') fail(`preço do produto não normalizou: ${product.price}`);
if (product.tableRows[0]?.price !== 'R$ 39,90') fail(`preço comercial não normalizou: ${product.tableRows[0]?.price}`);

const migrated = Core.migrate({
  products: [
    { id: 'legacy-ok', code: '1', description: 'Legado válido', price: '54,9' },
    { id: 'legacy-text', code: '2', description: 'Legado textual', price: 'consultar' }
  ],
  selectedIds: [],
  catalog: {}
});
if (migrated.products[0]?.price !== 'R$ 54,90') fail('migração não normalizou preço legado reconhecível');
if (migrated.products[1]?.price !== 'consultar') fail('migração alterou preço legado não reconhecível');

const imported = Importer.sheetRowsFromMatrix([
  ['codigo', 'descricao', 'preco'],
  ['10', 'Produto válido', '54,9'],
  ['11', 'Produto inválido', '54 reais'],
  ['12', 'Produto sem preço', '']
]);
if (imported.products.length !== 2) fail(`importação deveria manter 2 linhas válidas, recebeu ${imported.products.length}`);
if (imported.products[0]?.price !== 'R$ 54,90') fail(`preço importado não normalizou: ${imported.products[0]?.price}`);
if (imported.report.invalid.length !== 1 || imported.report.invalid[0]?.row !== 3 || !imported.report.invalid[0]?.reason.includes('54 reais')) {
  fail(`relatório de preço inválido inesperado: ${JSON.stringify(imported.report.invalid)}`);
}

console.log('PASS money fixture: parsing BRL, normalização, migração, tableRows e importação fail-closed por linha');
