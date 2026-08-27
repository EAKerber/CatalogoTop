(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const { Core, Collection, Composition } = NS;
  if (!Core || !Collection || !Composition) return;
  const $ = selector => document.querySelector(selector);
  const markedIds = new Set();

  function state() { return Core.getState(); }

  function allBlockMemberIds(current = state()) {
    const ids = new Set();
    (current.catalog?.presentation?.blocks || []).forEach(block => {
      (Array.isArray(block?.memberIds) ? block.memberIds : []).forEach(id => ids.add(String(id)));
    });
    return ids;
  }

  function reconcileMarked() {
    const current = state();
    const selected = new Set((current.selectedIds || []).map(String));
    const membership = allBlockMemberIds(current);
    Array.from(markedIds).forEach(id => {
      if (!selected.has(id) || membership.has(id) || !current.products.some(product => String(product.id) === id)) markedIds.delete(id);
    });
  }

  function blockUnitsByMember(current) {
    const map = new Map();
    if (!NS.CatalogOrder?.allUnits) return map;
    NS.CatalogOrder.allUnits(current).forEach(unit => {
      if (!['collection', 'table'].includes(unit.type)) return;
      unit.memberIds.forEach(id => map.set(String(id), unit));
    });
    return map;
  }

  function refreshStatus() {
    const actions = $('.selection-actions');
    if (!actions) return;
    actions.style.flexWrap = 'wrap';
    let status = $('#blockSelectionStatus');
    if (!status) {
      status = document.createElement('span');
      status.id = 'blockSelectionStatus';
      status.className = 'counter';
      status.style.flexBasis = '100%';
      actions.appendChild(status);
    }
    let clear = $('#btnClearBlockSelection');
    if (!clear) {
      clear = document.createElement('button');
      clear.id = 'btnClearBlockSelection';
      clear.type = 'button';
      clear.className = 'button secondary compact';
      clear.textContent = 'Cancelar marcação';
      clear.addEventListener('click', () => clearMarked());
      actions.appendChild(clear);
    }
    status.textContent = `${markedIds.size} ${markedIds.size === 1 ? 'marcado para bloco' : 'marcados para bloco'}`;
    status.hidden = markedIds.size === 0;
    clear.hidden = markedIds.size === 0;
  }

  function productCopy(row) {
    return row.querySelector(':scope > span:not(.order-handle-spacer)');
  }

  function decorateRows() {
    reconcileMarked();
    const current = state();
    const selected = new Set((current.selectedIds || []).map(String));
    const membership = allBlockMemberIds(current);
    const unitsByMember = blockUnitsByMember(current);

    document.querySelectorAll('#selectableProducts > .select-product').forEach(row => {
      row.querySelectorAll('[data-block-pick],[data-block-member-move]').forEach(control => control.remove());
      const id = String(row.dataset.productRow || '');
      const copy = productCopy(row);
      if (!id || !copy || !selected.has(id)) return;

      const unit = unitsByMember.get(id);
      if (unit) {
        const index = unit.memberIds.indexOf(id);
        const label = unit.type === 'collection' ? 'coleção' : 'tabela';
        const controls = document.createElement('span');
        controls.dataset.blockMemberMove = id;
        controls.className = 'block-member-order-controls';
        controls.style.display = 'inline-flex';
        controls.style.gap = '4px';
        controls.style.justifySelf = 'start';
        controls.innerHTML = `<button class="icon-button" style="width:28px;height:28px;font-size:13px" type="button" data-block-member-delta="-1" data-block-id="${unit.blockId}" data-block-product-id="${id}" ${index <= 0 ? 'disabled' : ''} title="Subir dentro da ${label}" aria-label="Subir produto dentro da ${label}">↑</button><button class="icon-button" style="width:28px;height:28px;font-size:13px" type="button" data-block-member-delta="1" data-block-id="${unit.blockId}" data-block-product-id="${id}" ${index >= unit.memberIds.length - 1 ? 'disabled' : ''} title="Descer dentro da ${label}" aria-label="Descer produto dentro da ${label}">↓</button>`;
        copy.appendChild(controls);
        return;
      }

      if (membership.has(id)) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.blockPick = id;
      button.className = `button compact ${markedIds.has(id) ? 'primary' : 'secondary'}`;
      button.style.justifySelf = 'start';
      button.setAttribute('aria-pressed', markedIds.has(id) ? 'true' : 'false');
      button.textContent = markedIds.has(id) ? 'Marcado para bloco' : 'Agrupar';
      button.title = markedIds.has(id) ? 'Remover da marcação para Collection/Table' : 'Marcar para criar Collection ou Table';
      copy.appendChild(button);
    });
  }

  function refreshBlockSelectionUi() {
    decorateRows();
    refreshStatus();
    NS.CollectionControls?.refreshButton?.();
    NS.TableControls?.refreshButton?.();
  }

  function toggleMarked(id) {
    const productId = String(id || '');
    if (!productId) return;
    if (markedIds.has(productId)) markedIds.delete(productId);
    else markedIds.add(productId);
    refreshBlockSelectionUi();
  }

  function clearMarked(refresh = true) {
    markedIds.clear();
    if (refresh) refreshBlockSelectionUi();
  }

  function marked() {
    reconcileMarked();
    return Array.from(markedIds);
  }

  NS.BlockSelection = { ids: marked, clear: clearMarked, toggle: toggleMarked, refresh: refreshBlockSelectionUi };

  function candidateIds() {
    const current = state();
    const membership = allBlockMemberIds(current);
    const selected = new Set((current.selectedIds || []).map(String));
    const markedSet = new Set(marked().filter(id => selected.has(id) && !membership.has(id)));
    if (markedSet.size < 2) return [];
    const byId = new Map(current.products.map(product => [String(product.id), product]));
    const effective = NS.CatalogOrder?.effectiveIds ? NS.CatalogOrder.effectiveIds(current) : current.selectedIds.map(String);
    const candidates = effective.filter(id => markedSet.has(id));
    if (candidates.length !== markedSet.size || candidates.length < 2) return [];
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
      alert('Marque de 2 a 12 produtos contíguos, da mesma categoria e ainda fora de outro bloco usando a ação “Agrupar” de cada item.');
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
    clearMarked(false);
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
      actions.appendChild(button);
      button.addEventListener('click', createCollection);
    }
    return button;
  }

  function refreshButton() {
    const button = ensureButton();
    if (!button) return;
    const ids = candidateIds();
    const count = marked().length;
    button.textContent = count ? `Agrupar em coleção (${count})` : 'Agrupar em coleção';
    button.disabled = ids.length < 2 || ids.length > Collection.MAX_MEMBERS;
    button.title = button.disabled
      ? 'Marque um trecho contíguo de 2 a 12 produtos do catálogo, da mesma categoria e ainda fora de outro bloco.'
      : `Agrupar ${ids.length} produtos em coleção`;
  }

  function bindBlockSelectionEvents() {
    const root = $('#selectableProducts');
    if (!root || root.dataset.blockSelectionBound === 'true') return;
    root.dataset.blockSelectionBound = 'true';
    root.addEventListener('click', event => {
      const pick = event.target.closest('[data-block-pick]');
      if (pick) {
        event.preventDefault();
        event.stopPropagation();
        toggleMarked(pick.dataset.blockPick);
        return;
      }
      const move = event.target.closest('[data-block-member-delta]');
      if (!move || move.disabled) return;
      event.preventDefault();
      event.stopPropagation();
      NS.PresentationActions?.moveBlockMember?.(move.dataset.blockId, move.dataset.blockProductId, Number(move.dataset.blockMemberDelta));
    });
  }

  function clarifyMembershipActions() {
    const selectVisible = $('#btnSelectVisible');
    const clearSelection = $('#btnClearSelection');
    if (selectVisible) {
      selectVisible.textContent = 'Incluir visíveis no catálogo';
      selectVisible.title = 'Adiciona os produtos visíveis ao catálogo; não marca itens para agrupamento.';
    }
    if (clearSelection) {
      clearSelection.textContent = 'Esvaziar catálogo';
      clearSelection.title = 'Remove todos os produtos do catálogo.';
    }
  }

  function init() {
    clarifyMembershipActions();
    bindBlockSelectionEvents();
    refreshBlockSelectionUi();
    window.addEventListener('catalogotop:selection-rendered', refreshBlockSelectionUi);
    $('#searchSelection')?.addEventListener('input', () => clearMarked());
    $('#selectionCategory')?.addEventListener('change', () => clearMarked());
  }

  NS.CollectionControls = { candidateIds, createCollection, refreshButton };
  init();
})();
