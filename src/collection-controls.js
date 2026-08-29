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
      alert('Selecione de 2 a 12 produtos da mesma categoria, já incluídos no catálogo e ainda fora de outro bloco. Itens separados serão reunidos automaticamente.');
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

  function refreshButton() {
    const button = $('#btnCreateCollection');
    if (!button) return;
    const ids = candidateIds();
    const count = NS.ComposerSelection?.ids?.().length || 0;
    const shownCount = Math.min(count, Collection.MAX_MEMBERS);
    button.classList.add('group-create-action', 'group-create-collection');
    button.dataset.count = String(shownCount);
    button.dataset.shortcut = 'Ctrl+G';
    button.innerHTML = `<span class="group-action-glyph" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="7" width="11" height="10" rx="2"></rect><rect x="9" y="4" width="11" height="10" rx="2"></rect></svg></span><span class="group-action-text">${count ? `Coleção (${shownCount})` : 'Criar coleção'}</span><span class="group-action-badge" aria-hidden="true">${shownCount}</span>`;
    button.disabled = ids.length < 2 || ids.length > Collection.MAX_MEMBERS;
    const hint = button.disabled
      ? 'Selecione de 2 a 12 produtos do catálogo, da mesma categoria e fora de outro bloco.'
      : `Agrupar ${ids.length} produtos em coleção${NS.GroupingControls?.isContiguousSameCategory?.(ids) ? '' : ' · itens separados serão reunidos'}`;
    button.title = `${hint} Atalho: Ctrl+G (Ctrl+Alt+G se o navegador reservar o atalho).`;
    button.setAttribute('aria-label', `${count ? `Criar coleção com ${shownCount} selecionados` : 'Criar coleção'}. ${hint}`);
  }

  function init() {
    $('#btnCreateCollection')?.addEventListener('click', createCollection);
    refreshButton();
    window.addEventListener('catalogotop:selection-rendered', refreshButton);
    window.addEventListener('catalogotop:grouping-selection-changed', refreshButton);
    window.addEventListener('catalogotop:editor-selection-changed', refreshButton);
  }

  NS.CollectionControls = { candidateIds, createCollection, refreshButton };
  init();
})();