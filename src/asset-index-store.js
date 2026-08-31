(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const { IndexedCache, AssetIndexSnapshot, ProductStore, FolderTree } = NS;
  if (!IndexedCache || !AssetIndexSnapshot || !ProductStore || !FolderTree) return;

  let revision = 0;
  let snapshot = AssetIndexSnapshot.forWrite();
  let bootstrapped = false;
  let publishing = false;
  let pendingWrite = false;
  let conflict = false;

  function notify(detail = {}) {
    window.dispatchEvent(new CustomEvent('catalogotop:asset-index-updated', { detail }));
  }

  function uuid() {
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function candidate({ folders = snapshot.folders, assets = snapshot.assets } = {}) {
    return AssetIndexSnapshot.forWrite({ revision, folders, assets });
  }

  function requireFolder(folderId) {
    if (folderId == null || String(folderId).trim() === '') return null;
    const id = String(folderId).trim();
    if (!snapshot.folders.some(folder => folder.id === id)) {
      const error = new Error(`Pasta de imagem não encontrada: ${id}.`);
      error.code = 'asset_folder_invalid';
      throw error;
    }
    return id;
  }

  async function fetchSnapshot() {
    const response = await fetch('/api/asset-index', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error(`Falha ao carregar índice de imagens (${response.status}).`);
    return response.json();
  }

  async function cachedSnapshot() {
    const cached = await IndexedCache.getAssetIndexSnapshot?.();
    if (!cached) return null;
    try { return { raw: cached, snapshot: AssetIndexSnapshot.read(cached).snapshot }; }
    catch (error) { console.warn('Índice de imagens em cache incompatível:', error); return null; }
  }

  async function ensureSession() {
    if (ProductStore.isWritable?.()) return true;
    return Boolean(await ProductStore.unlock?.());
  }

  async function putSnapshot(nextCandidate) {
    const writeId = uuid();
    const outgoing = AssetIndexSnapshot.forWrite({ revision, writeId, folders: nextCandidate.folders, assets: nextCandidate.assets });
    const response = await fetch('/api/asset-index', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedRevision: revision, writeId, folders: outgoing.folders, assets: outgoing.assets })
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) { const error = new Error('write_session_required'); error.code = 'write_session_required'; throw error; }
    if (response.status === 409) { const error = new Error('revision_conflict'); error.code = 'revision_conflict'; error.currentRevision = payload.currentRevision; throw error; }
    if (!response.ok) throw new Error(payload.message || payload.error || `Falha ao salvar índice de imagens (${response.status}).`);
    return AssetIndexSnapshot.read(payload).snapshot;
  }

  async function publishCandidate(nextCandidate) {
    if (publishing || conflict) {
      if (conflict) alert('Há um conflito de revisão no índice de imagens. Recarregue antes de salvar novamente.');
      return false;
    }
    publishing = true;
    snapshot = nextCandidate;
    pendingWrite = true;
    await IndexedCache.setAssetIndexSnapshot?.({ ...nextCandidate, pendingWrite: true });
    notify({ type: 'asset-index-local-change' });
    try {
      if (!await ensureSession()) return false;
      let remote;
      try { remote = await putSnapshot(nextCandidate); }
      catch (error) {
        if (error.code === 'write_session_required') {
          if (!await ensureSession()) return false;
          remote = await putSnapshot(nextCandidate);
        } else throw error;
      }
      revision = Number(remote.revision) || revision + 1;
      snapshot = remote;
      pendingWrite = false;
      conflict = false;
      await IndexedCache.setAssetIndexSnapshot?.(remote);
      notify({ type: 'asset-index-saved', revision });
      return true;
    } catch (error) {
      if (error.code === 'revision_conflict') {
        conflict = true;
        await IndexedCache.setAssetIndexSnapshot?.({ ...nextCandidate, pendingWrite: true, conflict: true });
        alert('O índice de imagens mudou em outro navegador. Sua alteração continua no cache local; recarregue antes de decidir como prosseguir.');
        notify({ type: 'asset-index-conflict', currentRevision: error.currentRevision });
        return false;
      }
      console.error(error);
      await IndexedCache.setAssetIndexSnapshot?.({ ...nextCandidate, pendingWrite: true });
      alert(`Não foi possível sincronizar o índice de imagens. A alteração continua no cache local.\n\n${error.message || error}`);
      notify({ type: 'asset-index-offline-change' });
      return false;
    } finally {
      publishing = false;
    }
  }

  async function bootstrap() {
    if (bootstrapped) return;
    bootstrapped = true;
    const cache = await cachedSnapshot();
    try {
      const raw = await fetchSnapshot();
      const remote = AssetIndexSnapshot.read(raw).snapshot;
      revision = Number(remote.revision) || 0;
      if (cache?.raw?.pendingWrite) {
        snapshot = cache.snapshot;
        pendingWrite = true;
        conflict = Number(cache.snapshot.revision) !== revision || Boolean(cache.raw.conflict);
      } else {
        snapshot = remote;
        pendingWrite = false;
        conflict = false;
        await IndexedCache.setAssetIndexSnapshot?.(remote);
      }
      notify({ type: 'asset-index-bootstrapped', revision });
    } catch (error) {
      if (cache) {
        snapshot = cache.snapshot;
        revision = Number(cache.snapshot.revision) || 0;
        pendingWrite = Boolean(cache.raw.pendingWrite);
        conflict = Boolean(cache.raw.conflict);
        notify({ type: 'asset-index-cache-loaded', revision });
      } else {
        console.warn('Índice de imagens indisponível:', error);
        notify({ type: 'asset-index-offline' });
      }
    }
  }

  async function setLabel(assetRef, label, metadata = {}) {
    if (conflict) return false;
    const id = AssetIndexSnapshot.idFrom(assetRef);
    const existing = snapshot.assets.find(record => record.id === id) || null;
    const now = new Date().toISOString();
    const next = AssetIndexSnapshot.fromManaged(assetRef, {
      folderId: existing?.folderId ?? null,
      label: String(label || '').trim(),
      contentType: existing?.contentType || metadata.contentType || '',
      bytes: existing?.bytes || metadata.bytes || 0,
      createdAt: existing?.createdAt || metadata.createdAt || '',
      updatedAt: now
    });
    const assets = snapshot.assets.filter(record => record.id !== id);
    assets.push(next);
    return publishCandidate(candidate({ assets }));
  }

  async function createFolder({ name, parentId = null } = {}) {
    if (conflict) return '';
    const id = `asset-folder-${uuid()}`;
    const folders = FolderTree.createFolder(snapshot.folders, { id, parentId: parentId || null, name });
    if (!await publishCandidate(candidate({ folders }))) return '';
    return id;
  }

  async function renameFolder(id, name) {
    if (conflict) return false;
    const folders = FolderTree.renameFolder(snapshot.folders, id, name);
    return publishCandidate(candidate({ folders }));
  }

  async function moveFolder(id, parentId) {
    if (conflict) return false;
    const folders = FolderTree.moveFolder(snapshot.folders, id, parentId || null);
    return publishCandidate(candidate({ folders }));
  }

  async function deleteEmptyFolder(id) {
    if (conflict) return false;
    const occupiedFolderIds = snapshot.assets.map(asset => asset.folderId).filter(Boolean);
    const folders = FolderTree.deleteEmptyFolder(snapshot.folders, id, { occupiedFolderIds });
    return publishCandidate(candidate({ folders }));
  }

  function recordFromItem(item, folderId) {
    const value = typeof item === 'string' ? { url: item } : (item || {});
    const ref = value.url || value.id || value.sha256;
    const existingId = AssetIndexSnapshot.idFrom(ref);
    const existing = snapshot.assets.find(record => record.id === existingId) || null;
    if (existing) return { ...existing, folderId };
    return AssetIndexSnapshot.fromManaged(ref, {
      folderId,
      label: String(value.label || '').trim(),
      contentType: String(value.contentType || ''),
      bytes: Number(value.bytes || 0),
      createdAt: String(value.createdAt || ''),
      updatedAt: new Date().toISOString()
    });
  }

  async function moveAssets(items, folderId = null) {
    if (conflict) return false;
    const destination = requireFolder(folderId);
    const values = Array.isArray(items) ? items : [];
    if (!values.length) return true;
    const ids = new Set(values.map(item => AssetIndexSnapshot.idFrom(typeof item === 'string' ? item : item?.url || item?.id || item?.sha256)));
    const provided = new Map(values.map(item => {
      const ref = typeof item === 'string' ? item : item?.url || item?.id || item?.sha256;
      return [AssetIndexSnapshot.idFrom(ref), item];
    }));
    const assets = snapshot.assets.filter(record => !ids.has(record.id));
    for (const id of ids) assets.push(recordFromItem(provided.get(id), destination));
    return publishCandidate(candidate({ assets }));
  }

  async function registerAssets(records, { folderId = null } = {}) {
    if (conflict) return false;
    const destination = requireFolder(folderId);
    const values = Array.isArray(records) ? records : [];
    if (!values.length) return true;
    const assets = snapshot.assets.map(record => ({ ...record }));
    const existingIds = new Set(assets.map(record => record.id));
    let changed = false;
    for (const raw of values) {
      const ref = raw?.url || raw?.id || raw?.sha256;
      const id = AssetIndexSnapshot.idFrom(ref);
      if (existingIds.has(id)) continue;
      assets.push(AssetIndexSnapshot.fromManaged(ref, {
        folderId: destination,
        label: String(raw?.label || '').trim(),
        contentType: String(raw?.contentType || ''),
        bytes: Number(raw?.bytes || 0),
        createdAt: String(raw?.createdAt || ''),
        updatedAt: new Date().toISOString()
      }));
      existingIds.add(id);
      changed = true;
    }
    if (!changed) return true;
    return publishCandidate(candidate({ assets }));
  }

  async function reloadRemote({ confirmDiscard = true } = {}) {
    if (confirmDiscard && (pendingWrite || conflict) && !window.confirm('Descartar alterações locais do índice de imagens e recarregar?')) return false;
    try {
      const remote = AssetIndexSnapshot.read(await fetchSnapshot()).snapshot;
      revision = Number(remote.revision) || 0;
      snapshot = remote;
      pendingWrite = false;
      conflict = false;
      await IndexedCache.setAssetIndexSnapshot?.(remote);
      notify({ type: 'asset-index-reloaded', revision });
      return true;
    } catch (error) {
      console.warn(error);
      return false;
    }
  }

  document.addEventListener('DOMContentLoaded', bootstrap);

  NS.AssetIndexStore = Object.freeze({
    bootstrap,
    setLabel,
    createFolder,
    renameFolder,
    moveFolder,
    deleteEmptyFolder,
    moveAssets,
    registerAssets,
    reloadRemote,
    getRevision: () => revision,
    getSnapshot: () => AssetIndexSnapshot.read(snapshot).snapshot,
    hasPendingWrite: () => pendingWrite,
    hasConflict: () => conflict
  });
})();
