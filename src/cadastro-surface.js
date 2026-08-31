(function () {
  'use strict';

  const NS = window.CatalogoTop;
  const Core = NS?.Core;
  const FolderTree = NS?.FolderTree;
  const ProductQuery = NS?.ProductQuery;
  const ProductDomain = NS?.ProductDomain;
  const ProductSnapshot = NS?.ProductSnapshot;
  const App = NS?.App;
  const Render = NS?.Render;

  const form = document.getElementById('productForm');
  const panel = document.getElementById('cadastroContextPanel');
  const pathInput = document.getElementById('productFolderPath');
  const pathOptions = document.getElementById('productFolderPathOptions');
  const categoryInput = document.getElementById('category');
  const subcategoryInput = document.getElementById('subcategory');
  const codeInput = document.getElementById('code');
  const productIdInput = document.getElementById('productId');
  const contextSearch = document.getElementById('cadastroProductSearch');
  const contextRows = document.getElementById('cadastroProductRows');
  const contextEmpty = document.getElementById('cadastroProductsEmpty');
  const scopedCount = document.getElementById('cadastroScopedCount');

  if (!Core || !FolderTree || !ProductQuery || !ProductDomain || !ProductSnapshot || !App || !Render
      || !form || !panel || !pathInput || !pathOptions || !categoryInput || !subcategoryInput
      || !codeInput || !productIdInput || !contextSearch || !contextRows || !contextEmpty || !scopedCount) return;

  function pathSegments(value = pathInput.value) {
    const raw = String(value || '').trim();
    if (!raw) return [];
    return raw
      .split(/\s+\/\s+/)
      .map(segment => FolderTree.displayName(segment))
      .filter(Boolean);
  }

  function pathKey(segments) {
    return segments.map(segment => FolderTree.nameKey(segment)).join('\u001f');
  }

  function folderRecords() {
    const folders = Core.getState().folders || [];
    return folders.map(folder => {
      const path = FolderTree.pathOf(folders, folder.id).map(item => item.name);
      return { folder, path, key: pathKey(path), label: path.join(' / ') };
    }).sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'));
  }

  function folderRecordForPath(value) {
    const segments = pathSegments(value);
    if (!segments.length) return null;
    const key = pathKey(segments);
    return folderRecords().find(record => record.key === key) || null;
  }

  function folderPathForId(folderId) {
    const id = String(folderId || '').trim();
    if (!id) return '';
    return folderRecords().find(item => item.folder.id === id)?.label || '';
  }

  function renderFolderOptions() {
    pathOptions.innerHTML = folderRecords().map(record => `<option value="${Render.esc(record.label)}"></option>`).join('');
  }

  function syncLegacyFields() {
    const segments = pathSegments();
    categoryInput.value = segments[0] || '';
    subcategoryInput.value = segments.slice(1).join(' / ');
    return segments;
  }

  function assignProduct(draft, product) {
    const segments = pathSegments();
    const assigned = ProductSnapshot.assignPathProduct(draft.folders || [], product, segments, {
      idFactory: () => `folder-${Core.uuid()}`
    });
    draft.folders = assigned.folders;
    return Core.normalizeProduct(assigned.product);
  }

  function scopeProducts() {
    const current = Core.getState();
    const rawPath = pathInput.value.trim();
    const folderRecord = folderRecordForPath(rawPath);
    if (rawPath && !folderRecord) return [];
    return ProductQuery.query({
      products: current.products,
      folders: current.folders,
      folderId: folderRecord?.folder.id || null,
      recursive: true,
      text: contextSearch.value.trim()
    });
  }

  function productPath(product) {
    return folderPathForId(product.folderId) || [product.category, product.subcategory].filter(Boolean).join(' / ');
  }

  function renderContext() {
    renderFolderOptions();
    const products = scopeProducts();
    scopedCount.textContent = `${products.length} ${products.length === 1 ? 'produto' : 'produtos'}`;
    contextRows.innerHTML = products.map(product => `
      <tr data-cadastro-product="${Render.esc(product.id)}">
        <td><strong>${Render.esc(product.code)}</strong></td>
        <td>${Render.esc(product.description)}</td>
        <td><small>${Render.esc(productPath(product) || '—')}</small></td>
        <td><div class="product-row-actions">
          <button class="button secondary compact" type="button" data-cadastro-edit="${Render.esc(product.id)}">Editar</button>
          <button class="button secondary compact" type="button" data-cadastro-clone="${Render.esc(product.id)}">Usar como base</button>
          <button class="button secondary compact" type="button" data-cadastro-library="${Render.esc(product.id)}">Biblioteca</button>
        </div></td>
      </tr>`).join('');
    contextEmpty.classList.toggle('hidden', products.length !== 0);
  }

  function setPathFromProduct(product) {
    pathInput.value = folderPathForId(product?.folderId) || [product?.category, product?.subcategory].filter(Boolean).join(' / ');
    syncLegacyFields();
    renderContext();
  }

  function editProduct(id) {
    const product = Core.getState().products.find(item => String(item.id) === String(id));
    if (!product) return;
    App.switchTab('products');
    document.querySelector('[data-mobile-workspace-target="form"]')?.click();
    App.editProduct(product.id);
    NS.ProductDetails?.loadDetails?.();
    setPathFromProduct(product);
    document.querySelector('[data-form-step-target="1"]')?.click();
  }

  function useAsBase(id) {
    const source = Core.getState().products.find(item => String(item.id) === String(id));
    if (!source) return;
    const clone = ProductDomain.cloneAsNewProduct(source, {
      idFactory: () => Core.uuid(),
      now: () => new Date().toISOString()
    });

    App.switchTab('products');
    document.querySelector('[data-mobile-workspace-target="form"]')?.click();
    App.editProduct(source.id);
    NS.ProductDetails?.loadDetails?.();

    productIdInput.value = clone.id;
    codeInput.value = '';
    document.getElementById('description').value = clone.description;
    document.getElementById('status').value = clone.status;
    document.getElementById('price').value = clone.price;
    document.getElementById('notes').value = clone.notes;
    document.getElementById('specs').value = Core.specsToText(clone.specs);
    document.getElementById('imageUrl').value = clone.image;
    document.getElementById('formTitle').textContent = `Novo produto baseado em ${source.code}`;
    setPathFromProduct(clone);
    document.querySelector('[data-form-step-target="1"]')?.click();
    codeInput.focus();
  }

  function openLibrary(id) {
    NS.ProductLibrary?.openProduct?.(id);
  }

  function resetCadastroPath() {
    pathInput.value = '';
    pathInput.setCustomValidity('');
    codeInput.setCustomValidity('');
    syncLegacyFields();
    renderContext();
  }

  function validateBeforeSubmit(event) {
    const segments = syncLegacyFields();
    if (!segments.length) {
      event.preventDefault();
      event.stopImmediatePropagation();
      pathInput.setCustomValidity('Escolha uma pasta para o produto.');
      pathInput.reportValidity();
      pathInput.focus();
      return;
    }
    pathInput.setCustomValidity('');

    try {
      ProductDomain.assertCodeAvailable(Core.getState().products, codeInput.value, {
        exceptId: productIdInput.value || null
      });
      codeInput.setCustomValidity('');
    } catch (error) {
      event.preventDefault();
      event.stopImmediatePropagation();
      codeInput.setCustomValidity(error.message || 'Código já utilizado por outro produto.');
      codeInput.reportValidity();
      codeInput.focus();
    }
  }

  function selectedFolderId() {
    return folderRecordForPath(pathInput.value)?.folder.id || '';
  }

  pathInput.addEventListener('input', () => {
    pathInput.setCustomValidity('');
    syncLegacyFields();
    renderContext();
  });
  contextSearch.addEventListener('input', renderContext);
  codeInput.addEventListener('input', () => codeInput.setCustomValidity(''));
  form.addEventListener('submit', validateBeforeSubmit, true);
  form.addEventListener('submit', () => setTimeout(renderContext, 0));

  panel.addEventListener('click', event => {
    const editButton = event.target.closest('[data-cadastro-edit]');
    if (editButton) return editProduct(editButton.dataset.cadastroEdit);
    const cloneButton = event.target.closest('[data-cadastro-clone]');
    if (cloneButton) return useAsBase(cloneButton.dataset.cadastroClone);
    const libraryButton = event.target.closest('[data-cadastro-library]');
    if (libraryButton) openLibrary(libraryButton.dataset.cadastroLibrary);
  });

  ['btnNewProduct', 'btnCancelEdit'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => queueMicrotask(resetCadastroPath));
  });

  window.addEventListener('catalogotop:products-updated', renderContext);
  window.addEventListener('catalogotop:tab-changed', event => {
    if (event.detail?.tabId === 'products') renderContext();
  });

  renderContext();

  NS.CadastroSurface = Object.freeze({
    render: renderContext,
    selectedFolderId,
    assignProduct,
    editProduct,
    useAsBase,
    openLibrary,
    pathSegments
  });
})();
