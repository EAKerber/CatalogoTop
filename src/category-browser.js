(function () {
  'use strict';

  const NS = window.CatalogoTop;
  const Core = NS?.Core;
  const foldersRoot = document.getElementById('categoryFolders');
  const datalist = document.getElementById('categoryOptions');
  const categoryInput = document.getElementById('category');
  const productFilter = document.getElementById('filterCategory');
  const productRows = document.getElementById('productRows');

  if (!Core || !foldersRoot || !datalist || !categoryInput || !productFilter || !productRows) return;

  const folderIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h6l2 2h9v9.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V6.5Z"/><path d="M3.5 10h17"/></svg>';
  const allIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h6l2 2h8v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z"/><path d="M6 4h5l2 2"/></svg>';

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
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

  function renderFolders() {
    const { products, counts, categories } = snapshot();
    const active = productFilter.value;
    const allButton = `<button type="button" class="category-folder ${active ? '' : 'active'}" data-category-folder="">
      ${allIcon}<span class="category-folder-label">Todos os produtos</span><span class="category-folder-count">${products.length}</span>
    </button>`;

    const categoryButtons = categories.map(category => `<button type="button" class="category-folder ${active === category ? 'active' : ''}" data-category-folder="${esc(category)}">
      ${folderIcon}<span class="category-folder-label">${esc(category)}</span><span class="category-folder-count">${counts.get(category)}</span>
    </button>`).join('');

    foldersRoot.innerHTML = allButton + (categoryButtons || '<div class="category-browser-empty">As categorias aparecerão aqui conforme produtos forem cadastrados ou importados.</div>');
    renderDatalist(categories);
  }

  function ensureFilterOption(category) {
    if (!category) return;
    if (Array.from(productFilter.options).some(option => option.value === category)) return;
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    productFilter.append(option);
  }

  foldersRoot.addEventListener('click', event => {
    const button = event.target.closest('[data-category-folder]');
    if (!button) return;
    const category = button.dataset.categoryFolder || '';
    ensureFilterOption(category);
    productFilter.value = category;
    productFilter.dispatchEvent(new Event('change', { bubbles: true }));
    renderFolders();
  });

  productFilter.addEventListener('change', () => queueMicrotask(renderFolders));
  categoryInput.addEventListener('input', () => {
    categoryInput.dataset.categoryMode = snapshot().categories.includes(categoryInput.value.trim()) ? 'existing' : 'new';
  });

  document.getElementById('productForm')?.addEventListener('submit', () => queueMicrotask(renderFolders));
  new MutationObserver(() => queueMicrotask(renderFolders)).observe(productRows, { childList: true });

  renderFolders();
})();
