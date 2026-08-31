(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const { CatalogStore, CatalogQuery, FolderTree, Render } = NS;
  const root = document.getElementById('catalogLibraryAdmin');
  const tree = document.getElementById('catalogLibraryFolderTree');
  const list = document.getElementById('catalogLibraryList');
  const search = document.getElementById('catalogLibrarySearch');
  const count = document.getElementById('catalogLibraryCount');
  const selectionCount = document.getElementById('catalogLibrarySelectionCount');
  const moveDestination = document.getElementById('catalogLibraryMoveDestination');
  const folderParent = document.getElementById('catalogLibraryFolderParent');
  const folderPath = document.getElementById('catalogLibraryFolderPath');
  const empty = document.getElementById('catalogLibraryEmpty');
  if (!CatalogStore || !CatalogQuery || !FolderTree || !Render || !root || !tree || !list || !search || !count || !selectionCount || !moveDestination || !folderParent || !folderPath || !empty) return;

  let selectedFolderId = null;
  let selectedCatalogIds = new Set();
  let mobileView = 'catalogs';

  function snapshot() { return CatalogStore.getSnapshot(); }

  function sortedChildren(folders, parentId) {
    return FolderTree.childrenOf(folders, parentId).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  function pathFor(folderId, folders = snapshot().folders) {
    if (!folderId) return 'Todos os catálogos';
    try { return FolderTree.pathOf(folders, folderId).map(folder => folder.name).join(' / '); }
    catch { return 'Todos os catálogos'; }
  }

  function resourcePath(record, folders) {
    return record?.folderId ? pathFor(record.folderId, folders) : 'Catálogos (raiz)';
  }

  function scopedCatalogs(text = search.value.trim()) {
    const current = snapshot();
    const records = CatalogQuery.query({
      catalogs: current.catalogs,
      folders: current.folders,
      folderId: selectedFolderId,
      recursive: true,
      text
    });
    if (String(text || '').trim()) return records;
    return records.slice().sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')) || a.catalog.title.localeCompare(b.catalog.title, 'pt-BR'));
  }

  function scopeCount(folderId, current = snapshot()) {
    return CatalogQuery.query({ catalogs: current.catalogs, folders: current.folders, folderId, recursive: true, text: '' }).length;
  }

  function folderTreeMarkup(folders, parentId = null) {
    return sortedChildren(folders, parentId).map(folder => `
      <div class="library-folder-node">
        <button class="library-folder-button ${selectedFolderId === folder.id ? 'active' : ''}" type="button" data-catalog-library-folder="${Render.esc(folder.id)}" aria-pressed="${selectedFolderId === folder.id}">
          <span>${Render.esc(folder.name)}</span><small>${scopeCount(folder.id)}</small>
        </button>
        <div class="library-folder-children">${folderTreeMarkup(folders, folder.id)}</div>
      </div>`).join('');
  }

  function validFolderParentIds(current) {
    if (!selectedFolderId) return new Set(current.folders.map(folder => folder.id));
    const forbidden = new Set([selectedFolderId, ...FolderTree.descendantsOf(current.folders, selectedFolderId).map(folder => folder.id)]);
    return new Set(current.folders.map(folder => folder.id).filter(id => !forbidden.has(id)));
  }

  function folderOptions(folders, { includeRoot = false, allowedIds = null } = {}) {
    const options = [];
    if (includeRoot) options.push('<option value="">Catálogos (raiz)</option>');
    folders
      .map(folder => ({ folder, label: pathFor(folder.id, folders) }))
      .filter(entry => !allowedIds || allowedIds.has(entry.folder.id))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
      .forEach(entry => options.push(`<option value="${Render.esc(entry.folder.id)}">${Render.esc(entry.label)}</option>`));
    return options.join('');
  }

  function reconcileSelection(current) {
    const valid = new Set(current.catalogs.map(record => String(record.id)));
    selectedCatalogIds = new Set(Array.from(selectedCatalogIds).filter(id => valid.has(id)));
  }

  function render() {
    const current = snapshot();
    if (selectedFolderId && !current.folders.some(folder => folder.id === selectedFolderId)) selectedFolderId = null;
    reconcileSelection(current);

    tree.innerHTML = `
      <button class="library-folder-button root ${selectedFolderId == null ? 'active' : ''}" type="button" data-catalog-library-folder="" aria-pressed="${selectedFolderId == null}">
        <span>Todos os catálogos</span><small>${current.catalogs.length}</small>
      </button>
      ${folderTreeMarkup(current.folders)}`;

    const allowedParents = validFolderParentIds(current);
    const previousMoveTarget = moveDestination.value;
    const previousParent = folderParent.value;
    moveDestination.innerHTML = `<option value="__choose__">Mover para…</option>${folderOptions(current.folders, { includeRoot: true })}`;
    if (previousMoveTarget === '' || current.folders.some(folder => folder.id === previousMoveTarget)) moveDestination.value = previousMoveTarget;
    folderParent.innerHTML = folderOptions(current.folders, { includeRoot: true, allowedIds: allowedParents });
    if (previousParent === '' || allowedParents.has(previousParent)) folderParent.value = previousParent;

    const catalogs = scopedCatalogs();
    count.textContent = `${catalogs.length} ${catalogs.length === 1 ? 'catálogo' : 'catálogos'}`;
    selectionCount.textContent = `${selectedCatalogIds.size} selecionado${selectedCatalogIds.size === 1 ? '' : 's'}`;
    folderPath.textContent = pathFor(selectedFolderId, current.folders);

    list.innerHTML = catalogs.map(record => {
      const id = String(record.id);
      const active = id === String(CatalogStore.getActiveCatalogId());
      const selected = selectedCatalogIds.has(id);
      const updated = record.updatedAt ? Render.formatDate(record.updatedAt) : '—';
      return `<article class="catalog-library-row ${active ? 'active-resource' : ''} ${selected ? 'selected' : ''}" data-catalog-resource="${Render.esc(id)}">
        <label class="catalog-library-check"><input type="checkbox" data-catalog-library-select="${Render.esc(id)}" ${selected ? 'checked' : ''} aria-label="Selecionar ${Render.esc(record.catalog.title)}" /></label>
        <div class="catalog-library-copy">
          <strong>${Render.esc(record.catalog.title)}</strong>
          <span>${record.selectedIds.length} ${record.selectedIds.length === 1 ? 'produto referenciado' : 'produtos referenciados'} · ${Render.esc(resourcePath(record, current.folders))}</span>
          <small>${active ? 'Aberto agora · ' : ''}Atualizado em ${Render.esc(updated)}</small>
        </div>
        <div class="catalog-library-actions">
          <button class="button secondary compact" type="button" data-catalog-open="${Render.esc(id)}">Abrir</button>
          <button class="button secondary compact" type="button" data-catalog-duplicate="${Render.esc(id)}">Duplicar</button>
        </div>
      </article>`;
    }).join('');
    empty.classList.toggle('hidden', catalogs.length !== 0);

    const hasSelection = selectedCatalogIds.size > 0;
    document.getElementById('catalogLibraryMoveCatalogs').disabled = !hasSelection || moveDestination.value === '__choose__';
    document.getElementById('catalogLibraryDeleteCatalogs').disabled = !hasSelection;

    const hasFolder = Boolean(selectedFolderId);
    document.getElementById('catalogLibraryRenameFolder').disabled = !hasFolder;
    document.getElementById('catalogLibraryMoveFolder').disabled = !hasFolder;
    document.getElementById('catalogLibraryDeleteFolder').disabled = !hasFolder;
    folderParent.disabled = !hasFolder;

    root.dataset.mobileView = mobileView;
    document.querySelectorAll('[data-catalog-library-mobile-view]').forEach(button => {
      const active = button.dataset.catalogLibraryMobileView === mobileView;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
  }

  function selectFolder(id) {
    selectedFolderId = id || null;
    selectedCatalogIds.clear();
    mobileView = selectedFolderId ? 'catalogs' : mobileView;
    render();
  }

  async function createFolder() {
    const parentId = selectedFolderId;
    const name = window.prompt(`Nome da nova pasta em ${pathFor(parentId)}:`, '');
    if (name == null) return;
    try {
      const id = await CatalogStore.createFolder({ name, parentId });
      if (id) {
        selectedFolderId = id;
        mobileView = 'catalogs';
      }
      render();
    } catch (error) {
      alert(error.message || String(error));
    }
  }

  async function renameSelectedFolder() {
    if (!selectedFolderId) return;
    const current = snapshot();
    const folder = current.folders.find(item => item.id === selectedFolderId);
    if (!folder) return;
    const name = window.prompt('Novo nome da pasta:', folder.name);
    if (name == null) return;
    try { await CatalogStore.renameFolder(selectedFolderId, name); }
    catch (error) { alert(error.message || String(error)); }
    render();
  }

  async function moveSelectedFolder() {
    if (!selectedFolderId) return;
    try { await CatalogStore.moveFolder(selectedFolderId, folderParent.value || null); }
    catch (error) { alert(error.message || String(error)); }
    render();
  }

  async function deleteSelectedFolder() {
    if (!selectedFolderId) return;
    const current = snapshot();
    const folder = current.folders.find(item => item.id === selectedFolderId);
    if (!folder) return;
    const parentId = folder.parentId || null;
    if (!window.confirm(`Excluir a pasta vazia “${folder.name}”?`)) return;
    try {
      await CatalogStore.deleteEmptyFolder(selectedFolderId);
      if (!snapshot().folders.some(item => item.id === selectedFolderId)) {
        selectedFolderId = parentId;
        mobileView = parentId ? 'catalogs' : 'folders';
      }
    } catch (error) {
      alert(error.message || String(error));
    }
    render();
  }

  async function moveSelectedCatalogs() {
    if (!selectedCatalogIds.size || moveDestination.value === '__choose__') return;
    const ids = Array.from(selectedCatalogIds);
    try {
      await CatalogStore.moveCatalogs(ids, moveDestination.value || null);
      selectedCatalogIds.clear();
    } catch (error) {
      alert(error.message || String(error));
    }
    render();
  }

  async function deleteSelectedCatalogs() {
    const ids = Array.from(selectedCatalogIds);
    if (!ids.length) return;
    const label = ids.length === 1 ? 'este catálogo salvo' : `estes ${ids.length} catálogos salvos`;
    if (!window.confirm(`Excluir ${label}? A composição aberta não será apagada.`)) return;
    try {
      await CatalogStore.deleteCatalogs(ids);
      const valid = new Set(snapshot().catalogs.map(record => String(record.id)));
      selectedCatalogIds = new Set(ids.filter(id => valid.has(id)));
    } catch (error) {
      alert(error.message || String(error));
    }
    render();
  }

  tree.addEventListener('click', event => {
    const button = event.target.closest('[data-catalog-library-folder]');
    if (button) selectFolder(button.dataset.catalogLibraryFolder);
  });

  list.addEventListener('change', event => {
    const checkbox = event.target.closest('[data-catalog-library-select]');
    if (!checkbox) return;
    const id = String(checkbox.dataset.catalogLibrarySelect);
    if (checkbox.checked) selectedCatalogIds.add(id);
    else selectedCatalogIds.delete(id);
    render();
  });

  list.addEventListener('click', async event => {
    const open = event.target.closest('[data-catalog-open]');
    if (open) {
      if (await CatalogStore.openCatalog(open.dataset.catalogOpen)) NS.App?.switchTab?.('catalog');
      render();
      return;
    }
    const duplicate = event.target.closest('[data-catalog-duplicate]');
    if (duplicate) {
      await CatalogStore.duplicateCatalog(duplicate.dataset.catalogDuplicate, { open: true });
      NS.App?.switchTab?.('catalog');
      render();
    }
  });

  search.addEventListener('input', render);
  moveDestination.addEventListener('change', render);
  folderParent.addEventListener('change', render);
  document.getElementById('catalogLibrarySelectVisible').addEventListener('click', () => {
    scopedCatalogs().forEach(record => selectedCatalogIds.add(String(record.id)));
    render();
  });
  document.getElementById('catalogLibraryClearSelection').addEventListener('click', () => {
    selectedCatalogIds.clear();
    render();
  });
  document.getElementById('catalogLibraryMoveCatalogs').addEventListener('click', moveSelectedCatalogs);
  document.getElementById('catalogLibraryDeleteCatalogs').addEventListener('click', deleteSelectedCatalogs);
  document.getElementById('catalogLibraryCreateFolder').addEventListener('click', createFolder);
  document.getElementById('catalogLibraryRenameFolder').addEventListener('click', renameSelectedFolder);
  document.getElementById('catalogLibraryMoveFolder').addEventListener('click', moveSelectedFolder);
  document.getElementById('catalogLibraryDeleteFolder').addEventListener('click', deleteSelectedFolder);

  document.querySelectorAll('[data-catalog-library-mobile-view]').forEach(button => {
    button.addEventListener('click', () => {
      mobileView = button.dataset.catalogLibraryMobileView;
      render();
    });
  });

  window.addEventListener('catalogotop:catalogs-updated', render);
  window.addEventListener('catalogotop:catalog-opened', render);
  window.addEventListener('catalogotop:library-provider-changed', event => {
    if (event.detail?.provider === 'catalogs') render();
  });
  window.addEventListener('catalogotop:tab-changed', event => {
    if (event.detail?.tabId === 'library') render();
  });

  NS.CatalogLibrary = Object.freeze({ render });
  render();
})();