(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const FolderTree = NS.FolderTree;
  if (!FolderTree) return;

  function normalizeText(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function folderPath(folders, folderId) {
    if (!folderId) return '';
    try { return FolderTree.pathOf(folders, folderId).map(folder => folder.name).join(' / '); }
    catch { return ''; }
  }

  function scopeFolderIds(folders, folderId, recursive = true) {
    if (!folderId) return null;
    const ids = new Set([folderId]);
    if (recursive) FolderTree.descendantsOf(folders, folderId).forEach(folder => ids.add(folder.id));
    return ids;
  }

  function matchesUsage(asset, usage) {
    const used = Array.isArray(asset.usages) && asset.usages.length > 0;
    if (usage === 'used') return used;
    if (usage === 'unused') return !used;
    return true;
  }

  function searchText(asset, folders) {
    const usages = Array.isArray(asset.usages) ? asset.usages : [];
    return normalizeText([
      asset.label,
      asset.sha256,
      asset.contentType,
      folderPath(folders, asset.folderId),
      ...usages.flatMap(usage => [usage.ownerLabel, usage.ownerId, usage.field, usage.productId])
    ].join(' '));
  }

  function query({ assets = [], folders = [], folderId = null, unfiled = false, recursive = true, usage = 'all', text = '' } = {}) {
    const normalizedFolders = FolderTree.normalize(folders);
    const folderIds = unfiled ? null : scopeFolderIds(normalizedFolders, folderId, recursive);
    const needle = normalizeText(text);
    return (Array.isArray(assets) ? assets : []).filter(asset => {
      const assetFolderId = asset?.folderId == null || asset.folderId === '' ? null : String(asset.folderId);
      if (unfiled && assetFolderId !== null) return false;
      if (!unfiled && folderIds && !folderIds.has(assetFolderId)) return false;
      if (!matchesUsage(asset || {}, usage)) return false;
      if (needle && !searchText(asset || {}, normalizedFolders).includes(needle)) return false;
      return true;
    });
  }

  NS.AssetQuery = Object.freeze({ normalizeText, folderPath, query });
})();
