import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const [orderSource, actionsSource] = await Promise.all([
  readFile('src/catalog-order.js', 'utf8'),
  readFile('src/product-actions.js', 'utf8')
]);

const state = {
  products: [
    { id: 'a', code: 'A', description: 'A', category: 'Corrediças' },
    { id: 'b', code: 'B', description: 'B', category: 'Corrediças' },
    { id: 'c', code: 'C', description: 'C', category: 'Dobradiças' }
  ],
  selectedIds: ['a', 'b', 'c'],
  catalog: {
    presentation: {
      order: ['a', 'b', 'c'],
      itemStyles: { a: { width: 'wide' }, b: { width: 'simple' }, c: { width: 'simple' } },
      imageFrames: { a: { mode: 'contain' }, b: { mode: 'cover' } },
      blocks: [
        { id: 'collection-1', type: 'collection', memberIds: ['a', 'b'], itemStyles: { a: { emphasis: 'feature' } } }
      ]
    }
  }
};

let published = 0;
const context = {
  window: {
    CatalogoTop: {
      Core: {
        getState: () => state,
        mutate: mutator => mutator(state)
      },
      ProductStore: {
        publishCurrent: async () => { published += 1; return true; }
      }
    },
    dispatchEvent: () => {},
    confirm: () => true
  },
  console,
  Object,
  Array,
  Map,
  Set,
  Math,
  Number,
  String,
  CustomEvent: class CustomEvent {
    constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
  }
};
context.window.window = context.window;

vm.runInNewContext(orderSource, context, { filename: 'src/catalog-order.js' });
vm.runInNewContext(actionsSource, context, { filename: 'src/product-actions.js' });

const Actions = context.window.CatalogoTop.ProductActions;
const fail = message => { throw new Error(message); };

const deleted = await Actions.deleteCategory('Corrediças', { confirmDelete: false });
if (!deleted) fail('deleteCategory deveria remover categoria existente');
if (state.products.map(product => product.id).join(',') !== 'c') fail(`produtos da categoria não foram removidos: ${state.products.map(product => product.id)}`);
if (state.selectedIds.join(',') !== 'c') fail(`selectedIds não foi limpo: ${state.selectedIds}`);
if (state.catalog.presentation.order.join(',') !== 'c') fail(`ordem não foi limpa: ${state.catalog.presentation.order}`);
if ('a' in state.catalog.presentation.itemStyles || 'b' in state.catalog.presentation.itemStyles) fail('itemStyles órfãos permaneceram');
if ('a' in state.catalog.presentation.imageFrames || 'b' in state.catalog.presentation.imageFrames) fail('imageFrames órfãos permaneceram');
if (state.catalog.presentation.blocks.length !== 0) fail('Collection com membros apagados deveria ser dissolvida');
if (published !== 1) fail(`exclusão em lote deve publicar uma vez; publicou ${published}`);

const missing = await Actions.deleteCategory('Inexistente', { confirmDelete: false });
if (missing !== false || published !== 1) fail('categoria inexistente não deve publicar nem alterar estado');

console.log('PASS product/category actions fixture: exclusão de categoria limpa produtos, catálogo e blocos com uma publicação');
