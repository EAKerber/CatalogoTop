(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const { Core, Composition, Collection, TableBlock, ComposerSelection, PresentationActions, Render } = NS;
  if (!Core || !ComposerSelection || !PresentationActions || !Render) return;

  const $ = selector => document.querySelector(selector);
  const esc = value => Render.esc(value == null ? '' : value);
  let inspectorMinimized = false;
  let suppressClickUntil = 0;

  function state() { return Core.getState(); }
  function productById(id) { return state().products.find(product => String(product.id) === String(id)) || null; }
  function blockById(id) { return (state().catalog?.presentation?.blocks || []).find(block => String(block?.id || '') === String(id)) || null; }

  function options(items, selected) {
    return items.map(item => `<option value="${esc(item.id)}"${String(item.id) === String(selected) ? ' selected' : ''}>${esc(item.name)}</option>`).join('');
  }

  function emptyMarkup() {
    return '<div class="inspector-compact-hint"><strong>Ajustes</strong><span>Selecione um item no A4 ou na lista</span></div>';
  }

  function inspectorHead(kind, title, subtitle) {
    return `<div class="inspector-head"><div><span>${esc(kind)}</span><strong>${esc(title)}</strong>${subtitle ? `<small>${esc(subtitle)}</small>` : ''}</div><div class="inspector-head-actions"><button class="inspector-collapse" type="button" data-inspector-toggle title="Recolher ajustes" aria-label="Recolher ajustes" aria-expanded="true">⌃</button><button class="inspector-clear" type="button" data-inspector-clear title="Fechar ajustes" aria-label="Fechar ajustes">×</button></div></div>`;
  }

  function imageFrameMarkup(product, { available = true } = {}) {
    const framing = NS.ImageFraming;
    if (!framing || !product) return '';
    if (!product.image) {
      return `<section class="inspector-image-frame is-unavailable"><div class="inspector-subhead"><strong>Enquadramento</strong><span>Imagem principal</span></div><small>Adicione uma imagem principal ao produto para ajustar o enquadramento.</small></section>`;
    }
    if (!available) {
      return `<section class="inspector-image-frame is-unavailable"><div class="inspector-subhead"><strong>Enquadramento</strong><span>Imagem principal</span></div><small>Este Card usa uma grade de imagens de variações. O enquadramento individual dessas fotos fica fora deste recorte.</small></section>`;
    }
    const presentation = Composition.normalizePresentation(state().catalog.presentation);
    const frame = framing.imageFrameFor(presentation, product.id);
    const zoomPercent = Math.round(frame.zoom * 100);
    return `<section class="inspector-image-frame" data-image-frame-editor="${esc(product.id)}">
      <div class="inspector-subhead"><strong>Enquadramento</strong><span>Imagem principal</span></div>
      <fieldset class="inspector-frame-fit"><legend>Ajuste</legend>${framing.IMAGE_FRAME_FITS.map(item => `<label><input type="radio" name="image-fit-${esc(product.id)}" value="${esc(item.id)}" data-image-frame-field="fit"${item.id === frame.fit ? ' checked' : ''} />${esc(item.name)}</label>`).join('')}</fieldset>
      <label class="inspector-frame-range"><span>Zoom <output data-image-frame-output="zoom">${zoomPercent}%</output></span><input type="range" min="1" max="2.4" step="0.05" value="${frame.zoom}" data-image-frame-field="zoom" /></label>
      <div class="inspector-frame-grid">
        <label class="inspector-frame-range"><span>Horizontal <output data-image-frame-output="x">${frame.x}%</output></span><input type="range" min="0" max="100" step="1" value="${frame.x}" data-image-frame-field="x" /></label>
        <label class="inspector-frame-range"><span>Vertical <output data-image-frame-output="y">${frame.y}%</output></span><input type="range" min="0" max="100" step="1" value="${frame.y}" data-image-frame-field="y" /></label>
      </div>
      <button class="inspector-link inspector-frame-reset" type="button" data-image-frame-reset="${esc(product.id)}">Redefinir enquadramento</button>
    </section>`;
  }

  function effectiveBlockMemberIds(blockId, fallback = []) {
    const unit = NS.CatalogOrder?.allUnits?.(state())?.find(item => ['collection', 'table'].includes(item.type) && String(item.blockId) === String(blockId));
    return (unit?.memberIds || fallback || []).map(String);
  }

  function blockMemberOrderMarkup(blockId, memberIds, label) {
    const ordered = effectiveBlockMemberIds(blockId, memberIds);
    if (ordered.length < 2) return '';
    return `<section class="inspector-member-order" data-inspector-member-order="${esc(blockId)}">
      <div class="inspector-subhead"><strong>Ordem interna</strong><span>${esc(label)}</span></div>
      <div class="inspector-member-order-list">${ordered.map((id, index) => {
        const product = productById(id);
        const title = product ? `${product.code} · ${product.description}` : id;
        return `<div class="inspector-member-order-row" data-inspector-order-product="${esc(id)}">
          <span title="${esc(title)}"><strong>${esc(product?.code || id)}</strong><small>${esc(product?.description || '')}</small></span>
          <div class="inspector-member-order-actions">
            <button type="button" data-inspector-member-move="-1" data-block-id="${esc(blockId)}" data-product-id="${esc(id)}"${index === 0 ? ' disabled' : ''} aria-label="Subir ${esc(product?.code || id)} dentro do bloco">↑</button>
            <button type="button" data-inspector-member-move="1" data-block-id="${esc(blockId)}" data-product-id="${esc(id)}"${index === ordered.length - 1 ? ' disabled' : ''} aria-label="Descer ${esc(product?.code || id)} dentro do bloco">↓</button>
          </div>
        </div>`;
      }).join('')}</div>
    </section>`;
  }

  function cardMarkup(target) {
    const product = productById(target.productId);
    if (!product) return emptyMarkup();
    const presentation = Composition.normalizePresentation(state().catalog.presentation);
    const style = Composition.styleFor(presentation, product.id);
    const hasVariantImages = Array.isArray(product.variants) && product.variants.some(entry => entry?.image);
    return `${inspectorHead('Card', `${product.code} · ${product.description}`, product.category)}
      <div class="inspector-fields" data-inspector-card="${esc(product.id)}">
        <label>Conteúdo<select data-inspector-card-field="contentPreset">${options(Composition.CONTENT_PRESETS, style.contentPreset)}</select></label>
        <label>Ênfase<select data-inspector-card-field="emphasis">${options(Composition.EMPHASIS_PRESETS, style.emphasis)}</select></label>
        <label>Largura<select data-inspector-card-field="width">${options(Composition.WIDTH_PRESETS, style.width)}</select></label>
      </div>
      ${imageFrameMarkup(product, { available: !hasVariantImages })}
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
      ${blockMemberOrderMarkup(block.id, block.memberIds, 'Coleção')}
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
      ${imageFrameMarkup(product)}
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
      ${blockMemberOrderMarkup(block.id, block.memberIds, 'Tabela')}
      <button class="inspector-danger" type="button" data-inspector-dissolve-table="${esc(block.id)}">Desagrupar tabela</button>`;
  }

  function tableRowMarkup(target) {
    const raw = blockById(target.blockId);
    const product = productById(target.productId);
    if (!raw || !product || !TableBlock) return emptyMarkup();
    const block = TableBlock.normalizeBlock(raw);
    const members = block.memberIds.map(productById).filter(Boolean);
    const row = TableBlock.rowsForBlock(block, members).find(item => String(item.rowId) === String(target.rowId));
    if (!row) return tableMarkup({ kind: 'table', blockId: block.id });
    return `${inspectorHead('Linha da Table', `${row.code || product.code} · ${row.description || product.description}`, block.title || 'Tabela')}
      <div class="inspector-fields inspector-row-facts" data-inspector-table-row="${esc(row.rowId)}" data-block-id="${esc(block.id)}" data-product-id="${esc(product.id)}">
        <div><span>Código</span><strong>${esc(row.code || product.code)}</strong></div>
        ${row.variant ? `<div><span>Variação</span><strong>${esc(row.variant)}</strong></div>` : ''}
        ${row.package ? `<div><span>Embalagem</span><strong>${esc(row.package)}</strong></div>` : ''}
        ${row.price ? `<div><span>Preço</span><strong>${esc(row.price)}</strong></div>` : ''}
      </div>
      <div class="inspector-inline-actions"><button class="inspector-link" type="button" data-inspector-open-table="${esc(block.id)}">Ajustar tabela</button><button class="inspector-link" type="button" data-inspector-edit-product="${esc(product.id)}">Editar produto</button></div>`;
  }

  function targetSummary(target) {
    if (!target) return { kind: 'Ajustes', title: 'Selecione um item' };
    if (target.kind === 'card') { const p = productById(target.productId); return { kind: 'Card', title: p ? `${p.code} · ${p.description}` : target.productId }; }
    if (target.kind === 'collection') { const b = blockById(target.blockId); return { kind: 'Collection', title: b?.title || 'Coleção' }; }
    if (target.kind === 'collection-member') { const p = productById(target.productId); return { kind: 'Item da Collection', title: p ? `${p.code} · ${p.description}` : target.productId }; }
    if (target.kind === 'table') { const b = blockById(target.blockId); return { kind: 'Table', title: b?.title || 'Tabela' }; }
    if (target.kind === 'table-row') { const p = productById(target.productId); return { kind: 'Linha da Table', title: p ? `${p.code} · ${p.description}` : target.rowId }; }
    return { kind: 'Ajustes', title: 'Item' };
  }

  function minimizedMarkup(target) {
    const summary = targetSummary(target);
    return `<div class="inspector-minimized-head"><div><span>${esc(summary.kind)}</span><strong>${esc(summary.title)}</strong></div><div class="inspector-head-actions"><button class="inspector-collapse" type="button" data-inspector-toggle title="Expandir ajustes" aria-label="Expandir ajustes" aria-expanded="false">⌄</button><button class="inspector-clear" type="button" data-inspector-clear title="Fechar ajustes" aria-label="Fechar ajustes">×</button></div></div>`;
  }

  function renderInspector() {
    const root = $('#contextualInspector');
    if (!root) return;
    const target = ComposerSelection.get();
    root.classList.toggle('is-collapsed', !target);
    root.classList.toggle('is-minimized', Boolean(target && inspectorMinimized));
    if (!target) { root.innerHTML = emptyMarkup(); return; }
    if (inspectorMinimized) { root.innerHTML = minimizedMarkup(target); return; }
    if (target.kind === 'card') root.innerHTML = cardMarkup(target);
    else if (target.kind === 'collection') root.innerHTML = collectionMarkup(target);
    else if (target.kind === 'collection-member') root.innerHTML = collectionMemberMarkup(target);
    else if (target.kind === 'table') root.innerHTML = tableMarkup(target);
    else if (target.kind === 'table-row') root.innerHTML = tableRowMarkup(target);
    else { root.classList.add('is-collapsed'); root.innerHTML = emptyMarkup(); }
  }

  function targetFromPreviewNode(node) {
    if (!node) return null;
    const tableRow = node.closest('tr[data-table-row-id][data-product-id]');
    if (tableRow) {
      const table = tableRow.closest('.catalog-table-block[data-table-block-id]');
      if (table) return { kind: 'table-row', blockId: table.dataset.tableBlockId, rowId: tableRow.dataset.tableRowId, productId: tableRow.dataset.productId };
    }
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
    if (target.kind === 'table-row') {
      const block = root.querySelector(`.catalog-table-block[data-table-block-id="${CSS.escape(target.blockId)}"]`);
      return block?.querySelector(`tr[data-table-row-id="${CSS.escape(target.rowId)}"]`) || null;
    }
    return null;
  }

  function previewNodesForProduct(productId) {
    const root = $('#catalogPreview');
    if (!root) return [];
    const id = CSS.escape(String(productId));
    return Array.from(root.querySelectorAll(`.catalog-card[data-product-id="${id}"],.catalog-collection-item[data-product-id="${id}"],.catalog-table-block tr[data-product-id="${id}"]`));
  }

  function applySelectionChrome({ locate = false } = {}) {
    const target = ComposerSelection.get();
    const editorialIds = new Set(ComposerSelection.ids?.() || []);
    const preview = $('#catalogPreview');
    if (preview) {
      preview.querySelectorAll('.editor-selected,.editor-multi-selected').forEach(node => node.classList.remove('editor-selected', 'editor-multi-selected'));
      preview.querySelectorAll('.catalog-card[data-product-id],.catalog-collection[data-collection-id],.catalog-collection-item[data-product-id],.catalog-table-block[data-table-block-id],.catalog-table-block tr[data-table-row-id]').forEach(node => {
        node.setAttribute('tabindex', '0');
        node.setAttribute('data-editor-target', '');
      });
      editorialIds.forEach(id => previewNodesForProduct(id).forEach(node => node.classList.add('editor-multi-selected')));
      const node = previewNodeForTarget(target);
      if (node) {
        node.classList.add('editor-selected');
        if (locate) node.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
    }

    document.querySelectorAll('#selectableProducts [data-product-row]').forEach(row => {
      const id = String(row.dataset.productRow || '');
      row.setAttribute('tabindex', '0');
      row.classList.toggle('editor-selected-row', editorialIds.has(id));
      row.classList.toggle('editor-primary-row', Boolean(target?.productId && String(target.productId) === id));
    });
  }

  function select(target, { locate = false, additive = false, range = false } = {}) {
    if (target?.productId) ComposerSelection.selectProduct(state(), target.productId, { target, additive, range });
    else ComposerSelection.select(target);
    renderInspector();
    applySelectionChrome({ locate });
  }

  function selectProductFromList(productId, options = {}) {
    const target = ComposerSelection.targetForProduct(state(), productId);
    if (target) select(target, { locate: true, ...options });
  }

  function modifierOptions(event) {
    return { additive: Boolean(event.ctrlKey || event.metaKey), range: Boolean(event.shiftKey) };
  }

  function bindLongPress(root, resolver) {
    let press = null;
    const cancel = () => {
      if (press?.timer) clearTimeout(press.timer);
      press = null;
    };
    root.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'touch' || event.button !== 0) return;
      const target = resolver(event.target);
      if (!target?.productId) return;
      cancel();
      press = { x: event.clientX, y: event.clientY, target, timer: setTimeout(() => {
        suppressClickUntil = Date.now() + 650;
        select(target, { additive: true });
        press = null;
      }, 450) };
    }, { passive: true });
    root.addEventListener('pointermove', event => {
      if (!press) return;
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 11) cancel();
    }, { passive: true });
    root.addEventListener('pointerup', cancel, { passive: true });
    root.addEventListener('pointercancel', cancel, { passive: true });
  }

  function bindPreview() {
    const preview = $('#catalogPreview');
    if (!preview) return;
    preview.addEventListener('click', event => {
      if (Date.now() < suppressClickUntil) { event.preventDefault(); return; }
      const target = targetFromPreviewNode(event.target);
      if (target) select(target, modifierOptions(event));
      else if (event.target.closest('.catalog-page')) ComposerSelection.clear();
    });
    preview.addEventListener('keydown', event => {
      if (!['Enter', ' '].includes(event.key)) return;
      const target = targetFromPreviewNode(event.target);
      if (!target) return;
      event.preventDefault();
      select(target, modifierOptions(event));
    });
    bindLongPress(preview, targetFromPreviewNode);
  }

  function bindList() {
    const list = $('#selectableProducts');
    if (!list) return;
    list.addEventListener('click', event => {
      if (Date.now() < suppressClickUntil) { event.preventDefault(); return; }
      if (event.target.closest('[data-select-product],[data-order-handle],button,select,input,a')) return;
      const row = event.target.closest('[data-product-row]');
      if (row) selectProductFromList(row.dataset.productRow, modifierOptions(event));
    });
    list.addEventListener('keydown', event => {
      if (!['Enter', ' '].includes(event.key) || event.target.closest('button,input,select,a')) return;
      const row = event.target.closest('[data-product-row]');
      if (!row) return;
      event.preventDefault();
      selectProductFromList(row.dataset.productRow, modifierOptions(event));
    });
    bindLongPress(list, node => {
      const row = node.closest?.('[data-product-row]');
      return row ? ComposerSelection.targetForProduct(state(), row.dataset.productRow) : null;
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
      if (event.target.closest('[data-inspector-toggle]')) { inspectorMinimized = !inspectorMinimized; renderInspector(); return; }
      const frameReset = event.target.closest('[data-image-frame-reset]');
      if (frameReset) { PresentationActions.resetImageFrame(frameReset.dataset.imageFrameReset); return; }
      const move = event.target.closest('[data-inspector-member-move]');
      if (move && !move.disabled) {
        PresentationActions.moveBlockMember(move.dataset.blockId, move.dataset.productId, Number(move.dataset.inspectorMemberMove));
        return;
      }
      const edit = event.target.closest('[data-inspector-edit-product]');
      if (edit) {
        NS.App?.switchTab?.('products');
        NS.App?.editProduct?.(edit.dataset.inspectorEditProduct);
        return;
      }
      const openCollection = event.target.closest('[data-inspector-open-collection]');
      if (openCollection) { select({ kind: 'collection', blockId: openCollection.dataset.inspectorOpenCollection }); return; }
      const openTable = event.target.closest('[data-inspector-open-table]');
      if (openTable) { select({ kind: 'table', blockId: openTable.dataset.inspectorOpenTable }); return; }
      const dissolveCollection = event.target.closest('[data-inspector-dissolve-collection]');
      if (dissolveCollection) { ComposerSelection.clear(); PresentationActions.dissolveCollection(dissolveCollection.dataset.inspectorDissolveCollection); return; }
      const dissolveTable = event.target.closest('[data-inspector-dissolve-table]');
      if (dissolveTable) { ComposerSelection.clear(); PresentationActions.dissolveTable(dissolveTable.dataset.inspectorDissolveTable); }
    });

    inspector.addEventListener('input', event => {
      const frameField = event.target.closest('[data-image-frame-field]');
      if (!frameField || frameField.type !== 'range') return;
      const editor = frameField.closest('[data-image-frame-editor]');
      const output = editor?.querySelector(`[data-image-frame-output="${frameField.dataset.imageFrameField}"]`);
      if (!output) return;
      output.value = frameField.dataset.imageFrameField === 'zoom'
        ? `${Math.round(Number(frameField.value) * 100)}%`
        : `${Math.round(Number(frameField.value))}%`;
    });

    inspector.addEventListener('change', event => {
      const frameField = event.target.closest('[data-image-frame-field]');
      if (frameField) {
        const editor = frameField.closest('[data-image-frame-editor]');
        const key = frameField.dataset.imageFrameField;
        const value = key === 'fit' ? frameField.value : Number(frameField.value);
        PresentationActions.setImageFrame(editor.dataset.imageFrameEditor, { [key]: value });
        return;
      }
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
    window.addEventListener('catalogotop:editor-selection-changed', () => { renderInspector(); applySelectionChrome(); });
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
    selectProductFromList,
    isMinimized: () => inspectorMinimized,
    setMinimized: value => { inspectorMinimized = Boolean(value); renderInspector(); }
  };

  init();
})();