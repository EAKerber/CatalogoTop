(function () {
  'use strict';

  const NS = window.CatalogoTop;
  const { Core, Importer, Templates, Render, AssetClient, ProductStore, Composition } = NS;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  let pendingImport = null;
  let pendingProductImageBlob = null;
  let pendingPreviewUrl = '';
  let draggedOrderUnit = '';

  function state() { return Core.getState(); }

  function save(mutator) {
    try {
      Core.mutate(mutator);
      renderAll();
    } catch (error) {
      alert(error.message || String(error));
    }
  }

  async function publishProducts() {
    if (!ProductStore) return true;
    return ProductStore.publishCurrent();
  }

  function switchTab(tabId) {
    $$('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabId));
    $$('.panel').forEach(panel => panel.classList.toggle('active', panel.id === tabId));
    if (tabId === 'catalog') renderCatalog();
  }

  function productMatches(product, query, category) {
    const haystack = [product.code, product.description, product.category, product.subcategory, product.notes, ...(product.specs || []).flatMap(spec => [spec.label, spec.value])].join(' ').toLowerCase();
    return (!category || product.category === category) && (!query || haystack.includes(query.toLowerCase()));
  }

  function imageValue(product) {
    return product.image || Render.PLACEHOLDER;
  }

  function renderProducts() {
    const current = state();
    const query = $('#searchProducts').value.trim();
    const category = $('#filterCategory').value;
    const products = current.products.filter(product => productMatches(product, query, category));
    $('#productRows').innerHTML = products.map(product => `<tr>
      <td><img class="product-thumb" src="${Render.esc(imageValue(product))}" alt="" /></td>
      <td><strong>${Render.esc(product.code)}</strong><span class="status ${product.status === 'Ativo' ? 'active' : 'inactive'}">${Render.esc(product.status)}</span></td>
      <td><button class="table-product-link" data-edit-product="${Render.esc(product.id)}">${Render.esc(product.description)}</button>${product.notes ? `<small>${Render.esc(product.notes)}</small>` : ''}</td>
      <td>${Render.esc(product.category || '—')}<small>${Render.esc(product.subcategory || '')}</small></td>
      <td><strong>${Render.esc(product.price || '—')}</strong></td>
      <td><div class="product-row-actions">
        <button class="icon-button" data-edit-product="${Render.esc(product.id)}" title="Editar" aria-label="Editar produto">›</button>
        <button class="icon-button danger-action" data-delete-product-direct="${Render.esc(product.id)}" title="Excluir produto" aria-label="Excluir produto">×</button>
      </div></td>
    </tr>`).join('');
    $('#productCount').textContent = `${current.products.length} ${current.products.length === 1 ? 'produto' : 'produtos'}`;
    $('#productsEmpty').classList.toggle('hidden', current.products.length !== 0);
  }

  function categories() {
    return Array.from(new Set(state().products.map(product => product.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  function renderCategorySelects() {
    const values = categories();
    ['filterCategory', 'selectionCategory'].forEach(id => {
      const select = $(`#${id}`);
      const selected = select.value;
      select.innerHTML = `<option value="">Todas as categorias</option>${values.map(category => `<option value="${Render.esc(category)}">${Render.esc(category)}</option>`).join('')}`;
      if (values.includes(selected)) select.value = selected;
    });
  }

  function renderTemplates() {
    const current = state();
    $('#catalogTemplate').innerHTML = Templates.templates.map(template => `<option value="${template.id}" ${template.id === current.catalog.templateId ? 'selected' : ''}>${Render.esc(template.name)}</option>`).join('');
    $('#templateCards').innerHTML = Templates.templates.map(template => `<article class="card template-card ${template.id === current.catalog.templateId ? 'selected' : ''}">
      ${Render.renderTemplatePreview(template)}
      <div class="template-card-copy"><span>${template.perPage} cards / página</span><h3>${Render.esc(template.name)}</h3><p>${Render.esc(template.description)}</p><button class="button ${template.id === current.catalog.templateId ? 'primary' : 'secondary'}" data-template="${template.id}">${template.id === current.catalog.templateId ? 'Em uso' : 'Usar template'}</button></div>
    </article>`).join('');
  }

  function selectionFilters() {
    return { query: $('#searchSelection').value.trim(), category: $('#selectionCategory').value };
  }

  function blockMembership(presentation) {
    const map = new Map();
    (Array.isArray(presentation.blocks) ? presentation.blocks : []).forEach(block => {
      (Array.isArray(block?.memberIds) ? block.memberIds : []).forEach(id => {
        if (!map.has(String(id))) map.set(String(id), block);
      });
    });
    return map;
  }

  function orderUnitMaps(current) {
    const byMember = new Map();
    const leadIds = new Set();
    if (!NS.CatalogOrder) return { byMember, leadIds };
    NS.CatalogOrder.categorySequence(current).forEach(category => {
      NS.CatalogOrder.unitsForCategory(current, category).forEach(unit => {
        unit.memberIds.forEach(id => byMember.set(String(id), unit));
        if (unit.memberIds[0]) leadIds.add(String(unit.memberIds[0]));
      });
    });
    return { byMember, leadIds };
  }

  function unitHandleMarkup(productId, unit, leadIds, reorderDisabled) {
    if (!unit || !leadIds.has(String(productId))) return '<span class="order-handle-spacer" aria-hidden="true"></span>';
    const title = reorderDisabled ? 'Limpe a busca para reordenar.' : `Reordenar ${unit.type === 'card' ? 'produto' : unit.type === 'collection' ? 'coleção' : 'tabela'}`;
    return `<button class="order-handle" type="button" data-order-handle="${Render.esc(unit.id)}" draggable="${reorderDisabled ? 'false' : 'true'}" ${reorderDisabled ? 'disabled' : ''} title="${Render.esc(title)}" aria-label="${Render.esc(title)}">⋮⋮</button>`;
  }

  function renderSelection() {
    const current = state();
    const presentation = Composition.normalizePresentation(current.catalog.presentation);
    const membership = blockMembership(presentation);
    const orderMap = NS.SelectionOrder?.effectiveOrderMap(current) || new Map(current.selectedIds.map((id, index) => [String(id), index + 1]));
    const { byMember, leadIds } = orderUnitMaps(current);
    const { query, category } = selectionFilters();
    const reorderDisabled = Boolean(query);
    const available = current.products
      .filter(product => product.status === 'Ativo' && productMatches(product, query, category))
      .map((product, domIndex) => ({
        product,
        domIndex,
        selected: current.selectedIds.map(String).includes(String(product.id)),
        effectiveOrder: orderMap.get(String(product.id)) || Number.POSITIVE_INFINITY
      }))
      .sort((left, right) => {
        if (left.selected !== right.selected) return left.selected ? -1 : 1;
        if (left.selected && right.selected) return left.effectiveOrder - right.effectiveOrder || left.domIndex - right.domIndex;
        return left.domIndex - right.domIndex;
      });

    $('#selectableProducts').innerHTML = available.length ? available.map(entry => {
      const product = entry.product;
      const id = String(product.id);
      const selected = entry.selected;
      const order = selected && Number.isFinite(entry.effectiveOrder) ? entry.effectiveOrder : null;
      const block = membership.get(id);
      const baseStyle = Composition.styleFor(presentation, id);
      const resolvedPreset = Composition.resolveContentPreset(product, baseStyle.contentPreset);
      const blockClass = block?.type === 'collection' ? ' in-collection' : block?.type === 'table' ? ' in-table' : '';
      const badge = selected && block?.type === 'collection'
        ? `<span class="collection-member-badge">Coleção · ${Render.esc(block.title || 'sem título')}</span>`
        : selected && block?.type === 'table'
          ? `<span class="table-member-badge">Tabela · ${Render.esc(block.title || 'sem título')}</span>` : '';
      const unit = selected ? byMember.get(id) : null;
      const unitAttr = selected && unit && leadIds.has(id) ? ` data-order-unit="${Render.esc(unit.id)}" data-order-category="${Render.esc(unit.category)}"` : '';
      return `<div class="select-product ${selected ? 'selected' : ''}${blockClass}" data-product-row="${Render.esc(id)}"${order ? ` data-effective-order="${order}"` : ''}${unitAttr}>
        <input type="checkbox" data-select-product="${Render.esc(id)}" ${selected ? 'checked' : ''} aria-label="${selected ? 'Remover' : 'Adicionar'} ${Render.esc(product.code)} do catálogo" />
        ${selected ? unitHandleMarkup(id, unit, leadIds, reorderDisabled) : '<span class="order-handle-spacer" aria-hidden="true"></span>'}
        <img src="${Render.esc(imageValue(product))}" alt="" />
        <span><strong>${Render.esc(product.code)} · ${Render.esc(product.description)}</strong><small>${Render.esc([product.category, product.subcategory].filter(Boolean).join(' / '))}${baseStyle.contentPreset === 'auto' ? ` · auto: ${Render.esc(resolvedPreset)}` : ''}</small>${badge}</span>
        ${order ? `<b class="selection-order" title="Ordem editorial efetiva">${order}</b>` : ''}
      </div>`;
    }).join('') : '<div class="empty-state compact-empty"><strong>Nenhum produto disponível.</strong><span>Ajuste o filtro ou cadastre produtos ativos.</span></div>';

    window.dispatchEvent(new CustomEvent('catalogotop:selection-rendered'));
  }

  function renderCatalog() {
    const current = state();
    const presentation = Composition.normalizePresentation(current.catalog.presentation);
    $('#catalogTitle').value = current.catalog.title;
    $('#catalogShowPrices').checked = current.catalog.showPrices;
    $('#catalogDistribution').value = presentation.distribution;
    $('#catalogTypography').value = presentation.typography;
    $('#catalogCreatedAt').textContent = Render.formatDate(current.catalog.createdAt);
    const summary = Render.renderCatalog($('#catalogPreview'), current);
    $('#selectedCount').textContent = `${summary.selectedCount} ${summary.selectedCount === 1 ? 'selecionado' : 'selecionados'}`;
    $('#pageCount').textContent = `${summary.pageCount} ${summary.pageCount === 1 ? 'página' : 'páginas'}`;
    NS.ComposerSelection?.reconcile?.(current);
    window.dispatchEvent(new CustomEvent('catalogotop:catalog-rendered', { detail: summary.document || null }));
    return summary;
  }

  function renderAll() {
    renderCategorySelects();
    renderProducts();
    renderTemplates();
    renderSelection();
    renderCatalog();
  }

  function releasePendingPreview() {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    pendingPreviewUrl = '';
    pendingProductImageBlob = null;
  }

  function clearProductForm() {
    releasePendingPreview();
    $('#productForm').reset();
    $('#productId').value = '';
    $('#formTitle').textContent = 'Novo produto';
    $('#btnDeleteProduct').disabled = true;
    $('#imagePreview').removeAttribute('src');
    $('#imageDropzone').classList.remove('has-image');
  }

  function editProduct(id) {
    releasePendingPreview();
    const product = state().products.find(item => String(item.id) === String(id));
    if (!product) return;
    $('#productId').value = product.id;
    $('#code').value = product.code;
    $('#description').value = product.description;
    $('#category').value = product.category;
    $('#subcategory').value = product.subcategory;
    $('#price').value = product.price;
    $('#status').value = product.status;
    $('#notes').value = product.notes;
    $('#imageUrl').value = product.image && !product.image.startsWith('data:') ? product.image : '';
    $('#specs').value = Core.specsToText(product.specs);
    $('#imagePreview').src = imageValue(product);
    $('#imageDropzone').classList.add('has-image');
    $('#formTitle').textContent = `Editar ${product.code}`;
    $('#btnDeleteProduct').disabled = false;
    $('#productForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function setProductImage(file) {
    if (!file || !file.type.startsWith('image/')) return;
    try {
      releasePendingPreview();
      pendingProductImageBlob = await AssetClient.prepareImage(file);
      pendingPreviewUrl = URL.createObjectURL(pendingProductImageBlob);
      $('#imagePreview').src = pendingPreviewUrl;
      $('#imageDropzone').classList.add('has-image');
    } catch (error) {
      alert(error.message || 'Não foi possível preparar a imagem.');
    }
  }

  function reportImport(result, file) {
    const report = result.report;
    const invalidText = report.invalid.length ? `<div class="import-warning"><strong>${report.invalid.length} linha(s) ignorada(s)</strong><span>${report.invalid.slice(0, 4).map(item => `Linha ${item.row}: ${item.reason}`).join(' · ')}</span></div>` : '';
    $('#importReport').innerHTML = `<div class="import-summary">
      <div><strong>${Render.esc(file.name)}</strong><span>${report.validRows} válidas de ${report.totalRows} linhas${report.sheetName ? ` · aba ${Render.esc(report.sheetName)}` : ''}</span></div>
      <div><span>Mapeadas</span><strong>${report.mapped.length ? report.mapped.map(Render.esc).join(', ') : 'nenhuma'}</strong></div>
      <div><span>Especificações extras</span><strong>${report.extras.length ? report.extras.map(Render.esc).join(', ') : 'nenhuma'}</strong></div>
      <button class="button primary" id="btnConfirmImport" ${result.products.length ? '' : 'disabled'}>Importar ${result.products.length}</button>
    </div>${invalidText}`;
    $('#importReport').classList.remove('hidden');
    $('#btnConfirmImport')?.addEventListener('click', async () => {
      if (!pendingImport) return;
      Core.mergeProducts(pendingImport.products, $('#importMode').value);
      pendingImport = null;
      $('#importProductsFile').value = '';
      $('#importReport').classList.add('hidden');
      renderAll();
      await publishProducts();
    });
  }

  async function handleProductImport(file) {
    if (!file) return;
    $('#importReport').classList.remove('hidden');
    $('#importReport').innerHTML = '<div class="import-loading">Lendo arquivo…</div>';
    try {
      const result = await Importer.parseFile(file);
      pendingImport = result;
      reportImport(result, file);
    } catch (error) {
      pendingImport = null;
      $('#importReport').innerHTML = `<div class="import-error"><strong>Não foi possível importar.</strong><span>${Render.esc(error.message || String(error))}</span></div>`;
    }
  }

  function download(name, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function removeMembershipFromBlocks(presentation, productId) {
    const id = String(productId);
    presentation.blocks = (Array.isArray(presentation.blocks) ? presentation.blocks : [])
      .map(block => NS.ProductActions?.cleanupBlock ? NS.ProductActions.cleanupBlock(block, id) : block)
      .filter(Boolean);
  }

  function setMembership(id, checked) {
    save(draft => {
      const productId = String(id);
      const presentation = Composition.normalizePresentation(draft.catalog.presentation);
      const selected = draft.selectedIds.map(String);
      if (checked && !selected.includes(productId)) draft.selectedIds.push(productId);
      if (!checked) {
        draft.selectedIds = selected.filter(item => item !== productId);
        presentation.order = NS.CatalogOrder?.removeFromOrder ? NS.CatalogOrder.removeFromOrder(presentation.order, productId) : presentation.order.filter(item => item !== productId);
        removeMembershipFromBlocks(presentation, productId);
      }
      draft.catalog.presentation = presentation;
      if (checked && NS.CatalogOrder?.effectiveIds) draft.catalog.presentation.order = NS.CatalogOrder.effectiveIds(draft);
    });
  }

  async function deleteProductFromUi(id) {
    try {
      if (!NS.ProductActions?.deleteProduct) throw new Error('Operação de exclusão indisponível.');
      const deleted = await NS.ProductActions.deleteProduct(id);
      if (deleted && String($('#productId').value || '') === String(id)) clearProductForm();
    } catch (error) {
      alert(error.message || 'Não foi possível excluir o produto.');
    }
  }

  function bindOrderEvents(root) {
    root.addEventListener('dragstart', event => {
      const handle = event.target.closest('[data-order-handle]');
      if (!handle || handle.disabled) return;
      draggedOrderUnit = String(handle.dataset.orderHandle || '');
      const row = handle.closest('[data-order-unit]');
      row?.classList.add('is-dragging');
      event.dataTransfer?.setData('text/plain', draggedOrderUnit);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    });

    root.addEventListener('dragover', event => {
      if (!draggedOrderUnit) return;
      const row = event.target.closest('[data-order-unit]');
      if (!row || row.dataset.orderUnit === draggedOrderUnit) return;
      event.preventDefault();
      root.querySelectorAll('.order-drop-target').forEach(item => item.classList.remove('order-drop-target'));
      row.classList.add('order-drop-target');
    });

    root.addEventListener('drop', event => {
      if (!draggedOrderUnit) return;
      const row = event.target.closest('[data-order-unit]');
      if (!row || row.dataset.orderUnit === draggedOrderUnit) return;
      event.preventDefault();
      const rect = row.getBoundingClientRect();
      const position = event.clientY > rect.top + rect.height / 2 ? 'after' : 'before';
      NS.PresentationActions?.moveOrderUnit?.(draggedOrderUnit, row.dataset.orderUnit, position);
    });

    root.addEventListener('dragend', () => {
      draggedOrderUnit = '';
      root.querySelectorAll('.is-dragging,.order-drop-target').forEach(item => item.classList.remove('is-dragging', 'order-drop-target'));
    });

    root.addEventListener('keydown', event => {
      const handle = event.target.closest('[data-order-handle]');
      if (!handle || handle.disabled || !event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      NS.PresentationActions?.moveOrderUnitRelative?.(handle.dataset.orderHandle, event.key === 'ArrowUp' ? -1 : 1);
    });
  }

  function bindEvents() {
    $$('.tab').forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));
    $('#btnNewProduct').addEventListener('click', clearProductForm);
    $('#btnCancelEdit').addEventListener('click', clearProductForm);
    $('#searchProducts').addEventListener('input', renderProducts);
    $('#filterCategory').addEventListener('change', renderProducts);
    $('#searchSelection').addEventListener('input', renderSelection);
    $('#selectionCategory').addEventListener('change', renderSelection);
    $('#importProductsFile').addEventListener('change', event => handleProductImport(event.target.files[0]));

    $('#productRows').addEventListener('click', event => {
      const deleteButton = event.target.closest('[data-delete-product-direct]');
      if (deleteButton) {
        event.preventDefault();
        deleteProductFromUi(deleteButton.dataset.deleteProductDirect);
        return;
      }
      const editButton = event.target.closest('[data-edit-product]');
      if (editButton) editProduct(editButton.dataset.editProduct);
    });

    $('#productForm').addEventListener('submit', async event => {
      event.preventDefault();
      const id = $('#productId').value || Core.uuid();
      const existing = state().products.find(product => product.id === id);
      const urlImage = $('#imageUrl').value.trim();
      let image = existing?.image || '';

      if (pendingProductImageBlob) {
        if (!ProductStore.isWritable() && !await ProductStore.unlock()) return;
        try {
          image = await AssetClient.uploadBlob(pendingProductImageBlob);
        } catch (error) {
          if (error.code === 'write_session_required' && await ProductStore.unlock()) image = await AssetClient.uploadBlob(pendingProductImageBlob);
          else { alert(error.message || 'Não foi possível enviar a imagem.'); return; }
        }
      } else if (urlImage) image = urlImage;

      const product = Core.normalizeProduct({
        ...existing,
        id,
        code: $('#code').value,
        description: $('#description').value,
        category: $('#category').value,
        subcategory: $('#subcategory').value,
        price: $('#price').value,
        status: $('#status').value,
        notes: $('#notes').value,
        specs: Core.parseSpecsText($('#specs').value),
        image,
        updatedAt: new Date().toISOString()
      });
      if (!product.code || !product.description) return;
      save(draft => {
        const index = draft.products.findIndex(item => item.id === id);
        if (index >= 0) draft.products[index] = product;
        else draft.products.push(product);
      });
      clearProductForm();
      await publishProducts();
    });

    $('#btnDeleteProduct').addEventListener('click', () => {
      const id = $('#productId').value;
      if (id) deleteProductFromUi(id);
    });

    const dropzone = $('#imageDropzone');
    ['dragenter', 'dragover'].forEach(name => dropzone.addEventListener(name, event => { event.preventDefault(); dropzone.classList.add('dragging'); }));
    ['dragleave', 'drop'].forEach(name => dropzone.addEventListener(name, event => { event.preventDefault(); dropzone.classList.remove('dragging'); }));
    dropzone.addEventListener('drop', event => setProductImage(event.dataTransfer.files[0]));
    $('#imageFile').addEventListener('change', event => setProductImage(event.target.files[0]));
    $('#imageUrl').addEventListener('change', event => {
      if (!event.target.value.trim()) return;
      releasePendingPreview();
      $('#imagePreview').src = event.target.value.trim();
      dropzone.classList.add('has-image');
    });

    const selectionRoot = $('#selectableProducts');
    selectionRoot.addEventListener('change', event => {
      const checkbox = event.target.closest('[data-select-product]');
      if (!checkbox) return;
      setMembership(checkbox.dataset.selectProduct, checkbox.checked);
    });
    bindOrderEvents(selectionRoot);

    $('#btnSelectVisible').addEventListener('click', () => {
      const { query, category } = selectionFilters();
      const visibleIds = state().products.filter(product => product.status === 'Ativo' && productMatches(product, query, category)).map(product => String(product.id));
      save(draft => {
        visibleIds.forEach(id => { if (!draft.selectedIds.map(String).includes(id)) draft.selectedIds.push(id); });
        const presentation = Composition.normalizePresentation(draft.catalog.presentation);
        draft.catalog.presentation = presentation;
        if (NS.CatalogOrder?.effectiveIds) draft.catalog.presentation.order = NS.CatalogOrder.effectiveIds(draft);
      });
    });

    $('#btnClearSelection').addEventListener('click', () => save(draft => {
      draft.selectedIds = [];
      const presentation = Composition.normalizePresentation(draft.catalog.presentation);
      presentation.order = [];
      presentation.blocks = [];
      draft.catalog.presentation = presentation;
    }));

    $('#catalogTitle').addEventListener('input', event => save(draft => { draft.catalog.title = event.target.value; }));
    $('#catalogShowPrices').addEventListener('change', event => save(draft => { draft.catalog.showPrices = event.target.checked; }));
    $('#catalogTemplate').addEventListener('change', event => save(draft => { draft.catalog.templateId = event.target.value; }));
    $('#catalogDistribution').addEventListener('change', event => save(draft => {
      draft.catalog.presentation = Composition.normalizePresentation({ ...draft.catalog.presentation, distribution: event.target.value });
    }));
    $('#catalogTypography').addEventListener('change', event => save(draft => {
      draft.catalog.presentation = Composition.normalizePresentation({ ...draft.catalog.presentation, typography: event.target.value });
    }));
    $('#btnNewCatalog').addEventListener('click', () => {
      if (!confirm('Iniciar um novo catálogo? A base de produtos será preservada e apenas a seleção/configuração do catálogo será reiniciada.')) return;
      Core.resetCatalog();
      NS.ComposerSelection?.clear?.();
      renderAll();
    });
    $('#btnPrint').addEventListener('click', () => { switchTab('catalog'); setTimeout(() => window.print(), 0); });

    $('#templateCards').addEventListener('click', event => {
      const button = event.target.closest('[data-template]');
      if (!button) return;
      save(draft => { draft.catalog.templateId = button.dataset.template; });
      switchTab('catalog');
    });

    $('#btnExportBackup').addEventListener('click', () => {
      download(`catalogotop-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state(), null, 2), 'application/json');
    });
    $('#backupFile').addEventListener('change', async event => {
      const file = event.target.files[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        Core.setState(parsed);
        NS.ComposerSelection?.clear?.();
        clearProductForm();
        renderAll();
        if (confirm('Backup carregado localmente. Publicar os produtos deste backup na base compartilhada?')) await publishProducts();
      } catch (error) {
        alert('Backup inválido ou incompatível.');
      } finally {
        event.target.value = '';
      }
    });

    window.addEventListener('catalogotop:products-updated', renderAll);
  }

  NS.App = {
    state,
    switchTab,
    renderProducts,
    renderSelection,
    renderCatalog,
    renderAll,
    editProduct,
    selectionFilters,
    setMembership
  };

  bindEvents();
  renderAll();
})();