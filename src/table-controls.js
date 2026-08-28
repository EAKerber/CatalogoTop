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
      window.alert?.('Selecione de 2 a 30 produtos contíguos da mesma categoria, já incluídos no catálogo e ainda fora de outro bloco.');
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
    button.textContent = count ? `Tabela (${Math.min(count, TableBlock.MAX_MEMBERS)})` : 'Criar tabela';
    button.disabled = ids.length < 2 || ids.length > TableBlock.MAX_MEMBERS;
    button.title = button.disabled
      ? 'Selecione um trecho contíguo de 2 a 30 produtos do catálogo, da mesma categoria e fora de outro bloco.'
      : `Agrupar ${ids.length} produtos em tabela`;
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