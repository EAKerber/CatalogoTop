import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile('src/catalog-date.js', 'utf8');
const context = {
  window: { CatalogoTop: {} },
  console,
  Date,
  Object,
  Array,
  Math,
  Number,
  String,
  RegExp
};
context.window.window = context.window;
vm.runInNewContext(source, context, { filename: 'src/catalog-date.js' });

const CatalogDate = context.window.CatalogoTop.CatalogDate;
const fail = message => { throw new Error(message); };

if (!CatalogDate) fail('CatalogDate deve ser exportado');
if (CatalogDate.normalizeOverride('2026-08-27') !== '2026-08-27') fail('override ISO válido deve ser preservado');
if (CatalogDate.normalizeOverride('2026-02-30') !== '') fail('data impossível deve ser rejeitada');
if (CatalogDate.normalizeOverride('27/08/2026') !== '') fail('estado deve persistir somente YYYY-MM-DD');
if (CatalogDate.formatValue('2026-08-27') !== '27/08/2026') fail('data deve ser formatada em pt-BR sem depender de timezone');

const fixed = new Date(2026, 7, 27, 10, 30, 0, 0);
if (CatalogDate.todayValue(fixed) !== '2026-08-27') fail('modo automático deve usar a data local atual');
if (CatalogDate.effectiveLabel({}, fixed) !== 'Hoje · 27/08/2026') fail('label automático deve deixar explícito que acompanha hoje');
if (CatalogDate.effectiveLabel({ dateOverride: '2025-12-31' }, fixed) !== '31/12/2025') fail('override deve substituir a data automática');
if (!CatalogDate.isAutomatic({ dateOverride: '' })) fail('override vazio deve representar modo automático');
if (CatalogDate.isAutomatic({ dateOverride: '2025-12-31' })) fail('data escolhida deve sair do modo automático');

const overrideIso = CatalogDate.effectiveIso({ dateOverride: '2025-12-31' }, fixed);
const overrideDate = new Date(overrideIso);
if (Number.isNaN(overrideDate.getTime())) fail('override deve produzir ISO válido para o renderer existente');

console.log('PASS catalog date fixture: automático por padrão, override date-only e formatação timezone-safe');
