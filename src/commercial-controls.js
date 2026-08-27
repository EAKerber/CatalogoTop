(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};

  function esc(value) {
    return NS.Render?.esc ? NS.Render.esc(value) : String(value ?? '');
  }

  function state() {
    return NS.Core?.getState?.();
  }

  function blockById(id) {
    return (state()?.catalog?.presentation?.blocks || []).find(block => String(block?.id || '') === String(id)) || null;
  }

  function cardControls(target) {
    const editor = document.querySelector('[data-inspector-card]');
    if (!editor || editor.querySelector('[data-commercial-card-price-style]') || !NS.Composition) return;
    const presentation = NS.Composition.normalizePresentation(state()?.catalog?.presentation);
    const style = NS.Composition.styleFor(presentation, target.productId);
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'inspector-price-style';
    fieldset.dataset.commercialCardPriceStyle = String(target.productId);
    fieldset.innerHTML = `<legend>Preço</legend><div class="inspector-segmented">${(NS.Composition.PRICE_STYLES || []).map(option => `<label><input type="radio" name="price-style-${esc(target.productId)}" value="${esc(option.id)}"${option.id === style.priceStyle ? ' checked' : ''} data-commercial-price-style /><span>${esc(option.name)}</span></label>`).join('')}</div>`;
    editor.appendChild(fieldset);
  }

  function tableControls(target) {
    const editor = document.querySelector('[data-inspector-table]');
    if (!editor || editor.querySelector('[data-commercial-table-prices]') || !NS.TableBlock) return;
    const raw = blockById(target.blockId);
    if (!raw) return;
    const block = NS.TableBlock.normalizeBlock(raw);
    const label = document.createElement('label');
    label.className = 'inspector-commercial-toggle';
    label.innerHTML = `<input type="checkbox" data-commercial-table-prices${block.commercialPrices ? ' checked' : ''} /><span>Destacar preços</span>`;
    editor.appendChild(label);
  }

  function augment() {
    const target = NS.ComposerSelection?.get?.();
    if (!target) return;
    if (target.kind === 'card') cardControls(target);
    if (target.kind === 'table') tableControls(target);
  }

  function bind() {
    const inspector = document.getElementById('contextualInspector');
    if (!inspector || inspector.dataset.commercialControlsBound === 'true') return;
    inspector.dataset.commercialControlsBound = 'true';
    inspector.addEventListener('change', event => {
      const priceStyle = event.target.closest('[data-commercial-price-style]');
      if (priceStyle) {
        const editor = priceStyle.closest('[data-commercial-card-price-style]');
        if (editor) NS.PresentationActions?.setCardStyle?.(editor.dataset.commercialCardPriceStyle, { priceStyle: priceStyle.value });
        return;
      }
      const tableToggle = event.target.closest('[data-commercial-table-prices]');
      if (tableToggle) {
        const editor = tableToggle.closest('[data-inspector-table]');
        if (editor) NS.PresentationActions?.updateTable?.(editor.dataset.inspectorTable, { commercialPrices: tableToggle.checked });
      }
    });
  }

  function scheduleAugment() {
    queueMicrotask(augment);
  }

  bind();
  ['catalogotop:editor-selection-changed', 'catalogotop:catalog-rendered', 'catalogotop:selection-rendered'].forEach(name => window.addEventListener(name, scheduleAugment));
  scheduleAugment();

  NS.CommercialControls = { augment };
})();
