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

  function priceStyleFieldset({ selected = 'standard', marker, inputMarker, namePrefix, legend = 'Preço' }) {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'inspector-price-style';
    fieldset.dataset[marker] = 'true';
    const styles = NS.Composition?.PRICE_STYLES || NS.TableBlock?.TABLE_PRICE_STYLES || [];
    fieldset.innerHTML = `<legend>${esc(legend)}</legend><div class="inspector-segmented">${styles.map(option => `<label><input type="radio" name="${esc(namePrefix)}" value="${esc(option.id)}"${option.id === selected ? ' checked' : ''} ${inputMarker} /><span>${esc(option.name)}</span></label>`).join('')}</div>`;
    return fieldset;
  }

  function cardControls(target) {
    const editor = document.querySelector('[data-inspector-card]');
    if (!editor || editor.querySelector('[data-commercial-card-price-style]') || !NS.Composition) return;
    const presentation = NS.Composition.normalizePresentation(state()?.catalog?.presentation);
    const style = NS.Composition.styleFor(presentation, target.productId);
    const fieldset = priceStyleFieldset({
      selected: style.priceStyle,
      marker: 'commercialCardPriceStyle',
      inputMarker: 'data-commercial-price-style',
      namePrefix: `price-style-${target.productId}`
    });
    fieldset.dataset.commercialCardPriceStyle = String(target.productId);
    editor.appendChild(fieldset);
  }

  function collectionMemberControls(target) {
    const editor = document.querySelector('[data-inspector-collection-member]');
    if (!editor || editor.querySelector('[data-commercial-member-price-style]') || !NS.Collection) return;
    const raw = blockById(target.blockId);
    if (!raw) return;
    const block = NS.Collection.normalizeBlock(raw);
    const style = NS.Collection.memberStyleFor(block, target.productId);
    editor.appendChild(priceStyleFieldset({
      selected: style.priceStyle,
      marker: 'commercialMemberPriceStyle',
      inputMarker: 'data-commercial-member-price-style',
      namePrefix: `collection-price-style-${target.blockId}-${target.productId}`
    }));
  }

  function tableControls(target) {
    const editor = document.querySelector('[data-inspector-table], [data-inspector-table-row]');
    if (!editor || editor.querySelector('[data-commercial-table-price-style]') || !NS.TableBlock) return;
    const raw = blockById(target.blockId);
    if (!raw) return;
    const block = NS.TableBlock.normalizeBlock(raw);
    const fieldset = priceStyleFieldset({
      selected: block.priceStyle,
      marker: 'commercialTablePriceStyle',
      inputMarker: 'data-commercial-table-price-style',
      namePrefix: `table-price-style-${target.blockId}`,
      legend: target.kind === 'table-row' ? 'Preço da tabela' : 'Preço'
    });
    fieldset.dataset.blockId = String(target.blockId);
    editor.appendChild(fieldset);
  }

  function augment() {
    const target = NS.ComposerSelection?.get?.();
    if (!target) return;
    if (target.kind === 'card') cardControls(target);
    if (target.kind === 'collection-member') collectionMemberControls(target);
    if (target.kind === 'table' || target.kind === 'table-row') tableControls(target);
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
      const memberStyle = event.target.closest('[data-commercial-member-price-style]');
      if (memberStyle) {
        const editor = memberStyle.closest('[data-inspector-collection-member]');
        if (editor) NS.PresentationActions?.setCollectionMemberStyle?.(editor.dataset.blockId, editor.dataset.inspectorCollectionMember, { priceStyle: memberStyle.value });
        return;
      }
      const tableStyle = event.target.closest('[data-commercial-table-price-style]');
      if (tableStyle) {
        const fieldset = tableStyle.closest('[data-commercial-table-price-style]');
        const blockId = fieldset?.dataset.blockId || tableStyle.closest('[data-inspector-table]')?.dataset.inspectorTable || tableStyle.closest('[data-inspector-table-row]')?.dataset.blockId;
        if (blockId) NS.PresentationActions?.updateTable?.(blockId, { priceStyle: tableStyle.value, commercialPrices: tableStyle.value !== 'standard' });
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