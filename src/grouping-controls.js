(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const { Core, Composition, CatalogOrder, PresentationActions } = NS;
  const ComposerSelection = NS.ComposerSelection;
  if (!Core || !Composition || !ComposerSelection || !CatalogOrder || !PresentationActions) return;
  const $ = selector => document.querySelector(selector);

  const state = () => Core.getState();

  function uniqueIds(values) {
    const seen = new Set();
    return (Array.isArray(values) ? values : []).map(String).filter(id => id && !seen.has(id) && seen.add(id));
  }

  function editorialIds() {
    return NS.ComposerSelection?.ids?.().map(String) || [];
  }

  function effectiveIds(current = state()) {
    return CatalogOrder.effectiveIds(current).map(String);
  }

  function productMap(current = state()) {
    return new Map((current.products || []).map(product => [String(product.id), product]));
  }

  function categoryOf(product) {
    return String(product?.category || '').trim() || 'Sem categoria';
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
    const plan = selectedMovePlan(delta);
    if (!plan) return false;
    if (plan.type === 'member') PresentationActions.moveBlockMember(plan.blockId, plan.productId, plan.delta);
    else PresentationActions.mutatePresentation(presentation => { presentation.order = plan.nextOrder; });
    return true;
  }

  const canMoveSelection = delta => Boolean(selectedMovePlan(delta));

  function installSelectionPrimaryPreservation() {
    if (ComposerSelection.__v01123PrimaryPreservation) return;
    const original = ComposerSelection.selectProduct.bind(ComposerSelection);
    ComposerSelection.selectProduct = function (current, productId, options = {}) {
      const id = String(productId || '');
      const currentTarget = ComposerSelection.get();
      const selected = ComposerSelection.ids().map(String);
      const productTargetActive = currentTarget && !['collection', 'table'].includes(currentTarget.kind);
      if (!options.additive && !options.range && productTargetActive && selected.length > 1 && selected.includes(id)) {
        const target = ComposerSelection.normalize(options.target) || ComposerSelection.targetForProduct(current, id);
        return ComposerSelection.select(target, { preserveProducts: true });
      }
      return original(current, productId, options);
    };
    ComposerSelection.__v01123PrimaryPreservation = true;
  }

  function collectionPatch(patch) {
    const allowed = new Set(['emphasis', 'width', 'priceStyle']);
    return Object.fromEntries(Object.entries(patch || {}).filter(([key]) => allowed.has(key)));
  }

  function applyBulkStylePatch(originProductId, patch) {
    const selected = uniqueIds(ComposerSelection.ids());
    if (selected.length < 2 || !selected.includes(String(originProductId))) return false;
    PresentationActions.mutatePresentation((presentation, draft) => {
      const blocks = Array.isArray(presentation.blocks) ? presentation.blocks : [];
      selected.forEach(id => {
        const blockIndex = blocks.findIndex(block => (block?.memberIds || []).map(String).includes(id));
        const block = blockIndex >= 0 ? blocks[blockIndex] : null;
        if (block?.type === 'collection' && NS.Collection) {
          const compatible = collectionPatch(patch);
          if (!Object.keys(compatible).length) return;
          const normalized = NS.Collection.normalizeBlock(block);
          normalized.itemStyles[id] = { ...NS.Collection.memberStyleFor(normalized, id), ...compatible };
          blocks[blockIndex] = NS.Collection.normalizeBlock(normalized);
          return;
        }
        if (block) return;
        presentation.itemStyles[id] = { ...Composition.styleFor(presentation, id), ...(patch || {}) };
      });
      presentation.blocks = blocks;
      draft.catalog.presentation = presentation;
    });
    return true;
  }

  function installBulkPresentationActions() {
    if (PresentationActions.__v01123Bulk) return;
    const originalCard = PresentationActions.setCardStyle.bind(PresentationActions);
    const originalMember = PresentationActions.setCollectionMemberStyle.bind(PresentationActions);
    const originalFrame = PresentationActions.setImageFrame.bind(PresentationActions);
    const originalResetFrame = PresentationActions.resetImageFrame.bind(PresentationActions);
    const originalMoveMember = PresentationActions.moveBlockMember.bind(PresentationActions);

    PresentationActions.setCardStyle = (productId, patch) => applyBulkStylePatch(productId, patch) || originalCard(productId, patch);
    PresentationActions.setCollectionMemberStyle = (blockId, productId, patch) => applyBulkStylePatch(productId, patch) || originalMember(blockId, productId, patch);

    PresentationActions.setImageFrame = function (productId, patch) {
      const selected = uniqueIds(ComposerSelection.ids());
      if (selected.length < 2 || !selected.includes(String(productId)) || !NS.ImageFraming) return originalFrame(productId, patch);
      return PresentationActions.mutatePresentation(presentation => {
        presentation.imageFrames = presentation.imageFrames && typeof presentation.imageFrames === 'object' ? { ...presentation.imageFrames } : {};
        selected.forEach(id => {
          const next = NS.ImageFraming.normalizeImageFrame({ ...NS.ImageFraming.imageFrameFor(presentation, id), ...(patch || {}) });
          if (NS.ImageFraming.isDefaultImageFrame(next)) delete presentation.imageFrames[id];
          else presentation.imageFrames[id] = next;
        });
      });
    };

    PresentationActions.resetImageFrame = function (productId) {
      const selected = uniqueIds(ComposerSelection.ids());
      if (selected.length < 2 || !selected.includes(String(productId))) return originalResetFrame(productId);
      return PresentationActions.mutatePresentation(presentation => {
        if (!presentation.imageFrames || typeof presentation.imageFrames !== 'object') return;
        selected.forEach(id => { delete presentation.imageFrames[id]; });
      });
    };

    PresentationActions.moveBlockMember = function (blockId, productId, delta) {
      const current = state();
      const unit = CatalogOrder.allUnits(current).find(item => ['collection', 'table'].includes(item.type)
        && String(item.blockId) === String(blockId)
        && item.memberIds.includes(String(productId)));
      if (!unit) return originalMoveMember(blockId, productId, delta);
      const sourceIndex = unit.memberIds.indexOf(String(productId));
      const targetIndex = sourceIndex + (Number(delta) < 0 ? -1 : 1);
      if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= unit.memberIds.length) return current;
      const targetProductId = String(unit.memberIds[targetIndex]);
      const nextOrder = CatalogOrder.moveBlockMember(current, blockId, productId, delta);
      return PresentationActions.mutatePresentation(presentation => {
        presentation.order = nextOrder;
        const index = presentation.blocks.findIndex(block => block?.type === 'collection' && String(block.id) === String(blockId));
        if (index < 0 || !NS.Collection) return;
        const block = NS.Collection.normalizeBlock(presentation.blocks[index]);
        const sourceStyle = NS.Collection.memberStyleFor(block, productId);
        const targetStyle = NS.Collection.memberStyleFor(block, targetProductId);
        block.itemStyles[String(productId)] = targetStyle;
        block.itemStyles[targetProductId] = sourceStyle;
        presentation.blocks[index] = NS.Collection.normalizeBlock(block);
      });
    };
    PresentationActions.__v01123Bulk = true;
  }

  function installCanonicalTextFit() {
    if (!NS.TextFit?.fitCatalog || NS.TextFit.__v01123CanonicalScale) return;
    const original = NS.TextFit.fitCatalog.bind(NS.TextFit);
    NS.TextFit.fitCatalog = function (root) {
      if (!root?.style) return original(root);
      const previous = root.style.getPropertyValue('--preview-scale');
      const priority = root.style.getPropertyPriority('--preview-scale');
      root.style.setProperty('--preview-scale', '1');
      void root.offsetWidth;
      try { return original(root); }
      finally {
        if (previous) root.style.setProperty('--preview-scale', previous, priority);
        else root.style.removeProperty('--preview-scale');
      }
    };
    NS.TextFit.__v01123CanonicalScale = true;
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
    const values = uniqueIds(ComposerSelection.ids()).map(id => styleValueForProduct(id, key)).filter(value => value != null);
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

  let augmentFrame = 0;
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
    const ids = uniqueIds(ComposerSelection.ids());
    if (root && target) {
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
      floater.setAttribute('aria-label', 'Reordenar seleção');
      floater.innerHTML = '<button type="button" data-editor-move="-1" aria-label="Mover seleção para cima">↑</button><button type="button" data-editor-move="1" aria-label="Mover seleção para baixo">↓</button>';
      document.body.appendChild(floater);
    }
    floater.hidden = !$('#catalog')?.classList.contains('active') || !target || !ids.length;
    const floatUp = floater.querySelector('[data-editor-move="-1"]');
    const floatDown = floater.querySelector('[data-editor-move="1"]');
    if (floatUp) floatUp.disabled = !canMoveSelection(-1);
    if (floatDown) floatDown.disabled = !canMoveSelection(1);
  }

  function refreshToolbar() {
    const selected = editorialIds();
    const valid = candidateIds(Number.POSITIVE_INFINITY);
    const context = $('#groupingActions');
    if (context) context.hidden = selected.length < 2;
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
    refreshToolbar();
    window.dispatchEvent(new CustomEvent('catalogotop:grouping-selection-changed', {
      detail: { ids: editorialIds(), candidates: candidateIds(Number.POSITIVE_INFINITY) }
    }));
  }

  function bindGroupingPreparation() {
    document.addEventListener('click', event => {
      const button = event.target.closest('#btnCreateCollection,#btnCreateTableBlock');
      if (!button || button.disabled) return;
      const max = button.id === 'btnCreateCollection' ? (NS.Collection?.MAX_MEMBERS || 12) : (NS.TableBlock?.MAX_MEMBERS || 30);
      prepareGrouping(max);
    }, true);
  }

  function bindOrderCommands() {
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-editor-move]');
      if (!button || button.disabled) return;
      event.preventDefault();
      moveSelectionRelative(Number(button.dataset.editorMove));
    });
    window.addEventListener('keydown', event => {
      if (!['ArrowUp', 'ArrowDown'].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (!$('#catalog')?.classList.contains('active') || !ComposerSelection.get()) return;
      if (event.target?.closest?.('input,textarea,select,button,a,[contenteditable="true"]')) return;
      const active = document.activeElement;
      if (!(active === document.body || active?.closest?.('#selectableProducts,#catalogPreview,.contextual-inspector'))) return;
      const delta = event.key === 'ArrowUp' ? -1 : 1;
      if (!canMoveSelection(delta)) return;
      event.preventDefault();
      moveSelectionRelative(delta);
    });
  }

  installSelectionPrimaryPreservation();
  installBulkPresentationActions();
  installCanonicalTextFit();
  bindGroupingPreparation();
  bindOrderCommands();

  NS.GroupingControls = {
    ids: editorialIds,
    candidateIds,
    isContiguousSameCategory,
    consolidatedOrder,
    prepareGrouping,
    moveSelectionRelative,
    canMoveSelection,
    refresh: refreshToolbar
  };
  NS.EditorOrder = { consolidatedOrder, selectedMovePlan, moveSelectionRelative, canMoveSelection };

  window.addEventListener('catalogotop:editor-selection-changed', refreshAndEmit);
  window.addEventListener('catalogotop:selection-rendered', refreshToolbar);
  window.addEventListener('catalogotop:catalog-rendered', scheduleEditorAugment);
  window.addEventListener('catalogotop:products-updated', refreshToolbar);
  window.addEventListener('resize', scheduleEditorAugment);
  refreshToolbar();
})();
