import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile('src/catalog-order.js', 'utf8');
const context = { window: { CatalogoTop: {} }, console, Object, Array, Map, Set, Math, Number, String };
context.window.window = context.window;
vm.runInNewContext(source, context, { filename: 'src/catalog-order.js' });
const Order = context.window.CatalogoTop.CatalogOrder;
const fail = message => { throw new Error(message); };

const product = (id, category = 'A') => ({ id, code: id.toUpperCase(), description: `Produto ${id}`, category, status: 'Ativo' });
const products = [product('a'), product('b'), product('c'), product('d'), product('e'), product('f'), product('g'), product('x', 'B'), product('y', 'B')];
const state = {
  products,
  selectedIds: products.map(item => item.id),
  catalog: {
    presentation: {
      order: ['a', 'd', 'b', 'c', 'e', 'f', 'g', 'x', 'y'],
      blocks: [
        { id: 'collection-1', type: 'collection', memberIds: ['b', 'c'] },
        { id: 'table-1', type: 'table', memberIds: ['f', 'g'] }
      ]
    }
  }
};

const effective = Order.effectiveIds(state);
if (effective.join(',') !== 'a,d,b,c,e,f,g,x,y') fail(`ordem editorial divergente: ${effective.join(',')}`);
if (state.selectedIds.join(',') !== 'a,b,c,d,e,f,g,x,y') fail('effectiveIds não pode mutar membership');

const units = Order.unitsForCategory(state, 'A');
if (units.map(unit => unit.id).join(',') !== 'card:a,card:d,collection:collection-1,card:e,table:table-1') fail(`unidades editoriais incorretas: ${units.map(unit => unit.id).join(',')}`);

const movedCollection = Order.moveUnit(state, 'collection:collection-1', 'card:e', 'after');
if (movedCollection.join(',') !== 'a,d,e,b,c,f,g,x,y') fail(`Collection deve mover atomicamente: ${movedCollection.join(',')}`);
if (movedCollection.indexOf('c') !== movedCollection.indexOf('b') + 1) fail('membros de Collection perderam contiguidade');

const movedTable = Order.moveUnit({ ...state, catalog: { presentation: { ...state.catalog.presentation, order: movedCollection } } }, 'table:table-1', 'card:a', 'before');
if (movedTable.join(',') !== 'f,g,a,d,e,b,c,x,y') fail(`Table deve mover atomicamente: ${movedTable.join(',')}`);
if (movedTable.indexOf('g') !== movedTable.indexOf('f') + 1) fail('membros de Table perderam contiguidade');

const crossCategory = Order.moveUnit(state, 'card:a', 'card:x', 'before');
if (crossCategory.join(',') !== effective.join(',')) fail('reorder entre categorias deve ser rejeitado');

const partial = {
  ...state,
  selectedIds: ['a', 'b', 'c', 'd'],
  catalog: { presentation: { order: ['d', 'stale', 'd'], blocks: [] } }
};
if (Order.effectiveIds(partial).join(',') !== 'd,a,b,c') fail('IDs ausentes/duplicados devem ser normalizados e selecionados omitidos anexados');

console.log('PASS catalog order fixture: membership separado, categorias preservadas e blocos atômicos');