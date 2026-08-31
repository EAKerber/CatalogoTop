import { validateProductFolders } from './product-folders.mts';

export const CATALOG_SNAPSHOT_VERSION = 1;
export const MAX_CATALOGS = 1000;
export const MAX_SELECTED_IDS = 5000;
export const MAX_CATALOG_ID_LENGTH = 180;
export const MAX_CATALOG_TITLE_LENGTH = 300;

type FolderRecord = {
  id: string;
  parentId: string | null;
  name: string;
};

function validString(value: unknown, { required = true, max = 180 } = {}) {
  if (typeof value !== 'string') return false;
  if (value !== value.trim()) return false;
  if (required && !value) return false;
  return value.length <= max;
}

function validTimestamp(value: unknown) {
  return typeof value === 'string' && value.length <= 100;
}

function validDateOverride(value: unknown) {
  return value === '' || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function folderIds(folders: unknown) {
  if (!Array.isArray(folders)) return new Set<string>();
  return new Set(folders
    .filter(folder => folder && typeof folder === 'object' && !Array.isArray(folder))
    .map(folder => String((folder as FolderRecord).id || ''))
    .filter(Boolean));
}

function validateSelectedIds(value: unknown, catalogId: string) {
  if (!Array.isArray(value)) return `Catálogo ${catalogId} possui selectedIds inválido.`;
  if (value.length > MAX_SELECTED_IDS) return `Catálogo ${catalogId} excede ${MAX_SELECTED_IDS} referências.`;
  const seen = new Set<string>();
  for (const raw of value) {
    if (!validString(raw, { max: MAX_CATALOG_ID_LENGTH })) return `Catálogo ${catalogId} possui referência de produto inválida.`;
    const id = raw as string;
    if (seen.has(id)) return `Catálogo ${catalogId} possui referência de produto duplicada: ${id}.`;
    seen.add(id);
  }
  return '';
}

function validateCatalogContent(value: unknown, catalogId: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return `Catálogo ${catalogId} possui conteúdo inválido.`;
  const catalog = value as Record<string, unknown>;
  if (!validString(catalog.title, { max: MAX_CATALOG_TITLE_LENGTH })) return `Catálogo ${catalogId} possui título inválido.`;
  if (!validString(catalog.templateId, { max: 80 })) return `Catálogo ${catalogId} possui template inválido.`;
  if (typeof catalog.showPrices !== 'boolean') return `Catálogo ${catalogId} possui showPrices inválido.`;
  if (!validDateOverride(catalog.dateOverride)) return `Catálogo ${catalogId} possui dateOverride inválido.`;
  if (!validTimestamp(catalog.createdAt)) return `Catálogo ${catalogId} possui createdAt editorial inválido.`;
  if (!catalog.presentation || typeof catalog.presentation !== 'object' || Array.isArray(catalog.presentation)) return `Catálogo ${catalogId} possui presentation inválida.`;
  return '';
}

export function validateCatalogSnapshot(folders: unknown, catalogs: unknown) {
  const folderError = validateProductFolders(folders, []);
  if (folderError) return folderError;
  if (!Array.isArray(catalogs)) return 'catalogs deve ser um array.';
  if (catalogs.length > MAX_CATALOGS) return `Limite de ${MAX_CATALOGS} catálogos excedido.`;

  const knownFolders = folderIds(folders);
  const ids = new Set<string>();
  for (let index = 0; index < catalogs.length; index += 1) {
    const raw = catalogs[index];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return `Catálogo inválido no índice ${index}.`;
    const item = raw as Record<string, unknown>;
    if (!validString(item.id, { max: MAX_CATALOG_ID_LENGTH })) return `ID de catálogo inválido no índice ${index}.`;
    const id = item.id as string;
    if (ids.has(id)) return `ID de catálogo duplicado: ${id}.`;
    ids.add(id);

    if (item.folderId != null) {
      if (!validString(item.folderId, { max: MAX_CATALOG_ID_LENGTH }) || !knownFolders.has(item.folderId as string)) {
        return `Catálogo ${id} referencia folderId inexistente.`;
      }
    }
    if (!validTimestamp(item.createdAt) || !validTimestamp(item.updatedAt)) return `Catálogo ${id} possui metadata temporal inválida.`;
    const selectedError = validateSelectedIds(item.selectedIds, id);
    if (selectedError) return selectedError;
    const contentError = validateCatalogContent(item.catalog, id);
    if (contentError) return contentError;
  }

  return '';
}
