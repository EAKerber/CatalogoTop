(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const { Core, Collection, Composition, Render } = NS;
  if (!Core || !Collection || !Composition || !Render) return;
  const $ = selector => document.querySelector(selector);

  function state() { return Core.getState(); }
  function currentBlocks() { return Collection.normalizeBlocks(state().catalog?.presentation?.blocks); }
  function esc(value) { return Render.esc(value); }

  function notify() {
    window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
  }

  function mergeCollections(allBlocks, collections) {
    const byId = new Map(collections.map(block => [block.id, block]));
    const emitted = new Set();
    const merged = [];
    (Array.isArray(allBlocks) ? allBlocks : []).forEach(block => {
      if (block?.type !== 'collection') { merged.push(block); return; }
      const next = byId.get(String(block.id));
      if (!next) return;
      emitted.add(next.id);
      merged.push(next);
    });
    collections.forEach(block => { if (!emitted.has(block.id)) merged.push(block); });
    return merged;
  }

  function mutateBlocks(mutator) {
    Core.mutate(draft => {
      const presentation = Composition.normalizePresentation(draft.catalog.presentation);
      const allBlocks = presentation.blocks.slice();
      const collections = Collection.normalizeBlocks(allBlocks);
      mutator(collections, draft);
      draft.catalog.presentation = Composition.normalizePresentation({ ...presentation, blocks: mergeCollections(allBlocks, collections) });
    });
    notify();
  }

  function allBlockMemberIds() {
    const ids = new Set();
    (state().catalog?.presentation?.blocks || []).forEach(block => {
      (Array.isArray(block?.memberIds) ? block.memberIds : []).forEach(id => ids.add(String(id)));
    });
    return ids;
  }

  function selectedProducts() {
    const current = state();
    const byId = new Map(current.products.map(product => [String(product.id), product]));
    return current.selectedIds.map(id => byId.get(String(id))).filter(product => product && product.status !== 'Inativo');
  }

  function visibleSelectedIds() {
    return Array.from(document.querySelectorAll('#selectableProducts > .select-product [data-select-product]:checked'))
      .map(input => String(input.dataset.selectProduct || '')).filter(Boolean);
  }

  function candidateIds() {
    const membership = allBlockMemberIds();
    const visible = new Set(visibleSelectedIds().filter(id => !membership.has(id)));
    if (visible.size < 2) return [];
    const selected = selectedProducts();
    const candidates = selected.filter(product => visible.has(String(product.id)));
    if (candidates.length < 2) return [];
    const category = String(candidates[0].category || 'Sem categoria');
    if (candidates.some(product => String(product.category || 'Sem categoria') !== category)) return [];
    const categoryProducts = selected.filter(product => String(product.category || 'Sem categoria') === category);
    const positions = new Map(categoryProducts.map((product, index) => [String(product.id), index]));
    const candidatePositions = candidates.map(product => positions.get(String(product.id)));
    if (!candidatePositions.every((position, index) => index === 0 || position === candidatePositions[index - 1] + 1)) return [];
    return candidates.map(product => String(product.id));
  }

  function ensureShell() {
    const actions = $('.selection-actions');
    if (!actions) return;
    if (!$('#btnCreateCollection')) {
      const button = document.createElement('button');
      button.className = 'button secondary compact';
      button.id = 'btnCreateCollection';
      button.type = 'button';
      button.textContent = 'Agrupar em coleção';
      actions.appendChild(button);
      button.addEventListener('click', createCollection);
    }
    if (!$('#collectionManager')) {
      const manager = document.createElement('div');
      manager.id = 'collectionManager';
      manager.className = 'collection-manager';
      const bulk = $('.bulk-presentation-controls');
      (bulk || actions).insertAdjacentElement('afterend', manager);
      bindManager(manager);
    }
  }

  function createCollection() {
    const ids = candidateIds();
    if (ids.length < 2) {
      alert('Para criar uma coleção, deixe visíveis ao menos dois produtos selecionados, ainda não agrupados, contíguos e da mesma categoria.');
      return;
    }
    if (ids.length > Collection.MAX_MEMBERS) {
      alert(`O primeiro recorte aceita até ${Collection.MAX_MEMBERS} produtos por coleção.`);
      return;
    }
    const byId = new Map(state().products.map(product => [String(product.id), product]));
    const category = byId.get(ids[0])?.category || 'Coleção';
    mutateBlocks(blocks => blocks.push(Collection.normalizeBlock({
      id: `collection-${Date.now()}`,
      memberIds: ids,
      title: category,
      subtitle: '',
      theme: 'light',
      columns: 4,
      itemPreset: 'visual',
      itemStyles: {}
    }, blocks.length)));
  }

  function collectionMarkup(block) {
    const byId = new Map(state().products.map(product => [String(product.id), product]));
    const members = block.memberIds.map(id => byId.get(String(id))).filter(Boolean);
    return `<section class="collection-manager-card" data-collection-editor="${esc(block.id)}">
      <div class="collection-manager-head">
        <div><strong>${esc(block.title || 'Coleção')}</strong><span>${members.length} ${members.length === 1 ? 'produto' : 'produtos'}</span></div>
        <button class="icon-button collection-dissolve" type="button" data-dissolve-collection="${esc(block.id)}" title="Desagrupar">×</button>
      </div>
      <label>Título<input data-collection-field="title" value="${esc(block.title)}" /></label>
      <label>Subtítulo<input data-collection-field="subtitle" value="${esc(block.subtitle)}" placeholder="Opcional" /></label>
      <div class="collection-manager-grid">
        <label>Tema<select data-collection-field="theme">${Collection.COLLECTION_THEMES.map(item => `<option value="${item.id}"${item.id === block.theme ? ' selected' : ''}>${esc(item.name)}</option>`).join('')}</select></label>
        <label>Colunas<select data-collection-field="columns">${Collection.COLLECTION_COLUMNS.map(value => `<option value="${value}"${value === block.columns ? ' selected' : ''}>${value}</option>`).join('')}</select></label>
        <label>Apresentação<select data-collection-field="itemPreset">${Collection.COLLECTION_PRESETS.map(item => `<option value="${item.id}"${item.id === block.itemPreset ? ' selected' : ''}>${esc(item.name)}</option>`).join('')}</select></label>
      </div>
      <small>Ordem interna herdada da seleção · sem coordenadas livres</small>
    </section>`;
  }

  function renderManager() {
    ensureShell();
    const manager = $('#collectionManager');
    const button = $('#btnCreateCollection');
    if (!manager || !button) return;
    const blocks = currentBlocks();
    const ids = candidateIds();
    button.disabled = ids.length < 2 || ids.length > Collection.MAX_MEMBERS;
    button.title = button.disabled
      ? 'Deixe visível um trecho contíguo de 2 a 12 produtos selecionados da mesma categoria e ainda não usado em outro bloco.'
      : `Agrupar ${ids.length} produtos visíveis`;
    manager.innerHTML = blocks.length
      ? `<div class="collection-manager-title"><strong>Coleções</strong><span>${blocks.length}</span></div>${blocks.map(collectionMarkup).join('')}` : '';
  }

  function bindManager(manager) {
    manager.addEventListener('click', event => {
      const dissolve = event.target.closest('[data-dissolve-collection]');
      if (!dissolve) return;
      mutateBlocks(blocks => {
        const index = blocks.findIndex(block => block.id === dissolve.dataset.dissolveCollection);
        if (index >= 0) blocks.splice(index, 1);
      });
    });
    manager.addEventListener('change', event => {
      const field = event.target.closest('[data-collection-field]');
      const editor = field?.closest('[data-collection-editor]');
      if (!field || !editor) return;
      mutateBlocks(blocks => {
        const block = blocks.find(item => item.id === editor.dataset.collectionEditor);
        if (!block) return;
        const key = field.dataset.collectionField;
        block[key] = key === 'columns' ? Number(field.value) : field.value;
      });
    });
  }

  function updateMemberStyle(blockId, productId, patch) {
    mutateBlocks(blocks => {
      const block = blocks.find(item => item.id === blockId);
      if (!block || !block.memberIds.includes(String(productId))) return;
      block.itemStyles[String(productId)] = { ...Collection.memberStyleFor(block, productId), ...patch };
    });
  }

  function bindSelectionExtensions() {
    const root = $('#selectableProducts');
    if (!root) return;
    root.addEventListener('change', event => {
      const emphasis = event.target.closest('[data-collection-member-emphasis]');
      if (emphasis) {
        updateMemberStyle(emphasis.dataset.blockId, emphasis.dataset.collectionMemberEmphasis, { emphasis: emphasis.value });
        return;
      }
      const width = event.target.closest('[data-collection-member-width]');
      if (width) updateMemberStyle(width.dataset.blockId, width.dataset.collectionMemberWidth, { width: width.value });
    }, true);

    root.addEventListener('change', event => {
      const checkbox = event.target.closest('[data-select-product]');
      if (!checkbox || checkbox.checked) return;
      const id = String(checkbox.dataset.selectProduct);
      const block = Collection.blockForMember(currentBlocks(), id);
      if (!block) return;
      Core.mutate(draft => {
        const presentation = Composition.normalizePresentation(draft.catalog.presentation);
        const allBlocks = presentation.blocks.slice();
        const collections = Collection.normalizeBlocks(allBlocks);
        const target = collections.find(item => item.id === block.id);
        if (!target) return;
        target.memberIds = target.memberIds.filter(memberId => memberId !== id);
        const nextCollections = collections.filter(item => item.memberIds.length >= 2);
        draft.catalog.presentation = Composition.normalizePresentation({ ...presentation, blocks: mergeCollections(allBlocks, nextCollections) });
      });
    }, true);
  }

  function init() {
    ensureShell();
    bindSelectionExtensions();
    renderManager();
    window.addEventListener('catalogotop:selection-rendered', renderManager);
    window.addEventListener('catalogotop:products-updated', () => setTimeout(renderManager, 0));
  }

  init();
})();
