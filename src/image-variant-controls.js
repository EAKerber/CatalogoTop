(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const inspector = document.getElementById('contextualInspector');
  if (!inspector || !NS.Core || !NS.ComposerSelection || !NS.ImageVariants || !NS.PresentationActions || !NS.ImageFraming || !NS.TableBlock) return;

  const baseImageVariantRender = NS.ImageVariantRender;
  const baseImageFraming = NS.ImageFraming;

  function state() {
    return NS.Core.getState();
  }

  function blockById(blockId) {
    return (state().catalog?.presentation?.blocks || []).find(block => String(block?.id || '') === String(blockId)) || null;
  }

  function tableImageContext(target) {
    if (target?.kind !== 'table-row' || !target.blockId || !target.productId) return null;
    const raw = blockById(target.blockId);
    if (!raw) return null;
    const block = NS.TableBlock.normalizeBlock(raw);
    if (block.rowSource !== 'products') return null;
    return {
      block,
      imageVisible: block.columns.includes('image')
    };
  }

  function currentProduct() {
    const target = NS.ComposerSelection.get();
    if (!target?.productId) return { target: null, product: null, tableContext: null };
    const supported = ['card', 'collection-member'].includes(target.kind);
    const tableContext = tableImageContext(target);
    if (!supported && !tableContext) return { target: null, product: null, tableContext: null };
    const product = state().products.find(item => String(item.id) === String(target.productId)) || null;
    return { target, product, tableContext };
  }

  function commercialGridCard(target, product) {
    return target?.kind === 'card' && Array.isArray(product?.variants) && product.variants.some(entry => entry?.image);
  }

  function tableFrameMarkup(product, imageVisible) {
    if (!imageVisible) {
      return '<section class="inspector-image-frame is-unavailable" data-table-row-image-frame><div class="inspector-subhead"><strong>Enquadramento</strong><span>Imagem da linha</span></div><small>Ative a coluna Imagem na tabela para ajustar a apresentação desta linha.</small></section>';
    }
    if (!product.image) {
      return '<section class="inspector-image-frame is-unavailable" data-table-row-image-frame><div class="inspector-subhead"><strong>Enquadramento</strong><span>Imagem da linha</span></div><small>Adicione uma imagem principal ao produto para ajustar o enquadramento.</small></section>';
    }
    const presentation = NS.Composition.normalizePresentation(state().catalog?.presentation);
    const frame = baseImageFraming.imageFrameFor(presentation, product.id);
    const zoomPercent = Math.round(frame.zoom * 100);
    const esc = NS.Render.esc;
    return `<section class="inspector-image-frame" data-table-row-image-frame data-image-frame-editor="${esc(product.id)}">
      <div class="inspector-subhead"><strong>Enquadramento</strong><span>Imagem da linha</span></div>
      <fieldset class="inspector-frame-fit"><legend>Ajuste</legend>${baseImageFraming.IMAGE_FRAME_FITS.map(item => `<label><input type="radio" name="image-fit-${esc(product.id)}" value="${esc(item.id)}" data-image-frame-field="fit"${item.id === frame.fit ? ' checked' : ''} />${esc(item.name)}</label>`).join('')}</fieldset>
      <label class="inspector-frame-range"><span>Zoom <output data-image-frame-output="zoom">${zoomPercent}%</output></span><input type="range" min="1" max="2.4" step="0.05" value="${frame.zoom}" data-image-frame-field="zoom" /></label>
      <div class="inspector-frame-grid">
        <label class="inspector-frame-range"><span>Horizontal <output data-image-frame-output="x">${frame.x}%</output></span><input type="range" min="0" max="100" step="1" value="${frame.x}" data-image-frame-field="x" /></label>
        <label class="inspector-frame-range"><span>Vertical <output data-image-frame-output="y">${frame.y}%</output></span><input type="range" min="0" max="100" step="1" value="${frame.y}" data-image-frame-field="y" /></label>
      </div>
      <button class="inspector-link inspector-frame-reset" type="button" data-image-frame-reset="${esc(product.id)}">Redefinir enquadramento</button>
    </section>`;
  }

  function ensureTableFrame(target, product, tableContext) {
    inspector.querySelector('[data-table-row-image-frame]')?.remove();
    if (target?.kind !== 'table-row' || !product || !tableContext) return inspector.querySelector('.inspector-image-frame');
    const anchor = inspector.querySelector('.inspector-inline-actions');
    if (!anchor) return null;
    anchor.insertAdjacentHTML('beforebegin', tableFrameMarkup(product, tableContext.imageVisible));
    return inspector.querySelector('[data-table-row-image-frame]');
  }

  function tableBlocks(presentation) {
    const map = new Map();
    (Array.isArray(presentation?.blocks) ? presentation.blocks : []).forEach(raw => {
      if (raw?.type !== 'table') return;
      const block = NS.TableBlock.normalizeBlock(raw);
      if (block.rowSource === 'products' && block.columns.includes('image')) map.set(String(block.id), block);
    });
    return map;
  }

  function tableRowImages(root, currentState) {
    if (!root?.querySelectorAll || !currentState) return [];
    const presentation = NS.Composition.normalizePresentation(currentState.catalog?.presentation);
    const blocks = tableBlocks(presentation);
    if (!blocks.size) return [];
    const byId = new Map((Array.isArray(currentState.products) ? currentState.products : []).map(product => [String(product.id), product]));
    return Array.from(root.querySelectorAll('.catalog-table-block[data-table-block-id] tr[data-table-row-id][data-product-id]')).map(row => {
      const table = row.closest('.catalog-table-block[data-table-block-id]');
      const block = table ? blocks.get(String(table.dataset.tableBlockId || '')) : null;
      if (!block) return null;
      const product = byId.get(String(row.dataset.productId || ''));
      const image = row.querySelector('.table-cell-image > img');
      if (!product || !image) return null;
      return { row, image, product, presentation };
    }).filter(Boolean);
  }

  function applyTableImageSelections(root, currentState) {
    tableRowImages(root, currentState).forEach(({ image, product, presentation }) => {
      const resolved = NS.ImageVariants.resolveImage(product, presentation);
      if (!resolved.image) return;
      image.src = resolved.image;
      image.dataset.imageVariantSource = resolved.source;
      image.dataset.imageVariantId = resolved.id;
      image.dataset.imageVariantFallback = String(Boolean(resolved.isFallback));
    });
  }

  function applyTableImageFrames(root, currentState) {
    tableRowImages(root, currentState).forEach(({ image, product, presentation }) => {
      const frame = baseImageFraming.imageFrameFor(presentation, product.id);
      const holder = image.parentElement;
      if (holder) holder.style.overflow = 'hidden';
      image.dataset.imageFrameTarget = 'primary';
      image.dataset.imageFramePlacement = 'table-row';
      image.dataset.imageFrameFit = frame.fit;
      image.dataset.imageFrameZoom = String(frame.zoom);
      image.dataset.imageFrameX = String(frame.x);
      image.dataset.imageFrameY = String(frame.y);
      image.style.objectFit = frame.fit;
      image.style.objectPosition = `${frame.x}% ${frame.y}%`;
      image.style.transform = `scale(${frame.zoom})`;
      image.style.transformOrigin = `${frame.x}% ${frame.y}%`;
    });
  }

  if (baseImageVariantRender?.applyImageSelections) {
    NS.ImageVariantRender = Object.freeze({
      ...baseImageVariantRender,
      applyImageSelections(root, currentState) {
        baseImageVariantRender.applyImageSelections(root, currentState);
        applyTableImageSelections(root, currentState);
      }
    });
  }

  if (baseImageFraming?.applyImageFrames) {
    NS.ImageFraming = {
      ...baseImageFraming,
      applyImageFrames(root, currentState) {
        baseImageFraming.applyImageFrames(root, currentState);
        applyTableImageFrames(root, currentState);
      }
    };
  }

  function render() {
    inspector.querySelector('.inspector-image-choice')?.remove();
    inspector.querySelector('[data-table-row-image-frame]')?.remove();
    const { target, product, tableContext } = currentProduct();
    if (!target || !product) return;

    const frame = ensureTableFrame(target, product, tableContext);
    if (!frame) return;
    if (target.kind === 'table-row' && !tableContext?.imageVisible) return;

    const presentation = NS.Composition.normalizePresentation(state().catalog?.presentation);
    const available = NS.ImageVariants.availableImages(product, presentation);
    if (available.length < 2) return;

    const section = document.createElement('section');
    section.className = 'inspector-image-choice';
    section.dataset.imageChoiceEditor = String(product.id);

    if (commercialGridCard(target, product)) {
      section.classList.add('is-unavailable');
      section.innerHTML = '<div class="inspector-subhead"><strong>Imagem</strong><span>Variações comerciais</span></div><small>Este Card já apresenta uma grade de imagens de cores/acabamentos. A troca da imagem principal fica disponível quando o produto é usado como imagem única.</small>';
      frame.before(section);
      return;
    }

    const resolved = NS.ImageVariants.resolveImage(product, presentation);
    let index = available.findIndex(item => item.source === resolved.source && item.id === resolved.id);
    if (index < 0) index = 0;
    const label = resolved.label || (resolved.source === 'catalog' ? 'Variante do catálogo' : resolved.source === 'product' ? 'Imagem alternativa' : 'Original');
    const originalActive = resolved.source === 'original';

    section.innerHTML = `
      <div class="inspector-subhead"><strong>Imagem</strong><span>${index + 1} / ${available.length}</span></div>
      <div class="inspector-image-choice-row">
        <button type="button" data-image-choice-cycle="-1" aria-label="Imagem anterior" title="Imagem anterior">‹</button>
        <figure>
          <img src="${NS.Render.esc(resolved.image || NS.Render.PLACEHOLDER)}" alt="${NS.Render.esc(label)}" />
          <figcaption><strong>${NS.Render.esc(label)}</strong><span>${resolved.source === 'catalog' ? 'Catálogo' : resolved.source === 'product' ? 'Produto' : 'Original'}</span></figcaption>
        </figure>
        <button type="button" data-image-choice-cycle="1" aria-label="Próxima imagem" title="Próxima imagem">›</button>
      </div>
      <button class="inspector-link inspector-image-original" type="button" data-image-choice-original="${NS.Render.esc(product.id)}"${originalActive ? ' disabled' : ''}>Original</button>`;
    frame.before(section);
  }

  inspector.addEventListener('click', event => {
    const cycle = event.target.closest('[data-image-choice-cycle]');
    if (cycle) {
      const editor = cycle.closest('[data-image-choice-editor]');
      if (editor) NS.PresentationActions.cycleImageSelection(editor.dataset.imageChoiceEditor, Number(cycle.dataset.imageChoiceCycle));
      return;
    }
    const original = event.target.closest('[data-image-choice-original]');
    if (original && !original.disabled) NS.PresentationActions.resetImageSelection(original.dataset.imageChoiceOriginal);
  });

  window.addEventListener('catalogotop:editor-selection-changed', () => queueMicrotask(render));
  window.addEventListener('catalogotop:catalog-rendered', () => queueMicrotask(render));
  window.addEventListener('catalogotop:history-applied', () => queueMicrotask(render));
  render();

  NS.ImageVariantControls = Object.freeze({ render, tableImageContext, applyTableImageSelections, applyTableImageFrames });
})();