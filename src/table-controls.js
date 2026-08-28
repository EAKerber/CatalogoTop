(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const { Core, TableBlock, Composition } = NS;
  if (!Core || !TableBlock || !Composition) return;
  const $ = selector => document.querySelector(selector);

  function state() { return Core.getState(); }

  function allMembership() {
    const ids = new Set();
    (state().catalog?.presentation?.blocks || []).forEach(block => {
      (Array.isArray(block?.memberIds) ? block.memberIds : []).forEach(id => ids.add(String(id)));
    });
    return ids;
  }

  function candidateIds() {
    const current = state();
    const membership = allMembership();
    const selected = new Set((current.selectedIds || []).map(String));
    const marked = new Set((NS.BlockSelection?.ids?.() || []).filter(id => selected.has(id) && !membership.has(id)));
    if (marked.size < 2 || marked.size > TableBlock.MAX_MEMBERS) return [];
    const byId = new Map(current.products.map(product => [String(product.id), product]));
    const effective = NS.CatalogOrder?.effectiveIds ? NS.CatalogOrder.effectiveIds(current) : current.selectedIds.map(String);
    const candidates = effective.filter(id => marked.has(id));
    if (candidates.length !== marked.size || candidates.length < 2 || candidates.length > TableBlock.MAX_MEMBERS) return [];
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

  function createTable() {
    const ids = candidateIds();
    if (ids.length < 2) {
      window.alert?.('Marque de 2 a 30 produtos contíguos, da mesma categoria e ainda fora de outro bloco usando a ação “Marcar” de cada item.');
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
      columns
    });
    NS.BlockSelection?.clear?.(false);
    mutateBlocks(blocks => blocks.push(block));
    NS.ComposerSelection?.select?.({ kind: 'table', blockId: block.id });
  }

  function ensureButton() {
    const actions = $('.selection-actions');
    if (!actions) return null;
    let button = $('#btnCreateTableBlock');
    if (!button) {
      button = document.createElement('button');
      button.className = 'button secondary compact';
      button.id = 'btnCreateTableBlock';
      button.type = 'button';
      actions.appendChild(button);
      button.addEventListener('click', createTable);
    }
    return button;
  }

  function refreshButton() {
    const button = ensureButton();
    if (!button) return;
    const ids = candidateIds();
    const count = NS.BlockSelection?.ids?.().length || 0;
    button.textContent = count ? `Agrupar em tabela (${count})` : 'Agrupar em tabela';
    button.disabled = ids.length < 2 || ids.length > TableBlock.MAX_MEMBERS;
    button.title = button.disabled
      ? 'Marque um trecho contíguo de 2 a 30 produtos do catálogo, da mesma categoria e ainda fora de outro bloco.'
      : `Agrupar ${ids.length} produtos em tabela`;
  }

  function init() {
    refreshButton();
    window.addEventListener('catalogotop:selection-rendered', refreshButton);
  }

  NS.TableControls = { candidateIds, createTable, refreshButton };
  init();
})();