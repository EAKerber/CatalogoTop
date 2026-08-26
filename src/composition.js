(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};

  const CONTENT_PRESETS = Object.freeze([
    { id: 'visual', name: 'Visual' },
    { id: 'essential', name: 'Essencial' },
    { id: 'standard', name: 'Padrão' },
    { id: 'detailed', name: 'Detalhado' },
    { id: 'technical', name: 'Técnico' },
    { id: 'commercial', name: 'Comercial' },
    { id: 'auto', name: 'Auto' }
  ]);

  const EMPHASIS_PRESETS = Object.freeze([
    { id: 'normal', name: 'Normal' },
    { id: 'feature', name: 'Destaque visual' }
  ]);

  const WIDTH_PRESETS = Object.freeze([
    { id: 'simple', name: 'Simples · 1 slot' },
    { id: 'wide', name: 'Largo · 2 slots' },
    { id: 'full', name: 'Linha inteira' }
  ]);

  const DISTRIBUTIONS = Object.freeze([
    { id: 'compact', name: 'Compacta' },
    { id: 'balanced', name: 'Balanceada' },
    { id: 'editorial', name: 'Editorial' }
  ]);

  const TYPOGRAPHY_PRESETS = Object.freeze([
    { id: 'neutral', name: 'Neutra' },
    { id: 'technical', name: 'Técnica' },
    { id: 'editorial', name: 'Editorial' }
  ]);

  function normalizeChoice(value, allowed, fallback) {
    const text = String(value || '');
    return allowed.some(item => item.id === text) ? text : fallback;
  }

  function widthFromLegacySlots(value) {
    const slots = Number(value);
    if (!Number.isFinite(slots) || slots <= 1) return 'simple';
    if (slots === 2) return 'wide';
    return 'full';
  }

  function normalizeItemStyle(style) {
    const item = style && typeof style === 'object' ? style : {};
    const legacyHero = String(item.emphasis || '') === 'hero';
    const explicitWidth = item.width || item.layoutWidth || '';
    const widthFallback = legacyHero ? 'full' : (item.spanSlots != null ? widthFromLegacySlots(item.spanSlots) : 'simple');
    return {
      contentPreset: normalizeChoice(item.contentPreset, CONTENT_PRESETS, 'visual'),
      emphasis: normalizeChoice(legacyHero ? 'feature' : item.emphasis, EMPHASIS_PRESETS, 'normal'),
      width: normalizeChoice(explicitWidth, WIDTH_PRESETS, widthFallback)
    };
  }

  function normalizePresentation(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const itemStyles = {};
    if (source.itemStyles && typeof source.itemStyles === 'object') {
      Object.entries(source.itemStyles).forEach(([id, style]) => {
        if (!id) return;
        itemStyles[String(id)] = normalizeItemStyle(style);
      });
    }
    return {
      distribution: normalizeChoice(source.distribution, DISTRIBUTIONS, 'balanced'),
      typography: normalizeChoice(source.typography, TYPOGRAPHY_PRESETS, 'neutral'),
      itemStyles
    };
  }

  function styleFor(presentation, productId) {
    const normalized = normalizePresentation(presentation);
    return normalizeItemStyle(normalized.itemStyles[String(productId)]);
  }

  function resolveContentPreset(product, requested = 'visual') {
    const normalized = normalizeChoice(requested, CONTENT_PRESETS, 'visual');
    if (normalized !== 'auto') return normalized;
    const rows = Array.isArray(product?.tableRows) ? product.tableRows.length : 0;
    const specs = Array.isArray(product?.specs) ? product.specs.length : 0;
    const variants = Array.isArray(product?.variants) ? product.variants.length : 0;
    const variantImages = Array.isArray(product?.variants) ? product.variants.filter(item => item?.image).length : 0;
    if (rows >= 3 || specs >= 5) return 'technical';
    if (rows >= 1 || specs >= 3) return 'detailed';
    if (product?.price && rows === 0 && specs <= 1) return 'commercial';
    if ((variantImages >= 2 || variants >= 4) && rows === 0) return 'visual';
    return 'visual';
  }

  function templateSlotCount(template) {
    return Math.max(1, Math.min(3, Number(template?.columns) || 2));
  }

  function slotSpanFor(style, template) {
    const slots = templateSlotCount(template);
    if (style?.width === 'full') return slots;
    if (style?.width === 'wide') return Math.min(2, slots);
    return 1;
  }

  function microColumnsPerSlot(template) {
    return 6 / templateSlotCount(template);
  }

  function microSpanForSlots(slotSpan, template) {
    return Math.round(Math.max(1, Number(slotSpan) || 1) * microColumnsPerSlot(template));
  }

  function microStartForSlot(slotStart, template) {
    return Math.round((Math.max(1, Number(slotStart) || 1) - 1) * microColumnsPerSlot(template)) + 1;
  }

  function orderProductsForLayout(products) {
    return Array.isArray(products) ? products.slice() : [];
  }

  function packRows(products, template, presentation) {
    const normalizedPresentation = normalizePresentation(presentation);
    const orderedProducts = orderProductsForLayout(products);
    const slotsPerRow = templateSlotCount(template);
    const rows = [];
    let current = [];
    let usedSlots = 0;

    const flush = () => {
      if (!current.length) return;
      rows.push(current);
      current = [];
      usedSlots = 0;
    };

    orderedProducts.forEach(product => {
      const style = styleFor(normalizedPresentation, product.id);
      const slotSpan = slotSpanFor(style, template);
      const remainingSlots = slotsPerRow - usedSlots;

      if (current.length && slotSpan > remainingSlots) flush();

      const startSlot = usedSlots + 1;
      const item = {
        product,
        style,
        contentPreset: resolveContentPreset(product, style.contentPreset),
        width: style.width,
        slotSpan,
        startSlot,
        span: microSpanForSlots(slotSpan, template),
        row: rows.length + 1,
        start: microStartForSlot(startSlot, template)
      };

      current.push(item);
      usedSlots += slotSpan;
      if (usedSlots >= slotsPerRow) flush();
    });
    flush();

    rows.forEach((row, rowIndex) => {
      row.forEach(item => { item.row = rowIndex + 1; });
    });

    return rows;
  }

  function planProducts(products, template, presentation) {
    const rows = packRows(products, template, presentation);
    return {
      rows,
      rowCount: rows.length,
      items: rows.flat(),
      slotsPerRow: templateSlotCount(template)
    };
  }

  function paginateProducts(products, template, presentation) {
    const maxRows = Math.max(1, Number(template?.rows) || 3);
    const ordered = orderProductsForLayout(products);
    const pages = [];
    let current = [];

    for (const product of ordered) {
      const candidate = current.concat(product);
      const candidatePlan = planProducts(candidate, template, presentation);
      if (current.length && candidatePlan.rowCount > maxRows) {
        pages.push({ products: current, layout: planProducts(current, template, presentation) });
        current = [product];
      } else {
        current = candidate;
      }
    }

    if (current.length) pages.push({ products: current, layout: planProducts(current, template, presentation) });
    return pages;
  }

  function optionsMarkup(items, selected) {
    return items.map(item => `<option value="${item.id}"${item.id === selected ? ' selected' : ''}>${item.name}</option>`).join('');
  }

  function setupBulkControls() {
    if (typeof document === 'undefined' || document.getElementById('bulkPresentationControls')) return;
    const anchor = document.querySelector('.selection-actions');
    if (!anchor) return;

    const panel = document.createElement('div');
    panel.id = 'bulkPresentationControls';
    panel.className = 'bulk-presentation-controls';
    panel.innerHTML = `
      <strong>Aplicar a todos os selecionados</strong>
      <label>Conteúdo
        <select id="bulkContentPreset">${optionsMarkup(CONTENT_PRESETS, 'visual')}</select>
      </label>
      <button class="button secondary compact" id="btnApplyBulkContent" type="button">Aplicar conteúdo</button>
      <label>Ênfase
        <select id="bulkEmphasis">${optionsMarkup(EMPHASIS_PRESETS, 'normal')}</select>
      </label>
      <button class="button secondary compact" id="btnApplyBulkEmphasis" type="button">Aplicar ênfase</button>
      <label>Largura
        <select id="bulkWidth">${optionsMarkup(WIDTH_PRESETS, 'simple')}</select>
      </label>
      <button class="button secondary compact" id="btnApplyBulkWidth" type="button">Aplicar largura</button>`;
    anchor.insertAdjacentElement('afterend', panel);

    const apply = patch => {
      const Core = NS.Core;
      if (!Core) return;
      const current = Core.getState();
      const ids = Array.isArray(current.selectedIds) ? current.selectedIds.slice() : [];
      if (!ids.length) {
        window.alert?.('Selecione ao menos um produto para aplicar o ajuste em lote.');
        return;
      }
      Core.mutate(draft => {
        const presentation = normalizePresentation(draft.catalog?.presentation);
        ids.forEach(id => {
          presentation.itemStyles[id] = {
            ...styleFor(presentation, id),
            ...patch
          };
        });
        draft.catalog.presentation = presentation;
      });
      window.dispatchEvent(new Event('catalogotop:products-updated'));
    };

    panel.querySelector('#btnApplyBulkContent')?.addEventListener('click', () => {
      apply({ contentPreset: panel.querySelector('#bulkContentPreset').value });
    });
    panel.querySelector('#btnApplyBulkEmphasis')?.addEventListener('click', () => {
      apply({ emphasis: panel.querySelector('#bulkEmphasis').value });
    });
    panel.querySelector('#btnApplyBulkWidth')?.addEventListener('click', () => {
      apply({ width: panel.querySelector('#bulkWidth').value });
    });
  }

  NS.Composition = {
    CONTENT_PRESETS,
    EMPHASIS_PRESETS,
    WIDTH_PRESETS,
    DISTRIBUTIONS,
    TYPOGRAPHY_PRESETS,
    normalizeItemStyle,
    normalizePresentation,
    styleFor,
    resolveContentPreset,
    templateSlotCount,
    slotSpanFor,
    microSpanForSlots,
    orderProductsForLayout,
    packRows,
    planProducts,
    paginateProducts,
    setupBulkControls
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', setupBulkControls, { once: true });
  }
})();
