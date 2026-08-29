(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  if (!document.querySelector('link[data-editor-command-layout]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'editor-command-layout.css';
    link.dataset.editorCommandLayout = 'true';
    document.head.appendChild(link);
  }

  const products = document.querySelector('#products');
  const workspace = products?.querySelector('.product-workspace');
  const tabs = Array.from(products?.querySelectorAll('[data-mobile-workspace-target]') || []);
  const panels = Array.from(products?.querySelectorAll('[data-mobile-workspace-panel]') || []);
  const mobile = window.matchMedia('(max-width: 639px)');
  const desktopAuthoring = window.matchMedia('(min-width: 1180px)');
  const catalogPreviewViewport = document.querySelector('#catalogPreviewViewport');
  const selectionToolbar = document.querySelector('#catalog .selection-toolbar');
  const selectionCategory = document.querySelector('#selectionCategory');
  const contextualInspector = document.querySelector('#contextualInspector');
  const selectionPanel = document.querySelector('#catalog .selection-panel');
  const previewToolbar = document.querySelector('#catalog .preview-toolbar');
  const previewZoomControls = document.querySelector('#catalog .preview-zoom-controls');
  const headingActions = document.querySelector('#catalog .catalog-heading .heading-actions');
  const appPrimaryTools = document.querySelector('.app-primary-tools');

  let current = 'form';
  let gesture = null;
  let selectionCategoryRail = null;
  let desktopActionToolbar = null;
  let desiredInspectorMode = 'general';
  let inspectorTargetKey = '';
  let historyControls = null;
  let historyMarker = null;

  const managedNodes = new Map();
  function rememberNode(node, key) {
    if (!node || managedNodes.has(key)) return;
    const marker = document.createElement('span');
    marker.hidden = true;
    marker.dataset.workspaceMarker = key;
    node.parentNode?.insertBefore(marker, node);
    managedNodes.set(key, { node, marker, text: node.textContent });
  }
  function restoreNode(key) {
    const entry = managedNodes.get(key);
    if (!entry?.marker?.isConnected) return;
    entry.marker.after(entry.node);
    if (entry.text != null && entry.node instanceof HTMLButtonElement && !entry.node.classList.contains('group-create-action')) entry.node.textContent = entry.text;
  }

  function clone(value) {
    return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  }

  function activeTab() {
    return document.querySelector('.tab.active')?.dataset.tab || '';
  }

  function isCatalogActive() {
    return activeTab() === 'catalog' && Boolean(document.querySelector('#catalog.panel.active'));
  }

  /* Histórico editorial deliberadamente limitado a catálogo/seleção.
   * Produtos não entram no snapshot para evitar que undo local tente ressuscitar dados já publicados. */
  const history = {
    undo: [],
    redo: [],
    applying: false,
    lastSource: '',
    lastAt: 0,
    limit: 80
  };
  const originalCoreMutate = NS.Core?.mutate?.bind(NS.Core);
  const originalCoreSetState = NS.Core?.setState?.bind(NS.Core);
  const originalResetCatalog = NS.Core?.resetCatalog?.bind(NS.Core);

  function historySnapshot() {
    const state = NS.Core?.getState?.();
    if (!state) return null;
    return clone({ selectedIds: state.selectedIds || [], catalog: state.catalog || {} });
  }

  function snapshotKey(snapshot) {
    return snapshot ? JSON.stringify(snapshot) : '';
  }

  function historySource() {
    const node = document.activeElement;
    if (!node || node === document.body) return 'editor';
    const id = node.id ? `#${node.id}` : '';
    const data = node.dataset || {};
    const detail = data.inspectorCardField || data.inspectorCollectionField || data.inspectorTableField || data.inspectorMemberField || data.selectProduct || data.commercialPriceStyle || data.commercialTablePriceStyle || data.commercialMemberPriceStyle || data.imageFrameField || data.editorMove || '';
    return `${node.tagName || 'NODE'}${id}:${detail}`;
  }

  function syncHistoryControls() {
    if (!historyControls) return;
    const active = isCatalogActive();
    historyControls.hidden = !active;
    const undoButton = historyControls.querySelector('[data-editor-history="undo"]');
    const redoButton = historyControls.querySelector('[data-editor-history="redo"]');
    if (undoButton) undoButton.disabled = !active || history.undo.length === 0;
    if (redoButton) redoButton.disabled = !active || history.redo.length === 0;
    historyControls.dataset.undoCount = String(history.undo.length);
    historyControls.dataset.redoCount = String(history.redo.length);
  }

  function pushHistory(before, source) {
    const now = Date.now();
    const coalesce = source && source === history.lastSource && now - history.lastAt < 650 && history.undo.length;
    if (!coalesce) {
      history.undo.push(before);
      if (history.undo.length > history.limit) history.undo.shift();
    }
    history.redo.length = 0;
    history.lastSource = source;
    history.lastAt = now;
    syncHistoryControls();
    window.dispatchEvent(new CustomEvent('catalogotop:history-changed', { detail: { undo: history.undo.length, redo: history.redo.length } }));
  }

  function clearHistory() {
    history.undo.length = 0;
    history.redo.length = 0;
    history.lastSource = '';
    history.lastAt = 0;
    syncHistoryControls();
  }

  if (originalCoreMutate) {
    NS.Core.mutate = function historyAwareMutate(mutator) {
      if (history.applying || !isCatalogActive()) return originalCoreMutate(mutator);
      const before = historySnapshot();
      const beforeKey = snapshotKey(before);
      const source = historySource();
      const result = originalCoreMutate(mutator);
      const after = historySnapshot();
      if (before && beforeKey !== snapshotKey(after)) pushHistory(before, source);
      return result;
    };
  }

  if (originalResetCatalog) {
    NS.Core.resetCatalog = function historyAwareResetCatalog() {
      if (history.applying || !isCatalogActive()) return originalResetCatalog();
      const before = historySnapshot();
      const beforeKey = snapshotKey(before);
      const result = originalResetCatalog();
      if (before && beforeKey !== snapshotKey(historySnapshot())) pushHistory(before, 'reset-catalog');
      return result;
    };
  }

  if (originalCoreSetState) {
    NS.Core.setState = function historyAwareSetState(nextState, options) {
      const result = originalCoreSetState(nextState, options);
      if (!history.applying) clearHistory();
      return result;
    };
  }

  function applyHistorySnapshot(snapshot) {
    if (!snapshot || !originalCoreSetState) return false;
    const currentState = NS.Core.getState();
    history.applying = true;
    try {
      originalCoreSetState({ ...currentState, selectedIds: clone(snapshot.selectedIds), catalog: clone(snapshot.catalog) });
    } finally {
      history.applying = false;
    }
    NS.App?.renderAll?.();
    NS.ComposerSelection?.reconcile?.(NS.Core.getState());
    window.dispatchEvent(new CustomEvent('catalogotop:history-applied'));
    syncHistoryControls();
    return true;
  }

  function undo() {
    if (!isCatalogActive() || !history.undo.length) return false;
    const target = history.undo.pop();
    history.redo.push(historySnapshot());
    history.lastSource = '';
    history.lastAt = 0;
    return applyHistorySnapshot(target);
  }

  function redo() {
    if (!isCatalogActive() || !history.redo.length) return false;
    const target = history.redo.pop();
    history.undo.push(historySnapshot());
    history.lastSource = '';
    history.lastAt = 0;
    return applyHistorySnapshot(target);
  }

  function ensureHistoryControls() {
    if (historyControls?.isConnected) return historyControls;
    if (!headingActions) return null;
    if (!historyMarker) {
      historyMarker = document.createElement('span');
      historyMarker.hidden = true;
      historyMarker.dataset.historyMarker = 'true';
      headingActions.insertBefore(historyMarker, document.getElementById('btnNewCatalog') || headingActions.firstChild);
    }
    historyControls = document.createElement('div');
    historyControls.className = 'editor-history-controls';
    historyControls.setAttribute('aria-label', 'Histórico de edição do catálogo');
    historyControls.innerHTML = '<button type="button" data-editor-history="undo" aria-label="Desfazer" title="Desfazer · Ctrl+Z" aria-keyshortcuts="Control+Z">↶</button><button type="button" data-editor-history="redo" aria-label="Refazer" title="Refazer · Ctrl+Shift+Z / Ctrl+Y" aria-keyshortcuts="Control+Shift+Z Control+Y">↷</button>';
    historyMarker.after(historyControls);
    historyControls.addEventListener('click', event => {
      const button = event.target.closest('[data-editor-history]');
      if (!button || button.disabled) return;
      if (button.dataset.editorHistory === 'undo') undo();
      else redo();
    });
    syncHistoryControls();
    return historyControls;
  }

  function syncHistoryPlacement() {
    const controls = ensureHistoryControls();
    if (!controls || !historyMarker) return;
    if (mobile.matches && appPrimaryTools) appPrimaryTools.appendChild(controls);
    else if (historyMarker.isConnected) historyMarker.after(controls);
    syncHistoryControls();
  }

  function show(name) {
    if (!panels.some(panel => panel.dataset.mobileWorkspacePanel === name)) return;
    current = name;
    tabs.forEach(tab => {
      const active = tab.dataset.mobileWorkspaceTarget === name;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    panels.forEach(panel => panel.classList.toggle('mobile-workspace-active', panel.dataset.mobileWorkspacePanel === name));
  }

  function ensureSelectionCategoryRail() {
    if (!selectionToolbar || !selectionCategory) return null;
    if (selectionCategoryRail?.isConnected) return selectionCategoryRail;
    selectionCategoryRail = document.createElement('div');
    selectionCategoryRail.className = 'selection-category-rail';
    selectionCategoryRail.setAttribute('aria-label', 'Filtrar produtos por categoria');
    selectionToolbar.appendChild(selectionCategoryRail);
    selectionCategoryRail.addEventListener('click', event => {
      const button = event.target.closest('[data-selection-category-value]');
      if (!button) return;
      const nextValue = button.dataset.selectionCategoryValue || '';
      if (selectionCategory.value === nextValue) {
        renderSelectionCategoryRail();
        return;
      }
      selectionCategory.value = nextValue;
      selectionCategory.dispatchEvent(new Event('change', { bubbles: true }));
    });
    return selectionCategoryRail;
  }

  function keepActiveCategoryVisible(rail) {
    if (!rail?.clientWidth) return;
    const active = rail.querySelector('.active');
    if (!active) return;
    const left = active.offsetLeft;
    const right = left + active.offsetWidth;
    const visibleLeft = rail.scrollLeft;
    const visibleRight = visibleLeft + rail.clientWidth;
    if (left < visibleLeft + 8) rail.scrollTo({ left: Math.max(0, left - 8), behavior: 'auto' });
    else if (right > visibleRight - 8) rail.scrollTo({ left: Math.max(0, right - rail.clientWidth + 8), behavior: 'auto' });
  }

  function renderSelectionCategoryRail() {
    const rail = ensureSelectionCategoryRail();
    if (!rail || !selectionCategory) return;
    const previousScroll = rail.scrollLeft;
    const selected = selectionCategory.value;
    const buttons = Array.from(selectionCategory.options).map(option => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'selection-category-chip';
      button.dataset.selectionCategoryValue = option.value;
      button.textContent = option.textContent || 'Todas as categorias';
      const active = option.value === selected;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
      return button;
    });
    rail.replaceChildren(...buttons);
    rail.scrollLeft = previousScroll;
    requestAnimationFrame(() => keepActiveCategoryVisible(rail));
  }

  function protectPreviewImages() {
    if (!catalogPreviewViewport || !mobile.matches) return;
    catalogPreviewViewport.querySelectorAll('img').forEach(image => {
      image.draggable = false;
      image.setAttribute('draggable', 'false');
    });
  }

  function currentTargetKey() {
    const target = NS.ComposerSelection?.get?.();
    if (!target) return '';
    return [target.kind, target.blockId || '', target.productId || '', target.rowId || ''].join(':');
  }

  function syncInspectorImageMode() {
    if (!contextualInspector) return;
    const key = currentTargetKey();
    if (key !== inspectorTargetKey) {
      inspectorTargetKey = key;
      desiredInspectorMode = 'general';
    }
    const modeTabs = contextualInspector.querySelector('.inspector-mode-tabs');
    if (!modeTabs || !key) return;
    const hasImageMode = Boolean(contextualInspector.querySelector('.inspector-image-frame:not(.is-unavailable)'));
    contextualInspector.dataset.hasImageMode = String(hasImageMode);
    let imageTab = modeTabs.querySelector('[data-inspector-image-tab]');
    if (hasImageMode && !imageTab) {
      imageTab = document.createElement('button');
      imageTab.type = 'button';
      imageTab.dataset.inspectorImageTab = 'true';
      imageTab.setAttribute('role', 'tab');
      imageTab.textContent = 'Imagem';
      modeTabs.appendChild(imageTab);
    } else if (!hasImageMode && imageTab) {
      imageTab.remove();
      imageTab = null;
    }
    if (desiredInspectorMode === 'image' && hasImageMode && imageTab) {
      contextualInspector.dataset.inspectorMode = 'image';
      modeTabs.querySelectorAll('button').forEach(button => {
        const active = button === imageTab;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
      });
    } else {
      imageTab?.classList.remove('active');
      imageTab?.setAttribute('aria-selected', 'false');
      if (desiredInspectorMode === 'image') desiredInspectorMode = 'general';
    }
  }

  function scheduleInspectorSync() {
    requestAnimationFrame(() => requestAnimationFrame(syncInspectorImageMode));
  }

  function ensureDesktopActionToolbar() {
    if (!selectionToolbar) return null;
    if (desktopActionToolbar?.isConnected) return desktopActionToolbar;
    desktopActionToolbar = document.createElement('div');
    desktopActionToolbar.className = 'desktop-editor-actions';
    const overflow = document.createElement('details');
    overflow.className = 'desktop-action-overflow';
    overflow.innerHTML = '<summary aria-label="Mais ações" title="Mais ações">⋯</summary><div></div>';
    desktopActionToolbar.appendChild(overflow);
    selectionToolbar.appendChild(desktopActionToolbar);
    return desktopActionToolbar;
  }

  function syncDesktopActionToolbar() {
    const ids = ['btnSelectVisible', 'btnCreateCollection', 'btnCreateTableBlock', 'btnClearSelection'];
    ids.forEach(id => rememberNode(document.getElementById(id), id));
    if (!desktopAuthoring.matches) {
      ids.forEach(restoreNode);
      if (desktopActionToolbar) desktopActionToolbar.hidden = true;
      return;
    }
    const toolbar = ensureDesktopActionToolbar();
    if (!toolbar) return;
    toolbar.hidden = false;
    const overflowMenu = toolbar.querySelector('.desktop-action-overflow > div');
    const overflow = toolbar.querySelector('.desktop-action-overflow');
    const include = document.getElementById('btnSelectVisible');
    const collection = document.getElementById('btnCreateCollection');
    const table = document.getElementById('btnCreateTableBlock');
    const clear = document.getElementById('btnClearSelection');
    if (include) { include.textContent = 'Incluir visíveis'; toolbar.insertBefore(include, overflow); }
    if (collection) toolbar.insertBefore(collection, overflow);
    if (table) toolbar.insertBefore(table, overflow);
    if (clear && overflowMenu) overflowMenu.appendChild(clear);
  }

  function syncHeadingActions() {
    if (!headingActions || !previewToolbar) return;
    rememberNode(headingActions, 'headingActions');
    if (desktopAuthoring.matches) previewToolbar.insertBefore(headingActions, previewZoomControls || null);
    else restoreNode('headingActions');
  }

  function syncDesktopChrome() {
    syncHeadingActions();
    syncHistoryPlacement();
    syncDesktopActionToolbar();
    renderSelectionCategoryRail();
    scheduleInspectorSync();
  }

  function syncMode() {
    if (products && workspace && tabs.length === 2 && panels.length === 2) {
      products.classList.toggle('mobile-workspace-enabled', mobile.matches);
      show(current);
    }
    renderSelectionCategoryRail();
    protectPreviewImages();
    syncDesktopChrome();
  }

  function shortcutButton(kind) {
    return document.getElementById(kind === 'table' ? 'btnCreateTableBlock' : 'btnCreateCollection');
  }

  function handleKeyboardShortcuts(event) {
    const key = String(event.key || '').toLowerCase();
    const editable = event.target?.closest?.('input,textarea,select,[contenteditable="true"]');
    const command = event.ctrlKey || event.metaKey;

    if (isCatalogActive() && command && !editable && key === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if (isCatalogActive() && command && !editable && key === 'y') {
      event.preventDefault();
      redo();
      return;
    }

    if (!isCatalogActive() || editable || event.shiftKey) return;
    if (!command || !['g', 't'].includes(key)) return;
    event.preventDefault();
    const button = shortcutButton(key === 't' ? 'table' : 'collection');
    if (button && !button.disabled) button.click();
  }

  tabs.forEach(tab => tab.addEventListener('click', () => show(tab.dataset.mobileWorkspaceTarget)));

  products?.addEventListener('click', event => {
    if (!mobile.matches) return;
    if (event.target.closest('[data-edit-product], #btnNewProduct')) show('form');
  });

  workspace?.addEventListener('touchstart', event => {
    if (!mobile.matches || event.touches.length !== 1) return;
    if (event.target.closest('input, textarea, select, button, a, [contenteditable="true"]')) return;
    const touch = event.touches[0];
    gesture = { x: touch.clientX, y: touch.clientY, time: performance.now() };
  }, { passive: true });

  workspace?.addEventListener('touchend', event => {
    if (!gesture || !mobile.matches || event.changedTouches.length !== 1) {
      gesture = null;
      return;
    }
    const touch = event.changedTouches[0];
    const dx = touch.clientX - gesture.x;
    const dy = touch.clientY - gesture.y;
    const elapsed = performance.now() - gesture.time;
    gesture = null;
    if (elapsed > 700 || Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    if (dx < 0 && current === 'form') show('library');
    if (dx > 0 && current === 'library') show('form');
  }, { passive: true });

  catalogPreviewViewport?.addEventListener('contextmenu', event => {
    if (!mobile.matches) return;
    event.preventDefault();
  });
  catalogPreviewViewport?.addEventListener('dragstart', event => {
    if (!mobile.matches || !event.target.closest('img')) return;
    event.preventDefault();
  });

  document.addEventListener('click', event => {
    const imageTab = event.target.closest('[data-inspector-image-tab]');
    if (imageTab) {
      event.preventDefault();
      desiredInspectorMode = 'image';
      syncInspectorImageMode();
      return;
    }
    const mode = event.target.closest('.inspector-mode-tabs button[data-inspector-mode]');
    if (mode) desiredInspectorMode = mode.dataset.inspectorMode === 'order' ? 'order' : 'general';
    if (event.target.closest('#btnClearSelection')) document.querySelector('.desktop-action-overflow')?.removeAttribute('open');
  });

  window.addEventListener('keydown', handleKeyboardShortcuts, true);
  selectionCategory?.addEventListener('change', renderSelectionCategoryRail);
  window.addEventListener('catalogotop:selection-rendered', () => { renderSelectionCategoryRail(); syncDesktopChrome(); });
  window.addEventListener('catalogotop:catalog-rendered', () => { protectPreviewImages(); syncDesktopChrome(); });
  window.addEventListener('catalogotop:editor-selection-changed', scheduleInspectorSync);
  window.addEventListener('catalogotop:products-updated', renderSelectionCategoryRail);
  window.addEventListener('catalogotop:tab-changed', syncHistoryPlacement);
  document.addEventListener('change', event => {
    if (event.target.closest('.inspector-image-frame')) scheduleInspectorSync();
  });

  if (typeof mobile.addEventListener === 'function') mobile.addEventListener('change', syncMode);
  else mobile.addListener(syncMode);
  if (typeof desktopAuthoring.addEventListener === 'function') desktopAuthoring.addEventListener('change', syncMode);
  else desktopAuthoring.addListener(syncMode);

  NS.EditorHistory = { undo, redo, clear: clearHistory, canUndo: () => history.undo.length > 0, canRedo: () => history.redo.length > 0, snapshot: historySnapshot };
  NS.MobileWorkspace = { show, current: () => current, renderSelectionCategoryRail, syncDesktopChrome };
  ensureHistoryControls();
  syncMode();
})();