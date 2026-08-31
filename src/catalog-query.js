(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const FolderTree = NS.FolderTree;
  if (!FolderTree) return;

  function normalizeText(value) {
    return String(value ?? '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  }

  function scopedFolderIds(folders, folderId, { recursive = true } = {}) {
    if (folderId == null || String(folderId).trim() === '') return null;
    const id = String(folderId).trim();
    FolderTree.pathOf(folders, id);
    const ids = new Set([id]);
    if (recursive) FolderTree.descendantsOf(folders, id).forEach(folder => ids.add(folder.id));
    return ids;
  }

  function pathText(folders, folderId) {
    if (!folderId) return '';
    return FolderTree.pathOf(folders, folderId).map(folder => folder.name).join(' / ');
  }

  function matchScore(record, folders, text) {
    const needle = normalizeText(text);
    if (!needle) return 0;

    const title = normalizeText(record?.catalog?.title);
    const path = normalizeText(pathText(folders, record?.folderId));
    const ids = normalizeText(Array.isArray(record?.selectedIds) ? record.selectedIds.join(' ') : '');

    if (title === needle) return 0;
    if (title.startsWith(needle)) return 1;
    if (title.includes(needle)) return 2;
    if (path.includes(needle)) return 3;
    if (ids.includes(needle)) return 4;
    return null;
  }

  function query({ catalogs = [], folders = [], folderId = null, recursive = true, text = '' } = {}) {
    const source = Array.isArray(catalogs) ? catalogs : [];
    const scope = scopedFolderIds(folders, folderId, { recursive });
    const needle = normalizeText(text);

    return source
      .map((record, index) => ({
        record,
        index,
        score: scope && !scope.has(String(record?.folderId || '')) ? null : matchScore(record, folders, needle)
      }))
      .filter(entry => entry.score !== null)
      .sort((left, right) => left.score - right.score || left.index - right.index)
      .map(entry => entry.record);
  }

  NS.CatalogQuery = Object.freeze({
    normalizeText,
    scopedFolderIds,
    pathText,
    matchScore,
    query
  });
})();