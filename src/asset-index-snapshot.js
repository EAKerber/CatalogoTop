(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const FolderTree = NS.FolderTree;
  if (!FolderTree) return;

  const SCHEMA_VERSION = 1;
  const MAX_ASSETS = 5000;
  const MAX_LABEL_LENGTH = 300;
  const MANAGED_RE = /^\/api\/assets\/sha256\/([a-f0-9]{64})$/i;
  const ID_RE = /^sha256\/([a-f0-9]{64})$/i;
  const HASH_RE = /^[a-f0-9]{64}$/i;

  function issue(code, message, detail = {}) {
    const error = new Error(message || code);
    error.code = code;
    Object.assign(error, detail);
    return error;
  }

  function hashFrom(value) {
    const text = String(value || '').trim();
    const match = text.match(MANAGED_RE) || text.match(ID_RE);
    if (match) return match[1].toLowerCase();
    if (HASH_RE.test(text)) return text.toLowerCase();
    return '';
  }

  function requireHash(value) {
    const hash = hashFrom(value);
    if (!hash) throw issue('asset_hash_invalid', 'Hash de asset inválido.');
    return hash;
  }

  function idFrom(value) {
    return `sha256/${requireHash(value)}`;
  }

  function urlFrom(value) {
    return `/api/assets/sha256/${requireHash(value)}`;
  }

  function metadata(raw) {
    const revision = Number(raw?.revision);
    return {
      revision: Number.isInteger(revision) && revision >= 0 ? revision : 0,
      updatedAt: String(raw?.updatedAt || ''),
      writeId: String(raw?.writeId || '')
    };
  }

  function timestamp(value, code = 'asset_timestamp_invalid') {
    const result = String(value || '').trim();
    if (result.length > 100) throw issue(code, 'Timestamp de asset inválido.');
    return result;
  }

  function normalizeBytes(value) {
    const bytes = Number(value || 0);
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > 100_000_000) throw issue('asset_bytes_invalid', 'Tamanho de asset inválido.');
    return bytes;
  }

  function normalizeRecord(raw, folders = [], index = -1, { validateFolder = true } = {}) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw issue('asset_record_invalid', `Asset inválido${index >= 0 ? ` no índice ${index}` : ''}.`, { index });
    }
    const sha256 = requireHash(raw.sha256 || raw.id);
    const id = String(raw.id || `sha256/${sha256}`).trim();
    if (id !== `sha256/${sha256}`) throw issue('asset_id_mismatch', `ID não corresponde ao hash ${sha256}.`, { id, sha256 });
    const folderId = raw.folderId == null || raw.folderId === '' ? null : String(raw.folderId).trim();
    if (folderId && validateFolder && !folders.some(folder => folder.id === folderId)) {
      throw issue('asset_folder_invalid', `Asset ${id} referencia uma pasta inexistente.`, { id, folderId });
    }
    const label = String(raw.label || '').trim();
    if (label.length > MAX_LABEL_LENGTH) throw issue('asset_label_invalid', 'Label de asset excede o limite.');
    const contentType = String(raw.contentType || '').trim().toLowerCase();
    if (contentType.length > 120) throw issue('asset_content_type_invalid', 'Content-Type de asset inválido.');
    return {
      id,
      sha256,
      folderId,
      label,
      contentType,
      bytes: normalizeBytes(raw.bytes),
      createdAt: timestamp(raw.createdAt),
      updatedAt: timestamp(raw.updatedAt)
    };
  }

  function normalizeV1(raw) {
    const folders = FolderTree.normalize(raw?.folders || []);
    if (!Array.isArray(raw?.assets)) throw issue('asset_snapshot_assets_invalid', 'assets deve ser um array.');
    if (raw.assets.length > MAX_ASSETS) throw issue('asset_snapshot_too_large', `Limite de ${MAX_ASSETS} assets excedido.`);
    const ids = new Set();
    const assets = raw.assets.map((item, index) => {
      const record = normalizeRecord(item, folders, index);
      if (ids.has(record.id)) throw issue('asset_id_duplicate', `Asset duplicado: ${record.id}.`, { id: record.id });
      ids.add(record.id);
      return record;
    });
    return { schemaVersion: SCHEMA_VERSION, ...metadata(raw), folders, assets };
  }

  function read(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw issue('asset_snapshot_invalid', 'Snapshot de assets inválido.');
    const version = Number(raw.schemaVersion || SCHEMA_VERSION);
    if (version !== SCHEMA_VERSION) throw issue('asset_snapshot_version', `Versão de AssetIndexSnapshot não suportada: ${version}.`, { version });
    return { snapshot: normalizeV1(raw), migratedFromVersion: null };
  }

  function forWrite({ revision = 0, updatedAt = '', writeId = '', folders = [], assets = [] } = {}) {
    return normalizeV1({ schemaVersion: SCHEMA_VERSION, revision, updatedAt, writeId, folders, assets });
  }

  function fromManaged(value, { folderId = null, label = '', contentType = '', bytes = 0, createdAt = '', updatedAt = '' } = {}) {
    const sha256 = requireHash(value);
    return normalizeRecord({
      id: `sha256/${sha256}`,
      sha256,
      folderId,
      label,
      contentType,
      bytes,
      createdAt,
      updatedAt
    }, [], -1, { validateFolder: false });
  }

  NS.AssetIndexSnapshot = Object.freeze({
    SCHEMA_VERSION,
    MAX_ASSETS,
    MAX_LABEL_LENGTH,
    hashFrom,
    idFrom,
    urlFrom,
    normalizeRecord,
    normalizeV1,
    read,
    forWrite,
    fromManaged
  });
})();
