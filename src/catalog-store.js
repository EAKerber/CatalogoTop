(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const { Core, IndexedCache, CatalogSnapshot, ProductStore, FolderTree } = NS;
  if (!Core || !IndexedCache || !CatalogSnapshot || !ProductStore || !FolderTree) return;

  const ACTIVE_KEY = 'catalogotop:active-catalog:v1';
  let revision = 0;
  let snapshot = CatalogSnapshot.forWrite();
  let activeCatalogId = '';
  let bootstrapped = false;
  let publishing = false;
  let pendingWrite = false;
  let conflict = false;

  function statusNode() {
    return document.getElementById('catalogSaveStatus');
  }

  function setStatus(label, kind = 'new', title = '') {
    const node = statusNode();
    if (!node) return;
    node.textContent = label;
    node.dataset.saveState = kind;
    node.title = title || label;
  }

  function loadActiveId() {
    try { return String(localStorage.getItem(ACTIVE_KEY) || '').trim(); }
    catch { return ''; }
  }

  function setActiveId(id) {
    activeCatalogId = String(id || '').trim();
    try {
      if (activeCatalogId) localStorage.setItem(ACTIVE_KEY, activeCatalogId);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch (_) {}
  }

  function notifyCatalogsChanged(detail = {}) {
    window.dispatchEvent(new CustomEvent('catalogotop:catalogs-updated', { detail }));
  }

  function recordById(id = activeCatalogId) {
    return snapshot.catalogs.find(record => String(record.id) === String(id)) || null;
  }

  function meaningfulNewSession() {
    const current = Core.getState();
    const catalog = current.catalog || {};
    const presentation = catalog.presentation || {};
    return Boolean(
      current.selectedIds?.length ||
      String(catalog.title || '').trim() !== 'Categoria' ||
      String(catalog.templateId || 'technical') !== 'technical' ||
      catalog.showPrices === false ||
      String(catalog.dateOverride || '') ||
      (Array.isArray(presentation.order) && presentation.order.length) ||
      (Array.isArray(presentation.blocks) && presentation.blocks.length) ||
      (presentation.itemStyles && Object.keys(presentation.itemStyles).length) ||
      (presentation.imageFrames && Object.keys(presentation.imageFrames).length) ||
      (presentation.imageSelections && Object.keys(presentation.imageSelections).length) ||
      (presentation.imageVariants && Object.keys(presentation.imageVariants).length)
    );
  }

  function currentRecord(existing = recordById()) {
    const id = activeCatalogId || existing?.id || `catalog-${Core.uuid()}`;
    return CatalogSnapshot.fromState(Core.getState(), {
      id,
      folderId: existing?.folderId ?? null,
      createdAt: existing?.createdAt || '',
      updatedAt: new Date().toISOString()
    });
  }

  function isDirty() {
    if (pendingWrite || conflict) return true;
    if (!activeCatalogId) return meaningfulNewSession();
    const saved = recordById();
    if (!saved) return true;
    try {
      return CatalogSnapshot.contentSignature(currentRecord(saved)) !== CatalogSnapshot.contentSignature(saved);
    } catch {
      return true;
    }
  }

  function refreshStatus() {
    if (publishing) return setStatus('Salvando…', 'loading');
    if (conflict) return setStatus('Conflito de revisão', 'conflict', 'A Biblioteca de catálogos mudou em outro navegador. Clique para recarregar antes de sobrescrever.');
    if (pendingWrite || isDirty()) return setStatus('Alterações locais', 'dirty', activeCatalogId ? 'O catálogo atual possui alterações não salvas.' : 'Esta sessão ainda não foi salva como catálogo.');
    if (!activeCatalogId) return setStatus('Novo', 'new', 'Sessão de catálogo ainda sem identidade salva.');
    const record = recordById();
    return setStatus(record ? `Salvo · r${revision}` : 'Novo', record ? 'saved' : 'new', record ? `Catálogo salvo: ${record.catalog.title}` : 'Sessão sem recurso salvo.');
  }

  async function cachedSnapshot() {
    const cached = await IndexedCache.getCatalogSnapshot?.();
    if (!cached) return null;
    try {
      return { raw: cached, snapshot: CatalogSnapshot.read(cached).snapshot };
    } catch (error) {
      console.warn('Snapshot de catálogos em cache incompatível:', error);
      return null;
    }
  }

  async function fetchSnapshot() {
    const response = await fetch('/api/catalogs', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error(`Falha ao carregar catálogos (${response.status}).`);
    return response.json();
  }

  function reconcileActiveId() {
    if (activeCatalogId && !recordById(activeCatalogId)) setActiveId('');
  }

  async function bootstrap() {
    if (bootstrapped) return;
    bootstrapped = true;
    activeCatalogId = loadActiveId();
    setStatus('Conectando…', 'loading');
    const cache = await cachedSnapshot();

    try {
      const raw = await fetchSnapshot();
      const remote = CatalogSnapshot.read(raw).snapshot;
      revision = Number(remote.revision) || 0;

      if (cache?.raw?.pendingWrite) {
        snapshot = cache.snapshot;
        pendingWrite = true;
        conflict = Number(cache.snapshot.revision) !== revision || Boolean(cache.raw.conflict);
      } else {
        snapshot = remote;
        pendingWrite = false;
        conflict = false;
        await IndexedCache.setCatalogSnapshot?.(remote);
      }
      reconcileActiveId();
      refreshStatus();
      notifyCatalogsChanged({ type: 'catalogs-bootstrapped' });
    } catch (error) {
      if (cache) {
        snapshot = cache.snapshot;
        revision = Number(cache.snapshot.revision) || 0;
        pendingWrite = Boolean(cache.raw.pendingWrite);
        conflict = Boolean(cache.raw.conflict);
        reconcileActiveId();
        setStatus('Offline · cache local', 'offline', error.message || String(error));
        notifyCatalogsChanged({ type: 'catalogs-cache-loaded' });
      } else {
        setStatus('Offline', 'offline', error.message || String(error));
      }
    }
  }

  async function ensureSession() {
    if (ProductStore.isWritable?.()) return true;
    return Boolean(await ProductStore.unlock?.());
  }

  async function putSnapshot(candidate) {
    const writeId = crypto.randomUUID ? crypto.randomUUID() : `write-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const outgoing = CatalogSnapshot.forWrite({ revision, writeId, folders: candidate.folders, catalogs: candidate.catalogs });
    const response = await fetch('/api/catalogs', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedRevision: revision, writeId, folders: outgoing.folders, catalogs: outgoing.catalogs })
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) {
      const error = new Error('write_session_required'); error.code = 'write_session_required'; throw error;
    }
    if (response.status === 409) {
      const error = new Error('revision_conflict'); error.code = 'revision_conflict'; error.currentRevision = payload.currentRevision; throw error;
    }
    if (!response.ok) throw new Error(payload.message || payload.error || `Falha ao salvar catálogos (${response.status}).`);
    return CatalogSnapshot.read(payload).snapshot;
  }

  async function publishCandidate(candidate, { activateId } = {}) {
    if (publishing || conflict) {
      if (conflict) alert('Há um conflito de revisão na Biblioteca de catálogos. Recarregue antes de salvar novamente.');
      return false;
    }
    publishing = true;
    snapshot = candidate;
    if (activateId !== undefined) setActiveId(activateId);
    pendingWrite = true;
    await IndexedCache.setCatalogSnapshot?.({ ...candidate, pendingWrite: true });
    refreshStatus();
    notifyCatalogsChanged({ type: 'catalogs-local-change' });

    try {
      if (!await ensureSession()) {
        setStatus('Alterações locais', 'dirty', 'A alteração segue no cache local. Salve novamente para liberar a escrita.');
        return false;
      }
      let remote;
      try {
        remote = await putSnapshot(candidate);
      } catch (error) {
        if (error.code === 'write_session_required') {
          if (!await ensureSession()) return false;
          remote = await putSnapshot(candidate);
        } else throw error;
      }
      revision = Number(remote.revision) || revision + 1;
      snapshot = remote;
      pendingWrite = false;
      conflict = false;
      await IndexedCache.setCatalogSnapshot?.(remote);
      notifyCatalogsChanged({ type: 'catalogs-saved', catalogId: activeCatalogId, revision });
      refreshStatus();
      return true;
    } catch (error) {
      if (error.code === 'revision_conflict') {
        conflict = true;
        await IndexedCache.setCatalogSnapshot?.({ ...candidate, pendingWrite: true, conflict: true });
        setStatus('Conflito de revisão', 'conflict');
        alert('Os catálogos foram alterados em outro navegador. Sua alteração continua no cache local; recarregue a Biblioteca de catálogos antes de decidir como prosseguir.');
        return false;
      }
      console.error(error);
      await IndexedCache.setCatalogSnapshot?.({ ...candidate, pendingWrite: true });
      setStatus('Alterações locais', 'dirty', error.message || String(error));
      alert(`Não foi possível sincronizar o catálogo. A alteração continua no cache local.\n\n${error.message || error}`);
      return false;
    } finally {
      publishing = false;
      refreshStatus();
    }
  }

  async function saveCurrent() {
    if (conflict) {
      alert('Recarregue a Biblioteca de catálogos antes de salvar sobre um conflito de revisão.');
      return false;
    }
    const existing = recordById();
    const record = currentRecord(existing);
    const id = record.id;
    const catalogs = snapshot.catalogs.filter(item => String(item.id) !== String(id));
    catalogs.push(record);
    const candidate = CatalogSnapshot.forWrite({ revision, folders: snapshot.folders, catalogs });
    return publishCandidate(candidate, { activateId: id });
  }

  function shouldDiscardCurrent() {
    return !isDirty() || window.confirm('O catálogo atual possui alterações não salvas. Descartar essas alterações e abrir outro catálogo?');
  }

  async function openCatalog(id, { confirmDirty = true } = {}) {
    const record = recordById(id);
    if (!record) return false;
    if (confirmDirty && String(id) !== activeCatalogId && !shouldDiscardCurrent()) return false;
    const nextState = CatalogSnapshot.applyToState(Core.getState(), record);
    Core.setState(nextState);
    setActiveId(record.id);
    pendingWrite = false;
    conflict = false;
    NS.ComposerSelection?.clear?.();
    NS.App?.renderAll?.();
    refreshStatus();
    window.dispatchEvent(new CustomEvent('catalogotop:catalog-opened', { detail: { catalogId: record.id } }));
    return true;
  }

  async function duplicateCatalog(id, { open = true } = {}) {
    const source = recordById(id);
    if (!source) return false;
    if (open && String(id) !== activeCatalogId && isDirty() && !shouldDiscardCurrent()) return false;
    const copy = CatalogSnapshot.duplicate(source, { id: `catalog-${Core.uuid()}` });
    const candidate = CatalogSnapshot.forWrite({ revision, folders: snapshot.folders, catalogs: [...snapshot.catalogs, copy] });
    const ok = await publishCandidate(candidate, { activateId: open ? copy.id : activeCatalogId });
    if (conflict) return false;
    if (open && recordById(copy.id)) {
      const nextState = CatalogSnapshot.applyToState(Core.getState(), copy);
      Core.setState(nextState);
      setActiveId(copy.id);
      NS.ComposerSelection?.clear?.();
      NS.App?.renderAll?.();
      refreshStatus();
      window.dispatchEvent(new CustomEvent('catalogotop:catalog-opened', { detail: { catalogId: copy.id, duplicatedFrom: source.id } }));
    }
    return ok;
  }

  function mutationIds(ids) {
    const values = Array.isArray(ids) ? ids : [ids];
    const normalized = Array.from(new Set(values.map(id => String(id || '').trim()).filter(Boolean)));
    if (!normalized.length) {
      const error = new Error('Selecione ao menos um catálogo.');
      error.code = 'catalog_selection_empty';
      throw error;
    }
    const existing = new Set(snapshot.catalogs.map(record => String(record.id)));
    const missing = normalized.filter(id => !existing.has(id));
    if (missing.length) {
      const error = new Error(`Catálogo não encontrado: ${missing[0]}.`);
      error.code = 'catalog_not_found';
      error.catalogId = missing[0];
      throw error;
    }
    return normalized;
  }

  function destinationFolderId(folderId) {
    const id = folderId == null || String(folderId).trim() === '' ? null : String(folderId).trim();
    if (id) FolderTree.pathOf(snapshot.folders, id);
    return id;
  }

  async function createFolder({ name, parentId = null } = {}) {
    const id = `catalog-folder-${Core.uuid()}`;
    const folders = FolderTree.createFolder(snapshot.folders, { id, parentId: destinationFolderId(parentId), name });
    const candidate = CatalogSnapshot.forWrite({ revision, folders, catalogs: snapshot.catalogs });
    await publishCandidate(candidate);
    return snapshot.folders.some(folder => folder.id === id) ? id : false;
  }

  async function renameFolder(id, name) {
    const folders = FolderTree.renameFolder(snapshot.folders, id, name);
    const candidate = CatalogSnapshot.forWrite({ revision, folders, catalogs: snapshot.catalogs });
    return publishCandidate(candidate);
  }

  async function moveFolder(id, parentId = null) {
    const folders = FolderTree.moveFolder(snapshot.folders, id, destinationFolderId(parentId));
    const candidate = CatalogSnapshot.forWrite({ revision, folders, catalogs: snapshot.catalogs });
    return publishCandidate(candidate);
  }

  async function deleteEmptyFolder(id) {
    const occupiedFolderIds = snapshot.catalogs.map(record => record.folderId).filter(Boolean);
    const folders = FolderTree.deleteEmptyFolder(snapshot.folders, id, { occupiedFolderIds });
    const candidate = CatalogSnapshot.forWrite({ revision, folders, catalogs: snapshot.catalogs });
    return publishCandidate(candidate);
  }

  async function moveCatalogs(ids, folderId = null) {
    const catalogIds = new Set(mutationIds(ids));
    const destination = destinationFolderId(folderId);
    const catalogs = snapshot.catalogs.map(record => catalogIds.has(String(record.id)) ? { ...record, folderId: destination } : record);
    const candidate = CatalogSnapshot.forWrite({ revision, folders: snapshot.folders, catalogs });
    return publishCandidate(candidate);
  }

  async function deleteCatalogs(ids) {
    const catalogIds = new Set(mutationIds(ids));
    const deletingActive = Boolean(activeCatalogId && catalogIds.has(activeCatalogId));
    const catalogs = snapshot.catalogs.filter(record => !catalogIds.has(String(record.id)));
    const candidate = CatalogSnapshot.forWrite({ revision, folders: snapshot.folders, catalogs });
    const ok = await publishCandidate(candidate, deletingActive ? { activateId: '' } : {});
    if (deletingActive && !activeCatalogId) {
      NS.ComposerSelection?.clear?.();
      refreshStatus();
      window.dispatchEvent(new CustomEvent('catalogotop:catalog-opened', { detail: { catalogId: null, deletedResource: true } }));
    }
    return ok;
  }

  function newSession() {
    setActiveId('');
    pendingWrite = false;
    conflict = false;
    Core.resetCatalog();
    NS.ComposerSelection?.clear?.();
    NS.App?.renderAll?.();
    refreshStatus();
    window.dispatchEvent(new CustomEvent('catalogotop:catalog-opened', { detail: { catalogId: null } }));
  }

  function clearActive() {
    setActiveId('');
    pendingWrite = false;
    conflict = false;
    refreshStatus();
  }

  async function reloadRemote({ confirmDiscard = true } = {}) {
    if (confirmDiscard && (pendingWrite || isDirty()) && !window.confirm('Descartar alterações locais de catálogo e recarregar a Biblioteca compartilhada?')) return false;
    try {
      const raw = await fetchSnapshot();
      const remote = CatalogSnapshot.read(raw).snapshot;
      revision = Number(remote.revision) || 0;
      snapshot = remote;
      pendingWrite = false;
      conflict = false;
      reconcileActiveId();
      await IndexedCache.setCatalogSnapshot?.(remote);
      refreshStatus();
      notifyCatalogsChanged({ type: 'catalogs-reloaded' });
      return true;
    } catch (error) {
      setStatus('Offline · cache local', 'offline', error.message || String(error));
      return false;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btnSaveCatalog')?.addEventListener('click', saveCurrent);
    document.getElementById('btnNewCatalog')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!window.confirm('Iniciar um novo catálogo? A base de produtos será preservada e alterações não salvas do catálogo atual serão descartadas.')) return;
      newSession();
    }, true);
    document.getElementById('backupFile')?.addEventListener('change', clearActive, true);
    statusNode()?.addEventListener('click', () => { if (conflict) reloadRemote(); });
    bootstrap();
  });

  window.addEventListener('catalogotop:catalog-rendered', refreshStatus);

  NS.CatalogStore = Object.freeze({
    bootstrap,
    saveCurrent,
    openCatalog,
    duplicateCatalog,
    createFolder,
    renameFolder,
    moveFolder,
    deleteEmptyFolder,
    moveCatalogs,
    deleteCatalogs,
    newSession,
    clearActive,
    reloadRemote,
    isDirty,
    getRevision: () => revision,
    getActiveCatalogId: () => activeCatalogId,
    getSnapshot: () => CatalogSnapshot.read(snapshot).snapshot,
    refreshStatus
  });
})();