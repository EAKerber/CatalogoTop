(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const { Core, TableBlock, Composition } = NS;
  if (!Core || !TableBlock || !Composition) return;
  const $ = selector => document.querySelector(selector);

  function state() { return Core.getState(); }

  function candidateIds() {
    return NS.GroupingControls?.candidateIds?.(TableBlock.MAX_MEMBERS) || [];
  }

  function mutateBlocks(mutator) {
    Core.mutate(draft => {
      const presentation = Composition.normalizePresentation(draft.catalog.presentation);
      mutator(presentation.blocks, draft);
      draft.catalog.presentation = Composition.normalizePresentation(presentation);
    });
    window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
  }

  function createTable() {
    const ids = candidateIds();
    if (ids.length < 2) {
      window.alert?.('Selecione de 2 a 30 produtos da mesma categoria, já incluídos no catálogo e ainda fora de outro bloco. Itens separados serão reunidos automaticamente.');
      return;
    }
    const byId = new Map(state().products.map(product => [String(product.id), product]));
    const category = byId.get(ids[0])?.category || 'Tabela';
    const columns = TableBlock.defaultColumns('products').slice();
    if (ids.some(id => Core.normalizeQuantityPrice(byId.get(id)?.quantityPrice))) columns.push('minQuantity', 'quantityPrice');
    const block = TableBlock.normalizeBlock({
      id: `table-${Date.now()}`,
      type: 'table',
      memberIds: ids,
      title: category,
      subtitle: '',
      rowSource: 'products',
      density: 'compact',
      columns,
      priceStyle: 'standard'
    });
    mutateBlocks(blocks => blocks.push(block));
    NS.ComposerSelection?.select?.({ kind: 'table', blockId: block.id });
  }

  function refreshButton() {
    const button = $('#btnCreateTableBlock');
    if (!button) return;
    const ids = candidateIds();
    const count = NS.ComposerSelection?.ids?.().length || 0;
    const shownCount = Math.min(count, TableBlock.MAX_MEMBERS);
    button.classList.add('group-create-action', 'group-create-table');
    button.dataset.count = String(shownCount);
    button.dataset.shortcut = 'Ctrl+T';
    button.innerHTML = `<span class="group-action-glyph" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2"></rect><path d="M4 10h16M9 5v14M15 5v14"></path></svg></span><span class="group-action-text">${count ? `Tabela (${shownCount})` : 'Criar tabela'}</span><span class="group-action-badge" aria-hidden="true">${shownCount}</span>`;
    button.disabled = ids.length < 2 || ids.length > TableBlock.MAX_MEMBERS;
    const hint = button.disabled
      ? 'Selecione de 2 a 30 produtos do catálogo, da mesma categoria e fora de outro bloco.'
      : `Agrupar ${ids.length} produtos em tabela${NS.GroupingControls?.isContiguousSameCategory?.(ids) ? '' : ' · itens separados serão reunidos'}`;
    button.title = `${hint} Atalho: Ctrl+T (Ctrl+Alt+T se o navegador reservar o atalho).`;
    button.setAttribute('aria-label', `${count ? `Criar tabela com ${shownCount} selecionados` : 'Criar tabela'}. ${hint}`);
  }

  function init() {
    $('#btnCreateTableBlock')?.addEventListener('click', createTable);
    refreshButton();
    window.addEventListener('catalogotop:selection-rendered', refreshButton);
    window.addEventListener('catalogotop:grouping-selection-changed', refreshButton);
    window.addEventListener('catalogotop:editor-selection-changed', refreshButton);
  }

  NS.TableControls = { candidateIds, createTable, refreshButton };
  init();
})();