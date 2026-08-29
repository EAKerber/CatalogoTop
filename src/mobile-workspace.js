(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
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

  let current = 'form';
  let gesture = null;
  let selectionCategoryRail = null;
  let desktopActionToolbar = null;
  let desiredInspectorMode = 'general';
  let inspectorTargetKey = '';
  let syncFrame = 0;

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
    if (entry.text != null && entry.node instanceof HTMLButtonElement) entry.node.textContent = entry.text;
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
    if (!selectionPanel) return null;
    if (desktopActionToolbar?.isConnected) return desktopActionToolbar;
    desktopActionToolbar = document.createElement('div');
    desktopActionToolbar.className = 'desktop-editor-actions';
    const overflow = document.createElement('details');
    overflow.className = 'desktop-action-overflow';
    overflow.innerHTML = '<summary aria-label="Mais ações" title="Mais ações">⋯</summary><div></div>';
    desktopActionToolbar.appendChild(overflow);
    const inspector = document.querySelector('#contextualInspector');
    if (inspector) inspector.insertAdjacentElement('afterend', desktopActionToolbar);
    else selectionPanel.prepend(desktopActionToolbar);
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
    if (collection) { collection.textContent = 'Coleção'; toolbar.insertBefore(collection, overflow); }
    if (table) { table.textContent = 'Tabela'; toolbar.insertBefore(table, overflow); }
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

  selectionCategory?.addEventListener('change', renderSelectionCategoryRail);
  window.addEventListener('catalogotop:selection-rendered', () => { renderSelectionCategoryRail(); syncDesktopChrome(); });
  window.addEventListener('catalogotop:catalog-rendered', () => { protectPreviewImages(); syncDesktopChrome(); });
  window.addEventListener('catalogotop:editor-selection-changed', scheduleInspectorSync);
  window.addEventListener('catalogotop:products-updated', renderSelectionCategoryRail);
  document.addEventListener('change', event => {
    if (event.target.closest('.inspector-image-frame')) scheduleInspectorSync();
  });

  if (typeof mobile.addEventListener === 'function') mobile.addEventListener('change', syncMode);
  else mobile.addListener(syncMode);
  if (typeof desktopAuthoring.addEventListener === 'function') desktopAuthoring.addEventListener('change', syncMode);
  else desktopAuthoring.addListener(syncMode);

  NS.MobileWorkspace = { show, current: () => current, renderSelectionCategoryRail, syncDesktopChrome };
  syncMode();
})();