(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const encoder = new TextEncoder();
  const MAX_ENTRIES = 512;
  const MAX_TOTAL_BYTES = 128 * 1024 * 1024;
  const UTF8_FLAG = 0x0800;
  const DOS_DATE_1980_01_01 = 0x0021;
  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
      table[index] = value >>> 0;
    }
    return table;
  })();

  function normalizePath(value) {
    const path = String(value || '');
    if (!path || path.includes('\\') || path.includes('\0') || path.startsWith('/') || /^[A-Za-z]:/.test(path)) throw new Error(`zip_path_invalid:${path}`);
    const parts = path.split('/');
    if (parts.some(part => !part || part === '.' || part === '..')) throw new Error(`zip_path_invalid:${path}`);
    const encoded = encoder.encode(path);
    if (encoded.byteLength > 0xffff) throw new Error(`zip_path_too_long:${path}`);
    return { path, encoded };
  }

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  async function toBytes(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    if (typeof Blob !== 'undefined' && value instanceof Blob) return new Uint8Array(await value.arrayBuffer());
    if (typeof value === 'string') return encoder.encode(value);
    throw new Error('zip_entry_data_invalid');
  }

  function write16(view, offset, value) { view.setUint16(offset, value, true); }
  function write32(view, offset, value) { view.setUint32(offset, value >>> 0, true); }

  function concatenate(chunks, totalLength) {
    const output = new Uint8Array(totalLength);
    let offset = 0;
    chunks.forEach(chunk => {
      output.set(chunk, offset);
      offset += chunk.byteLength;
    });
    return output;
  }

  async function create(entries, options = {}) {
    const source = Array.isArray(entries) ? entries : [];
    const maxEntries = Math.min(0xffff, Number(options.maxEntries) || MAX_ENTRIES);
    const maxTotalBytes = Number(options.maxTotalBytes) || MAX_TOTAL_BYTES;
    if (!source.length) throw new Error('zip_empty');
    if (source.length > maxEntries) throw new Error(`zip_entry_limit:${maxEntries}`);

    const normalized = [];
    const seen = new Set();
    let sourceBytes = 0;
    for (const entry of source) {
      const name = normalizePath(entry?.path);
      if (seen.has(name.path)) throw new Error(`zip_duplicate_path:${name.path}`);
      seen.add(name.path);
      const data = await toBytes(entry?.data);
      sourceBytes += data.byteLength;
      if (sourceBytes > maxTotalBytes) throw new Error(`zip_size_limit:${maxTotalBytes}`);
      normalized.push({ path: name.path, name: name.encoded, data, crc: crc32(data) });
    }
    normalized.sort((left, right) => left.path.localeCompare(right.path, 'en'));

    const localChunks = [];
    const records = [];
    let localOffset = 0;
    for (const entry of normalized) {
      const headerLength = 30 + entry.name.byteLength;
      const chunk = new Uint8Array(headerLength + entry.data.byteLength);
      const view = new DataView(chunk.buffer);
      write32(view, 0, 0x04034b50);
      write16(view, 4, 20);
      write16(view, 6, UTF8_FLAG);
      write16(view, 8, 0);
      write16(view, 10, 0);
      write16(view, 12, DOS_DATE_1980_01_01);
      write32(view, 14, entry.crc);
      write32(view, 18, entry.data.byteLength);
      write32(view, 22, entry.data.byteLength);
      write16(view, 26, entry.name.byteLength);
      write16(view, 28, 0);
      chunk.set(entry.name, 30);
      chunk.set(entry.data, headerLength);
      localChunks.push(chunk);
      records.push({ ...entry, localOffset });
      localOffset += chunk.byteLength;
    }

    const centralChunks = [];
    let centralSize = 0;
    for (const entry of records) {
      const chunk = new Uint8Array(46 + entry.name.byteLength);
      const view = new DataView(chunk.buffer);
      write32(view, 0, 0x02014b50);
      write16(view, 4, 20);
      write16(view, 6, 20);
      write16(view, 8, UTF8_FLAG);
      write16(view, 10, 0);
      write16(view, 12, 0);
      write16(view, 14, DOS_DATE_1980_01_01);
      write32(view, 16, entry.crc);
      write32(view, 20, entry.data.byteLength);
      write32(view, 24, entry.data.byteLength);
      write16(view, 28, entry.name.byteLength);
      write16(view, 30, 0);
      write16(view, 32, 0);
      write16(view, 34, 0);
      write16(view, 36, 0);
      write32(view, 38, 0);
      write32(view, 42, entry.localOffset);
      chunk.set(entry.name, 46);
      centralChunks.push(chunk);
      centralSize += chunk.byteLength;
    }

    const eocd = new Uint8Array(22);
    const end = new DataView(eocd.buffer);
    write32(end, 0, 0x06054b50);
    write16(end, 4, 0);
    write16(end, 6, 0);
    write16(end, 8, records.length);
    write16(end, 10, records.length);
    write32(end, 12, centralSize);
    write32(end, 16, localOffset);
    write16(end, 20, 0);

    const totalLength = localOffset + centralSize + eocd.byteLength;
    const bytes = concatenate([...localChunks, ...centralChunks, eocd], totalLength);
    return {
      bytes,
      blob: new Blob([bytes], { type: 'application/zip' }),
      byteLength: bytes.byteLength,
      entries: records.map(entry => ({ path: entry.path, byteLength: entry.data.byteLength, crc32: entry.crc }))
    };
  }

  NS.ZipStore = Object.freeze({
    MAX_ENTRIES,
    MAX_TOTAL_BYTES,
    normalizePath: value => normalizePath(value).path,
    crc32,
    toBytes,
    create
  });
})();
