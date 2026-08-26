(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const { Core, TableBlock, Composition, Render } = NS;
  if (!Core || !TableBlock || !Composition || !Render) return;

  const $ = selector => document.querySelector(selector);
  let patchingSelection = false;

  function state() { return Core.getState(); }
  function esc(value) { return Render.esc(value); }
  function currentBlocks() { return TableBlock.normalizeBlocks(state().catalog?.presentation?.blocks); }

  function allMembership() {
    const map = new Map();
    const blocks = Array.isArray(state().catalog?.presentation?.blocks) ? state().catalog.presentation.blocks : [];
    blocks.forEach(block => (Array.isArray(block?.memberIds) ? block.memberIds : []).forEach(id => map.set(String(id), block)));
    return map;
  }

  function notify() {
    window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
  }

  function mutateTables(mutator) {
    Core.mutate(draft => {
      const presentation = Composition.normalizePresentation(draft.catalog.presentation);
      const blocks = Array.isArray(presentation.blocks) ? presentation.blocks.slice() : [];
      mutator(blocks, draft);
      draft.catalog.presentation = Composition.normalizePresentation({ ...presentation, blocks });
    });
    notify();
  }

  function visibleSelectedIds() {
    const root = $('#selectableProducts');
    if (!root) return [];
    return Array.from(root.querySelectorAll(':scope > .select-product'))
      .map(label => label.querySelector('[data-select-product]'))
      .filter(checkbox => checkbox?.checked)
      .map(checkbox => String(checkbox.dataset.selectProduct));
  }

  function candidateIds() {
    const current = state();
    const membership = allMembership();
    const byId = new Map(current.products.map(product => [String(product.id), product]));
    const ids = visibleSelectedIds().filter(id => !membership.has(id));
    if (ids.length < 2 || ids.length > TableBlock.MAX_MEMBERS) return [];
    const categories = new Set(ids.map(id => String(byId.get(id)?.category || 'Sem categoria')));
    if (categories.size !== 1) return [];
    const positions = ids.map(id => current.selectedIds.map(String).indexOf(id)).sort((a, b) => a - b);
    if (positions.some((value, index) => value < 0 || (index > 0 && value !== positions[index - 1] + 1))) return [];
    return current.selectedIds.map(String).filter(id => ids.includes(id));
  }

  function ensureShell() {
    const actions = $('.selection-actions');
    if (!actions) return;
    if (!$('#btnCreateTableBlock')) {
      const button = document.createElement('button');
      button.className = 'button secondary compact';
      button.id = 'btnCreateTableBlock';
      button.type = 'button';
      button.textContent = 'Agrupar em tabela';
      actions.appendChild(button);
      button.addEventListener('click', createTable);
    }
    if (!$('#tableBlockManager')) {
      const manager = document.createElement('div');
      manager.id = 'tableBlockManager';
      manager.className = 'table-block-manager';
      const collectionManager = $('#collectionManager');
      const bulk = $('.bulk-presentation-controls');
      const anchor = collectionManager || bulk || actions;
      anchor.insertAdjacentElement('afterend', manager);
      bindManager(manager);
    }
  }

  function createTable() {
    const ids = candidateIds();
    if (ids.length < 2) {
      window.alert?.('Para criar uma tabela, deixe visível um trecho contíguo de 2 a 30 produtos selecionados, ainda não agrupados e de uma única categoria.');
      return;
    }
    const current = state();
    const byId = new Map(current.products.map(product => [String(product.id), product]));
    const category = byId.get(ids[0])?.category || 'Tabela';
    mutateTables(blocks => {
      blocks.push(TableBlock.normalizeBlock({
        id: `table-${Date.now()}`,
        type: 'table',
        memberIds: ids,
        title: category,
        subtitle: '',
        rowSource: 'products',
        density: 'compact',
        columns: TableBlock.defaultColumns('products')
      }));
    });
  }

  function columnChoices(block) {
    return TableBlock.columnsForSource(block.rowSource).map(column => `<label class="table-column-choice"><input type="checkbox" data-table-column="${esc(column.id)}" ${block.columns.includes(column.id) ? 'checked' : ''} />${esc(column.name)}</label>`).join('');
  }

  function tableEditorMarkup(block) {
    return `<section class="table-block-manager-card" data-table-editor="${esc(block.id)}">
      <div class="table-block-manager-head">
        <div><strong>${esc(block.title || 'Tabela')}</strong><span>${block.memberIds.length} ${block.memberIds.length === 1 ? 'produto' : 'produtos'}</span></div>
        <button class="icon-button table-dissolve" type="button" data-dissolve-table="${esc(block.id)}" title="Desagrupar">×</button>
      </div>
      <label>Título<input data-table-field="title" value="${esc(block.title)}" /></label>
      <label>Subtítulo<input data-table-field="subtitle" value="${esc(block.subtitle)}" placeholder="Opcional" /></label>
      <div class="table-block-manager-grid">
        <label>Linhas<select data-table-field="rowSource">${TableBlock.TABLE_SOURCES.map(item => `<option value="${item.id}"${item.id === block.rowSource ? ' selected' : ''}>${esc(item.name)}</option>`).join('')}</select></label>
        <label>Densidade<select data-table-field="density">${TableBlock.TABLE_DENSITIES.map(item => `<option value="${item.id}"${item.id === block.density ? ' selected' : ''}>${esc(item.name)}</option>`).join('')}</select></label>
      </div>
      <fieldset class="table-column-choices"><legend>Colunas</legend>${columnChoices(block)}</fieldset>
      <small>Tabela full-width · cabeçalho repetido ao continuar em outra página</small>
    </section>`;
  }

  function renderManager() {
    ensureShell();
    const manager = $('#tableBlockManager');
    const button = $('#btnCreateTableBlock');
    if (!manager || !button) return;
    const blocks = currentBlocks();
    const ids = candidateIds();
    button.disabled = ids.length < 2;
    button.title = button.disabled ? 'Filtre um trecho contíguo de uma categoria com 2 a 30 produtos selecionados e ainda não agrupados.' : `Agrupar ${ids.length} produtos em tabela`;
    manager.innerHTML = blocks.length
      ? `<div class="table-block-manager-title"><strong>Tabelas</strong><span>${blocks.length}</span></div>${blocks.map(tableEditorMarkup).join('')}`
      : '';
  }

  function bindManager(manager) {
    manager.addEventListener('click', event => {
      const dissolve = event.target.closest('[data-dissolve-table]');
      if (!dissolve) return;
      mutateTables(blocks => {
        const index = blocks.findIndex(block => block.type === 'table' && block.id === dissolve.dataset.dissolveTable);
        if (index >= 0) blocks.splice(index, 1);
      });
    });

    manager.addEventListener('change', event => {
      const editor = event.target.closest('[data-table-editor]');
      if (!editor) return;
      const blockId = editor.dataset.tableEditor;
      const field = event.target.closest('[data-table-field]');
      const column = event.target.closest('[data-table-column]');
      mutateTables(blocks => {
        const index = blocks.findIndex(block => block.type === 'table' && block.id === blockId);
        if (index < 0) return;
        const block = TableBlock.normalizeBlock(blocks[index]);
        if (field) {
          const key = field.dataset.tableField;
          block[key] = field.value;
          if (key === 'rowSource') block.columns = TableBlock.defaultColumns(field.value);
        }
        if (column) {
          const checked = Array.from(editor.querySelectorAll('[data-table-column]:checked')).map(input => input.dataset.tableColumn);
          if (checked.length) block.columns = checked;
        }
        blocks[index] = TableBlock.normalizeBlock(block);
      });
    });
  }

  function patchSelection() {
    if (patchingSelection) return;
    const root = $('#selectableProducts');
    if (!root) return;
    patchingSelection = true;
    try {
      const membership = new Map();
      currentBlocks().forEach(block => block.memberIds.forEach(id => membership.set(String(id), block)));
      root.querySelectorAll(':scope > .select-product').forEach(label => {
        const checkbox = label.querySelector('[data-select-product]');
        if (!checkbox) return;
        const id = String(checkbox.dataset.selectProduct);
        const block = membership.get(id);
        const active = Boolean(block && checkbox.checked);
        label.classList.toggle('in-table', Boolean(block));

        let badge = label.querySelector('.table-member-badge');
        if (!active) {
          badge?.remove();
          return;
        }

        const badgeText = `Tabela · ${block.title || 'sem título'}`;
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'table-member-badge';
          badge.textContent = badgeText;
          label.querySelector(':scope > span')?.appendChild(badge);
        } else if (badge.textContent !== badgeText) {
          badge.textContent = badgeText;
        }
      });
    } finally {
      patchingSelection = false;
    }
  }

  function bindSelectionExtensions() {
    const root = $('#selectableProducts');
    if (!root) return;
    root.addEventListener('change', event => {
      const checkbox = event.target.closest('[data-select-product]');
      if (!checkbox || checkbox.checked) return;
      const id = String(checkbox.dataset.selectProduct);
      const block = TableBlock.blockForMember(currentBlocks(), id);
      if (!block) return;
      Core.mutate(draft => {
        const presentation = Composition.normalizePresentation(draft.catalog.presentation);
        const blocks = Array.isArray(presentation.blocks) ? presentation.blocks.slice() : [];
        const index = blocks.findIndex(item => item.type === 'table' && item.id === block.id);
        if (index < 0) return;
        const target = TableBlock.normalizeBlock(blocks[index]);
        target.memberIds = target.memberIds.filter(memberId => memberId !== id);
        if (target.memberIds.length < 2) blocks.splice(index, 1);
        else blocks[index] = target;
        draft.catalog.presentation = Composition.normalizePresentation({ ...presentation, blocks });
      });
    }, true);

    new MutationObserver(() => {
      patchSelection();
      renderManager();
    }).observe(root, { childList: true });
  }

  function init() {
    ensureShell();
    bindSelectionExtensions();
    patchSelection();
    renderManager();
    $('#selectionCategory')?.addEventListener('change', () => setTimeout(renderManager, 0));
    $('#searchSelection')?.addEventListener('input', () => setTimeout(renderManager, 0));
    window.addEventListener('catalogotop:products-updated', () => setTimeout(() => { patchSelection(); renderManager(); }, 0));
  }

  init();
})();