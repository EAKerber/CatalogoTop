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
    { id: 'feature', name: 'Destaque' },
    { id: 'hero', name: 'Hero' }
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

  function normalizeItemStyle(style) {
    const item = style && typeof style === 'object' ? style : {};
    return {
      contentPreset: normalizeChoice(item.contentPreset, CONTENT_PRESETS, 'visual'),
      emphasis: normalizeChoice(item.emphasis, EMPHASIS_PRESETS, 'normal')
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

  function baseSpan(template) {
    const columns = Math.max(1, Math.min(3, Number(template?.columns) || 2));
    return Math.max(2, Math.round(6 / columns));
  }

  function desiredSpan(style, template) {
    if (style.emphasis === 'hero') return 6;
    if (style.emphasis === 'feature') return 4;
    return baseSpan(template);
  }

  function emphasisRank(style) {
    if (style.emphasis === 'feature') return 0;
    if (style.emphasis === 'normal') return 1;
    return 2;
  }

  /*
   * Destaque é prioridade de fluxo; Hero é âncora de página.
   * Separá-los evita tratar Hero como apenas um "Destaque mais forte".
   */
  function partitionForLayout(products, presentation) {
    const normalizedPresentation = normalizePresentation(presentation);
    const entries = (Array.isArray(products) ? products : [])
      .map((product, index) => ({ product, index, style: styleFor(normalizedPresentation, product?.id) }));

    const heroes = entries
      .filter(entry => entry.style.emphasis === 'hero')
      .sort((left, right) => left.index - right.index);

    const flow = entries
      .filter(entry => entry.style.emphasis !== 'hero')
      .sort((left, right) => emphasisRank(left.style) - emphasisRank(right.style) || left.index - right.index);

    return {
      flow: flow.map(entry => entry.product),
      heroes: heroes.map(entry => entry.product)
    };
  }

  function orderProductsForLayout(products, presentation) {
    const { flow, heroes } = partitionForLayout(products, presentation);
    return [...flow, ...heroes];
  }

  function distributeSix(count) {
    if (count <= 0) return [];
    const base = Math.floor(6 / count);
    let remainder = 6 - (base * count);
    return Array.from({ length: count }, () => {
      const value = base + (remainder > 0 ? 1 : 0);
      remainder -= remainder > 0 ? 1 : 0;
      return value;
    });
  }

  function rebalanceRow(row, distribution) {
    const total = row.reduce((sum, item) => sum + item.span, 0);
    if (total >= 6 || distribution === 'compact') return row;

    const allNormal = row.every(item => item.style.emphasis === 'normal');
    if (allNormal) {
      const spans = distributeSix(row.length);
      row.forEach((item, index) => { item.span = spans[index]; });
      return row;
    }

    let remainder = 6 - total;
    const normals = row.filter(item => item.style.emphasis === 'normal');
    for (let index = normals.length - 1; index >= 0 && remainder > 0; index -= 1) {
      const item = normals[index];
      const add = Math.min(remainder, 6 - item.span);
      item.span += add;
      remainder -= add;
    }
    return row;
  }

  function packRows(products, template, presentation) {
    const normalizedPresentation = normalizePresentation(presentation);
    const orderedProducts = orderProductsForLayout(products, normalizedPresentation);
    const rows = [];
    let current = [];
    let used = 0;

    const flush = () => {
      if (!current.length) return;
      rows.push(rebalanceRow(current, normalizedPresentation.distribution));
      current = [];
      used = 0;
    };

    orderedProducts.forEach(product => {
      const style = styleFor(normalizedPresentation, product.id);
      const item = {
        product,
        style,
        contentPreset: resolveContentPreset(product, style.contentPreset),
        span: desiredSpan(style, template),
        row: 0,
        start: 1
      };

      if (item.span === 6) flush();

      let remaining = 6 - used;
      if (current.length && item.span > remaining) {
        if (item.style.emphasis === 'normal' && remaining >= 2 && current.some(entry => entry.style.emphasis !== 'normal')) {
          item.span = remaining;
        } else {
          flush();
          remaining = 6;
        }
      }

      item.start = used + 1;
      current.push(item);
      used += item.span;

      if (used >= 6 || item.span === 6) flush();
    });
    flush();

    rows.forEach((row, rowIndex) => {
      let cursor = 1;
      row.forEach(item => {
        item.row = rowIndex + 1;
        item.start = cursor;
        cursor += item.span;
      });
    });

    return rows;
  }

  function planProducts(products, template, presentation) {
    const rows = packRows(products, template, presentation);
    return {
      rows,
      rowCount: rows.length,
      items: rows.flat()
    };
  }

  function paginateFlowProducts(products, template, presentation, maxRows) {
    const pages = [];
    let current = [];

    for (const product of products) {
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

  function takeFlowForHeroPage(flow, startIndex, template, presentation, maxFlowRows) {
    if (maxFlowRows <= 0) return { products: [], nextIndex: startIndex };
    let current = [];
    let index = startIndex;

    while (index < flow.length) {
      const candidate = current.concat(flow[index]);
      const plan = planProducts(candidate, template, presentation);
      if (plan.rowCount > maxFlowRows) break;
      current = candidate;
      index += 1;
    }

    return { products: current, nextIndex: index };
  }

  function paginateProducts(products, template, presentation) {
    const maxRows = Math.max(1, Number(template?.rows) || 3);
    const { flow, heroes } = partitionForLayout(products, presentation);

    if (!heroes.length) return paginateFlowProducts(flow, template, presentation, maxRows);

    const pages = [];
    let flowIndex = 0;

    /*
     * Cada Hero ancora a última linha usada de uma página própria. A área antes
     * dele é preenchida com Destaques primeiro e depois Normais. Com isso a
     * linha residual/sobra fica imediatamente acima do Hero, nunca abaixo.
     */
    for (const hero of heroes) {
      const pageFlow = takeFlowForHeroPage(flow, flowIndex, template, presentation, Math.max(0, maxRows - 1));
      flowIndex = pageFlow.nextIndex;
      const pageProducts = [...pageFlow.products, hero];
      pages.push({ products: pageProducts, layout: planProducts(pageProducts, template, presentation) });
    }

    if (flowIndex < flow.length) {
      pages.push(...paginateFlowProducts(flow.slice(flowIndex), template, presentation, maxRows));
    }

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
      <button class="button secondary compact" id="btnApplyBulkEmphasis" type="button">Aplicar ênfase</button>`;
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
  }

  NS.Composition = {
    CONTENT_PRESETS,
    EMPHASIS_PRESETS,
    DISTRIBUTIONS,
    TYPOGRAPHY_PRESETS,
    normalizeItemStyle,
    normalizePresentation,
    styleFor,
    resolveContentPreset,
    partitionForLayout,
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
