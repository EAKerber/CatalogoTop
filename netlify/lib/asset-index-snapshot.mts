import { validateProductFolders } from './product-folders.mts';

export const ASSET_INDEX_SNAPSHOT_VERSION = 1;
export const MAX_ASSET_INDEX_RECORDS = 5000;
export const MAX_ASSET_LABEL_LENGTH = 300;

const HASH_RE = /^[a-f0-9]{64}$/;
const ID_RE = /^sha256\/([a-f0-9]{64})$/;

type AssetIndexRecord = {
  id: string;
  sha256: string;
  folderId: string | null;
  label: string;
  contentType: string;
  bytes: number;
  createdAt: string;
  updatedAt: string;
};

function validTrimmed(value: unknown, max: number, required = false) {
  if (typeof value !== 'string' || value !== value.trim() || value.length > max) return false;
  return !required || Boolean(value);
}

function folderIds(folders: unknown) {
  if (!Array.isArray(folders)) return new Set<string>();
  return new Set(folders
    .filter(folder => folder && typeof folder === 'object' && !Array.isArray(folder))
    .map(folder => String((folder as Record<string, unknown>).id || ''))
    .filter(Boolean));
}

export function hashFromManagedRef(value: unknown) {
  const text = String(value || '').trim().toLowerCase();
  if (HASH_RE.test(text)) return text;
  const id = text.match(ID_RE);
  if (id) return id[1];
  const url = text.match(/^\/api\/assets\/sha256\/([a-f0-9]{64})$/);
  return url?.[1] || '';
}

export function validateAssetIndexSnapshot(folders: unknown, assets: unknown) {
  const folderError = validateProductFolders(folders, []);
  if (folderError) return folderError;
  if (!Array.isArray(assets)) return 'assets deve ser um array.';
  if (assets.length > MAX_ASSET_INDEX_RECORDS) return `Limite de ${MAX_ASSET_INDEX_RECORDS} assets excedido.`;

  const knownFolders = folderIds(folders);
  const ids = new Set<string>();
  for (let index = 0; index < assets.length; index += 1) {
    const raw = assets[index];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return `Asset inválido no índice ${index}.`;
    const item = raw as AssetIndexRecord;
    const hash = String(item.sha256 || '').toLowerCase();
    if (!HASH_RE.test(hash) || item.sha256 !== hash) return `Asset no índice ${index} possui sha256 inválido.`;
    if (item.id !== `sha256/${hash}`) return `Asset ${item.id || index} possui id incompatível com sha256.`;
    if (ids.has(item.id)) return `Asset duplicado: ${item.id}.`;
    ids.add(item.id);
    if (item.folderId != null) {
      if (!validTrimmed(item.folderId, 180, true) || !knownFolders.has(item.folderId)) return `Asset ${item.id} referencia folderId inexistente.`;
    }
    if (!validTrimmed(item.label, MAX_ASSET_LABEL_LENGTH)) return `Asset ${item.id} possui label inválido.`;
    if (!validTrimmed(item.contentType, 120)) return `Asset ${item.id} possui contentType inválido.`;
    if (!Number.isSafeInteger(Number(item.bytes)) || Number(item.bytes) < 0 || Number(item.bytes) > 100_000_000) return `Asset ${item.id} possui bytes inválido.`;
    if (!validTrimmed(item.createdAt, 100) || !validTrimmed(item.updatedAt, 100)) return `Asset ${item.id} possui metadata temporal inválida.`;
  }
  return '';
}
