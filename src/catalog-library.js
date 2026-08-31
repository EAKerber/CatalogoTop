(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const { CatalogStore, FolderTree, Render } = NS;
  const root = document.getElementById('catalogLibraryAdmin');
  const list = document.getElementById('catalogLibraryList');
  const search = document.getElementById('catalogLibrarySearch');
  const count = document.getElementById('catalogLibraryCount');
  const empty = document.getElementById('catalogLibraryEmpty');
  if (!CatalogStore || !FolderTree || !Render || !root || !list || !search || !count || !empty) return;

  function folderPath(folderId, folders) {
    if (!folderId) return 'Catálogos (raiz)';
    try { return FolderTree.pathOf(folders, folderId).map(folder => folder.name).join(' / '); }
    catch { return 'Pasta indisponível'; }
  }

  function render() {
    const snapshot = CatalogStore.getSnapshot();
    const query = search.value.trim().toLocaleLowerCase('pt-BR');
    const catalogs = snapshot.catalogs
      .filter(record => {
        if (!query) return true;
        const haystack = [record.catalog.title, folderPath(record.folderId, snapshot.folders), ...record.selectedIds].join(' ').toLocaleLowerCase('pt-BR');
        return haystack.includes(query);
      })
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')) || a.catalog.title.localeCompare(b.catalog.title, 'pt-BR'));

    count.textContent = `${catalogs.length} ${catalogs.length === 1 ? 'catálogo' : 'catálogos'}`;
    list.innerHTML = catalogs.map(record => {
      const active = String(record.id) === String(CatalogStore.getActiveCatalogId());
      const updated = record.updatedAt ? Render.formatDate(record.updatedAt) : '—';
      return `<article class="catalog-library-row ${active ? 'selected' : ''}" data-catalog-resource="${Render.esc(record.id)}">
        <div class="catalog-library-copy">
          <strong>${Render.esc(record.catalog.title)}</strong>
          <span>${record.selectedIds.length} ${record.selectedIds.length === 1 ? 'produto referenciado' : 'produtos referenciados'} · ${Render.esc(folderPath(record.folderId, snapshot.folders))}</span>
          <small>${active ? 'Aberto agora · ' : ''}Atualizado em ${Render.esc(updated)}</small>
        </div>
        <div class="catalog-library-actions">
          <button class="button secondary compact" type="button" data-catalog-open="${Render.esc(record.id)}">Abrir</button>
          <button class="button secondary compact" type="button" data-catalog-duplicate="${Render.esc(record.id)}">Duplicar</button>
        </div>
      </article>`;
    }).join('');
    empty.classList.toggle('hidden', catalogs.length !== 0);
  }

  list.addEventListener('click', async event => {
    const open = event.target.closest('[data-catalog-open]');
    if (open) {
      if (await CatalogStore.openCatalog(open.dataset.catalogOpen)) NS.App?.switchTab?.('catalog');
      render();
      return;
    }
    const duplicate = event.target.closest('[data-catalog-duplicate]');
    if (duplicate) {
      await CatalogStore.duplicateCatalog(duplicate.dataset.catalogDuplicate, { open: true });
      NS.App?.switchTab?.('catalog');
      render();
    }
  });

  search.addEventListener('input', render);
  window.addEventListener('catalogotop:catalogs-updated', render);
  window.addEventListener('catalogotop:catalog-opened', render);
  window.addEventListener('catalogotop:library-provider-changed', event => {
    if (event.detail?.provider === 'catalogs') render();
  });
  window.addEventListener('catalogotop:tab-changed', event => {
    if (event.detail?.tabId === 'library') render();
  });

  NS.CatalogLibrary = Object.freeze({ render });
  render();
})();
