import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const listeners = [];
const state = {
  products: [
    { id: 'p1', code: '1', description: 'Curto', category: 'A', status: 'Ativo', price: 'R$ 10,00', quantityPrice: null, tableRows: [] },
    { id: 'p2', code: '2', description: 'Produto com descrição longa para demandar largura editorial', category: 'A', status: 'Ativo', price: 'R$ 12,00', quantityPrice: null, tableRows: [] },
    { id: 'p3', code: '3', description: 'Terceiro produto', category: 'A', status: 'Ativo', price: 'R$ 14,00', quantityPrice: null, tableRows: [] },
    { id: 'p4', code: '400000000001', description: 'Quarto produto', category: 'A', status: 'Ativo', price: 'R$ 16,00', quantityPrice: null, tableRows: [] },
    { id: 'p5', code: '5', description: 'Quinto produto', category: 'A', status: 'Ativo', price: 'R$ 18,00', quantityPrice: null, tableRows: [] }
  ],
  selectedIds: ['p1', 'p2', 'p3', 'p4', 'p5'],
  catalog: {
    presentation: {
      order: ['p1', 'p2', 'p3', 'p4', 'p5'],
      blocks: [{ id: 'table-1', type: 'table', memberIds: ['p4', 'p5'], rowSource: 'products', density: 'compact', columns: ['code', 'description', 'price'] }]
    }
  }
};

class CustomEventStub {
  constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
}

const context = {
  window: {
    CatalogoTop: {
      Core: {
        getState: () => state,
        normalizeQuantityPrice: value => value || null
      },
      CatalogOrder: {
        effectiveIds: current => current.catalog.presentation.order.slice()
      }
    },
    dispatchEvent: event => listeners.push(event)
  },
  CustomEvent: CustomEventStub,
  console,
  Object,
  Array,
  Map,
  Set,
  String,
  Math,
  Number,
  JSON
};
context.window.window = context.window;
vm.runInNewContext(await readFile('src/table-block.js', 'utf8'), context, { filename: 'src/table-block.js' });
vm.runInNewContext(await readFile('src/composer-selection.js', 'utf8'), context, { filename: 'src/composer-selection.js' });

const { TableBlock, ComposerSelection } = context.window.CatalogoTop;
const fail = message => { throw new Error(message); };
const membershipBefore = state.selectedIds.join(',');

ComposerSelection.selectProduct(state, 'p1');
if (ComposerSelection.ids().join(',') !== 'p1' || ComposerSelection.get()?.kind !== 'card') fail('clique simples deve selecionar somente o produto e manter target Card');
ComposerSelection.selectProduct(state, 'p3', { additive: true });
if (ComposerSelection.ids().join(',') !== 'p1,p3') fail('seleção aditiva deve preservar produto anterior');
ComposerSelection.selectProduct(state, 'p5', { range: true });
if (ComposerSelection.ids().join(',') !== 'p3,p4,p5') fail(`Shift range deve usar CatalogOrder efetivo: ${ComposerSelection.ids().join(',')}`);
if (ComposerSelection.get()?.kind !== 'table-row' || ComposerSelection.get()?.productId !== 'p5') fail('produto com uma linha em Table deve resolver para table-row');
if (state.selectedIds.join(',') !== membershipBefore) fail('seleção editorial jamais pode alterar selectedIds');

const normalizedRow = ComposerSelection.normalize({ kind: 'table-row', blockId: 'table-1', rowId: 'p4', productId: 'p4' });
if (normalizedRow?.kind !== 'table-row' || normalizedRow.rowId !== 'p4') fail('table-row deve ser target efêmero válido');
ComposerSelection.clear();
if (ComposerSelection.ids().length || ComposerSelection.get()) fail('clear deve limpar somente seleção editorial');
if (state.selectedIds.join(',') !== membershipBefore) fail('clear editorial não pode alterar membership');

const table = TableBlock.normalizeBlock({ id: 'adaptive', type: 'table', memberIds: ['p1', 'p2', 'p3', 'p4', 'p5'], rowSource: 'products', columns: ['code', 'description', 'price'] });
const rows = TableBlock.rowsForBlock(table, state.products);
const demand = TableBlock.columnDemand(rows, table.columns);
const plan = TableBlock.planColumnWidths(table.columns, demand);
const byId = Object.fromEntries(plan.map(item => [item.id, item]));
const sum = Math.round(plan.reduce((total, item) => total + item.percent, 0) * 100) / 100;
if (sum !== 100) fail(`planner adaptativo deve ocupar 100%, recebeu ${sum}`);
if (!(byId.description.percent > byId.price.percent && byId.description.percent > byId.code.percent)) fail(`Produto deve receber mais largura quando conteúdo demanda: ${JSON.stringify(plan)}`);

const shortCodeDemand = TableBlock.columnDemand([{ code: '1', description: 'Descrição média', price: 'R$ 10,00' }], table.columns);
const longCodeDemand = TableBlock.columnDemand([{ code: 'CODIGO-REFERENCIA-MUITO-LONGO', description: 'Descrição média', price: 'R$ 10,00' }], table.columns);
const shortCode = Object.fromEntries(TableBlock.planColumnWidths(table.columns, shortCodeDemand).map(item => [item.id, item.percent]));
const longCode = Object.fromEntries(TableBlock.planColumnWidths(table.columns, longCodeDemand).map(item => [item.id, item.percent]));
if (!(longCode.code > shortCode.code)) fail(`Código longo deve ganhar largura: curto=${shortCode.code}, longo=${longCode.code}`);

const noPricePlan = TableBlock.planColumnWidths(['code', 'description'], demand);
const noPriceSum = Math.round(noPricePlan.reduce((total, item) => total + item.percent, 0) * 100) / 100;
if (noPriceSum !== 100) fail(`remover preço deve redistribuir 100% entre colunas restantes, recebeu ${noPriceSum}`);

const fragmented = TableBlock.fragmentTable(table, state.products);
if (!fragmented.columnDemand || fragmented.fragments.length < 2) fail('fixture precisa fragmentar Table e produzir demanda única');
if (fragmented.fragments.some(fragment => !Array.isArray(fragment.rows))) fail('fragmentos devem preservar linhas sem recalcular demanda local');

console.log('PASS editorial selection/table fixture: seleção efêmera, table-row e largura adaptativa determinística');
