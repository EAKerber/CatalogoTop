(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const FolderTree = NS.FolderTree;
  const Composition = NS.Composition;
  if (!FolderTree || !Composition) return;

  const SCHEMA_VERSION = 1;
  const MAX_CATALOGS = 1000;
  const MAX_SELECTED_IDS = 5000;
  const MAX_ID_LENGTH = 180;
  const MAX_TITLE_LENGTH = 300;

  function issue(code, message, detail = {}) {
    const error = new Error(message || code);
    error.code = code;
    Object.assign(error, detail);
    return error;
  }

  function metadata(raw) {
    const revision = Number(raw?.revision);
    return {
      revision: Number.isInteger(revision) && revision >= 0 ? revision : 0,
      updatedAt: String(raw?.updatedAt || ''),
      writeId: String(raw?.writeId || '')
    };
  }

  function requireId(value, code, label) {
    const id = String(value || '').trim();
    if (!id || id.length > MAX_ID_LENGTH) throw issue(code, `${label} inválido.`);
    return id;
  }

  function timestamp(value, fallback = '') {
    const result = String(value || fallback || '').trim();
    if (result.length > 100) throw issue('catalog_timestamp_invalid', 'Timestamp de catálogo inválido.');
    return result;
  }

  function dateOverride(value) {
    const result = String(value || '').trim();
    if (!result) return '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw issue('catalog_date_override_invalid', 'Override de data inválido.');
    return result;
  }

  function normalizeSelectedIds(value) {
    if (!Array.isArray(value)) throw issue('catalog_selected_ids_invalid', 'selectedIds deve ser um array.');
    if (value.length > MAX_SELECTED_IDS) throw issue('catalog_selected_ids_too_large', `Limite de ${MAX_SELECTED_IDS} referências excedido.`);
    const seen = new Set();
    return value.map((raw, index) => {
      const id = requireId(raw, 'catalog_selected_id_invalid', `selectedIds[${index}]`);
      if (seen.has(id)) throw issue('catalog_selected_id_duplicate', `selectedIds contém referência duplicada: ${id}.`, { productId: id });
      seen.add(id);
      return id;
    });
  }

  function normalizeCatalog(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw issue('catalog_content_invalid', 'Conteúdo de catálogo inválido.');
    const title = String(value.title || '').trim();
    if (!title || title.length > MAX_TITLE_LENGTH) throw issue('catalog_title_invalid', 'Título de catálogo inválido.');
    const templateId = String(value.templateId || 'technical').trim();
    if (!templateId || templateId.length > 80) throw issue('catalog_template_invalid', 'Template de catálogo inválido.');
    return {
      title,
      templateId,
      showPrices: value.showPrices !== false,
      dateOverride: dateOverride(value.dateOverride),
      createdAt: timestamp(value.createdAt),
      presentation: Composition.normalizePresentation(value.presentation || {})
    };
  }

  function normalizeRecord(raw, folders = [], index = -1, { validateFolder = true } = {}) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw issue('catalog_record_invalid', `Catálogo inválido${index >= 0 ? ` no índice ${index}` : ''}.`, { index });
    }
    const id = requireId(raw.id, 'catalog_id_invalid', 'ID de catálogo');
    const folderId = raw.folderId == null || raw.folderId === '' ? null : requireId(raw.folderId, 'catalog_folder_invalid', 'folderId de catálogo');
    if (folderId && validateFolder && !folders.some(folder => folder.id === folderId)) {
      throw issue('catalog_folder_invalid', `Catálogo ${id} referencia uma pasta inexistente.`, { catalogId: id, folderId });
    }
    return {
      id,
      folderId,
      createdAt: timestamp(raw.createdAt),
      updatedAt: timestamp(raw.updatedAt),
      selectedIds: normalizeSelectedIds(raw.selectedIds || []),
      catalog: normalizeCatalog(raw.catalog || {})
    };
  }

  function normalizeV1(raw) {
    const folders = FolderTree.normalize(raw?.folders || []);
    if (!Array.isArray(raw?.catalogs)) throw issue('catalog_snapshot_catalogs_invalid', 'catalogs deve ser um array.');
    if (raw.catalogs.length > MAX_CATALOGS) throw issue('catalog_snapshot_too_large', `Limite de ${MAX_CATALOGS} catálogos excedido.`);
    const ids = new Set();
    const catalogs = raw.catalogs.map((catalog, index) => {
      const normalized = normalizeRecord(catalog, folders, index);
      if (ids.has(normalized.id)) throw issue('catalog_id_duplicate', `ID de catálogo duplicado: ${normalized.id}.`, { catalogId: normalized.id });
      ids.add(normalized.id);
      return normalized;
    });
    return {
      schemaVersion: SCHEMA_VERSION,
      ...metadata(raw),
      folders,
      catalogs
    };
  }

  function read(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw issue('catalog_snapshot_invalid', 'Snapshot de catálogos inválido.');
    const version = Number(raw.schemaVersion || SCHEMA_VERSION);
    if (version !== SCHEMA_VERSION) throw issue('catalog_snapshot_version', `Versão de CatalogSnapshot não suportada: ${version}.`, { version });
    return { snapshot: normalizeV1(raw), migratedFromVersion: null };
  }

  function forWrite({ revision = 0, updatedAt = '', writeId = '', folders = [], catalogs = [] } = {}) {
    return normalizeV1({ schemaVersion: SCHEMA_VERSION, revision, updatedAt, writeId, folders, catalogs });
  }

  function fromState(state, { id, folderId = null, createdAt = '', updatedAt = '', now = '' } = {}) {
    const current = state && typeof state === 'object' ? state : {};
    const currentCatalog = current.catalog && typeof current.catalog === 'object' ? current.catalog : {};
    const stamp = timestamp(now || new Date().toISOString());
    return normalizeRecord({
      id,
      folderId,
      createdAt: createdAt || stamp,
      updatedAt: updatedAt || stamp,
      selectedIds: Array.isArray(current.selectedIds) ? current.selectedIds : [],
      catalog: {
        title: currentCatalog.title || 'Categoria',
        templateId: currentCatalog.templateId || 'technical',
        showPrices: currentCatalog.showPrices !== false,
        dateOverride: currentCatalog.dateOverride || '',
        createdAt: currentCatalog.createdAt || stamp,
        presentation: currentCatalog.presentation || {}
      }
    }, [], -1, { validateFolder: false });
  }

  function applyToState(state, record) {
    const current = state && typeof state === 'object' ? state : {};
    const normalized = normalizeRecord(record, [], -1, { validateFolder: false });
    return {
      ...current,
      selectedIds: normalized.selectedIds.slice(),
      catalog: {
        ...(current.catalog && typeof current.catalog === 'object' ? current.catalog : {}),
        ...normalized.catalog,
        presentation: Composition.normalizePresentation(normalized.catalog.presentation)
      }
    };
  }

  function duplicate(record, { id, now = '', title = '' } = {}) {
    const normalized = normalizeRecord(record, [], -1, { validateFolder: false });
    const stamp = timestamp(now || new Date().toISOString());
    return normalizeRecord({
      ...normalized,
      id: requireId(id, 'catalog_id_invalid', 'ID de catálogo'),
      createdAt: stamp,
      updatedAt: stamp,
      selectedIds: normalized.selectedIds.slice(),
      catalog: {
        ...normalized.catalog,
        title: String(title || `${normalized.catalog.title} (cópia)`).trim(),
        presentation: Composition.normalizePresentation(normalized.catalog.presentation)
      }
    }, [], -1, { validateFolder: false });
  }

  function contentSignature(record) {
    const normalized = normalizeRecord(record, [], -1, { validateFolder: false });
    const { createdAt: _derivedCreatedAt, ...catalogContent } = normalized.catalog;
    return JSON.stringify({ selectedIds: normalized.selectedIds, catalog: catalogContent });
  }

  NS.CatalogSnapshot = Object.freeze({
    SCHEMA_VERSION,
    MAX_CATALOGS,
    MAX_SELECTED_IDS,
    read,
    normalizeV1,
    normalizeRecord,
    forWrite,
    fromState,
    applyToState,
    duplicate,
    contentSignature
  });
})();
