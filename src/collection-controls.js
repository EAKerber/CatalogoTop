(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const { Core, Collection, Composition } = NS;
  if (!Core || !Collection || !Composition) return;
  const $ = selector => document.querySelector(selector);

  function state() { return Core.getState(); }

  function allBlockMemberIds() {
    const ids = new Set();
    (state().catalog?.presentation?.blocks || []).forEach(block => {
      (Array.isArray(block?.memberIds) ? block.memberIds : []).forEach(id => ids.add(String(id)));
    });
    return ids;
  }

  function visibleSelectedIds() {
    return Array.from(document.querySelectorAll('#selectableProducts > .select-product [data-select-product]:checked'))
      .map(input => String(input.dataset.selectProduct || '')).filter(Boolean);
  }

  function candidateIds() {
    const current = state();
    const membership = allBlockMemberIds();
    const visible = new Set(visibleSelectedIds().filter(id => !membership.has(id)));
    if (visible.size < 2) return [];
    const byId = new Map(current.products.map(product => [String(product.id), product]));
    const effective = NS.CatalogOrder?.effectiveIds ? NS.CatalogOrder.effectiveIds(current) : current.selectedIds.map(String);
    const candidates = effective.filter(id => visible.has(id));
    if (candidates.length < 2) return [];
    const category = String(byId.get(candidates[0])?.category || 'Sem categoria');
    if (candidates.some(id => String(byId.get(id)?.category || 'Sem categoria') !== category)) return [];
    const categoryIds = effective.filter(id => String(byId.get(id)?.category || 'Sem categoria') === category);
    const positions = candidates.map(id => categoryIds.indexOf(id));
    if (!positions.every((position, index) => position >= 0 && (index === 0 || position === positions[index - 1] + 1))) return [];
    return candidates;
  }

  function mutateBlocks(mutator) {
    Core.mutate(draft => {
      const presentation = Composition.normalizePresentation(draft.catalog.presentation);
      mutator(presentation.blocks, draft);
      draft.catalog.presentation = Composition.normalizePresentation(presentation);
    });
    window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
  }

  function createCollection() {
    const ids = candidateIds();
    if (ids.length < 2) {
      alert('Para criar uma coleção, deixe visíveis ao menos dois produtos selecionados, ainda não agrupados, contíguos na ordem editorial e da mesma categoria.');
      return;
    }
    if (ids.length > Collection.MAX_MEMBERS) {
      alert(`O primeiro recorte aceita até ${Collection.MAX_MEMBERS} produtos por coleção.`);
      return;
    }
    const byId = new Map(state().products.map(product => [String(product.id), product]));
    const category = byId.get(ids[0])?.category || 'Coleção';
    const block = Collection.normalizeBlock({
      id: `collection-${Date.now()}`,
      memberIds: ids,
      title: category,
      subtitle: '',
      theme: 'light',
      columns: 4,
      itemPreset: 'visual',
      itemStyles: {}
    });
    mutateBlocks(blocks => blocks.push(block));
    NS.ComposerSelection?.select?.({ kind: 'collection', blockId: block.id });
  }

  function ensureButton() {
    const actions = $('.selection-actions');
    if (!actions) return null;
    let button = $('#btnCreateCollection');
    if (!button) {
      button = document.createElement('button');
      button.className = 'button secondary compact';
      button.id = 'btnCreateCollection';
      button.type = 'button';
      button.textContent = 'Agrupar em coleção';
      actions.appendChild(button);
      button.addEventListener('click', createCollection);
    }
    return button;
  }

  function refreshButton() {
    const button = ensureButton();
    if (!button) return;
    const ids = candidateIds();
    button.disabled = ids.length < 2 || ids.length > Collection.MAX_MEMBERS;
    button.title = button.disabled
      ? 'Deixe visível um trecho contíguo de 2 a 12 produtos selecionados da mesma categoria e ainda não usado em outro bloco.'
      : `Agrupar ${ids.length} produtos em coleção`;
  }

  function init() {
    refreshButton();
    window.addEventListener('catalogotop:selection-rendered', refreshButton);
  }

  NS.CollectionControls = { candidateIds, createCollection, refreshButton };
  init();
})();