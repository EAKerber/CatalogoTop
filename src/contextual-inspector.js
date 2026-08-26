(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const { Core, Composition, Collection, TableBlock, ComposerSelection, PresentationActions, Render } = NS;
  if (!Core || !ComposerSelection || !PresentationActions || !Render) return;

  const $ = selector => document.querySelector(selector);
  const esc = value => Render.esc(value == null ? '' : value);

  function state() { return Core.getState(); }
  function productById(id) { return state().products.find(product => String(product.id) === String(id)) || null; }
  function blockById(id) { return (state().catalog?.presentation?.blocks || []).find(block => String(block?.id || '') === String(id)) || null; }

  function options(items, selected) {
    return items.map(item => `<option value="${esc(item.id)}"${String(item.id) === String(selected) ? ' selected' : ''}>${esc(item.name)}</option>`).join('');
  }

  function emptyMarkup() {
    return '<div class="inspector-empty"><strong>Ajustes</strong><span>Clique em um item do A4 ou da lista.</span></div>';
  }

  function inspectorHead(kind, title, subtitle) {
    return `<div class="inspector-head"><div><span>${esc(kind)}</span><strong>${esc(title)}</strong>${subtitle ? `<small>${esc(subtitle)}</small>` : ''}</div><button class="inspector-clear" type="button" data-inspector-clear title="Fechar ajustes" aria-label="Fechar ajustes">×</button></div>`;
  }

  function cardMarkup(target) {
    const product = productById(target.productId);
    if (!product) return emptyMarkup();
    const presentation = Composition.normalizePresentation(state().catalog.presentation);
    const style = Composition.styleFor(presentation, product.id);
    return `${inspectorHead('Card', `${product.code} · ${product.description}`, product.category)}
      <div class="inspector-fields" data-inspector-card="${esc(product.id)}">
        <label>Conteúdo<select data-inspector-card-field="contentPreset">${options(Composition.CONTENT_PRESETS, style.contentPreset)}</select></label>
        <label>Ênfase<select data-inspector-card-field="emphasis">${options(Composition.EMPHASIS_PRESETS, style.emphasis)}</select></label>
        <label>Largura<select data-inspector-card-field="width">${options(Composition.WIDTH_PRESETS, style.width)}</select></label>
      </div>
      <button class="inspector-link" type="button" data-inspector-edit-product="${esc(product.id)}">Editar dados do produto</button>`;
  }

  function collectionMarkup(target) {
    const raw = blockById(target.blockId);
    if (!raw || !Collection) return emptyMarkup();
    const block = Collection.normalizeBlock(raw);
    return `${inspectorHead('Collection', block.title || 'Coleção', `${block.memberIds.length} produtos`)}
      <div class="inspector-fields" data-inspector-collection="${esc(block.id)}">
        <label>Título<input data-inspector-collection-field="title" value="${esc(block.title)}" /></label>
        <label>Subtítulo<input data-inspector-collection-field="subtitle" value="${esc(block.subtitle)}" placeholder="Opcional" /></label>
        <div class="inspector-grid-two">
          <label>Tema<select data-inspector-collection-field="theme">${options(Collection.COLLECTION_THEMES, block.theme)}</select></label>
          <label>Colunas<select data-inspector-collection-field="columns">${Collection.COLLECTION_COLUMNS.map(value => `<option value="${value}"${Number(value) === Number(block.columns) ? ' selected' : ''}>${value}</option>`).join('')}</select></label>
        </div>
        <label>Apresentação<select data-inspector-collection-field="itemPreset">${options(Collection.COLLECTION_PRESETS, block.itemPreset)}</select></label>
      </div>
      <button class="inspector-danger" type="button" data-inspector-dissolve-collection="${esc(block.id)}">Desagrupar coleção</button>`;
  }

  function collectionMemberMarkup(target) {
    const raw = blockById(target.blockId);
    const product = productById(target.productId);
    if (!raw || !product || !Collection) return emptyMarkup();
    const block = Collection.normalizeBlock(raw);
    const style = Collection.memberStyleFor(block, product.id);
    return `${inspectorHead('Item da Collection', `${product.code} · ${product.description}`, block.title || 'Coleção')}
      <div class="inspector-fields" data-inspector-collection-member="${esc(product.id)}" data-block-id="${esc(block.id)}">
        <label>Ênfase<select data-inspector-member-field="emphasis"><option value="normal"${style.emphasis === 'normal' ? ' selected' : ''}>Normal</option><option value="feature"${style.emphasis === 'feature' ? ' selected' : ''}>Destaque</option></select></label>
        <label>Largura local<select data-inspector-member-field="width"><option value="simple"${style.width === 'simple' ? ' selected' : ''}>Simples</option><option value="wide"${style.width === 'wide' ? ' selected' : ''}>Largo</option><option value="full"${style.width === 'full' ? ' selected' : ''}>Linha inteira</option></select></label>
      </div>
      <div class="inspector-inline-actions"><button class="inspector-link" type="button" data-inspector-open-collection="${esc(block.id)}">Ajustar coleção</button><button class="inspector-link" type="button" data-inspector-edit-product="${esc(product.id)}">Editar produto</button></div>`;
  }

  function tableMarkup(target) {
    const raw = blockById(target.blockId);
    if (!raw || !TableBlock) return emptyMarkup();
    const block = TableBlock.normalizeBlock(raw);
    const columns = TableBlock.columnsForSource(block.rowSource);
    return `${inspectorHead('Table', block.title || 'Tabela', `${block.memberIds.length} produtos`)}
      <div class="inspector-fields" data-inspector-table="${esc(block.id)}">
        <label>Título<input data-inspector-table-field="title" value="${esc(block.title)}" /></label>
        <label>Subtítulo<input data-inspector-table-field="subtitle" value="${esc(block.subtitle)}" placeholder="Opcional" /></label>
        <div class="inspector-grid-two"><label>Linhas<select data-inspector-table-field="rowSource">${options(TableBlock.TABLE_SOURCES, block.rowSource)}</select></label><label>Densidade<select data-inspector-table-field="density">${options(TableBlock.TABLE_DENSITIES, block.density)}</select></label></div>
        <fieldset class="inspector-columns"><legend>Colunas</legend>${columns.map(column => `<label><input type="checkbox" data-inspector-table-column="${esc(column.id)}"${block.columns.includes(column.id) ? ' checked' : ''} />${esc(column.name)}</label>`).join('')}</fieldset>
      </div>
      <button class="inspector-danger" type="button" data-inspector-dissolve-table="${esc(block.id)}">Desagrupar tabela</button>`;
  }

  function renderInspector() {
    const root = $('#contextualInspector');
    if (!root) return;
    const target = ComposerSelection.get();
    if (!target) { root.innerHTML = emptyMarkup(); return; }
    if (target.kind === 'card') root.innerHTML = cardMarkup(target);
    else if (target.kind === 'collection') root.innerHTML = collectionMarkup(target);
    else if (target.kind === 'collection-member') root.innerHTML = collectionMemberMarkup(target);
    else if (target.kind === 'table') root.innerHTML = tableMarkup(target);
    else root.innerHTML = emptyMarkup();
  }

  function targetFromPreviewNode(node) {
    if (!node) return null;
    const member = node.closest('.catalog-collection-item[data-product-id]');
    if (member) {
      const collection = member.closest('.catalog-collection[data-collection-id]');
      if (collection) return { kind: 'collection-member', blockId: collection.dataset.collectionId, productId: member.dataset.productId };
    }
    const collection = node.closest('.catalog-collection[data-collection-id]');
    if (collection) return { kind: 'collection', blockId: collection.dataset.collectionId };
    const table = node.closest('.catalog-table-block[data-table-block-id]');
    if (table) return { kind: 'table', blockId: table.dataset.tableBlockId };
    const card = node.closest('.catalog-card[data-product-id]');
    if (card) return { kind: 'card', productId: card.dataset.productId };
    return null;
  }

  function previewNodeForTarget(target) {
    if (!target) return null;
    const root = $('#catalogPreview');
    if (!root) return null;
    if (target.kind === 'card') return root.querySelector(`.catalog-card[data-product-id="${CSS.escape(target.productId)}"]`);
    if (target.kind === 'collection') return root.querySelector(`.catalog-collection[data-collection-id="${CSS.escape(target.blockId)}"]`);
    if (target.kind === 'collection-member') {
      const block = root.querySelector(`.catalog-collection[data-collection-id="${CSS.escape(target.blockId)}"]`);
      return block?.querySelector(`.catalog-collection-item[data-product-id="${CSS.escape(target.productId)}"]`) || null;
    }
    if (target.kind === 'table') return root.querySelector(`.catalog-table-block[data-table-block-id="${CSS.escape(target.blockId)}"]`);
    return null;
  }

  function memberIdsForTarget(target) {
    if (!target) return [];
    if (target.productId) return [String(target.productId)];
    const block = target.blockId ? blockById(target.blockId) : null;
    return (Array.isArray(block?.memberIds) ? block.memberIds : []).map(String);
  }

  function applySelectionChrome({ locate = false } = {}) {
    const target = ComposerSelection.get();
    const preview = $('#catalogPreview');
    if (preview) {
      preview.querySelectorAll('.editor-selected').forEach(node => node.classList.remove('editor-selected'));
      preview.querySelectorAll('.catalog-card[data-product-id],.catalog-collection[data-collection-id],.catalog-collection-item[data-product-id],.catalog-table-block[data-table-block-id]').forEach(node => {
        node.setAttribute('tabindex', '0');
        node.setAttribute('data-editor-target', '');
      });
      const node = previewNodeForTarget(target);
      if (node) {
        node.classList.add('editor-selected');
        if (locate) node.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
    }

    const selectedIds = new Set(memberIdsForTarget(target));
    document.querySelectorAll('#selectableProducts [data-product-row]').forEach(row => {
      row.classList.toggle('editor-selected-row', selectedIds.has(String(row.dataset.productRow)));
    });
  }

  function select(target, { locate = false } = {}) {
    ComposerSelection.select(target);
    renderInspector();
    applySelectionChrome({ locate });
  }

  function selectProductFromList(productId) {
    const target = ComposerSelection.targetForProduct(state(), productId);
    if (target) select(target, { locate: true });
  }

  function bindPreview() {
    const preview = $('#catalogPreview');
    if (!preview) return;
    preview.addEventListener('click', event => {
      const target = targetFromPreviewNode(event.target);
      if (target) select(target);
      else if (event.target.closest('.catalog-page')) ComposerSelection.clear();
    });
    preview.addEventListener('keydown', event => {
      if (!['Enter', ' '].includes(event.key)) return;
      const target = targetFromPreviewNode(event.target);
      if (!target) return;
      event.preventDefault();
      select(target);
    });
  }

  function bindList() {
    const list = $('#selectableProducts');
    if (!list) return;
    list.addEventListener('click', event => {
      if (event.target.closest('[data-select-product],[data-order-handle],button,select,input,a')) return;
      const row = event.target.closest('[data-product-row]');
      if (row) selectProductFromList(row.dataset.productRow);
    });
  }

  function updateTableColumns(editor) {
    const blockId = editor?.dataset.inspectorTable;
    if (!blockId) return;
    const checked = Array.from(editor.querySelectorAll('[data-inspector-table-column]:checked')).map(input => input.dataset.inspectorTableColumn);
    if (!checked.length) return;
    PresentationActions.updateTable(blockId, { columns: checked });
  }

  function bindInspector() {
    const inspector = $('#contextualInspector');
    if (!inspector) return;

    inspector.addEventListener('click', event => {
      if (event.target.closest('[data-inspector-clear]')) { ComposerSelection.clear(); return; }
      const edit = event.target.closest('[data-inspector-edit-product]');
      if (edit) {
        NS.App?.switchTab?.('products');
        NS.App?.editProduct?.(edit.dataset.inspectorEditProduct);
        return;
      }
      const openCollection = event.target.closest('[data-inspector-open-collection]');
      if (openCollection) { select({ kind: 'collection', blockId: openCollection.dataset.inspectorOpenCollection }); return; }
      const dissolveCollection = event.target.closest('[data-inspector-dissolve-collection]');
      if (dissolveCollection) { ComposerSelection.clear(); PresentationActions.dissolveCollection(dissolveCollection.dataset.inspectorDissolveCollection); return; }
      const dissolveTable = event.target.closest('[data-inspector-dissolve-table]');
      if (dissolveTable) { ComposerSelection.clear(); PresentationActions.dissolveTable(dissolveTable.dataset.inspectorDissolveTable); }
    });

    inspector.addEventListener('change', event => {
      const cardField = event.target.closest('[data-inspector-card-field]');
      if (cardField) {
        const editor = cardField.closest('[data-inspector-card]');
        PresentationActions.setCardStyle(editor.dataset.inspectorCard, { [cardField.dataset.inspectorCardField]: cardField.value });
        return;
      }
      const collectionField = event.target.closest('[data-inspector-collection-field]');
      if (collectionField) {
        const editor = collectionField.closest('[data-inspector-collection]');
        const key = collectionField.dataset.inspectorCollectionField;
        PresentationActions.updateCollection(editor.dataset.inspectorCollection, { [key]: key === 'columns' ? Number(collectionField.value) : collectionField.value });
        return;
      }
      const memberField = event.target.closest('[data-inspector-member-field]');
      if (memberField) {
        const editor = memberField.closest('[data-inspector-collection-member]');
        PresentationActions.setCollectionMemberStyle(editor.dataset.blockId, editor.dataset.inspectorCollectionMember, { [memberField.dataset.inspectorMemberField]: memberField.value });
        return;
      }
      const tableField = event.target.closest('[data-inspector-table-field]');
      if (tableField) {
        const editor = tableField.closest('[data-inspector-table]');
        PresentationActions.updateTable(editor.dataset.inspectorTable, { [tableField.dataset.inspectorTableField]: tableField.value });
        return;
      }
      const column = event.target.closest('[data-inspector-table-column]');
      if (column) {
        const editor = column.closest('[data-inspector-table]');
        const checked = editor.querySelectorAll('[data-inspector-table-column]:checked');
        if (!checked.length) { column.checked = true; return; }
        updateTableColumns(editor);
      }
    });
  }

  function syncUi() {
    ComposerSelection.reconcile(state());
    renderInspector();
    applySelectionChrome();
  }

  function init() {
    bindPreview();
    bindList();
    bindInspector();
    window.addEventListener('catalogotop:editor-selection-changed', () => {
      renderInspector();
      applySelectionChrome();
    });
    window.addEventListener('catalogotop:catalog-rendered', syncUi);
    window.addEventListener('catalogotop:selection-rendered', () => applySelectionChrome());
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape' && ComposerSelection.get()) ComposerSelection.clear();
    });
    syncUi();
  }

  NS.ContextualInspector = {
    renderInspector,
    targetFromPreviewNode,
    previewNodeForTarget,
    applySelectionChrome,
    select,
    selectProductFromList
  };

  init();
})();