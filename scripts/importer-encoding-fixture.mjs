import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { TextDecoder } from 'node:util';

const source = await readFile('src/importer.js', 'utf8');
const context = {
  window: { CatalogoTop: { Core: { normalizeProduct: product => product } } },
  console,
  Object,
  Array,
  Map,
  Set,
  String,
  Math,
  Number,
  Uint8Array,
  TextDecoder
};
context.window.window = context.window;
vm.runInNewContext(source, context, { filename: 'src/importer.js' });
const Importer = context.window.CatalogoTop.Importer;
const fail = message => { throw new Error(message); };

const utf8Text = 'codigo;descricao;categoria\n1;Corrediça telescópica;CORREDIÇAS\n';
const utf8 = new TextEncoder().encode(utf8Text);
if (Importer.decodeCsvBytes(utf8) !== utf8Text) fail('UTF-8 com acentos deve ser preservado');

const windows1252Bytes = Uint8Array.from([
  0x63,0x6f,0x64,0x69,0x67,0x6f,0x3b,0x64,0x65,0x73,0x63,0x72,0x69,0x63,0x61,0x6f,0x3b,0x63,0x61,0x74,0x65,0x67,0x6f,0x72,0x69,0x61,0x0a,
  0x31,0x3b,0x43,0x6f,0x72,0x72,0x65,0x64,0x69,0xe7,0x61,0x20,0x74,0x65,0x6c,0x65,0x73,0x63,0xf3,0x70,0x69,0x63,0x61,0x3b,0x43,0x4f,0x52,0x52,0x45,0x44,0x49,0xc7,0x41,0x53,0x0a
]);
const decoded1252 = Importer.decodeCsvBytes(windows1252Bytes);
if (decoded1252 !== utf8Text) fail(`Windows-1252 deve preservar cedilha/acentos: ${decoded1252}`);

const rows = Importer.parseDelimited(decoded1252);
const parsed = Importer.sheetRowsFromMatrix(rows);
if (parsed.products[0]?.description !== 'Corrediça telescópica') fail('descrição acentuada não chegou ao produto');
if (parsed.products[0]?.category !== 'CORREDIÇAS') fail('categoria acentuada não chegou ao produto');
if (Importer.normalizeHeader('Descrição') !== 'descricao') fail('normalização de cabeçalho deve aceitar acentos');

console.log('PASS importer encoding fixture: UTF-8 e Windows-1252 preservam caracteres acentuados');
