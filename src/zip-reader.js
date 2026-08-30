(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  if (!NS.ZipStore) return;

  const MAX_ARCHIVE_BYTES = 128 * 1024 * 1024;
  const MAX_ENTRIES = 512;
  const MAX_ENTRY_BYTES = 32 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 128 * 1024 * 1024;
  const EOCD_MIN = 22;
  const EOCD_SEARCH = 0xffff + EOCD_MIN;
  const UTF8_FLAG = 0x0800;
  const ENCRYPTION_FLAGS = 0x0041;
  const METHODS = new Set([0, 8]);
  const decoder = new TextDecoder('utf-8', { fatal: false });

  function read16(view, offset) { return view.getUint16(offset, true); }
  function read32(view, offset) { return view.getUint32(offset, true); }

  function findEocd(bytes) {
    if (bytes.byteLength < EOCD_MIN) throw new Error('zip_eocd_missing');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const floor = Math.max(0, bytes.byteLength - EOCD_SEARCH);
    for (let offset = bytes.byteLength - EOCD_MIN; offset >= floor; offset -= 1) {
      if (read32(view, offset) !== 0x06054b50) continue;
      const commentLength = read16(view, offset + 20);
      if (offset + EOCD_MIN + commentLength !== bytes.byteLength) continue;
      return { offset, view };
    }
    throw new Error('zip_eocd_missing');
  }

  function decodeName(nameBytes, flags) {
    if (!(flags & UTF8_FLAG) && Array.from(nameBytes).some(byte => byte > 0x7f)) throw new Error('zip_filename_encoding_unsupported');
    const name = decoder.decode(nameBytes);
    if (!name) throw new Error('zip_filename_empty');
    return name;
  }

  function safePath(name, directory) {
    const raw = directory ? String(name).replace(/\/+$/, '') : String(name);
    if (!raw) throw new Error('zip_path_invalid');
    return NS.ZipStore.normalizePath(raw);
  }

  function parseCentralDirectory(bytes, options = {}) {
    const { offset: eocdOffset, view } = findEocd(bytes);
    const disk = read16(view, eocdOffset + 4);
    const centralDisk = read16(view, eocdOffset + 6);
    const diskEntries = read16(view, eocdOffset + 8);
    const totalEntries = read16(view, eocdOffset + 10);
    const centralSize = read32(view, eocdOffset + 12);
    const centralOffset = read32(view, eocdOffset + 16);
    if (disk || centralDisk || diskEntries !== totalEntries) throw new Error('zip_multidisk_unsupported');
    if (totalEntries === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) throw new Error('zip64_unsupported');
    const maxEntries = Math.min(0xffff, Number(options.maxEntries) || MAX_ENTRIES);
    const maxEntryBytes = Number(options.maxEntryBytes) || MAX_ENTRY_BYTES;
    const maxTotalBytes = Number(options.maxTotalBytes) || MAX_TOTAL_BYTES;
    if (totalEntries > maxEntries) throw new Error(`zip_entry_limit:${maxEntries}`);
    if (centralOffset + centralSize > eocdOffset || centralOffset > bytes.byteLength) throw new Error('zip_central_bounds');

    const entries = [];
    const paths = new Set();
    const offsets = new Set();
    let cursor = centralOffset;
    let totalBytes = 0;
    for (let index = 0; index < totalEntries; index += 1) {
      if (cursor + 46 > centralOffset + centralSize || read32(view, cursor) !== 0x02014b50) throw new Error('zip_central_entry_invalid');
      const madeBy = read16(view, cursor + 4);
      const flags = read16(view, cursor + 8);
      const method = read16(view, cursor + 10);
      const crc32 = read32(view, cursor + 16);
      const compressedSize = read32(view, cursor + 20);
      const uncompressedSize = read32(view, cursor + 24);
      const nameLength = read16(view, cursor + 28);
      const extraLength = read16(view, cursor + 30);
      const commentLength = read16(view, cursor + 32);
      const diskStart = read16(view, cursor + 34);
      const externalAttributes = read32(view, cursor + 38);
      const localOffset = read32(view, cursor + 42);
      if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) throw new Error('zip64_unsupported');
      if (flags & ENCRYPTION_FLAGS) throw new Error('zip_encryption_unsupported');
      if (!METHODS.has(method)) throw new Error(`zip_method_unsupported:${method}`);
      if (diskStart) throw new Error('zip_multidisk_unsupported');
      const recordEnd = cursor + 46 + nameLength + extraLength + commentLength;
      if (recordEnd > centralOffset + centralSize) throw new Error('zip_central_entry_bounds');
      const nameBytes = bytes.slice(cursor + 46, cursor + 46 + nameLength);
      const name = decodeName(nameBytes, flags);
      const unixMode = (externalAttributes >>> 16) & 0xffff;
      const madeByOs = madeBy >>> 8;
      if (madeByOs === 3 && (unixMode & 0xf000) === 0xa000) throw new Error(`zip_symlink_unsupported:${name}`);
      const directory = name.endsWith('/') || (madeByOs === 3 && (unixMode & 0xf000) === 0x4000);
      const path = safePath(name, directory);
      if (!directory) {
        if (paths.has(path)) throw new Error(`zip_duplicate_path:${path}`);
        paths.add(path);
        if (offsets.has(localOffset)) throw new Error('zip_duplicate_local_offset');
        offsets.add(localOffset);
        if (uncompressedSize > maxEntryBytes) throw new Error(`zip_entry_size_limit:${path}`);
        totalBytes += uncompressedSize;
        if (totalBytes > maxTotalBytes) throw new Error(`zip_total_size_limit:${maxTotalBytes}`);
      } else if (compressedSize || uncompressedSize) {
        throw new Error(`zip_directory_has_data:${path}`);
      }
      entries.push({
        index,
        path,
        directory,
        flags,
        method,
        crc32,
        compressedSize,
        uncompressedSize,
        localOffset
      });
      cursor = recordEnd;
    }
    if (cursor !== centralOffset + centralSize) throw new Error('zip_central_size_mismatch');
    return { entries, centralOffset, eocdOffset, totalBytes };
  }

  function localData(bytes, entry, centralOffset) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const offset = entry.localOffset;
    if (offset + 30 > centralOffset || read32(view, offset) !== 0x04034b50) throw new Error(`zip_local_header_invalid:${entry.path}`);
    const flags = read16(view, offset + 6);
    const method = read16(view, offset + 8);
    const nameLength = read16(view, offset + 26);
    const extraLength = read16(view, offset + 28);
    if ((flags & ENCRYPTION_FLAGS) || method !== entry.method) throw new Error(`zip_local_header_mismatch:${entry.path}`);
    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLength;
    const dataStart = nameEnd + extraLength;
    const dataEnd = dataStart + entry.compressedSize;
    if (dataStart > centralOffset || dataEnd > centralOffset || dataEnd > bytes.byteLength) throw new Error(`zip_local_data_bounds:${entry.path}`);
    const localName = safePath(decodeName(bytes.slice(nameStart, nameEnd), flags), entry.directory);
    if (localName !== entry.path) throw new Error(`zip_local_name_mismatch:${entry.path}`);
    return bytes.slice(dataStart, dataEnd);
  }

  async function inflateRaw(compressed, options = {}) {
    if (typeof options.inflateRaw === 'function') {
      const result = await options.inflateRaw(compressed);
      return result instanceof Uint8Array ? result : new Uint8Array(result);
    }
    if (typeof DecompressionStream === 'undefined') throw new Error('zip_deflate_unavailable');
    let stream;
    try { stream = new DecompressionStream('deflate-raw'); }
    catch { throw new Error('zip_deflate_unavailable'); }
    const output = new Response(new Blob([compressed]).stream().pipeThrough(stream));
    return new Uint8Array(await output.arrayBuffer());
  }

  async function extract(bytes, entry, centralOffset, options = {}) {
    const compressed = localData(bytes, entry, centralOffset);
    let output;
    if (entry.method === 0) {
      if (entry.compressedSize !== entry.uncompressedSize) throw new Error(`zip_store_size_mismatch:${entry.path}`);
      output = compressed;
    } else {
      output = await inflateRaw(compressed, options);
    }
    if (output.byteLength !== entry.uncompressedSize) throw new Error(`zip_uncompressed_size_mismatch:${entry.path}`);
    if (NS.ZipStore.crc32(output) !== entry.crc32) throw new Error(`zip_crc_mismatch:${entry.path}`);
    return output;
  }

  async function open(input, options = {}) {
    const bytes = await NS.ZipStore.toBytes(input);
    const maxArchiveBytes = Number(options.maxArchiveBytes) || MAX_ARCHIVE_BYTES;
    if (bytes.byteLength > maxArchiveBytes) throw new Error(`zip_archive_size_limit:${maxArchiveBytes}`);
    const parsed = parseCentralDirectory(bytes, options);
    const files = new Map();
    for (const entry of parsed.entries) {
      if (entry.directory) continue;
      files.set(entry.path, await extract(bytes, entry, parsed.centralOffset, options));
    }
    const get = path => files.get(NS.ZipStore.normalizePath(path)) || null;
    const text = path => {
      const value = get(path);
      return value ? decoder.decode(value) : null;
    };
    return Object.freeze({
      byteLength: bytes.byteLength,
      entries: parsed.entries.map(entry => ({ ...entry })),
      files,
      get,
      text
    });
  }

  NS.ZipReader = Object.freeze({
    MAX_ARCHIVE_BYTES,
    MAX_ENTRIES,
    MAX_ENTRY_BYTES,
    MAX_TOTAL_BYTES,
    findEocd,
    parseCentralDirectory,
    open
  });
})();
