(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const { AssetIndexStore, AssetInventory, AssetQuery, AssetClient, FolderTree, LibraryShell, App, Render } = NS;
  const root = document.getElementById('assetLibraryAdmin');
  const tree = document.getElementById('assetLibraryFolderTree');
  const list = document.getElementById('assetLibraryList');
  const search = document.getElementById('assetLibrarySearch');
  const usageFilter = document.getElementById('assetLibraryUsageFilter');
  const count = document.getElementById('assetLibraryCount');
  const authority = document.getElementById('assetLibraryAuthority');
  const selectionCount = document.getElementById('assetLibrarySelectionCount');
  const moveDestination = document.getElementById('assetLibraryMoveDestination');
  const folderParent = document.getElementById('assetLibraryFolderParent');
  const folderPath = document.getElementById('assetLibraryFolderPath');
  const empty = document.getElementById('assetLibraryEmpty');
  const picker = document.getElementById('assetPickerContext');
  const uploadInput = document.getElementById('assetLibraryUploadInput');
  const uploadStatus = document.getElementById('assetLibraryUploadStatus');
  if (!AssetIndexStore || !AssetInventory || !AssetQuery || !AssetClient || !FolderTree || !LibraryShell || !App || !Render || !root || !tree || !list || !search || !usageFilter || !count || !selectionCount || !moveDestination || !folderParent || !folderPath || !empty) return;

  let remotePayload = { assets: [], assetIndexRevision: 0, productRevision: 0, catalogRevision: 0 };
  let inventory = [];
  let selectedFolderId = null;
  let unfiledScope = false;
  let selectedAssetIds = new Set();
  let pickerActive = false;
  let loading = false;
  let uploading = false;
  let mobileView = 'images';

  const esc = value => Render.esc(String(value ?? ''));

  function active() {
    return LibraryShell.getActiveProvider?.() === 'images';
  }

  function snapshot() {
    return AssetIndexStore.getSnapshot();
  }

  function folders() {
    return snapshot().folders;
  }

  function projectedInventory() {
    const projected = AssetInventory.overlay(remotePayload, snapshot(), { pending: AssetIndexStore.hasPendingWrite() });
    inventory = Array.isArray(projected.assets) ? projected.assets : [];
    return projected;
  }

  function formatBytes(value) {
    const bytes = Number(value || 0);
    if (!Number.isFinite(bytes) || bytes <= 0) return 'Tamanho desconhecido';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  }

  function pathFor(folderId, values = folders()) {
    if (!folderId) return 'Todas as imagens';
    try { return FolderTree.pathOf(values, folderId).map(folder => folder.name).join(' / '); }
    catch { return 'Todas as imagens'; }
  }

  function usageLabels(asset) {
    const values = [];
    const seen = new Set();
    (Array.isArray(asset.usages) ? asset.usages : []).forEach(usage => {
      const label = String(usage.ownerLabel || usage.ownerId || '').trim();
      if (!label || seen.has(label)) return;
      seen.add(label);
      values.push(label);
    });
    return values;
  }

  function visibleAssets(text = search.value.trim()) {
    return AssetQuery.query({
      assets: inventory,
      folders: folders(),
      folderId: selectedFolderId,
      unfiled: unfiledScope,
      recursive: true,
      usage: usageFilter.value || 'all',
      text
    }).slice().sort((a, b) => String(a.label || '').localeCompare(String(b.label || ''), 'pt-BR') || String(a.sha256 || '').localeCompare(String(b.sha256 || '')));
  }

  function scopeCount(folderId, { unfiled = false } = {}) {
    return AssetQuery.query({ assets: inventory, folders: folders(), folderId, unfiled, recursive: true, usage: 'all', text: '' }).length;
  }

  function sortedChildren(values, parentId) {
    return FolderTree.childrenOf(values, parentId).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  function folderTreeMarkup(values, parentId = null) {
    return sortedChildren(values, parentId).map(folder => `
      <div class="library-folder-node">
        <button class="library-folder-button ${!unfiledScope && selectedFolderId === folder.id ? 'active' : ''}" type="button" data-asset-library-folder="${esc(folder.id)}" aria-pressed="${!unfiledScope && selectedFolderId === folder.id}">
          <span>${esc(folder.name)}</span><small>${scopeCount(folder.id)}</small>
        </button>
        <div class="library-folder-children">${folderTreeMarkup(values, folder.id)}</div>
      </div>`).join('');
  }

  function validFolderParentIds(currentFolders) {
    if (!selectedFolderId || unfiledScope) return new Set(currentFolders.map(folder => folder.id));
    const forbidden = new Set([selectedFolderId, ...FolderTree.descendantsOf(currentFolders, selectedFolderId).map(folder => folder.id)]);
    return new Set(currentFolders.map(folder => folder.id).filter(id => !forbidden.has(id)));
  }

  function folderOptions(currentFolders, { includeRoot = false, allowedIds = null } = {}) {
    const options = [];
    if (includeRoot) options.push('<option value="">Imagens (raiz)</option>');
    currentFolders
      .map(folder => ({ folder, label: pathFor(folder.id, currentFolders) }))
      .filter(entry => !allowedIds || allowedIds.has(entry.folder.id))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
      .forEach(entry => options.push(`<option value="${esc(entry.folder.id)}">${esc(entry.label)}</option>`));
    return options.join('');
  }

  function reconcileSelection() {
    const valid = new Set(inventory.map(asset => String(asset.id)));
    selectedAssetIds = new Set(Array.from(selectedAssetIds).filter(id => valid.has(id)));
  }

  function render() {
    const projected = projectedInventory();
    const currentFolders = folders();
    if (selectedFolderId && !currentFolders.some(folder => folder.id === selectedFolderId)) selectedFolderId = null;
    reconcileSelection();

    tree.innerHTML = `
      <button class="library-folder-button root ${!unfiledScope && selectedFolderId == null ? 'active' : ''}" type="button" data-asset-library-folder="" aria-pressed="${!unfiledScope && selectedFolderId == null}">
        <span>Todas as imagens</span><small>${inventory.length}</small>
      </button>
      <button class="library-folder-button root ${unfiledScope ? 'active' : ''}" type="button" data-asset-library-unfiled="true" aria-pressed="${unfiledScope}">
        <span>Sem pasta</span><small>${scopeCount(null, { unfiled: true })}</small>
      </button>
      ${folderTreeMarkup(currentFolders)}`;

    const allowedParents = validFolderParentIds(currentFolders);
    const previousMove = moveDestination.value;
    const previousParent = folderParent.value;
    moveDestination.innerHTML = `<option value="__choose__">Mover para…</option>${folderOptions(currentFolders, { includeRoot: true })}`;
    if (previousMove === '' || currentFolders.some(folder => folder.id === previousMove)) moveDestination.value = previousMove;
    folderParent.innerHTML = folderOptions(currentFolders, { includeRoot: true, allowedIds: allowedParents });
    if (previousParent === '' || allowedParents.has(previousParent)) folderParent.value = previousParent;

    const values = visibleAssets();
    count.textContent = loading ? 'Carregando…' : `${values.length} ${values.length === 1 ? 'imagem' : 'imagens'}`;
    selectionCount.textContent = `${selectedAssetIds.size} selecionada${selectedAssetIds.size === 1 ? '' : 's'}`;
    folderPath.textContent = unfiledScope ? 'Sem pasta' : pathFor(selectedFolderId, currentFolders);
    if (authority) authority.textContent = `índice r${projected.assetIndexRevision ?? 0}${projected.assetIndexPending ? ' · pendente local' : ''} · produtos r${projected.productRevision ?? 0} · catálogos r${projected.catalogRevision ?? 0}`;
    if (picker) picker.classList.toggle('hidden', !pickerActive);

    list.innerHTML = values.map(asset => {
      const uses = usageLabels(asset);
      const usageText = uses.length ? `${uses.slice(0, 3).map(esc).join(' · ')}${uses.length > 3 ? ` · +${uses.length - 3}` : ''}` : 'Sem uso autoritativo';
      const technical = [asset.contentType || 'tipo desconhecido', formatBytes(asset.bytes)].join(' · ');
      const status = asset.pendingIndex ? 'Pendente' : asset.available === false ? 'Blob indisponível' : asset.indexed ? 'Indexada' : 'Descoberta por uso';
      const selected = selectedAssetIds.has(String(asset.id));
      return `<article class="asset-library-item ${selected ? 'selected' : ''}" data-asset-resource="${esc(asset.id)}">
        <label class="asset-library-check"><input type="checkbox" data-asset-library-select="${esc(asset.id)}" ${selected ? 'checked' : ''} aria-label="Selecionar ${esc(asset.label || asset.id)}" /></label>
        <div class="asset-library-thumb"><img src="${esc(asset.url)}" alt="" loading="lazy" /></div>
        <div class="asset-library-copy">
          <div class="asset-library-title"><strong>${esc(asset.label || `Imagem ${String(asset.sha256 || '').slice(0, 8)}`)}</strong><span>${esc(status)}</span></div>
          <code title="${esc(asset.sha256)}">${esc(String(asset.sha256 || '').slice(0, 12))}</code>
          <small>${esc(technical)}</small>
          <small class="asset-library-usage">${usageText}</small>
        </div>
        <div class="asset-library-actions">
          <button class="button secondary compact" type="button" data-asset-edit-label="${esc(asset.id)}">Editar nome</button>
          ${pickerActive && asset.available !== false ? `<button class="button primary compact" type="button" data-asset-use="${esc(asset.id)}">Usar imagem</button>` : ''}
        </div>
      </article>`;
    }).join('');
    empty.classList.toggle('hidden', values.length > 0 || loading);

    const hasSelection = selectedAssetIds.size > 0;
    document.getElementById('assetLibraryMoveAssets').disabled = !hasSelection || moveDestination.value === '__choose__';
    document.getElementById('assetLibraryClearSelection').disabled = !hasSelection;
    const realFolder = Boolean(selectedFolderId) && !unfiledScope;
    document.getElementById('assetLibraryRenameFolder').disabled = !realFolder;
    document.getElementById('assetLibraryMoveFolder').disabled = !realFolder;
    document.getElementById('assetLibraryDeleteFolder').disabled = !realFolder;
    folderParent.disabled = !realFolder;

    root.dataset.mobileView = mobileView;
    document.querySelectorAll('[data-asset-library-mobile-view]').forEach(button => {
      const isActive = button.dataset.assetLibraryMobileView === mobileView;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', String(isActive));
      button.tabIndex = isActive ? 0 : -1;
    });
    if (uploadStatus) uploadStatus.textContent = uploading ? 'Adicionando imagens…' : '';
  }

  async function refreshInventory() {
    if (loading) return;
    loading = true;
    render();
    try {
      await AssetIndexStore.bootstrap?.();
      const response = await fetch('/api/asset-inventory', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error(`Falha ao carregar imagens (${response.status}).`);
      remotePayload = await response.json();
    } catch (error) {
      console.warn(error);
    } finally {
      loading = false;
      render();
    }
  }

  function byId(id) {
    projectedInventory();
    return inventory.find(asset => asset.id === id) || null;
  }

  function selectScope({ folderId = null, unfiled = false } = {}) {
    selectedFolderId = folderId || null;
    unfiledScope = Boolean(unfiled);
    selectedAssetIds.clear();
    mobileView = 'images';
    render();
  }

  async function editLabel(id) {
    const asset = byId(id);
    if (!asset) return;
    const current = asset.indexed ? String(asset.label || '') : '';
    const label = window.prompt('Nome desta imagem na Biblioteca:', current);
    if (label == null) return;
    await AssetIndexStore.setLabel(asset.url, label, {
      contentType: asset.contentType || '', bytes: Number(asset.bytes || 0), createdAt: asset.createdAt || ''
    });
    await refreshInventory();
  }

  async function createFolder() {
    const parentId = selectedFolderId && !unfiledScope ? selectedFolderId : null;
    const name = window.prompt(`Nome da nova pasta em ${pathFor(parentId)}:`, '');
    if (name == null) return;
    try {
      const id = await AssetIndexStore.createFolder({ name, parentId });
      if (id) selectScope({ folderId: id });
    } catch (error) { alert(error.message || String(error)); }
    await refreshInventory();
  }

  async function renameSelectedFolder() {
    if (!selectedFolderId || unfiledScope) return;
    const folder = folders().find(item => item.id === selectedFolderId);
    if (!folder) return;
    const name = window.prompt('Novo nome da pasta:', folder.name);
    if (name == null) return;
    try { await AssetIndexStore.renameFolder(selectedFolderId, name); }
    catch (error) { alert(error.message || String(error)); }
    await refreshInventory();
  }

  async function moveSelectedFolder() {
    if (!selectedFolderId || unfiledScope) return;
    try { await AssetIndexStore.moveFolder(selectedFolderId, folderParent.value || null); }
    catch (error) { alert(error.message || String(error)); }
    await refreshInventory();
  }

  async function deleteSelectedFolder() {
    if (!selectedFolderId || unfiledScope) return;
    const folder = folders().find(item => item.id === selectedFolderId);
    if (!folder) return;
    const parentId = folder.parentId || null;
    if (!window.confirm(`Excluir a pasta vazia “${folder.name}”?`)) return;
    try {
      const ok = await AssetIndexStore.deleteEmptyFolder(selectedFolderId);
      if (ok) selectedFolderId = parentId;
    } catch (error) { alert(error.message || String(error)); }
    await refreshInventory();
  }

  async function moveSelectedAssets() {
    if (!selectedAssetIds.size || moveDestination.value === '__choose__') return;
    const items = Array.from(selectedAssetIds).map(byId).filter(Boolean);
    try {
      if (await AssetIndexStore.moveAssets(items, moveDestination.value || null)) selectedAssetIds.clear();
    } catch (error) { alert(error.message || String(error)); }
    await refreshInventory();
  }

  function labelFromFilename(name) {
    return String(name || '').replace(/\.[^.]+$/, '').trim().slice(0, 300);
  }

  async function uploadFiles(files) {
    const values = Array.from(files || []).filter(file => String(file.type || '').startsWith('image/'));
    if (!values.length || uploading) return;
    uploading = true;
    render();
    try {
      if (!await AssetIndexStore.ensureWritable?.()) throw new Error('Sessão de escrita necessária para adicionar imagens.');
      const records = [];
      for (const file of values) {
        const prepared = await AssetClient.prepareImage(file);
        const result = await AssetClient.uploadBlobDetailed(prepared);
        records.push({ ...result, label: labelFromFilename(file.name) });
      }
      const destination = selectedFolderId && !unfiledScope ? selectedFolderId : null;
      await AssetIndexStore.registerAssets(records, { folderId: destination });
    } catch (error) {
      console.error(error);
      alert(`Não foi possível adicionar as imagens.\n\n${error.message || error}`);
    } finally {
      uploading = false;
      if (uploadInput) uploadInput.value = '';
      await refreshInventory();
    }
  }

  function useAsset(id) {
    const asset = byId(id);
    if (!asset || asset.available === false) return;
    const input = document.getElementById('imageUrl');
    if (!input) return;
    input.value = asset.url;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    pickerActive = false;
    window.dispatchEvent(new CustomEvent('catalogotop:asset-picked', { detail: { assetId: asset.id, url: asset.url } }));
    App.switchTab('products');
    mobileView = 'images';
    render();
  }

  async function openPicker() {
    pickerActive = true;
    mobileView = 'images';
    App.switchTab('library');
    LibraryShell.show('images');
    render();
    await refreshInventory();
  }

  function cancelPicker() {
    pickerActive = false;
    mobileView = 'images';
    App.switchTab('products');
    render();
  }

  tree.addEventListener('click', event => {
    const folder = event.target.closest('[data-asset-library-folder]');
    if (folder) { selectScope({ folderId: folder.dataset.assetLibraryFolder || null }); return; }
    if (event.target.closest('[data-asset-library-unfiled]')) selectScope({ unfiled: true });
  });

  list.addEventListener('change', event => {
    const checkbox = event.target.closest('[data-asset-library-select]');
    if (!checkbox) return;
    const id = String(checkbox.dataset.assetLibrarySelect);
    if (checkbox.checked) selectedAssetIds.add(id);
    else selectedAssetIds.delete(id);
    render();
  });

  list.addEventListener('click', event => {
    const edit = event.target.closest('[data-asset-edit-label]');
    if (edit) { editLabel(edit.dataset.assetEditLabel); return; }
    const use = event.target.closest('[data-asset-use]');
    if (use) useAsset(use.dataset.assetUse);
  });

  document.getElementById('btnChooseAssetLibrary')?.addEventListener('click', openPicker);
  document.getElementById('assetPickerCancel')?.addEventListener('click', cancelPicker);
  document.getElementById('assetLibraryCreateFolder')?.addEventListener('click', createFolder);
  document.getElementById('assetLibraryRenameFolder')?.addEventListener('click', renameSelectedFolder);
  document.getElementById('assetLibraryMoveFolder')?.addEventListener('click', moveSelectedFolder);
  document.getElementById('assetLibraryDeleteFolder')?.addEventListener('click', deleteSelectedFolder);
  document.getElementById('assetLibrarySelectVisible')?.addEventListener('click', () => { visibleAssets().forEach(asset => selectedAssetIds.add(String(asset.id))); render(); });
  document.getElementById('assetLibraryClearSelection')?.addEventListener('click', () => { selectedAssetIds.clear(); render(); });
  document.getElementById('assetLibraryMoveAssets')?.addEventListener('click', moveSelectedAssets);
  document.getElementById('assetLibraryUploadButton')?.addEventListener('click', () => uploadInput?.click());
  uploadInput?.addEventListener('change', () => uploadFiles(uploadInput.files));
  search.addEventListener('input', render);
  usageFilter.addEventListener('change', render);
  moveDestination.addEventListener('change', render);
  document.querySelectorAll('[data-asset-library-mobile-view]').forEach(button => button.addEventListener('click', () => { mobileView = button.dataset.assetLibraryMobileView || 'images'; render(); }));

  window.addEventListener('catalogotop:library-provider-changed', event => {
    if (event.detail?.provider === 'images') { mobileView = 'images'; refreshInventory(); }
  });
  window.addEventListener('catalogotop:asset-index-updated', event => {
    projectedInventory();
    render();
    if (active() && event.detail?.type === 'asset-index-saved') refreshInventory();
  });
  window.addEventListener('catalogotop:products-updated', () => { if (active()) refreshInventory(); });
  window.addEventListener('catalogotop:catalogs-updated', () => { if (active()) refreshInventory(); });

  NS.AssetLibrary = Object.freeze({
    refreshInventory,
    openPicker,
    cancelPicker,
    isPickerActive: () => pickerActive,
    getVisibleAssets: () => visibleAssets().slice()
  });
  projectedInventory();
  render();
})();
