(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const { IndexedCache, TemplateSnapshot, TemplateContract, Templates, ProductStore } = NS;
  if (!IndexedCache || !TemplateSnapshot || !TemplateContract || !Templates || !ProductStore) return;

  const REGISTRY_MIRROR_KEY = 'catalogotop:templates-registry:v1';
  let revision = 0;
  let snapshot = TemplateSnapshot.forWrite();
  let bootstrapped = false;
  let publishing = false;
  let pendingWrite = false;
  let conflict = false;
  let remotePromise = null;
  let selectorObserver = null;
  let repairingSelector = false;

  function uuid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function notify(detail = {}) {
    window.dispatchEvent(new CustomEvent('catalogotop:templates-updated', { detail }));
    NS.App?.renderAll?.();
  }
  function install(nextSnapshot = snapshot) {
    Templates.installCustomResources(nextSnapshot.templates);
    try { localStorage.setItem(REGISTRY_MIRROR_KEY, JSON.stringify(nextSnapshot.templates)); } catch (_) {}
    repairCatalogSelector();
  }

  async function fetchSnapshot() {
    const response = await fetch('/api/templates', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error(`Falha ao carregar templates (${response.status}).`);
    return response.json();
  }

  async function cachedSnapshot() {
    const cached = await IndexedCache.getTemplateSnapshot?.();
    if (!cached) return null;
    try { return { raw: cached, snapshot: TemplateSnapshot.read(cached).snapshot }; }
    catch (error) { console.warn('Templates em cache incompatíveis:', error); return null; }
  }

  async function ensureSession() {
    if (ProductStore.isWritable?.()) return true;
    return Boolean(await ProductStore.unlock?.());
  }

  async function putSnapshot(nextCandidate) {
    const writeId = uuid();
    const outgoing = TemplateSnapshot.forWrite({ revision, writeId, templates: nextCandidate.templates });
    const response = await fetch('/api/templates', {
      method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedRevision: revision, writeId, templates: outgoing.templates })
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) { const error = new Error('write_session_required'); error.code = 'write_session_required'; throw error; }
    if (response.status === 409) { const error = new Error(payload.error || 'revision_conflict'); error.code = 'revision_conflict'; error.currentRevision = payload.currentRevision; throw error; }
    if (!response.ok) { const error = new Error(payload.message || payload.error || `Falha ao salvar templates (${response.status}).`); error.code = payload.error || 'template_write_failed'; throw error; }
    return TemplateSnapshot.read(payload).snapshot;
  }

  async function publishCandidate(nextCandidate) {
    if (publishing || conflict) {
      if (conflict) alert('Há um conflito de revisão em Templates. Recarregue antes de publicar novamente.');
      return false;
    }
    const transition = TemplateSnapshot.transitionError(snapshot, nextCandidate);
    if (transition) throw new Error(transition);
    publishing = true;
    snapshot = nextCandidate;
    pendingWrite = true;
    install();
    await IndexedCache.setTemplateSnapshot?.({ ...nextCandidate, pendingWrite: true });
    notify({ type: 'templates-local-change' });
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
      install();
      await IndexedCache.setTemplateSnapshot?.(remote);
      notify({ type: 'templates-saved', revision });
      return true;
    } catch (error) {
      if (error.code === 'revision_conflict') {
        conflict = true;
        await IndexedCache.setTemplateSnapshot?.({ ...nextCandidate, pendingWrite: true, conflict: true });
        notify({ type: 'templates-conflict', currentRevision: error.currentRevision });
        alert('Templates mudaram em outro navegador. Sua publicação continua no cache local; recarregue antes de decidir como prosseguir.');
        return false;
      }
      console.error(error);
      await IndexedCache.setTemplateSnapshot?.({ ...nextCandidate, pendingWrite: true });
      notify({ type: 'templates-offline-change' });
      alert(`Não foi possível sincronizar Templates. A publicação continua no cache local.\n\n${error.message || error}`);
      return false;
    } finally { publishing = false; }
  }

  async function reconcileRemote() {
    try {
      const remote = TemplateSnapshot.read(await fetchSnapshot()).snapshot;
      revision = Number(remote.revision) || 0;
      if (pendingWrite) {
        conflict = Number(snapshot.revision) !== revision || conflict;
      } else {
        snapshot = remote;
        conflict = false;
        install();
        await IndexedCache.setTemplateSnapshot?.(remote);
      }
      notify({ type: 'templates-bootstrapped', revision, conflict });
      return true;
    } catch (error) {
      console.warn('Templates remotos indisponíveis:', error);
      notify({ type: 'templates-offline' });
      return false;
    }
  }

  async function bootstrap({ waitForRemote = false } = {}) {
    if (!bootstrapped) {
      bootstrapped = true;
      const cache = await cachedSnapshot();
      if (cache) {
        snapshot = cache.snapshot;
        revision = Number(cache.snapshot.revision) || 0;
        pendingWrite = Boolean(cache.raw.pendingWrite);
        conflict = Boolean(cache.raw.conflict);
        install();
        notify({ type: 'templates-cache-loaded', revision, pendingWrite, conflict });
      } else {
        install();
      }
      remotePromise = reconcileRemote();
    }
    if (waitForRemote && remotePromise) await remotePromise;
    return true;
  }

  function duplicateAsDraft(id, version) {
    const source = Templates.resolve(id, version);
    const draft = clone(source);
    delete draft.columns; delete draft.rows; delete draft.perPage; delete draft.className;
    draft.id = `custom-${uuid()}`;
    draft.version = 1;
    draft.name = `Cópia de ${source.name}`.slice(0, 120);
    return draft;
  }

  function editAsDraft(id) {
    const resource = TemplateSnapshot.resourceById(snapshot, id);
    if (!resource) { const error = new Error(`Template customizado não encontrado: ${id}.`); error.code = 'template_resource_not_found'; throw error; }
    const latest = TemplateSnapshot.latestContract(resource);
    const draft = clone(latest);
    draft.version = latest.version + 1;
    return draft;
  }

  async function publishDraft(rawDraft) {
    if (conflict) return false;
    const contract = TemplateContract.normalize(rawDraft);
    const candidate = TemplateSnapshot.appendVersion(snapshot, contract);
    return publishCandidate(candidate);
  }

  async function reloadRemote({ confirmDiscard = true } = {}) {
    if (confirmDiscard && (pendingWrite || conflict) && !window.confirm('Descartar alterações locais de Templates e recarregar?')) return false;
    try {
      const remote = TemplateSnapshot.read(await fetchSnapshot()).snapshot;
      revision = Number(remote.revision) || 0;
      snapshot = remote;
      pendingWrite = false;
      conflict = false;
      install();
      await IndexedCache.setTemplateSnapshot?.(remote);
      notify({ type: 'templates-reloaded', revision });
      return true;
    } catch (error) { console.warn(error); return false; }
  }

  function selectorChoices() {
    const latest = Templates.templates.slice();
    const catalog = NS.Core?.getState?.()?.catalog;
    const currentId = String(catalog?.templateId || '').trim();
    const currentVersion = Number(catalog?.templateVersion || 1);
    let currentExact = null;
    if (currentId) {
      try { currentExact = Templates.resolve(currentId, currentVersion); }
      catch (_) {}
    }
    if (currentExact && !latest.some(template => template.id === currentExact.id && template.version === currentExact.version)) latest.push(currentExact);
    return latest;
  }

  function observeCatalogSelector(select) {
    if (selectorObserver && select) selectorObserver.observe(select, { childList: true });
  }

  function repairCatalogSelector() {
    if (repairingSelector || typeof document === 'undefined') return;
    const select = document.getElementById('catalogTemplate');
    const catalog = NS.Core?.getState?.()?.catalog;
    if (!select || !catalog) return;
    const currentId = String(catalog.templateId || 'technical');
    const currentVersion = Number(catalog.templateVersion || 1);
    repairingSelector = true;
    selectorObserver?.disconnect();
    try {
      const choices = selectorChoices();
      select.replaceChildren();
      choices.forEach(template => {
        const exact = template.id === currentId && Number(template.version) === currentVersion;
        const builtin = Templates.isBuiltIn(template.id);
        const latestVersion = Templates.latest(template.id)?.version;
        const option = document.createElement('option');
        option.value = template.id;
        option.dataset.templateVersion = String(template.version);
        option.textContent = `${template.name}${builtin ? '' : ` · v${template.version}`}${!builtin && exact && latestVersion !== template.version ? ' · em uso' : ''}`;
        option.selected = exact;
        select.appendChild(option);
      });
      if (!choices.some(template => template.id === currentId && Number(template.version) === currentVersion)) {
        const option = document.createElement('option');
        option.value = currentId;
        option.dataset.templateVersion = String(currentVersion);
        option.textContent = `Indisponível · ${currentId}@${currentVersion}`;
        option.selected = true;
        option.disabled = true;
        select.appendChild(option);
      }
    } finally {
      repairingSelector = false;
      observeCatalogSelector(select);
    }
  }

  function installCatalogSelectorBridge() {
    if (typeof document === 'undefined') return;
    const select = document.getElementById('catalogTemplate');
    if (!select) return;
    if (!selectorObserver) {
      selectorObserver = new MutationObserver(() => {
        if (!repairingSelector) queueMicrotask(repairCatalogSelector);
      });
      document.addEventListener('change', event => {
        if (event.target !== select) return;
        const option = select.selectedOptions?.[0];
        const version = Number(option?.dataset?.templateVersion || 1);
        if (!option || !Number.isInteger(version) || version < 1) return;
        try {
          NS.Core?.mutate?.(draft => {
            draft.catalog.templateId = option.value;
            draft.catalog.templateVersion = version;
          });
        } catch (error) {
          console.error(error);
        }
      }, true);
    }
    repairCatalogSelector();
  }

  NS.TemplateStore = Object.freeze({
    REGISTRY_MIRROR_KEY,
    bootstrap,
    ensureWritable: ensureSession,
    duplicateAsDraft,
    editAsDraft,
    publishDraft,
    reloadRemote,
    repairCatalogSelector,
    getRevision: () => revision,
    getSnapshot: () => TemplateSnapshot.read(snapshot).snapshot,
    getResource: id => TemplateSnapshot.resourceById(snapshot, id),
    hasPendingWrite: () => pendingWrite,
    hasConflict: () => conflict,
    isPublishing: () => publishing
  });

  installCatalogSelectorBridge();
})();
