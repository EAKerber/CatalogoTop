(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const { Core, Collection, Composition } = NS;
  if (!Core || !Collection || !Composition) return;
  const $ = selector => document.querySelector(selector);

  function state() { return Core.getState(); }

  function candidateIds() {
    return NS.GroupingControls?.candidateIds?.(Collection.MAX_MEMBERS) || [];
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
      alert('No modo Agrupar, selecione de 2 a 12 produtos contíguos da mesma categoria e ainda fora de outro bloco.');
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
    NS.BlockSelection?.clear?.(false);
    NS.GroupingControls?.exit?.({ render: false });
    mutateBlocks(blocks => blocks.push(block));
    NS.ComposerSelection?.select?.({ kind: 'collection', blockId: block.id });
  }

  function refreshButton() {
    const button = $('#btnCreateCollection');
    if (!button) return;
    const ids = candidateIds();
    const count = NS.BlockSelection?.ids?.().length || 0;
    button.textContent = count ? `Coleção (${count})` : 'Criar coleção';
    button.disabled = NS.GroupingControls?.mode?.() !== 'grouping' || ids.length < 2 || ids.length > Collection.MAX_MEMBERS;
    button.title = button.disabled
      ? 'Selecione um trecho contíguo de 2 a 12 produtos do catálogo, da mesma categoria e fora de outro bloco.'
      : `Agrupar ${ids.length} produtos em coleção`;
  }

  function init() {
    $('#btnCreateCollection')?.addEventListener('click', createCollection);
    refreshButton();
    window.addEventListener('catalogotop:selection-rendered', refreshButton);
    window.addEventListener('catalogotop:grouping-selection-changed', refreshButton);
  }

  NS.CollectionControls = { candidateIds, createCollection, refreshButton };
  init();
})();