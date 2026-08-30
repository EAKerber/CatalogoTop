import { readFile } from 'node:fs/promises';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import vm from 'node:vm';

const context = {
  window: { CatalogoTop: {} },
  TextEncoder,
  TextDecoder,
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
  JSON,
  Map,
  Set,
  console
};
context.window.window = context.window;
vm.runInNewContext(await readFile('src/zip-store.js', 'utf8'), context, { filename: 'src/zip-store.js' });
vm.runInNewContext(await readFile('src/zip-reader.js', 'utf8'), context, { filename: 'src/zip-reader.js' });

const { ZipStore, ZipReader } = context.window.CatalogoTop;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const fail = message => { throw new Error(message); };
const w16 = (view, offset, value) => view.setUint16(offset, value, true);
const w32 = (view, offset, value) => view.setUint32(offset, value >>> 0, true);

function makeZip(entries) {
  const localChunks = [];
  const centralEntries = [];
  let localOffset = 0;
  for (const raw of entries) {
    const name = encoder.encode(raw.name);
    const input = encoder.encode(raw.text || '');
    const method = raw.method ?? 0;
    const compressed = method === 8 ? new Uint8Array(deflateRawSync(input)) : input;
    const crc = raw.crcOverride ?? ZipStore.crc32(input);
    const local = new Uint8Array(30 + name.length + compressed.length);
    const lv = new DataView(local.buffer);
    w32(lv, 0, 0x04034b50); w16(lv, 4, 20); w16(lv, 6, 0x0800); w16(lv, 8, method);
    w16(lv, 10, 0); w16(lv, 12, 0x0021); w32(lv, 14, crc); w32(lv, 18, compressed.length); w32(lv, 22, input.length);
    w16(lv, 26, name.length); w16(lv, 28, 0); local.set(name, 30); local.set(compressed, 30 + name.length);
    localChunks.push(local);
    centralEntries.push({ name, input, compressed, method, crc, localOffset });
    localOffset += local.length;
  }

  const centralChunks = [];
  let centralSize = 0;
  for (const entry of centralEntries) {
    const central = new Uint8Array(46 + entry.name.length);
    const cv = new DataView(central.buffer);
    w32(cv, 0, 0x02014b50); w16(cv, 4, 20); w16(cv, 6, 20); w16(cv, 8, 0x0800); w16(cv, 10, entry.method);
    w16(cv, 12, 0); w16(cv, 14, 0x0021); w32(cv, 16, entry.crc); w32(cv, 20, entry.compressed.length); w32(cv, 24, entry.input.length);
    w16(cv, 28, entry.name.length); w16(cv, 30, 0); w16(cv, 32, 0); w16(cv, 34, 0); w16(cv, 36, 0); w32(cv, 38, 0); w32(cv, 42, entry.localOffset);
    central.set(entry.name, 46); centralChunks.push(central); centralSize += central.length;
  }

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  w32(ev, 0, 0x06054b50); w16(ev, 4, 0); w16(ev, 6, 0); w16(ev, 8, entries.length); w16(ev, 10, entries.length);
  w32(ev, 12, centralSize); w32(ev, 16, localOffset); w16(ev, 20, 0);
  const output = new Uint8Array(localOffset + centralSize + eocd.length);
  let offset = 0;
  [...localChunks, ...centralChunks, eocd].forEach(chunk => { output.set(chunk, offset); offset += chunk.length; });
  return output;
}

const stored = await ZipStore.create([
  { path: 'manifest.json', data: '{"kind":"result"}' },
  { path: 'images/a.webp', data: new Uint8Array([1, 2, 3, 4]) }
]);
const readStored = await ZipReader.open(stored.bytes);
if (readStored.text('manifest.json') !== '{"kind":"result"}') fail('STORE manifest não round-trippou');
if (Array.from(readStored.get('images/a.webp') || []).join(',') !== '1,2,3,4') fail('STORE binário não round-trippou');

const deflated = makeZip([{ name: 'manifest.json', text: '{"compressed":true}', method: 8 }]);
const readDeflated = await ZipReader.open(deflated, { inflateRaw: bytes => new Uint8Array(inflateRawSync(bytes)) });
if (readDeflated.text('manifest.json') !== '{"compressed":true}') fail('DEFLATE não round-trippou');

let rejected = false;
try { await ZipReader.open(makeZip([{ name: '../evil.txt', text: 'x' }])); } catch (error) { rejected = String(error.message).includes('zip_path_invalid'); }
if (!rejected) fail('path traversal deve ser rejeitado');

rejected = false;
try { await ZipReader.open(makeZip([{ name: 'a.txt', text: '1' }, { name: 'a.txt', text: '2' }])); } catch (error) { rejected = String(error.message).includes('zip_duplicate_path'); }
if (!rejected) fail('paths duplicados devem ser rejeitados');

rejected = false;
try { await ZipReader.open(makeZip([{ name: 'a.txt', text: 'x', method: 99 }])); } catch (error) { rejected = String(error.message).includes('zip_method_unsupported'); }
if (!rejected) fail('método de compressão desconhecido deve ser rejeitado');

rejected = false;
try { await ZipReader.open(makeZip([{ name: 'a.txt', text: 'crc', crcOverride: 0x12345678 }])); } catch (error) { rejected = String(error.message).includes('zip_crc_mismatch'); }
if (!rejected) fail('CRC inválido deve ser rejeitado');

rejected = false;
try { await ZipReader.open(stored.bytes, { maxTotalBytes: 3 }); } catch (error) { rejected = String(error.message).includes('zip_total_size_limit'); }
if (!rejected) fail('limite total descompactado deve ser aplicado antes da extração');

const central = ZipReader.parseCentralDirectory(stored.bytes);
if (central.entries.filter(entry => !entry.directory).length !== 2 || central.totalBytes !== 21) fail(`metadados centrais inesperados: ${JSON.stringify(central)}`);

console.log('PASS zip reader fixture: STORE/DEFLATE, CRC, traversal, duplicatas, método e limites');
