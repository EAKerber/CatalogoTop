(function () {
  'use strict';

  const NS = window.CatalogoTop;
  const Core = NS?.Core;
  const foldersRoot = document.getElementById('categoryFolders');
  const datalist = document.getElementById('categoryOptions');
  const categoryInput = document.getElementById('category');
  const productFilter = document.getElementById('filterCategory');
  const productRows = document.getElementById('productRows');
  const productForm = document.getElementById('productForm');

  if (!Core || !foldersRoot || !datalist || !categoryInput || !productFilter || !productRows) return;

  const folderIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h6l2 2h9v9.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V6.5Z"/><path d="M3.5 10h17"/></svg>';
  const allIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h6l2 2h8v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z"/><path d="M6 4h5l2 2"/></svg>';
  const trashIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7h15"/><path d="M9 3.8h6L16.3 7H7.7L9 3.8Z"/><path d="M7 7l.8 12.2h8.4L17 7"/><path d="M10 10.5v5.5M14 10.5v5.5"/></svg>';

  let pickerRoot = null;
  let pickerToggle = null;
  let activePickerIndex = -1;
  let suppressFocusOpen = false;

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function snapshot() {
    const products = Core.getState().products || [];
    const counts = new Map();
    for (const product of products) {
      const category = String(product.category || 'Sem categoria').trim() || 'Sem categoria';
      counts.set(category, (counts.get(category) || 0) + 1);
    }
    const categories = Array.from(counts.keys()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return { products, counts, categories };
  }

  function renderDatalist(categories) {
    datalist.innerHTML = categories.map(category => `<option value="${esc(category)}"></option>`).join('');
  }

  function ensureFilterOption(category) {
    if (!category) return;
    if (Array.from(productFilter.options).some(option => option.value === category)) return;
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    productFilter.append(option);
  }

  function closePicker() {
    if (!pickerRoot || !pickerToggle) return;
    pickerRoot.hidden = true;
    categoryInput.setAttribute('aria-expanded', 'false');
    pickerToggle.setAttribute('aria-expanded', 'false');
    activePickerIndex = -1;
  }

  function suggestionScore(category, query) {
    const value = normalize(category);
    const needle = normalize(query);
    if (!needle) return 4;
    if (value === needle) return 0;
    if (value.startsWith(needle)) return 1;
    if (value.split(/\s+/).some(part => part.startsWith(needle))) return 2;
    if (value.includes(needle)) return 3;
    return 9;
  }

  function recommendedCategories(categories, counts, query) {
    if (!categories.length) return [];
    const needle = normalize(query);
    if (!needle) {
      return categories.slice().sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0) || a.localeCompare(b, 'pt-BR')).slice(0, 3);
    }
    return categories
      .map(category => ({ category, score: suggestionScore(category, needle) }))
      .filter(item => item.score < 9)
      .sort((a, b) => a.score - b.score || (counts.get(b.category) || 0) - (counts.get(a.category) || 0) || a.category.localeCompare(b.category, 'pt-BR'))
      .slice(0, 3)
      .map(item => item.category);
  }

  function pickerOption(category, { suggested = false } = {}) {
    const count = snapshot().counts.get(category) || 0;
    return `<button type="button" class="category-picker-option${suggested ? ' suggested' : ''}" role="option" data-category-choice="${esc(category)}">
      <span>${esc(category)}</span><small>${suggested ? 'Sugestão · ' : ''}${count} ${count === 1 ? 'produto' : 'produtos'}</small>
    </button>`;
  }

  function updateCategoryMode(categories) {
    const value = categoryInput.value.trim();
    const existing = categories.some(category => normalize(category) === normalize(value));
    categoryInput.dataset.categoryMode = existing ? 'existing' : value ? 'new' : '';
    const hint = categoryInput.closest('.product-category-field')?.querySelector('small');
    if (!hint) return;
    if (!value) hint.textContent = 'Digite para buscar uma categoria existente ou informe um novo nome.';
    else if (existing) hint.textContent = 'Categoria existente selecionada.';
    else hint.textContent = `“${value}” será criada como nova categoria ao salvar.`;
  }

  function renderPicker({ forceOpen = false } = {}) {
    if (!pickerRoot) return;
    const { categories, counts } = snapshot();
    const query = categoryInput.value.trim();
    const suggestions = recommendedCategories(categories, counts, query);
    const suggestedSet = new Set(suggestions);
    const remaining = categories.filter(category => !suggestedSet.has(category));
    const exact = categories.some(category => normalize(category) === normalize(query));

    const createOption = query && !exact
      ? `<button type="button" class="category-picker-option create" role="option" data-category-create="${esc(query)}"><span>Criar “${esc(query)}”</span><small>Nova categoria</small></button>`
      : '';
    const suggestionsMarkup = suggestions.length
      ? `<div class="category-picker-section"><span class="category-picker-label">Sugestões</span>${suggestions.map(category => pickerOption(category, { suggested: true })).join('')}</div>`
      : '';
    const allMarkup = categories.length
      ? `<div class="category-picker-section category-picker-all"><span class="category-picker-label">Todas as categorias</span>${remaining.map(category => pickerOption(category)).join('')}${!remaining.length && !suggestions.length ? categories.map(category => pickerOption(category)).join('') : ''}</div>`
      : '<div class="category-picker-empty">Nenhuma categoria cadastrada ainda.</div>';

    pickerRoot.innerHTML = createOption + suggestionsMarkup + allMarkup;
    updateCategoryMode(categories);
    if (forceOpen || document.activeElement === categoryInput) {
      pickerRoot.hidden = false;
      categoryInput.setAttribute('aria-expanded', 'true');
      pickerToggle?.setAttribute('aria-expanded', 'true');
    }
    activePickerIndex = -1;
  }

  function chooseCategory(category, { create = false } = {}) {
    categoryInput.value = category;
    categoryInput.dataset.categoryMode = create ? 'new' : 'existing';
    categoryInput.dispatchEvent(new Event('input', { bubbles: true }));
    closePicker();
    suppressFocusOpen = true;
    categoryInput.focus({ preventScroll: true });
  }

  function pickerButtons() {
    return pickerRoot ? Array.from(pickerRoot.querySelectorAll('[role="option"]')) : [];
  }

  function movePickerFocus(delta) {
    const buttons = pickerButtons();
    if (!buttons.length) return;
    activePickerIndex = Math.max(0, Math.min(buttons.length - 1, activePickerIndex + delta));
    buttons.forEach((button, index) => button.classList.toggle('keyboard-active', index === activePickerIndex));
    buttons[activePickerIndex].scrollIntoView({ block: 'nearest' });
  }

  function setupPicker() {
    const field = categoryInput.closest('.product-category-field');
    if (!field || pickerRoot) return;
    categoryInput.removeAttribute('list');
    datalist.hidden = true;

    const shell = document.createElement('div');
    shell.className = 'category-combobox';
    categoryInput.before(shell);
    shell.append(categoryInput);

    pickerToggle = document.createElement('button');
    pickerToggle.type = 'button';
    pickerToggle.className = 'category-picker-toggle';
    pickerToggle.setAttribute('aria-label', 'Ver todas as categorias');
    pickerToggle.setAttribute('aria-expanded', 'false');
    pickerToggle.textContent = '⌄';
    shell.append(pickerToggle);

    pickerRoot = document.createElement('div');
    pickerRoot.id = 'categoryPicker';
    pickerRoot.className = 'category-picker';
    pickerRoot.setAttribute('role', 'listbox');
    pickerRoot.hidden = true;
    shell.append(pickerRoot);

    categoryInput.setAttribute('role', 'combobox');
    categoryInput.setAttribute('aria-autocomplete', 'list');
    categoryInput.setAttribute('aria-controls', pickerRoot.id);
    categoryInput.setAttribute('aria-expanded', 'false');

    categoryInput.addEventListener('focus', () => {
      if (suppressFocusOpen) {
        suppressFocusOpen = false;
        return;
      }
      renderPicker({ forceOpen: true });
    });
    categoryInput.addEventListener('input', () => renderPicker({ forceOpen: true }));
    categoryInput.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (pickerRoot.hidden) renderPicker({ forceOpen: true });
        movePickerFocus(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (pickerRoot.hidden) renderPicker({ forceOpen: true });
        movePickerFocus(-1);
      } else if (event.key === 'Enter' && activePickerIndex >= 0) {
        event.preventDefault();
        pickerButtons()[activePickerIndex]?.click();
      } else if (event.key === 'Escape') {
        closePicker();
      }
    });

    pickerToggle.addEventListener('click', () => {
      if (pickerRoot.hidden) renderPicker({ forceOpen: true });
      else closePicker();
    });

    pickerRoot.addEventListener('click', event => {
      const choice = event.target.closest('[data-category-choice]');
      if (choice) {
        chooseCategory(choice.dataset.categoryChoice || '');
        return;
      }
      const create = event.target.closest('[data-category-create]');
      if (create) chooseCategory(create.dataset.categoryCreate || '', { create: true });
    });

    document.addEventListener('pointerdown', event => {
      if (!shell.contains(event.target)) closePicker();
    });

    productForm?.addEventListener('reset', () => queueMicrotask(() => {
      closePicker();
      updateCategoryMode(snapshot().categories);
    }));
  }

  function renderFolders() {
    const { products, counts, categories } = snapshot();
    const active = productFilter.value;
    const allButton = `<div class="category-folder-row all"><button type="button" class="category-folder ${active ? '' : 'active'}" data-category-folder="">
      ${allIcon}<span class="category-folder-label">Todos os produtos</span><span class="category-folder-count">${products.length}</span>
    </button></div>`;

    const categoryButtons = categories.map(category => `<div class="category-folder-row">
      <button type="button" class="category-folder ${active === category ? 'active' : ''}" data-category-folder="${esc(category)}">
        ${folderIcon}<span class="category-folder-label">${esc(category)}</span><span class="category-folder-count">${counts.get(category)}</span>
      </button>
      <button type="button" class="category-delete-button" data-delete-category="${esc(category)}" title="Excluir categoria e seus produtos" aria-label="Excluir categoria ${esc(category)}">${trashIcon}</button>
    </div>`).join('');

    foldersRoot.innerHTML = allButton + (categoryButtons || '<div class="category-browser-empty">As categorias aparecerão aqui conforme produtos forem cadastrados ou importados.</div>');
    renderDatalist(categories);
    renderPicker();
  }

  foldersRoot.addEventListener('click', async event => {
    const deleteButton = event.target.closest('[data-delete-category]');
    if (deleteButton) {
      event.preventDefault();
      event.stopPropagation();
      const category = deleteButton.dataset.deleteCategory || '';
      try {
        const deleted = await NS.ProductActions?.deleteCategory?.(category);
        if (!deleted) return;
        if (productFilter.value === category) {
          productFilter.value = '';
          productFilter.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const currentProductId = document.getElementById('productId')?.value || '';
        if (currentProductId && !Core.getState().products.some(product => String(product.id) === String(currentProductId))) {
          document.getElementById('btnNewProduct')?.click();
        }
        renderFolders();
      } catch (error) {
        window.alert?.(error.message || 'Não foi possível excluir a categoria.');
      }
      return;
    }

    const button = event.target.closest('[data-category-folder]');
    if (!button) return;
    const category = button.dataset.categoryFolder || '';
    ensureFilterOption(category);
    productFilter.value = category;
    productFilter.dispatchEvent(new Event('change', { bubbles: true }));
    renderFolders();
  });

  productFilter.addEventListener('change', () => queueMicrotask(renderFolders));
  productForm?.addEventListener('submit', () => queueMicrotask(renderFolders));
  new MutationObserver(() => queueMicrotask(renderFolders)).observe(productRows, { childList: true });

  setupPicker();
  renderFolders();
})();