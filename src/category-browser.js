(function () {
  'use strict';

  const NS = window.CatalogoTop;
  const Core = NS?.Core;
  const FolderTree = NS?.FolderTree;
  const ProductQuery = NS?.ProductQuery;
  const ProductDomain = NS?.ProductDomain;
  const Migration = NS?.ProductFolderMigration;
  const App = NS?.App;
  const Render = NS?.Render;

  const form = document.getElementById('productForm');
  const panel = document.getElementById('productLibraryPanel');
  const categoryInput = document.getElementById('category');
  const subcategoryInput = document.getElementById('subcategory');
  const codeInput = document.getElementById('code');
  const productIdInput = document.getElementById('productId');
  if (!Core || !FolderTree || !ProductQuery || !ProductDomain || !Migration || !App || !Render || !form || !panel || !categoryInput || !subcategoryInput || !codeInput || !productIdInput) return;

  const categoryLabel = categoryInput.closest('label');
  const subcategoryLabel = subcategoryInput.closest('label');
  const deleteButton = document.getElementById('btnDeleteProduct');
  const mobileLibraryButton = document.querySelector('[data-mobile-workspace-target="library"]');

  if (categoryLabel) categoryLabel.hidden = true;
  if (subcategoryLabel) subcategoryLabel.hidden = true;
  if (deleteButton) deleteButton.hidden = true;
  if (mobileLibraryButton) mobileLibraryButton.textContent = 'Existentes';

  const folderField = document.createElement('label');
  folderField.className = 'product-folder-path-field';
  folderField.innerHTML = `Pasta *
    <input id="productFolderPath" list="productFolderPathOptions" autocomplete="off" placeholder="Ex.: Ferragens / Corrediças / Telescópicas" />
    <datalist id="productFolderPathOptions"></datalist>
    <small>Escolha um caminho existente ou digite um novo. Pastas novas são criadas ao salvar o produto.</small>`;
  categoryLabel?.before(folderField);

  panel.innerHTML = `
    <div class="form-head">
      <div><p class="eyebrow">EXISTENTES</p><h3>Produtos nesta pasta e subpastas</h3></div>
      <span id="cadastroScopedCount" class="counter">0 produtos</span>
    </div>
    <div class="list-toolbar"><input id="cadastroProductSearch" type="search" placeholder="Buscar código ou descrição" /></div>
    <div class="table-wrap">
      <table class="product-table cadastro-product-table">
        <thead><tr><th>Código</th><th>Produto</th><th>Pasta</th><th></th></tr></thead>
        <tbody id="cadastroProductRows"></tbody>
      </table>
    </div>
    <div id="cadastroProductsEmpty" class="empty-state hidden"><strong>Nenhum produto neste escopo.</strong><span>Escolha outra pasta ou limpe a busca.</span></div>
    <div hidden aria-hidden="true" data-r1d-legacy-product-list-compat>
      <input id="searchProducts" type="search" />
      <select id="filterCategory"><option value="">Todas as categorias</option></select>
      <span id="productCount"></span>
      <div id="categoryFolders"></div>
      <table><tbody id="productRows"></tbody></table>
      <div id="productsEmpty" class="hidden"></div>
    </div>`;

  const pathInput = document.getElementById('productFolderPath');
  const pathOptions = document.getElementById('productFolderPathOptions');
  const contextSearch = document.getElementById('cadastroProductSearch');
  const contextRows = document.getElementById('cadastroProductRows');
  const contextEmpty = document.getElementById('cadastroProductsEmpty');
  const scopedCount = document.getElementById('cadastroScopedCount');

  function pathSegments(value) {
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
    const record = folderRecords().find(item => item.folder.id === id);
    return record?.label || '';
  }

  function renderFolderOptions() {
    pathOptions.innerHTML = folderRecords().map(record => `<option value="${Render.esc(record.label)}"></option>`).join('');
  }

  function syncLegacyFields() {
    const segments = pathSegments(pathInput.value);
    categoryInput.value = segments[0] || '';
    subcategoryInput.value = segments.slice(1).join(' / ');
    return segments;
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
        </div></td>
      </tr>`).join('');
    contextEmpty.classList.toggle('hidden', products.length !== 0);
  }

  function setPathFromProduct(product) {
    const path = folderPathForId(product?.folderId) || [product?.category, product?.subcategory].filter(Boolean).join(' / ');
    pathInput.value = path;
    syncLegacyFields();
    renderContext();
  }

  function editProduct(id) {
    const product = Core.getState().products.find(item => String(item.id) === String(id));
    if (!product) return;
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
    if (deleteButton) {
      deleteButton.hidden = true;
      deleteButton.disabled = true;
    }
    setPathFromProduct(clone);
    document.querySelector('[data-form-step-target="1"]')?.click();
    codeInput.focus();
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
    if (editButton) {
      editProduct(editButton.dataset.cadastroEdit);
      return;
    }
    const cloneButton = event.target.closest('[data-cadastro-clone]');
    if (cloneButton) useAsBase(cloneButton.dataset.cadastroClone);
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
    editProduct,
    useAsBase,
    pathSegments
  });
})();
