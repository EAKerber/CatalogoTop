(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  let midnightTimer = 0;

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function normalizeOverride(value) {
    const text = String(value || '').trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (!match) return '';
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '';
    return `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`;
  }

  function todayValue(now = new Date()) {
    const date = now instanceof Date ? now : new Date(now);
    if (Number.isNaN(date.getTime())) return '';
    return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function dateOnlyToIso(value) {
    const normalized = normalizeOverride(value);
    if (!normalized) return '';
    const [year, month, day] = normalized.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0).toISOString();
  }

  function effectiveIso(catalog, now = new Date()) {
    const override = normalizeOverride(catalog?.dateOverride);
    return override ? dateOnlyToIso(override) : new Date(now).toISOString();
  }

  function formatValue(value) {
    const normalized = normalizeOverride(value);
    if (!normalized) return '—';
    const [year, month, day] = normalized.split('-');
    return `${day}/${month}/${year}`;
  }

  function effectiveLabel(catalog, now = new Date()) {
    const override = normalizeOverride(catalog?.dateOverride);
    if (override) return formatValue(override);
    return `Hoje · ${formatValue(todayValue(now))}`;
  }

  function isAutomatic(catalog) {
    return !normalizeOverride(catalog?.dateOverride);
  }

  function currentCatalog() {
    return NS.Core?.getState?.()?.catalog || null;
  }

  function renderControl() {
    const catalog = currentCatalog();
    const label = document.getElementById('catalogCreatedAt');
    const input = document.getElementById('catalogDateOverride');
    const auto = document.getElementById('catalogDateAuto');
    const mode = document.getElementById('catalogDateMode');
    if (!catalog || !label || !input || !auto) return;

    const override = normalizeOverride(catalog.dateOverride);
    label.textContent = effectiveLabel(catalog);
    input.value = override;
    auto.setAttribute('aria-pressed', override ? 'false' : 'true');
    auto.classList.toggle('active', !override);
    if (mode) mode.textContent = override ? 'Data escolhida' : 'Automático';
  }

  function refreshCatalog() {
    window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
  }

  function setOverride(value) {
    if (!NS.Core?.mutate) return;
    const normalized = normalizeOverride(value);
    NS.Core.mutate(draft => {
      draft.catalog.dateOverride = normalized;
    });
    refreshCatalog();
  }

  function buildControl(meta) {
    if (!meta || meta.dataset.catalogDateReady === 'true') return;
    meta.dataset.catalogDateReady = 'true';
    meta.classList.add('catalog-date-meta');
    meta.innerHTML = `<span>Data do catálogo</span>
      <details class="catalog-date-menu" id="catalogDateMenu">
        <summary aria-label="Alterar data do catálogo">
          <span class="catalog-date-summary-copy"><strong id="catalogCreatedAt">—</strong><small id="catalogDateMode">Automático</small></span>
          <span class="catalog-date-caret" aria-hidden="true">⌄</span>
        </summary>
        <div class="catalog-date-popover">
          <button class="catalog-date-auto" id="catalogDateAuto" type="button" aria-pressed="true">
            <span><strong>Hoje</strong><small>Atualiza automaticamente</small></span><span class="catalog-date-check" aria-hidden="true">✓</span>
          </button>
          <label class="catalog-date-picker"><span>Escolher outra data</span><input id="catalogDateOverride" type="date" aria-label="Data personalizada do catálogo" /></label>
        </div>
      </details>`;

    const input = document.getElementById('catalogDateOverride');
    const auto = document.getElementById('catalogDateAuto');
    input?.addEventListener('change', event => {
      if (!event.target.value) return;
      setOverride(event.target.value);
      document.getElementById('catalogDateMenu')?.removeAttribute('open');
    });
    auto?.addEventListener('click', () => {
      setOverride('');
      document.getElementById('catalogDateMenu')?.removeAttribute('open');
    });
    renderControl();
  }

  function scheduleMidnightRefresh() {
    clearTimeout(midnightTimer);
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0);
    midnightTimer = window.setTimeout(() => {
      if (isAutomatic(currentCatalog()) && NS.Core?.mutate) {
        NS.Core.mutate(() => {});
        refreshCatalog();
      }
      scheduleMidnightRefresh();
    }, Math.max(1000, next.getTime() - now.getTime()));
  }

  function initUi() {
    const meta = document.querySelector('.catalog-controls .catalog-meta');
    if (!meta) return;
    buildControl(meta);
    window.addEventListener('catalogotop:catalog-rendered', renderControl);
    window.addEventListener('catalogotop:products-updated', () => window.setTimeout(renderControl, 0));
    scheduleMidnightRefresh();
  }

  NS.CatalogDate = {
    normalizeOverride,
    todayValue,
    dateOnlyToIso,
    effectiveIso,
    formatValue,
    effectiveLabel,
    isAutomatic,
    setOverride,
    renderControl
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initUi, { once: true });
    else initUi();
  }
})();