(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const { Core, Composition, ComposerSelection, CatalogOrder, PresentationActions } = NS;
  if (!Core || !Composition || !ComposerSelection || !CatalogOrder || !PresentationActions) return;
  const $ = selector => document.querySelector(selector);

  let inspectorMode = 'general';
  let lastInspectorTargetKey = '';
  let navigationMode = 'target';
  let drawerOpen = false;
  let augmentFrame = 0;

  function state() { return Core.getState(); }
  function activeTab() { return document.querySelector('.tab.active')?.dataset.tab || ''; }
  function isCatalogActive() { return activeTab() === 'catalog' && Boolean($('#catalog')?.classList.contains('active')); }

  function uniqueIds(values) {
    const seen = new Set();
    return (Array.isArray(values) ? values : []).map(String).filter(id => {
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function productMap(current = state()) {
    return new Map((current.products || []).map(product => [String(product.id), product]));
  }

  function categoryOf(product) {
    return String(product?.category || '').trim() || 'Sem categoria';
  }

  function effectiveIds(current = state()) {
    return CatalogOrder.effectiveIds(current).map(String);
  }

  function editorialIds() {
    return ComposerSelection?.ids?.().map(String) || [];
  }

  function blockMemberIds(current = state()) {
    const ids = new Set();
    (current.catalog?.presentation?.blocks || []).forEach(block => {
      (Array.isArray(block?.memberIds) ? block.memberIds : []).forEach(id => ids.add(String(id)));
    });
    return ids;
  }

  function orderedEditorial(current = state()) {
    const selected = new Set(editorialIds());
    return effectiveIds(current).filter(id => selected.has(id));
  }

  function isContiguousSameCategory(ids, current = state()) {
    if (!ids.length) return false;
    const byId = productMap(current);
    const category = categoryOf(byId.get(ids[0]));
    if (ids.some(id => categoryOf(byId.get(id)) !== category)) return false;
    const categoryIds = effectiveIds(current).filter(id => categoryOf(byId.get(id)) === category);
    const positions = ids.map(id => categoryIds.indexOf(String(id))).sort((a, b) => a - b);
    return positions.every((position, index) => position >= 0 && (index === 0 || position === positions[index - 1] + 1));
  }

  function candidateIds(maxMembers = Number.POSITIVE_INFINITY) {
    const current = state();
    const raw = uniqueIds(editorialIds());
    if (raw.length < 2 || raw.length > maxMembers) return [];
    const included = new Set((current.selectedIds || []).map(String));
    const occupied = blockMemberIds(current);
    const byId = productMap(current);
    if (raw.some(id => !included.has(id) || occupied.has(id) || !byId.has(id))) return [];
    const category = categoryOf(byId.get(raw[0]));
    if (raw.some(id => categoryOf(byId.get(id)) !== category)) return [];
    const ordered = orderedEditorial(current);
    return ordered.length === raw.length ? ordered : [];
  }

  function consolidatedOrder(current, ids) {
    const ordered = effectiveIds(current);
    const selected = new Set(uniqueIds(ids));
    const selectedInOrder = ordered.filter(id => selected.has(id));
    if (selectedInOrder.length < 2) return ordered;
    const firstIndex = ordered.findIndex(id => selected.has(id));
    if (firstIndex < 0) return ordered;
    const insertionIndex = ordered.slice(0, firstIndex).filter(id => !selected.has(id)).length;
    const remainder = ordered.filter(id => !selected.has(id));
    remainder.splice(insertionIndex, 0, ...selectedInOrder);
    return remainder;
  }

  function prepareGrouping(maxMembers) {
    if (!isCatalogActive()) return [];
    const ids = candidateIds(maxMembers);
    if (ids.length < 2) return ids;
    const current = state();
    const nextOrder = consolidatedOrder(current, ids);
    if (JSON.stringify(nextOrder) !== JSON.stringify(effectiveIds(current))) {
      PresentationActions.mutatePresentation(presentation => { presentation.order = nextOrder; });
    }
    return ids;
  }

  function categoryOrderFromUnits(current, category, units) {
    const byId = productMap(current);
    const replacement = units.flatMap(unit => unit.memberIds.map(String));
    const all = effectiveIds(current);
    const first = all.findIndex(id => categoryOf(byId.get(id)) === category);
    if (first < 0) return all;
    const withoutCategory = all.filter(id => categoryOf(byId.get(id)) !== category);
    const prefixCount = all.slice(0, first).filter(id => categoryOf(byId.get(id)) !== category).length;
    withoutCategory.splice(prefixCount, 0, ...replacement);
    return withoutCategory;
  }

  function selectedMovePlan(delta) {
    if (!isCatalogActive()) return null;
    const current = state();
    const direction = Number(delta) < 0 ? -1 : 1;
    const target = ComposerSelection.get();
    const selectedIds = uniqueIds(editorialIds());
    if (!target || !selectedIds.length) return null;

    if (target.kind === 'collection' || target.kind === 'table') {
      const nextOrder = CatalogOrder.moveUnitRelative(current, `${target.kind}:${target.blockId}`, direction);
      return JSON.stringify(nextOrder) === JSON.stringify(effectiveIds(current)) ? null : { type: 'order', nextOrder };
    }

    if (selectedIds.length === 1 && (target.kind === 'collection-member' || target.kind === 'table-row')) {
      const unit = CatalogOrder.allUnits(current).find(item => ['collection', 'table'].includes(item.type)
        && String(item.blockId) === String(target.blockId)
        && item.memberIds.includes(String(target.productId)));
      if (!unit) return null;
      const index = unit.memberIds.indexOf(String(target.productId));
      if (index < 0 || index + direction < 0 || index + direction >= unit.memberIds.length) return null;
      return { type: 'member', blockId: String(target.blockId), productId: String(target.productId), delta: direction };
    }

    const selected = new Set(selectedIds);
    const touched = [];
    let category = '';
    for (const unit of CatalogOrder.allUnits(current)) {
      const hits = unit.memberIds.filter(id => selected.has(String(id)));
      if (!hits.length) continue;
      if (hits.length !== unit.memberIds.length) return null;
      if (!category) category = unit.category;
      if (category !== unit.category) return null;
      touched.push(unit.id);
    }
    if (!touched.length || !category) return null;

    const selectedUnits = new Set(touched);
    const units = CatalogOrder.unitsForCategory(current, category).map(unit => ({ ...unit, memberIds: unit.memberIds.slice() }));
    let changed = false;
    if (direction < 0) {
      for (let index = 1; index < units.length; index += 1) {
        if (selectedUnits.has(units[index].id) && !selectedUnits.has(units[index - 1].id)) {
          [units[index - 1], units[index]] = [units[index], units[index - 1]];
          changed = true;
        }
      }
    } else {
      for (let index = units.length - 2; index >= 0; index -= 1) {
        if (selectedUnits.has(units[index].id) && !selectedUnits.has(units[index + 1].id)) {
          [units[index], units[index + 1]] = [units[index + 1], units[index]];
          changed = true;
        }
      }
    }
    return changed ? { type: 'order', nextOrder: categoryOrderFromUnits(current, category, units) } : null;
  }

  function moveSelectionRelative(delta) {
    if (!isCatalogActive()) return false;
    const plan = selectedMovePlan(delta);
    if (!plan) return false;
    if (plan.type === 'member') PresentationActions.moveBlockMember(plan.blockId, plan.productId, plan.delta);
    else PresentationActions.mutatePresentation(presentation => { presentation.order = plan.nextOrder; });
    return true;
  }

  function canMoveSelection(delta) {
    return isCatalogActive() && Boolean(selectedMovePlan(delta));
  }

  function styleValueForProduct(productId, key) {
    const current = state();
    const target = ComposerSelection.targetForProduct(current, productId);
    if (!target) return null;
    const presentation = Composition.normalizePresentation(current.catalog.presentation);
    if (target.kind === 'card') return Composition.styleFor(presentation, productId)?.[key] ?? null;
    if (target.kind !== 'collection-member' || !NS.Collection || !['emphasis', 'width', 'priceStyle'].includes(key)) return null;
    const block = presentation.blocks.find(item => item?.type === 'collection' && String(item.id) === String(target.blockId));
    return block ? NS.Collection.memberStyleFor(block, productId)?.[key] ?? null : null;
  }

  function mixedValues(key) {
    const values = uniqueIds(editorialIds()).map(id => styleValueForProduct(id, key)).filter(value => value != null);
    return { count: values.length, values: new Set(values) };
  }

  function augmentMixedSelect(select, key) {
    const mixed = mixedValues(key);
    select.querySelector('option[data-bulk-mixed]')?.remove();
    if (mixed.count < 2 || mixed.values.size < 2) return;
    const option = document.createElement('option');
    option.value = '__mixed__';
    option.textContent = 'Misto';
    option.disabled = true;
    option.selected = true;
    option.dataset.bulkMixed = 'true';
    select.prepend(option);
  }

  function orderLabel(target, count) {
    if (target?.kind === 'collection') return 'Mover coleção';
    if (target?.kind === 'table') return 'Mover tabela';
    if (count > 1) return `Mover ${count} selecionados`;
    return 'Mover item';
  }

  function targetKey(target) {
    if (!target) return '';
    return [target.kind, target.blockId || '', target.productId || '', target.rowId || ''].join(':');
  }

  function setInspectorMode(mode, { focus = false } = {}) {
    inspectorMode = mode === 'order' ? 'order' : 'general';
    const root = $('#contextualInspector');
    if (root) {
      root.dataset.inspectorMode = inspectorMode;
      root.querySelectorAll('[data-inspector-mode]').forEach(button => {
        const active = button.dataset.inspectorMode === inspectorMode;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
      });
      if (focus) root.querySelector(`[data-inspector-mode="${inspectorMode}"]`)?.focus({ preventScroll: true });
    }
  }

  function ensureInspectorModes(root, target) {
    if (!root || !target || root.classList.contains('is-minimized')) return;
    const key = targetKey(target);
    if (key !== lastInspectorTargetKey) {
      lastInspectorTargetKey = key;
      inspectorMode = 'general';
      navigationMode = 'target';
    }
    let tabs = root.querySelector('.inspector-mode-tabs');
    if (!tabs) {
      tabs = document.createElement('div');
      tabs.className = 'inspector-mode-tabs';
      tabs.setAttribute('role', 'tablist');
      tabs.setAttribute('aria-label', 'Modo do inspector');
      tabs.innerHTML = '<button type="button" data-inspector-mode="general" role="tab">Configuração</button><button type="button" data-inspector-mode="order" role="tab">Ordenação</button>';
      const head = root.querySelector('.inspector-head');
      if (head) head.insertAdjacentElement('afterend', tabs);
      else root.prepend(tabs);
    }
    setInspectorMode(inspectorMode);
  }

  function headerOffset() {
    return Math.ceil($('.app-shell-header')?.getBoundingClientRect().height || 0) + 10;
  }

  function scrollElementToEditorPosition(node, { target = false } = {}) {
    if (!node) return false;
    const rect = node.getBoundingClientRect();
    const desired = target ? headerOffset() + Math.min(140, window.innerHeight * .2) : headerOffset();
    const top = Math.max(0, Math.round(window.scrollY + rect.top - desired));
    window.scrollTo({ top, behavior: 'smooth' });
    return true;
  }

  function focusEditorSettings() {
    if (!isCatalogActive() || !ComposerSelection.get()) return false;
    navigationMode = 'settings';
    setInspectorMode('general');
    NS.ContextualInspector?.setMinimized?.(false);
    scheduleEditorAugment();
    requestAnimationFrame(() => {
      const mobile = matchMedia('(max-width: 1079px)').matches;
      const anchor = mobile ? $('#contextualInspector') : ($('.selection-toolbar') || $('#contextualInspector'));
      scrollElementToEditorPosition(anchor);
    });
    return true;
  }

  function focusEditorTarget() {
    if (!isCatalogActive()) return false;
    const target = ComposerSelection.get();
    if (!target) return focusEditorSettings();
    const node = NS.ContextualInspector?.previewNodeForTarget?.(target);
    if (!node) return focusEditorSettings();
    navigationMode = 'target';
    scheduleEditorAugment();
    return scrollElementToEditorPosition(node, { target: true });
  }

  function toggleEditorContext() {
    return navigationMode === 'settings' ? focusEditorTarget() : focusEditorSettings();
  }

  function ensureDrawerUi() {
    const toolbar = $('.preview-toolbar');
    if (toolbar && !$('#catalogPanelToggle')) {
      const button = document.createElement('button');
      button.id = 'catalogPanelToggle';
      button.className = 'catalog-panel-toggle';
      button.type = 'button';
      button.textContent = 'Painel';
      button.setAttribute('aria-controls', 'contextualInspector');
      button.setAttribute('aria-expanded', 'false');
      toolbar.prepend(button);
    }
    if (!$('#catalogPanelBackdrop')) {
      const backdrop = document.createElement('button');
      backdrop.type = 'button';
      backdrop.id = 'catalogPanelBackdrop';
      backdrop.className = 'catalog-panel-backdrop';
      backdrop.setAttribute('aria-label', 'Fechar painel do catálogo');
      document.body.appendChild(backdrop);
    }
  }

  function isMediumWorkspace() {
    return matchMedia('(min-width: 960px) and (max-width: 1239px)').matches;
  }

  function setDrawerOpen(value) {
    drawerOpen = Boolean(value && isCatalogActive() && isMediumWorkspace());
    document.body.classList.toggle('catalog-drawer-open', drawerOpen);
    const toggle = $('#catalogPanelToggle');
    if (toggle) toggle.setAttribute('aria-expanded', String(drawerOpen));
  }

  function syncDrawerUi() {
    ensureDrawerUi();
    const toggle = $('#catalogPanelToggle');
    const medium = isCatalogActive() && isMediumWorkspace();
    if (toggle) toggle.hidden = !medium;
    const backdrop = $('#catalogPanelBackdrop');
    if (backdrop) backdrop.hidden = !medium || !drawerOpen;
    if (!medium && drawerOpen) setDrawerOpen(false);
  }

  function scheduleEditorAugment() {
    if (augmentFrame) cancelAnimationFrame(augmentFrame);
    augmentFrame = requestAnimationFrame(() => {
      augmentFrame = 0;
      augmentEditorUi();
    });
  }

  function augmentEditorUi() {
    const root = $('#contextualInspector');
    const target = ComposerSelection.get();
    const ids = uniqueIds(editorialIds());
    if (root && target && isCatalogActive()) {
      root.querySelectorAll('[data-inspector-card-field]').forEach(select => augmentMixedSelect(select, select.dataset.inspectorCardField));
      root.querySelectorAll('[data-inspector-member-field]').forEach(select => augmentMixedSelect(select, select.dataset.inspectorMemberField));
      if (ids.length > 1 && ['card', 'collection-member'].includes(target.kind)) {
        const head = root.querySelector('.inspector-head > div:first-child');
        if (head && !head.querySelector('.inspector-bulk-count')) {
          const badge = document.createElement('small');
          badge.className = 'inspector-bulk-count';
          badge.textContent = `${ids.length} selecionados · alterações compatíveis serão aplicadas em conjunto`;
          head.appendChild(badge);
        }
        const priceMixed = mixedValues('priceStyle');
        const fieldset = root.querySelector('[data-commercial-card-price-editor],[data-commercial-member-price-editor]');
        if (fieldset && priceMixed.count >= 2 && priceMixed.values.size > 1) {
          fieldset.querySelectorAll('input[type="radio"]').forEach(input => { input.checked = false; });
          if (!fieldset.querySelector('.inspector-bulk-mixed')) {
            const note = document.createElement('small');
            note.className = 'inspector-bulk-mixed';
            note.textContent = 'Valores mistos · escolha uma opção para aplicar aos itens compatíveis.';
            fieldset.appendChild(note);
          }
        }
      }
      if (!root.querySelector('[data-editor-order-controls]')) {
        const section = document.createElement('section');
        section.className = 'inspector-selection-order';
        section.dataset.editorOrderControls = 'true';
        section.innerHTML = `<div class="inspector-subhead"><strong>Ordem no catálogo</strong><span>${orderLabel(target, ids.length)}</span></div><div class="inspector-selection-order-actions"><button type="button" data-editor-move="-1" aria-label="Mover para cima">↑</button><button type="button" data-editor-move="1" aria-label="Mover para baixo">↓</button></div>`;
        root.appendChild(section);
      }
      ensureInspectorModes(root, target);
      const up = root.querySelector('[data-editor-move="-1"]');
      const down = root.querySelector('[data-editor-move="1"]');
      if (up) up.disabled = !canMoveSelection(-1);
      if (down) down.disabled = !canMoveSelection(1);
    }

    let floater = $('#editorOrderFloater');
    if (!floater) {
      floater = document.createElement('div');
      floater.id = 'editorOrderFloater';
      floater.className = 'editor-order-floater';
      floater.setAttribute('aria-label', 'Reordenar seleção e alternar ajustes');
      floater.innerHTML = '<button type="button" data-editor-move="-1" aria-label="Mover seleção para cima">↑</button><button type="button" class="editor-settings-jump" data-editor-settings aria-label="Ir para ajustes" title="Ir para ajustes">⚙</button><button type="button" data-editor-move="1" aria-label="Mover seleção para baixo">↓</button>';
      document.body.appendChild(floater);
    }
    floater.hidden = !isCatalogActive() || !target || !ids.length;
    const settings = floater.querySelector('[data-editor-settings]');
    if (settings) {
      const returning = navigationMode === 'settings';
      settings.classList.toggle('is-returning', returning);
      settings.setAttribute('aria-label', returning ? 'Voltar ao item selecionado' : 'Ir para ajustes');
      settings.title = returning ? 'Voltar ao item selecionado' : 'Ir para ajustes';
    }
    const floatUp = floater.querySelector('[data-editor-move="-1"]');
    const floatDown = floater.querySelector('[data-editor-move="1"]');
    if (floatUp) floatUp.disabled = !canMoveSelection(-1);
    if (floatDown) floatDown.disabled = !canMoveSelection(1);
    syncDrawerUi();
  }

  function refreshToolbar() {
    const selected = editorialIds();
    const valid = candidateIds(Number.POSITIVE_INFINITY);
    const context = $('#groupingActions');
    if (context) context.hidden = !isCatalogActive() || selected.length < 2;
    const status = $('#blockSelectionStatus');
    if (status) {
      if (valid.length) status.textContent = isContiguousSameCategory(valid) ? `${valid.length} produtos selecionados` : `${valid.length} selecionados · serão reunidos ao agrupar`;
      else if (selected.length >= 2) status.textContent = `${selected.length} selecionados · agrupamento indisponível`;
      else status.textContent = '';
    }
    NS.CollectionControls?.refreshButton?.();
    NS.TableControls?.refreshButton?.();
    scheduleEditorAugment();
  }

  function refreshAndEmit() {
    navigationMode = 'target';
    refreshToolbar();
    window.dispatchEvent(new CustomEvent('catalogotop:grouping-selection-changed', {
      detail: { ids: editorialIds(), candidates: candidateIds(Number.POSITIVE_INFINITY) }
    }));
  }

  function handleTabChange() {
    if (!isCatalogActive()) {
      setDrawerOpen(false);
      navigationMode = 'target';
      const floater = $('#editorOrderFloater');
      if (floater) floater.hidden = true;
    }
    refreshToolbar();
    syncDrawerUi();
    window.dispatchEvent(new CustomEvent('catalogotop:tab-changed', { detail: { tab: activeTab() } }));
  }

  function bindGroupingPreparation() {
    document.addEventListener('click', event => {
      const button = event.target.closest('#btnCreateCollection,#btnCreateTableBlock');
      if (!button || button.disabled || !isCatalogActive()) return;
      const max = button.id === 'btnCreateCollection' ? (NS.Collection?.MAX_MEMBERS || 12) : (NS.TableBlock?.MAX_MEMBERS || 30);
      prepareGrouping(max);
    }, true);
  }

  function bindOrderCommands() {
    document.addEventListener('click', event => {
      const tab = event.target.closest('[data-tab]');
      if (tab) {
        requestAnimationFrame(handleTabChange);
        return;
      }
      const drawerToggle = event.target.closest('#catalogPanelToggle');
      if (drawerToggle) {
        event.preventDefault();
        setDrawerOpen(!drawerOpen);
        syncDrawerUi();
        return;
      }
      if (event.target.closest('#catalogPanelBackdrop')) {
        event.preventDefault();
        setDrawerOpen(false);
        syncDrawerUi();
        return;
      }
      const mode = event.target.closest('.inspector-mode-tabs button[data-inspector-mode]');
      if (mode && isCatalogActive()) {
        event.preventDefault();
        setInspectorMode(mode.dataset.inspectorMode, { focus: false });
        return;
      }
      const settings = event.target.closest('[data-editor-settings]');
      if (settings) {
        if (!isCatalogActive()) return;
        event.preventDefault();
        toggleEditorContext();
        return;
      }
      const button = event.target.closest('[data-editor-move]');
      if (!button || button.disabled || !isCatalogActive()) return;
      event.preventDefault();
      moveSelectionRelative(Number(button.dataset.editorMove));
    });

    window.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        if (!isCatalogActive()) {
          event.stopImmediatePropagation();
          return;
        }
        if (drawerOpen) {
          event.preventDefault();
          event.stopImmediatePropagation();
          setDrawerOpen(false);
          syncDrawerUi();
          return;
        }
      }
      if (!['ArrowUp', 'ArrowDown'].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (!isCatalogActive() || !ComposerSelection.get()) return;
      if (event.target?.closest?.('input,textarea,select,button,a,[contenteditable="true"]')) return;
      const active = document.activeElement;
      if (!(active === document.body || active?.closest?.('#selectableProducts,#catalogPreview,.contextual-inspector'))) return;
      const delta = event.key === 'ArrowUp' ? -1 : 1;
      if (!canMoveSelection(delta)) return;
      event.preventDefault();
      moveSelectionRelative(delta);
    });
  }

  function bindWorkspaceLayout() {
    window.addEventListener('orientationchange', () => { setDrawerOpen(false); scheduleEditorAugment(); });
    window.addEventListener('resize', () => { syncDrawerUi(); scheduleEditorAugment(); });
  }

  bindGroupingPreparation();
  bindOrderCommands();
  bindWorkspaceLayout();

  NS.GroupingControls = {
    ids: editorialIds,
    candidateIds,
    isContiguousSameCategory,
    consolidatedOrder,
    prepareGrouping,
    moveSelectionRelative,
    canMoveSelection,
    focusEditorSettings,
    focusEditorTarget,
    toggleEditorContext,
    setInspectorMode,
    activeTab,
    isCatalogActive,
    refresh: refreshToolbar
  };
  NS.EditorOrder = { consolidatedOrder, selectedMovePlan, moveSelectionRelative, canMoveSelection };
  NS.EditorWorkspace = { activeTab, isCatalogActive, setDrawerOpen, isDrawerOpen: () => drawerOpen, inspectorMode: () => inspectorMode };

  window.addEventListener('catalogotop:editor-selection-changed', refreshAndEmit);
  window.addEventListener('catalogotop:selection-rendered', refreshToolbar);
  window.addEventListener('catalogotop:catalog-rendered', scheduleEditorAugment);
  window.addEventListener('catalogotop:products-updated', refreshToolbar);
  refreshToolbar();
})();