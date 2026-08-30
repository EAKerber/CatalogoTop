(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const { Core, IndexedCache, AssetClient, ProductSnapshot } = NS;
  if (!Core || !IndexedCache || !AssetClient || !ProductSnapshot) return;

  let revision = 0;
  let sessionUnlocked = false;
  let migrationNeeded = false;
  let snapshotMigrationPending = false;
  let bootstrapped = false;
  let publishing = false;

  function statusButton() {
    return document.getElementById('productSyncStatus');
  }

  function setStatus(label, kind = 'neutral', title = '') {
    const button = statusButton();
    if (!button) return;
    button.textContent = label;
    button.dataset.syncState = kind;
    button.title = title || label;
  }

  function syncedTitle() {
    const migration = snapshotMigrationPending ? ' Snapshot legado lido de forma compatível; a próxima escrita legítima publicará ProductSnapshot v2.' : '';
    return `Clique para atualizar a base compartilhada.${migration}`;
  }

  function notifyProductsChanged() {
    window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
  }

  function localSnapshot(products, folders, extra = {}) {
    const snapshot = ProductSnapshot.forWrite({
      revision,
      updatedAt: new Date().toISOString(),
      writeId: '',
      folders: Array.isArray(folders) ? folders : [],
      products: Array.isArray(products) ? products : []
    });
    return { ...snapshot, ...extra };
  }

  function applySnapshot(rawSnapshot) {
    const read = ProductSnapshot.read(rawSnapshot);
    const snapshot = read.snapshot;
    const normalized = snapshot.products.map(Core.normalizeProduct).filter(product => product.code && product.description);
    Core.mutate(draft => {
      draft.folders = snapshot.folders;
      draft.products = normalized;
      const validIds = new Set(normalized.map(product => String(product.id)));
      draft.selectedIds = draft.selectedIds.map(String).filter(id => validIds.has(id));
    });
    notifyProductsChanged();
    return read;
  }

  function snapshotFromCurrent(extra = {}) {
    const current = Core.getState();
    return localSnapshot(current.products, current.folders, extra);
  }

  async function fetchSnapshot() {
    const response = await fetch('/api/products', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error(`Falha ao carregar produtos (${response.status}).`);
    return response.json();
  }

  async function checkSession() {
    try {
      const response = await fetch('/api/write-session', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) return false;
      const payload = await response.json();
      sessionUnlocked = Boolean(payload.writable);
      return sessionUnlocked;
    } catch {
      sessionUnlocked = false;
      return false;
    }
  }

  async function unlock() {
    const phrase = window.prompt('Frase de acesso para editar a base compartilhada:');
    if (!phrase) return false;
    const response = await fetch('/api/write-session', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phrase })
    });
    if (!response.ok) {
      if (response.status === 401) alert('Frase de acesso inválida.');
      else alert('Não foi possível liberar a edição agora.');
      return false;
    }
    sessionUnlocked = true;
    setStatus(migrationNeeded ? 'Local · publicar' : 'Edição liberada', migrationNeeded ? 'warning' : 'writable', 'Edição liberada por até 1 hora. Clique para atualizar a base compartilhada.');
    return true;
  }

  async function ensureSession() {
    if (sessionUnlocked) return true;
    if (await checkSession()) return true;
    return unlock();
  }

  async function cachedSnapshot() {
    const cached = await IndexedCache.getSnapshot();
    if (!cached) return null;
    try {
      return ProductSnapshot.read(cached).snapshot;
    } catch (error) {
      console.warn('Snapshot em cache incompatível:', error);
      return null;
    }
  }

  async function bootstrap() {
    if (bootstrapped) return;
    bootstrapped = true;
    setStatus('Conectando…', 'loading');

    const localState = Core.getState();
    const localProducts = localState.products.slice();
    const localFolders = localState.folders.slice();
    const cache = await cachedSnapshot();

    try {
      const raw = await fetchSnapshot();
      revision = Number(raw.revision) || 0;
      const read = ProductSnapshot.read(raw);
      const remote = read.snapshot;
      const remoteIsAuthoritative = Number(raw.schemaVersion) === ProductSnapshot.SCHEMA_VERSION || revision > 0 || remote.products.length > 0;

      if (remoteIsAuthoritative) {
        applySnapshot(remote);
        await IndexedCache.setSnapshot(remote);
        migrationNeeded = false;
        snapshotMigrationPending = read.migratedFromVersion != null;
        setStatus(remote.products.length ? `Sincronizado · r${revision}` : 'Sincronizado · vazio', 'synced', syncedTitle());
      } else {
        const fallback = localProducts.length
          ? localSnapshot(localProducts, localFolders)
          : cache;
        if (fallback?.products?.length) {
          if (!localProducts.length) applySnapshot(fallback);
          migrationNeeded = true;
          snapshotMigrationPending = false;
          await IndexedCache.setSnapshot({ ...fallback, migrationPending: true });
          setStatus('Local · publicar', 'warning', 'A base compartilhada está vazia. Clique para publicar a base local.');
        } else {
          applySnapshot(remote);
          await IndexedCache.setSnapshot(remote);
          migrationNeeded = false;
          snapshotMigrationPending = read.migratedFromVersion != null;
          setStatus('Sincronizado · vazio', 'synced', syncedTitle());
        }
      }
      await checkSession();
    } catch (error) {
      if (!localProducts.length && cache) applySnapshot(cache);
      setStatus('Offline · cache local', 'offline', error.message || String(error));
    }
  }

  async function putSnapshot(folders, products) {
    const writeId = crypto.randomUUID ? crypto.randomUUID() : `write-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const candidate = ProductSnapshot.forWrite({ revision, writeId, folders, products });
    const response = await fetch('/api/products', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        expectedRevision: revision,
        writeId,
        folders: candidate.folders,
        products: candidate.products
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) {
      sessionUnlocked = false;
      const error = new Error('write_session_required');
      error.code = 'write_session_required';
      throw error;
    }
    if (response.status === 409) {
      const error = new Error('revision_conflict');
      error.code = 'revision_conflict';
      error.currentRevision = payload.currentRevision;
      throw error;
    }
    if (!response.ok) throw new Error(payload.message || payload.error || `Falha ao salvar (${response.status}).`);
    return ProductSnapshot.read(payload).snapshot;
  }

  async function publishProducts(products, { folders = Core.getState().folders, promptOnConflict = true } = {}) {
    if (publishing) return false;
    publishing = true;
    const localProducts = Array.isArray(products) ? products : [];
    const localFolders = Array.isArray(folders) ? folders : [];
    await IndexedCache.setSnapshot(localSnapshot(localProducts, localFolders, { pendingWrite: true }));
    setStatus('Sincronizando…', 'loading');
    try {
      if (!await ensureSession()) {
        setStatus(migrationNeeded ? 'Local · publicar' : 'Somente leitura', 'readonly', 'A alteração segue local. Tente salvar novamente para liberar a escrita.');
        return false;
      }

      let materialized;
      try {
        materialized = await AssetClient.materializeProducts(localProducts);
      } catch (error) {
        if (error.code === 'write_session_required') {
          sessionUnlocked = false;
          if (!await ensureSession()) return false;
          materialized = await AssetClient.materializeProducts(localProducts);
        } else {
          throw error;
        }
      }

      let snapshot;
      try {
        snapshot = await putSnapshot(localFolders, materialized);
      } catch (error) {
        if (error.code === 'write_session_required') {
          sessionUnlocked = false;
          if (!await ensureSession()) return false;
          snapshot = await putSnapshot(localFolders, materialized);
        } else if (error.code === 'revision_conflict') {
          await IndexedCache.setSnapshot(localSnapshot(localProducts, localFolders, { pendingWrite: true, conflict: true }));
          setStatus('Conflito de revisão', 'conflict');
          if (promptOnConflict) alert('A base foi alterada em outro navegador. Recarregue os produtos compartilhados antes de salvar novamente.');
          return false;
        } else {
          throw error;
        }
      }

      revision = Number(snapshot.revision) || revision + 1;
      migrationNeeded = false;
      snapshotMigrationPending = false;
      applySnapshot(snapshot);
      await IndexedCache.setSnapshot(snapshot);
      setStatus(`Sincronizado · r${revision}`, 'synced', syncedTitle());
      return true;
    } catch (error) {
      console.error(error);
      await IndexedCache.setSnapshot(localSnapshot(localProducts, localFolders, { pendingWrite: true }));
      setStatus('Alterações locais', 'warning', error.message || String(error));
      alert(`Não foi possível sincronizar os produtos. A alteração continua disponível localmente.\n\n${error.message || error}`);
      return false;
    } finally {
      publishing = false;
    }
  }

  async function reloadRemote() {
    try {
      setStatus('Atualizando…', 'loading');
      const raw = await fetchSnapshot();
      revision = Number(raw.revision) || 0;
      const read = applySnapshot(raw);
      const current = ProductSnapshot.read(raw).snapshot;
      await IndexedCache.setSnapshot(current);
      migrationNeeded = false;
      snapshotMigrationPending = read.migratedFromVersion != null;
      await checkSession();
      setStatus(
        current.products.length ? `Sincronizado · r${revision}` : 'Sincronizado · vazio',
        'synced',
        sessionUnlocked ? `Base atualizada. Edição segue liberada nesta sessão.${snapshotMigrationPending ? ' A próxima escrita publicará ProductSnapshot v2.' : ''}` : syncedTitle()
      );
      return true;
    } catch (error) {
      setStatus('Offline · cache local', 'offline', error.message || String(error));
      return false;
    }
  }

  async function handleStatusClick() {
    if (migrationNeeded) {
      if (!confirm('Publicar a base local como base compartilhada? A base remota está vazia.')) return;
      await publishProducts(Core.getState().products, { folders: Core.getState().folders });
      return;
    }
    if (statusButton()?.dataset.syncState === 'conflict') {
      if (confirm('Descartar alterações locais de produtos e recarregar a base compartilhada?')) await reloadRemote();
      return;
    }
    await reloadRemote();
  }

  document.addEventListener('DOMContentLoaded', () => {
    statusButton()?.addEventListener('click', handleStatusClick);
    bootstrap();
  });

  NS.ProductStore = {
    bootstrap,
    publishProducts,
    publishCurrent: () => publishProducts(Core.getState().products, { folders: Core.getState().folders }),
    reloadRemote,
    unlock,
    getRevision: () => revision,
    isWritable: () => sessionUnlocked,
    isSnapshotMigrationPending: () => snapshotMigrationPending
  };
})();
