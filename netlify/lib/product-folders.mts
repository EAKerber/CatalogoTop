export const PRODUCT_SNAPSHOT_VERSION = 2;
export const MAX_PRODUCT_FOLDERS = 10_000;
export const MAX_FOLDER_ID_LENGTH = 180;
export const MAX_FOLDER_NAME_LENGTH = 180;

type FolderRecord = {
  id: string;
  parentId: string | null;
  name: string;
};

function displayName(value: unknown) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ');
}

function nameKey(value: unknown) {
  return displayName(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizedFolders(value: unknown): FolderRecord[] | string {
  if (!Array.isArray(value)) return 'folders deve ser um array.';
  if (value.length > MAX_PRODUCT_FOLDERS) return `Limite de ${MAX_PRODUCT_FOLDERS} pastas excedido.`;

  const folders: FolderRecord[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const raw = value[index];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return `Pasta inválida no índice ${index}.`;
    const item = raw as Record<string, unknown>;
    const id = typeof item.id === 'string' ? item.id : '';
    const parentId = item.parentId == null ? null : (typeof item.parentId === 'string' ? item.parentId : '');
    const name = typeof item.name === 'string' ? item.name : '';
    if (!id || id !== id.trim() || id.length > MAX_FOLDER_ID_LENGTH) return `ID de pasta inválido no índice ${index}.`;
    if (parentId !== null && (!parentId || parentId !== parentId.trim() || parentId.length > MAX_FOLDER_ID_LENGTH)) return `parentId inválido para ${id}.`;
    if (!name || displayName(name) !== name || name.length > MAX_FOLDER_NAME_LENGTH) return `Nome de pasta inválido para ${id}.`;
    folders.push({ id, parentId, name });
  }

  const byId = new Map<string, FolderRecord>();
  for (const folder of folders) {
    if (byId.has(folder.id)) return `ID de pasta duplicado: ${folder.id}.`;
    byId.set(folder.id, folder);
  }

  const siblings = new Map<string | null, Set<string>>();
  for (const folder of folders) {
    if (folder.parentId && !byId.has(folder.parentId)) return `Pasta pai ausente para ${folder.id}.`;
    if (folder.parentId === folder.id) return `Ciclo de pasta detectado em ${folder.id}.`;
    if (!siblings.has(folder.parentId)) siblings.set(folder.parentId, new Set());
    const key = nameKey(folder.name);
    if (siblings.get(folder.parentId)!.has(key)) return `Nome de pasta duplicado entre irmãos: ${folder.name}.`;
    siblings.get(folder.parentId)!.add(key);
  }

  const state = new Map<string, number>();
  for (const folder of folders) {
    if (state.get(folder.id) === 2) continue;
    let currentId = folder.id;
    const chain: string[] = [];
    while (currentId && state.get(currentId) !== 2) {
      if (state.get(currentId) === 1) return `Ciclo de pasta detectado em ${currentId}.`;
      state.set(currentId, 1);
      chain.push(currentId);
      currentId = byId.get(currentId)?.parentId || '';
    }
    for (const id of chain) state.set(id, 2);
  }

  return folders;
}

function legacyProjection(byId: Map<string, FolderRecord>, folderId: string) {
  const names: string[] = [];
  let current = byId.get(folderId);
  while (current) {
    names.push(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  names.reverse();
  return {
    category: names[0] || 'Sem categoria',
    subcategory: names.slice(1).join(' / ')
  };
}

export function validateProductFolders(foldersValue: unknown, productsValue: unknown) {
  const normalized = normalizedFolders(foldersValue);
  if (typeof normalized === 'string') return normalized;
  if (!Array.isArray(productsValue)) return 'products deve ser um array.';

  const byId = new Map(normalized.map(folder => [folder.id, folder]));
  for (let index = 0; index < productsValue.length; index += 1) {
    const raw = productsValue[index];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const product = raw as Record<string, unknown>;
    const folderId = typeof product.folderId === 'string' ? product.folderId.trim() : '';
    if (!folderId || !byId.has(folderId)) return `Produto no índice ${index} referencia folderId inexistente.`;
    const projection = legacyProjection(byId, folderId);
    if (String(product.category || '') !== projection.category || String(product.subcategory || '') !== projection.subcategory) {
      return `Produto no índice ${index} possui category/subcategory divergentes de folderId.`;
    }
  }
  return '';
}
