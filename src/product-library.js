(function () {
  'use strict';

  const NS = window.CatalogoTop;
  const { Core, FolderTree, ProductQuery, ProductSnapshot, ProductActions, ProductStore, App, Render } = NS || {};
  const root = document.getElementById('productLibraryAdmin');
  if (!Core || !FolderTree || !ProductQuery || !ProductSnapshot || !ProductActions || !ProductStore || !App || !Render || !root) return;

  const tree = document.getElementById('libraryFolderTree');
  const productList = document.getElementById('libraryProductList');
  const search = document.getElementById('libraryProductSearch');
  const visibleCount = document.getElementById('libraryVisibleCount');
  const selectionCount = document.getElementById('librarySelectionCount');
  const moveDestination = document.getElementById('libraryMoveDestination');
  const folderParent = document.getElementById('libraryFolderParent');
  const folderPath = document.getElementById('libraryFolderPath');
  const empty = document.getElementById('libraryProductsEmpty');

  let selectedFolderId = null;
  let selectedProductIds = new Set();
  let mobileView = 'folders';

  function state() { return Core.getState(); }

  function sortedChildren(folders, parentId) {
    return FolderTree.childrenOf(folders, parentId).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  function pathFor(folderId, folders = state().folders) {
    if (!folderId) return 'Todos os produtos';
    try { return FolderTree.pathOf(folders, folderId).map(folder => folder.name).join(' / '); }
    catch { return 'Todos os produtos'; }
  }

  function productPath(product, folders = state().folders) {
    return product?.folderId ? pathFor(product.folderId, folders) : [product?.category, product?.subcategory].filter(Boolean).join(' / ');
  }

  function scopedProducts(text = search.value.trim()) {
    const current = state();
    return ProductQuery.query({
      products: current.products,
      folders: current.folders,
      folderId: selectedFolderId,
      recursive: true,
      text
    });
  }

  function scopeCount(folderId, current = state()) {
    return ProductQuery.query({
      products: current.products,
      folders: current.folders,
      folderId,
      recursive: true,
      text: ''
    }).length;
  }

  function folderTreeMarkup(folders, parentId = null) {
    return sortedChildren(folders, parentId).map(folder => `
      <div class="library-folder-node">
        <button class="library-folder-button ${selectedFolderId === folder.id ? 'active' : ''}" type="button" data-library-folder="${Render.esc(folder.id)}" aria-pressed="${selectedFolderId === folder.id}">
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
    if (includeRoot) options.push('<option value="">Produtos (raiz)</option>');
    folders
      .map(folder => ({ folder, label: pathFor(folder.id, folders) }))
      .filter(entry => !allowedIds || allowedIds.has(entry.folder.id))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
      .forEach(entry => options.push(`<option value="${Render.esc(entry.folder.id)}">${Render.esc(entry.label)}</option>`));
    return options.join('');
  }

  function reconcileSelection() {
    const valid = new Set(state().products.map(product => String(product.id)));
    selectedProductIds = new Set(Array.from(selectedProductIds).filter(id => valid.has(id)));
  }

  function render() {
    const current = state();
    if (selectedFolderId && !current.folders.some(folder => folder.id === selectedFolderId)) selectedFolderId = null;
    reconcileSelection();

    tree.innerHTML = `
      <button class="library-folder-button root ${selectedFolderId == null ? 'active' : ''}" type="button" data-library-folder="" aria-pressed="${selectedFolderId == null}">
        <span>Todos os produtos</span><small>${current.products.length}</small>
      </button>
      ${folderTreeMarkup(current.folders)}`;

    const allowedParents = validFolderParentIds(current);
    const previousMoveTarget = moveDestination.value;
    const previousParent = folderParent.value;
    moveDestination.innerHTML = `<option value="">Mover para…</option>${folderOptions(current.folders)}`;
    if (current.folders.some(folder => folder.id === previousMoveTarget)) moveDestination.value = previousMoveTarget;
    folderParent.innerHTML = folderOptions(current.folders, { includeRoot: true, allowedIds: allowedParents });
    if (previousParent === '' || allowedParents.has(previousParent)) folderParent.value = previousParent;

    const products = scopedProducts();
    visibleCount.textContent = `${products.length} ${products.length === 1 ? 'produto' : 'produtos'}`;
    selectionCount.textContent = `${selectedProductIds.size} selecionado${selectedProductIds.size === 1 ? '' : 's'}`;
    folderPath.textContent = pathFor(selectedFolderId, current.folders);

    productList.innerHTML = products.map(product => `
      <article class="library-product-row ${selectedProductIds.has(String(product.id)) ? 'selected' : ''}" data-library-product="${Render.esc(product.id)}">
        <label class="library-product-check">
          <input type="checkbox" data-library-select="${Render.esc(product.id)}" ${selectedProductIds.has(String(product.id)) ? 'checked' : ''} aria-label="Selecionar ${Render.esc(product.code)}" />
        </label>
        <div class="library-product-copy">
          <div><strong>${Render.esc(product.code)}</strong><span class="status ${product.status === 'Ativo' ? 'active' : 'inactive'}">${Render.esc(product.status)}</span></div>
          <span>${Render.esc(product.description)}</span>
          <small>${Render.esc(productPath(product, current.folders) || '—')}</small>
        </div>
        <div class="library-product-meta"><strong>${Render.esc(product.price || '—')}</strong></div>
        <button class="button secondary compact" type="button" data-library-edit="${Render.esc(product.id)}">Editar</button>
      </article>`).join('');
    empty.classList.toggle('hidden', products.length !== 0);

    const hasSelection = selectedProductIds.size > 0;
    document.getElementById('libraryMoveProducts').disabled = !hasSelection || !moveDestination.value;
    document.getElementById('libraryDeleteProducts').disabled = !hasSelection;
    document.getElementById('libraryOpenCadastro').disabled = selectedProductIds.size !== 1;

    const hasFolder = Boolean(selectedFolderId);
    document.getElementById('libraryRenameFolder').disabled = !hasFolder;
    document.getElementById('libraryMoveFolder').disabled = !hasFolder;
    document.getElementById('libraryDeleteFolder').disabled = !hasFolder;
    folderParent.disabled = !hasFolder;

    root.dataset.mobileView = mobileView;
    document.querySelectorAll('[data-library-mobile-view]').forEach(button => {
      const active = button.dataset.libraryMobileView === mobileView;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
  }

  async function mutateAndPublish(mutator, { afterMutate = null, detail = null } = {}) {
    try {
      Core.mutate(mutator);
      afterMutate?.();
      window.dispatchEvent(new CustomEvent('catalogotop:products-updated', { detail }));
      render();
      await ProductStore.publishCurrent();
      return true;
    } catch (error) {
      alert(error.message || String(error));
      return false;
    }
  }

  function selectFolder(id) {
    selectedFolderId = id || null;
    selectedProductIds.clear();
    mobileView = selectedFolderId ? 'products' : mobileView;
    render();
  }

  function openCadastro(productId) {
    App.switchTab('products');
    document.querySelector('[data-mobile-workspace-target="form"]')?.click();
    NS.CadastroSurface?.editProduct?.(productId);
  }

  async function moveSelectedProducts() {
    const destination = moveDestination.value;
    if (!destination || !selectedProductIds.size) return;
    const ids = Array.from(selectedProductIds);
    await mutateAndPublish(draft => {
      const moved = ProductSnapshot.moveProducts(draft.folders, draft.products, ids, destination);
      draft.folders = moved.folders;
      draft.products = moved.products;
    }, {
      afterMutate: () => selectedProductIds.clear(),
      detail: { type: 'library-products-moved', productIds: ids, folderId: destination }
    });
  }

  async function createFolder() {
    const parentId = selectedFolderId;
    const parentLabel = pathFor(parentId);
    const name = window.prompt(`Nome da nova pasta em ${parentLabel}:`, '');
    if (name == null) return;
    const id = `folder-${Core.uuid()}`;
    await mutateAndPublish(draft => {
      draft.folders = FolderTree.createFolder(draft.folders, { id, parentId, name });
    }, {
      afterMutate: () => { selectedFolderId = id; mobileView = 'products'; },
      detail: { type: 'library-folder-created', folderId: id }
    });
  }

  async function renameSelectedFolder() {
    if (!selectedFolderId) return;
    const current = state();
    const folder = current.folders.find(item => item.id === selectedFolderId);
    if (!folder) return;
    const name = window.prompt('Novo nome da pasta:', folder.name);
    if (name == null) return;
    await mutateAndPublish(draft => {
      const changed = ProductSnapshot.renameFolder(draft.folders, draft.products, selectedFolderId, name);
      draft.folders = changed.folders;
      draft.products = changed.products;
    }, { detail: { type: 'library-folder-renamed', folderId: selectedFolderId } });
  }

  async function moveSelectedFolder() {
    if (!selectedFolderId) return;
    const parentId = folderParent.value || null;
    await mutateAndPublish(draft => {
      const changed = ProductSnapshot.moveFolder(draft.folders, draft.products, selectedFolderId, parentId);
      draft.folders = changed.folders;
      draft.products = changed.products;
    }, { detail: { type: 'library-folder-moved', folderId: selectedFolderId, parentId } });
  }

  async function deleteSelectedFolder() {
    if (!selectedFolderId) return;
    const current = state();
    const deletedFolderId = selectedFolderId;
    const folder = current.folders.find(item => item.id === deletedFolderId);
    if (!folder) return;
    const parentId = folder.parentId || null;
    if (!window.confirm(`Excluir a pasta vazia “${folder.name}”?`)) return;
    await mutateAndPublish(draft => {
      const changed = ProductSnapshot.deleteEmptyFolder(draft.folders, draft.products, deletedFolderId);
      draft.folders = changed.folders;
      draft.products = changed.products;
    }, {
      afterMutate: () => { selectedFolderId = parentId; mobileView = parentId ? 'products' : 'folders'; },
      detail: { type: 'library-folder-deleted', folderId: deletedFolderId }
    });
  }

  async function deleteSelectedProducts() {
    const ids = Array.from(selectedProductIds);
    if (!ids.length) return;
    try {
      if (await ProductActions.deleteProducts(ids)) {
        selectedProductIds.clear();
        render();
      }
    } catch (error) {
      alert(error.message || 'Não foi possível excluir os produtos.');
    }
  }

  tree.addEventListener('click', event => {
    const button = event.target.closest('[data-library-folder]');
    if (button) selectFolder(button.dataset.libraryFolder);
  });

  productList.addEventListener('change', event => {
    const checkbox = event.target.closest('[data-library-select]');
    if (!checkbox) return;
    const id = String(checkbox.dataset.librarySelect);
    if (checkbox.checked) selectedProductIds.add(id);
    else selectedProductIds.delete(id);
    render();
  });

  productList.addEventListener('click', event => {
    const edit = event.target.closest('[data-library-edit]');
    if (edit) openCadastro(edit.dataset.libraryEdit);
  });

  search.addEventListener('input', render);
  moveDestination.addEventListener('change', render);
  folderParent.addEventListener('change', render);

  document.getElementById('librarySelectVisible').addEventListener('click', () => {
    scopedProducts().forEach(product => selectedProductIds.add(String(product.id)));
    render();
  });
  document.getElementById('libraryClearSelection').addEventListener('click', () => {
    selectedProductIds.clear();
    render();
  });
  document.getElementById('libraryMoveProducts').addEventListener('click', moveSelectedProducts);
  document.getElementById('libraryDeleteProducts').addEventListener('click', deleteSelectedProducts);
  document.getElementById('libraryOpenCadastro').addEventListener('click', () => {
    const [id] = Array.from(selectedProductIds);
    if (id) openCadastro(id);
  });
  document.getElementById('libraryCreateFolder').addEventListener('click', createFolder);
  document.getElementById('libraryRenameFolder').addEventListener('click', renameSelectedFolder);
  document.getElementById('libraryMoveFolder').addEventListener('click', moveSelectedFolder);
  document.getElementById('libraryDeleteFolder').addEventListener('click', deleteSelectedFolder);

  document.querySelectorAll('[data-library-mobile-view]').forEach(button => {
    button.addEventListener('click', () => {
      mobileView = button.dataset.libraryMobileView;
      render();
    });
  });

  window.addEventListener('catalogotop:products-updated', render);
  window.addEventListener('catalogotop:tab-changed', event => {
    if (event.detail?.tabId === 'library') render();
  });

  NS.ProductLibrary = Object.freeze({
    render,
    openProduct(productId) {
      App.switchTab('library');
      const product = state().products.find(item => String(item.id) === String(productId));
      selectedFolderId = product?.folderId || null;
      selectedProductIds = new Set(product ? [String(product.id)] : []);
      mobileView = 'products';
      render();
    }
  });

  render();
})();
