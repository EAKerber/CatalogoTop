(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const { AssetIndexStore, LibraryShell, App } = NS;
  if (!AssetIndexStore || !LibraryShell || !App) return;

  let inventory = [];
  let pickerActive = false;
  let loading = false;

  const esc = value => NS.Render?.esc ? NS.Render.esc(String(value ?? '')) : String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  function active() {
    return LibraryShell.getActiveProvider?.() === 'images';
  }

  function formatBytes(value) {
    const bytes = Number(value || 0);
    if (!Number.isFinite(bytes) || bytes <= 0) return 'Tamanho desconhecido';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  }

  function usageLabels(asset) {
    const values = [];
    const seen = new Set();
    (Array.isArray(asset.usages) ? asset.usages : []).forEach(usage => {
      const label = String(usage.ownerLabel || usage.ownerId || '').trim();
      if (!label || seen.has(label)) return;
      seen.add(label);
      values.push(label);
    });
    return values;
  }

  function searchText(asset) {
    return [
      asset.label, asset.sha256, asset.contentType,
      ...(Array.isArray(asset.usages) ? asset.usages.flatMap(usage => [usage.ownerLabel, usage.ownerId, usage.field, usage.productId]) : [])
    ].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function visibleAssets() {
    const query = String(document.getElementById('assetLibrarySearch')?.value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const values = query ? inventory.filter(asset => searchText(asset).includes(query)) : inventory.slice();
    return values.sort((a, b) => String(a.label || '').localeCompare(String(b.label || ''), 'pt-BR') || String(a.sha256 || '').localeCompare(String(b.sha256 || '')));
  }

  function render() {
    const list = document.getElementById('assetLibraryList');
    const empty = document.getElementById('assetLibraryEmpty');
    const count = document.getElementById('assetLibraryCount');
    const authority = document.getElementById('assetLibraryAuthority');
    const picker = document.getElementById('assetPickerContext');
    if (!list || !empty || !count) return;

    const values = visibleAssets();
    count.textContent = loading ? 'Carregando…' : `${values.length} ${values.length === 1 ? 'imagem' : 'imagens'}`;
    if (authority) {
      const payload = list.__inventoryPayload || {};
      authority.textContent = `índice r${payload.assetIndexRevision ?? 0} · produtos r${payload.productRevision ?? 0} · catálogos r${payload.catalogRevision ?? 0}`;
    }
    if (picker) picker.classList.toggle('hidden', !pickerActive);

    list.innerHTML = values.map(asset => {
      const uses = usageLabels(asset);
      const usageText = uses.length ? `${uses.slice(0, 3).map(esc).join(' · ')}${uses.length > 3 ? ` · +${uses.length - 3}` : ''}` : 'Sem uso autoritativo';
      const technical = [asset.contentType || 'tipo desconhecido', formatBytes(asset.bytes)].join(' · ');
      const status = asset.available === false ? 'Blob indisponível' : asset.indexed ? 'Indexada' : 'Descoberta por uso';
      return `<article class="asset-library-item" data-asset-resource="${esc(asset.id)}">
        <div class="asset-library-thumb"><img src="${esc(asset.url)}" alt="" loading="lazy" /></div>
        <div class="asset-library-copy">
          <div class="asset-library-title"><strong>${esc(asset.label || `Imagem ${String(asset.sha256 || '').slice(0, 8)}`)}</strong><span>${esc(status)}</span></div>
          <code title="${esc(asset.sha256)}">${esc(String(asset.sha256 || '').slice(0, 12))}</code>
          <small>${esc(technical)}</small>
          <small class="asset-library-usage">${usageText}</small>
        </div>
        <div class="asset-library-actions">
          <button class="button secondary compact" type="button" data-asset-edit-label="${esc(asset.id)}">Editar nome</button>
          ${pickerActive && asset.available !== false ? `<button class="button primary compact" type="button" data-asset-use="${esc(asset.id)}">Usar imagem</button>` : ''}
        </div>
      </article>`;
    }).join('');
    empty.classList.toggle('hidden', values.length > 0 || loading);
  }

  async function refreshInventory() {
    if (loading) return;
    loading = true;
    render();
    try {
      const response = await fetch('/api/asset-inventory', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error(`Falha ao carregar imagens (${response.status}).`);
      const payload = await response.json();
      inventory = Array.isArray(payload.assets) ? payload.assets : [];
      const list = document.getElementById('assetLibraryList');
      if (list) list.__inventoryPayload = payload;
    } catch (error) {
      console.warn(error);
      inventory = [];
    } finally {
      loading = false;
      render();
    }
  }

  function byId(id) {
    return inventory.find(asset => asset.id === id) || null;
  }

  async function editLabel(id) {
    const asset = byId(id);
    if (!asset) return;
    const current = asset.indexed ? String(asset.label || '') : '';
    const label = window.prompt('Nome desta imagem na Biblioteca:', current);
    if (label == null) return;
    const ok = await AssetIndexStore.setLabel(asset.url, label, {
      contentType: asset.contentType || '', bytes: Number(asset.bytes || 0), createdAt: asset.createdAt || ''
    });
    if (ok) await refreshInventory();
  }

  function useAsset(id) {
    const asset = byId(id);
    if (!asset || asset.available === false) return;
    const input = document.getElementById('imageUrl');
    if (!input) return;
    input.value = asset.url;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    pickerActive = false;
    window.dispatchEvent(new CustomEvent('catalogotop:asset-picked', { detail: { assetId: asset.id, url: asset.url } }));
    App.switchTab('products');
    render();
  }

  async function openPicker() {
    pickerActive = true;
    App.switchTab('library');
    LibraryShell.show('images');
    render();
    await refreshInventory();
  }

  function cancelPicker() {
    pickerActive = false;
    App.switchTab('products');
    render();
  }

  document.getElementById('btnChooseAssetLibrary')?.addEventListener('click', openPicker);
  document.getElementById('assetLibrarySearch')?.addEventListener('input', render);
  document.getElementById('assetPickerCancel')?.addEventListener('click', cancelPicker);
  document.getElementById('assetLibraryList')?.addEventListener('click', event => {
    const edit = event.target.closest('[data-asset-edit-label]');
    if (edit) { editLabel(edit.dataset.assetEditLabel); return; }
    const use = event.target.closest('[data-asset-use]');
    if (use) useAsset(use.dataset.assetUse);
  });

  window.addEventListener('catalogotop:library-provider-changed', event => {
    if (event.detail?.provider === 'images') refreshInventory();
  });
  window.addEventListener('catalogotop:asset-index-updated', () => { if (active()) refreshInventory(); });
  window.addEventListener('catalogotop:products-updated', () => { if (active()) refreshInventory(); });
  window.addEventListener('catalogotop:catalogs-updated', () => { if (active()) refreshInventory(); });

  NS.AssetLibrary = Object.freeze({ refreshInventory, openPicker, cancelPicker, isPickerActive: () => pickerActive });
  render();
})();
