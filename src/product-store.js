(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const { Core, IndexedCache, AssetClient } = NS;
  if (!Core || !IndexedCache || !AssetClient) return;

  let revision = 0;
  let sessionUnlocked = false;
  let migrationNeeded = false;
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

  function notifyProductsChanged() {
    window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
  }

  function localSnapshot(products, extra = {}) {
    return {
      schemaVersion: 1,
      revision,
      updatedAt: new Date().toISOString(),
      writeId: '',
      products: Array.isArray(products) ? products : [],
      ...extra
    };
  }

  function applyProducts(products) {
    const normalized = (Array.isArray(products) ? products : []).map(Core.normalizeProduct).filter(product => product.code && product.description);
    Core.mutate(draft => {
      draft.products = normalized;
      const validIds = new Set(normalized.map(product => product.id));
      draft.selectedIds = draft.selectedIds.filter(id => validIds.has(id));
    });
    notifyProductsChanged();
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
    setStatus(migrationNeeded ? 'Local · publicar' : 'Edição liberada', migrationNeeded ? 'warning' : 'writable');
    return true;
  }

  async function ensureSession() {
    if (sessionUnlocked) return true;
    if (await checkSession()) return true;
    return unlock();
  }

  async function bootstrap() {
    if (bootstrapped) return;
    bootstrapped = true;
    setStatus('Conectando…', 'loading');

    const localProducts = Core.getState().products.slice();
    const cache = await IndexedCache.getSnapshot();

    try {
      const snapshot = await fetchSnapshot();
      revision = Number(snapshot.revision) || 0;
      const remoteProducts = Array.isArray(snapshot.products) ? snapshot.products : [];

      if (remoteProducts.length) {
        applyProducts(remoteProducts);
        await IndexedCache.setSnapshot(snapshot);
        migrationNeeded = false;
        setStatus(`Sincronizado · r${revision}`, 'synced');
      } else {
        const fallback = localProducts.length ? localProducts : (Array.isArray(cache?.products) ? cache.products : []);
        if (fallback.length) {
          if (!localProducts.length) applyProducts(fallback);
          migrationNeeded = true;
          await IndexedCache.setSnapshot(localSnapshot(fallback, { migrationPending: true }));
          setStatus('Local · publicar', 'warning', 'A base compartilhada está vazia. Clique para publicar a base local.');
        } else {
          await IndexedCache.setSnapshot(snapshot);
          setStatus('Sincronizado · vazio', 'synced');
        }
      }
      await checkSession();
    } catch (error) {
      if (!localProducts.length && Array.isArray(cache?.products) && cache.products.length) applyProducts(cache.products);
      setStatus('Offline · cache local', 'offline', error.message || String(error));
    }
  }

  async function putProducts(products) {
    const writeId = crypto.randomUUID ? crypto.randomUUID() : `write-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const response = await fetch('/api/products', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedRevision: revision, writeId, products })
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
    return payload;
  }

  async function publishProducts(products, { promptOnConflict = true } = {}) {
    if (publishing) return false;
    publishing = true;
    const localProducts = Array.isArray(products) ? products : [];
    await IndexedCache.setSnapshot(localSnapshot(localProducts, { pendingWrite: true }));
    setStatus('Sincronizando…', 'loading');
    try {
      if (!await ensureSession()) {
        setStatus(migrationNeeded ? 'Local · publicar' : 'Somente leitura', 'readonly');
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
        snapshot = await putProducts(materialized);
      } catch (error) {
        if (error.code === 'write_session_required') {
          if (!await ensureSession()) return false;
          snapshot = await putProducts(materialized);
        } else if (error.code === 'revision_conflict') {
          await IndexedCache.setSnapshot(localSnapshot(localProducts, { pendingWrite: true, conflict: true }));
          setStatus('Conflito de revisão', 'conflict');
          if (promptOnConflict) alert('A base foi alterada em outro navegador. Recarregue os produtos compartilhados antes de salvar novamente.');
          return false;
        } else {
          throw error;
        }
      }

      revision = Number(snapshot.revision) || revision + 1;
      migrationNeeded = false;
      applyProducts(snapshot.products || materialized);
      await IndexedCache.setSnapshot(snapshot);
      setStatus(`Sincronizado · r${revision}`, 'synced');
      return true;
    } catch (error) {
      console.error(error);
      await IndexedCache.setSnapshot(localSnapshot(localProducts, { pendingWrite: true }));
      setStatus('Alterações locais', 'warning', error.message || String(error));
      alert(`Não foi possível sincronizar os produtos. A alteração continua disponível localmente.\n\n${error.message || error}`);
      return false;
    } finally {
      publishing = false;
    }
  }

  async function reloadRemote() {
    try {
      const snapshot = await fetchSnapshot();
      revision = Number(snapshot.revision) || 0;
      applyProducts(snapshot.products || []);
      await IndexedCache.setSnapshot(snapshot);
      migrationNeeded = false;
      setStatus(`Sincronizado · r${revision}`, 'synced');
      return true;
    } catch (error) {
      setStatus('Offline · cache local', 'offline');
      return false;
    }
  }

  async function handleStatusClick() {
    if (migrationNeeded) {
      if (!confirm('Publicar a base local como base compartilhada? A base remota está vazia.')) return;
      await publishProducts(Core.getState().products);
      return;
    }
    if (statusButton()?.dataset.syncState === 'conflict') {
      if (confirm('Descartar alterações locais de produtos e recarregar a base compartilhada?')) await reloadRemote();
      return;
    }
    if (!sessionUnlocked) await unlock();
    else await reloadRemote();
  }

  document.addEventListener('DOMContentLoaded', () => {
    statusButton()?.addEventListener('click', handleStatusClick);
    bootstrap();
  });

  NS.ProductStore = {
    bootstrap,
    publishProducts,
    publishCurrent: () => publishProducts(Core.getState().products),
    reloadRemote,
    unlock,
    getRevision: () => revision,
    isWritable: () => sessionUnlocked
  };
})();
