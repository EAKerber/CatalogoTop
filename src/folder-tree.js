(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};

  const MAX_FOLDERS = 10000;
  const MAX_NAME_LENGTH = 180;
  const MAX_ID_LENGTH = 180;

  function issue(code, message, detail = {}) {
    const error = new Error(message || code);
    error.code = code;
    Object.assign(error, detail);
    return error;
  }

  function displayName(value) {
    return String(value ?? '')
      .normalize('NFKC')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function nameKey(value) {
    return displayName(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function normalizeId(value) {
    return String(value ?? '').trim();
  }

  function normalizedFolders(value) {
    if (!Array.isArray(value)) throw issue('folder_tree_invalid', 'folders deve ser um array.');
    if (value.length > MAX_FOLDERS) throw issue('folder_tree_too_large', `Limite de ${MAX_FOLDERS} pastas excedido.`);

    const folders = value.map((raw, index) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw issue('folder_invalid', `Pasta inválida no índice ${index}.`, { index });
      }
      const id = normalizeId(raw.id);
      const parentId = raw.parentId == null || String(raw.parentId).trim() === '' ? null : normalizeId(raw.parentId);
      const name = displayName(raw.name);
      if (!id || id.length > MAX_ID_LENGTH) throw issue('folder_id_invalid', `ID de pasta inválido no índice ${index}.`, { index, id });
      if (!name || name.length > MAX_NAME_LENGTH) throw issue('folder_name_invalid', `Nome de pasta inválido no índice ${index}.`, { index, id });
      if (parentId && parentId.length > MAX_ID_LENGTH) throw issue('folder_parent_invalid', `parentId inválido para ${id}.`, { id, parentId });
      return { id, parentId, name };
    });

    const byId = new Map();
    for (const folder of folders) {
      if (byId.has(folder.id)) throw issue('folder_id_duplicate', `ID de pasta duplicado: ${folder.id}.`, { id: folder.id });
      byId.set(folder.id, folder);
    }

    const siblingNamesByParent = new Map();
    for (const folder of folders) {
      if (folder.parentId && !byId.has(folder.parentId)) {
        throw issue('folder_parent_missing', `Pasta pai ausente para ${folder.id}.`, { id: folder.id, parentId: folder.parentId });
      }
      if (folder.parentId === folder.id) throw issue('folder_cycle', `Pasta ${folder.id} não pode ser pai de si mesma.`, { id: folder.id });
      const parentKey = folder.parentId;
      if (!siblingNamesByParent.has(parentKey)) siblingNamesByParent.set(parentKey, new Set());
      const siblingKey = nameKey(folder.name);
      if (siblingNamesByParent.get(parentKey).has(siblingKey)) {
        throw issue('folder_sibling_name_duplicate', `Nome de pasta duplicado entre irmãos: ${folder.name}.`, { id: folder.id, parentId: folder.parentId, name: folder.name });
      }
      siblingNamesByParent.get(parentKey).add(siblingKey);
    }

    const state = new Map();
    for (const folder of folders) {
      if (state.get(folder.id) === 2) continue;
      let currentId = folder.id;
      const chain = [];
      while (currentId && state.get(currentId) !== 2) {
        if (state.get(currentId) === 1) throw issue('folder_cycle', `Ciclo detectado na pasta ${currentId}.`, { id: currentId });
        state.set(currentId, 1);
        chain.push(currentId);
        currentId = byId.get(currentId)?.parentId || '';
      }
      for (const id of chain) state.set(id, 2);
    }

    return folders;
  }

  function index(value) {
    const folders = normalizedFolders(value);
    const byId = new Map(folders.map(folder => [folder.id, folder]));
    const children = new Map();
    for (const folder of folders) {
      const key = folder.parentId || '';
      if (!children.has(key)) children.set(key, []);
      children.get(key).push(folder);
    }
    return { folders, byId, children };
  }

  function requireFolder(byId, id) {
    const key = normalizeId(id);
    const folder = byId.get(key);
    if (!folder) throw issue('folder_not_found', `Pasta não encontrada: ${key}.`, { id: key });
    return folder;
  }

  function childrenOf(value, id = null) {
    const data = index(value);
    const parentId = id == null || String(id).trim() === '' ? '' : requireFolder(data.byId, id).id;
    return (data.children.get(parentId) || []).map(folder => ({ ...folder }));
  }

  function descendantsOf(value, id) {
    const data = index(value);
    const root = requireFolder(data.byId, id);
    const result = [];
    const queue = [...(data.children.get(root.id) || [])];
    while (queue.length) {
      const folder = queue.shift();
      result.push({ ...folder });
      queue.push(...(data.children.get(folder.id) || []));
    }
    return result;
  }

  function ancestorsOf(value, id) {
    const data = index(value);
    let current = requireFolder(data.byId, id);
    const reverse = [];
    while (current.parentId) {
      current = requireFolder(data.byId, current.parentId);
      reverse.push({ ...current });
    }
    return reverse.reverse();
  }

  function pathOf(value, id) {
    const data = index(value);
    const current = requireFolder(data.byId, id);
    return ancestorsOf(data.folders, current.id).concat([{ ...current }]);
  }

  function contains(value, ancestorId, candidateId) {
    const data = index(value);
    const ancestor = requireFolder(data.byId, ancestorId);
    let current = requireFolder(data.byId, candidateId);
    if (ancestor.id === current.id) return true;
    while (current.parentId) {
      if (current.parentId === ancestor.id) return true;
      current = requireFolder(data.byId, current.parentId);
    }
    return false;
  }

  function createFolder(value, folder) {
    const next = normalizedFolders(value).map(item => ({ ...item }));
    return normalizedFolders(next.concat([folder]));
  }

  function renameFolder(value, id, name) {
    const targetId = normalizeId(id);
    const next = normalizedFolders(value).map(item => item.id === targetId ? { ...item, name } : { ...item });
    if (!next.some(item => item.id === targetId)) throw issue('folder_not_found', `Pasta não encontrada: ${targetId}.`, { id: targetId });
    return normalizedFolders(next);
  }

  function moveFolder(value, id, parentId) {
    const targetId = normalizeId(id);
    const nextParent = parentId == null || String(parentId).trim() === '' ? null : normalizeId(parentId);
    const current = normalizedFolders(value);
    if (!current.some(item => item.id === targetId)) throw issue('folder_not_found', `Pasta não encontrada: ${targetId}.`, { id: targetId });
    if (nextParent && !current.some(item => item.id === nextParent)) throw issue('folder_parent_missing', `Pasta pai ausente: ${nextParent}.`, { id: targetId, parentId: nextParent });
    if (nextParent && contains(current, targetId, nextParent)) throw issue('folder_cycle', `Mover ${targetId} para ${nextParent} criaria um ciclo.`, { id: targetId, parentId: nextParent });
    return normalizedFolders(current.map(item => item.id === targetId ? { ...item, parentId: nextParent } : { ...item }));
  }

  function deleteEmptyFolder(value, id, { occupiedFolderIds = [] } = {}) {
    const targetId = normalizeId(id);
    const current = normalizedFolders(value);
    if (!current.some(item => item.id === targetId)) throw issue('folder_not_found', `Pasta não encontrada: ${targetId}.`, { id: targetId });
    if (current.some(item => item.parentId === targetId)) throw issue('folder_not_empty', `Pasta ${targetId} contém subpastas.`, { id: targetId });
    const occupied = new Set((Array.isArray(occupiedFolderIds) ? occupiedFolderIds : []).map(value => normalizeId(value)).filter(Boolean));
    if (occupied.has(targetId)) throw issue('folder_not_empty', `Pasta ${targetId} contém produtos.`, { id: targetId });
    return normalizedFolders(current.filter(item => item.id !== targetId));
  }

  NS.FolderTree = Object.freeze({
    MAX_FOLDERS,
    MAX_NAME_LENGTH,
    MAX_ID_LENGTH,
    displayName,
    nameKey,
    normalize: normalizedFolders,
    childrenOf,
    descendantsOf,
    ancestorsOf,
    pathOf,
    contains,
    createFolder,
    renameFolder,
    moveFolder,
    deleteEmptyFolder
  });
})();
