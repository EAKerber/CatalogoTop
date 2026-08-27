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
vm.runInNewContext(await readFile('src/composition.js', 'utf8'), context, { filename: 'src/composition.js' });
vm.runInNewContext(await readFile('src/table-block.js', 'utf8'), context, { filename: 'src/table-block.js' });

const { Composition, TableBlock } = context.window.CatalogoTop;
const fail = message => { throw new Error(message); };

const styles = ['standard', 'red', 'label', 'block'];
if (Composition.PRICE_STYLES.map(item => item.id).join(',') !== styles.join(',')) fail('priceStyle deve expor quatro apresentações canônicas');
for (const priceStyle of styles) {
  const normalized = Composition.normalizeItemStyle({ priceStyle });
  if (normalized.priceStyle !== priceStyle) fail(`priceStyle ${priceStyle} não foi preservado`);
}
if (Composition.normalizeItemStyle({ priceStyle: 'inventado' }).priceStyle !== 'standard') fail('priceStyle inválido deve cair para standard');
if (Composition.normalizeItemStyle({}).priceStyle !== 'standard') fail('estado legado sem priceStyle deve permanecer compatível');

const presentation = Composition.normalizePresentation({
  itemStyles: {
    a: { contentPreset: 'commercial', emphasis: 'feature', width: 'wide', priceStyle: 'block' }
  }
});
const style = Composition.styleFor(presentation, 'a');
if (style.priceStyle !== 'block' || style.width !== 'wide' || style.emphasis !== 'feature') fail('styleFor deve preservar priceStyle junto dos demais overrides editoriais');

const normalTable = TableBlock.normalizeBlock({ id: 't1', type: 'table', memberIds: ['a', 'b'], columns: ['code', 'price'] });
if (normalTable.commercialPrices !== false) fail('Table legado deve iniciar sem destaque comercial');
const commercialTable = TableBlock.normalizeBlock({ ...normalTable, commercialPrices: true, columns: ['description', 'price', 'code'] });
if (!commercialTable.commercialPrices) fail('Table deve preservar toggle commercialPrices');
if (commercialTable.columns.join(',') !== 'description,price,code') fail('destaque comercial não pode reordenar colunas');

console.log('PASS commercial presentation fixture: priceStyle e commercialPrices normalizam sem alterar contratos existentes');
