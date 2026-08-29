(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const inspector = document.getElementById('contextualInspector');
  if (!inspector || !NS.Core || !NS.ComposerSelection || !NS.ImageVariants || !NS.PresentationActions) return;

  function currentProduct() {
    const target = NS.ComposerSelection.get();
    if (!target?.productId || !['card', 'collection-member'].includes(target.kind)) return { target: null, product: null };
    const product = NS.Core.getState().products.find(item => String(item.id) === String(target.productId)) || null;
    return { target, product };
  }

  function commercialGridCard(target, product) {
    return target?.kind === 'card' && Array.isArray(product?.variants) && product.variants.some(entry => entry?.image);
  }

  function render() {
    inspector.querySelector('.inspector-image-choice')?.remove();
    const { target, product } = currentProduct();
    if (!target || !product) return;

    const presentation = NS.Composition.normalizePresentation(NS.Core.getState().catalog?.presentation);
    const available = NS.ImageVariants.availableImages(product, presentation);
    if (available.length < 2) return;

    const frame = inspector.querySelector('.inspector-image-frame');
    if (!frame) return;

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

  NS.ImageVariantControls = Object.freeze({ render });
})();