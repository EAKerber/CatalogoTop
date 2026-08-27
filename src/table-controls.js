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

  function visibleSelectedIds() {
    return Array.from(document.querySelectorAll('#selectableProducts > .select-product [data-select-product]:checked'))
      .map(input => String(input.dataset.selectProduct || '')).filter(Boolean);
  }

  function candidateIds() {
    const current = state();
    const membership = allMembership();
    const visible = new Set(visibleSelectedIds().filter(id => !membership.has(id)));
    if (visible.size < 2 || visible.size > TableBlock.MAX_MEMBERS) return [];
    const byId = new Map(current.products.map(product => [String(product.id), product]));
    const effective = NS.CatalogOrder?.effectiveIds ? NS.CatalogOrder.effectiveIds(current) : current.selectedIds.map(String);
    const candidates = effective.filter(id => visible.has(id));
    if (candidates.length < 2 || candidates.length > TableBlock.MAX_MEMBERS) return [];
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
      window.alert?.('Para criar uma tabela, deixe visível um trecho contíguo de 2 a 30 produtos selecionados, ainda não agrupados, da mesma categoria e na ordem editorial atual.');
      return;
    }
    const byId = new Map(state().products.map(product => [String(product.id), product]));
    const category = byId.get(ids[0])?.category || 'Tabela';
    const block = TableBlock.normalizeBlock({
      id: `table-${Date.now()}`,
      type: 'table',
      memberIds: ids,
      title: category,
      subtitle: '',
      rowSource: 'products',
      density: 'compact',
      columns: TableBlock.defaultColumns('products')
    });
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
      button.textContent = 'Agrupar em tabela';
      actions.appendChild(button);
      button.addEventListener('click', createTable);
    }
    return button;
  }

  function refreshButton() {
    const button = ensureButton();
    if (!button) return;
    const ids = candidateIds();
    button.disabled = ids.length < 2 || ids.length > TableBlock.MAX_MEMBERS;
    button.title = button.disabled
      ? 'Deixe visível um trecho contíguo de 2 a 30 produtos selecionados da mesma categoria e ainda não usado em outro bloco.'
      : `Agrupar ${ids.length} produtos em tabela`;
  }

  function init() {
    refreshButton();
    window.addEventListener('catalogotop:selection-rendered', refreshButton);
  }

  NS.TableControls = { candidateIds, createTable, refreshButton };
  init();
})();