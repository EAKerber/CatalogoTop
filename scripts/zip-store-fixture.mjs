import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const context = {
  window: { CatalogoTop: {} },
  TextEncoder,
  Uint8Array,
  Uint32Array,
  ArrayBuffer,
  DataView,
  Blob,
  Object,
  Array,
  String,
  Number,
  Math,
  Set,
  Map,
  console
};
context.window.window = context.window;
vm.runInNewContext(await readFile('src/zip-store.js', 'utf8'), context, { filename: 'src/zip-store.js' });

const { ZipStore } = context.window.CatalogoTop;
const fail = message => { throw new Error(message); };
const decoder = new TextDecoder();

const entries = [
  { path: 'sources/p1.bin', data: new Uint8Array([1, 2, 3, 4]) },
  { path: 'manifest.json', data: '{"ok":true}' }
];
const first = await ZipStore.create(entries);
const second = await ZipStore.create(entries.slice().reverse());
if (Buffer.compare(Buffer.from(first.bytes), Buffer.from(second.bytes)) !== 0) fail('ZIP STORE deve ser determinístico independentemente da ordem de entrada');
if (first.entries.map(item => item.path).join(',') !== 'manifest.json,sources/p1.bin') fail(`entradas não foram ordenadas: ${JSON.stringify(first.entries)}`);

const view = new DataView(first.bytes.buffer, first.bytes.byteOffset, first.bytes.byteLength);
if (view.getUint32(0, true) !== 0x04034b50) fail('assinatura do local header ausente');
const firstNameLength = view.getUint16(26, true);
const firstExtraLength = view.getUint16(28, true);
const firstName = decoder.decode(first.bytes.slice(30, 30 + firstNameLength));
if (firstName !== 'manifest.json') fail(`primeira entrada inesperada: ${firstName}`);
const firstSize = view.getUint32(22, true);
const firstDataStart = 30 + firstNameLength + firstExtraLength;
const firstData = first.bytes.slice(firstDataStart, firstDataStart + firstSize);
if (decoder.decode(firstData) !== '{"ok":true}') fail('conteúdo do manifest não round-trippou no STORE');
if (view.getUint32(14, true) !== ZipStore.crc32(firstData)) fail('CRC32 do local header diverge do conteúdo');

const eocdOffset = first.bytes.byteLength - 22;
if (view.getUint32(eocdOffset, true) !== 0x06054b50) fail('EOCD ausente');
if (view.getUint16(eocdOffset + 10, true) !== 2) fail('EOCD não registra duas entradas');

for (const invalid of ['../evil.txt', '/absolute.txt', 'C:/drive.txt', 'nested//empty.txt', 'nested/./dot.txt', 'nested/../escape.txt', 'bad\\slash.txt']) {
  let rejected = false;
  try { await ZipStore.create([{ path: invalid, data: 'x' }]); } catch { rejected = true; }
  if (!rejected) fail(`caminho inseguro deveria ser rejeitado: ${invalid}`);
}

let duplicateRejected = false;
try { await ZipStore.create([{ path: 'a.txt', data: '1' }, { path: 'a.txt', data: '2' }]); } catch { duplicateRejected = true; }
if (!duplicateRejected) fail('paths duplicados devem ser rejeitados');

console.log('PASS zip store fixture: determinismo, CRC32, EOCD, round-trip e path guards');
