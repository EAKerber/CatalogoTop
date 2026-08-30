import { readFile } from 'node:fs/promises';

const [html, css, controls, actions, renderer, details] = await Promise.all([
  readFile('index.html', 'utf8'),
  readFile('image-variants.css', 'utf8'),
  readFile('src/image-variant-controls.js', 'utf8'),
  readFile('src/presentation-actions.js', 'utf8'),
  readFile('src/catalog-renderer.js', 'utf8'),
  readFile('src/product-details.js', 'utf8')
]);

const checks = [
  ['bootstrap de variantes é estático', html.includes('image-variants.css') && html.includes('src/image-variant-controls.js') && html.indexOf('src/contextual-inspector.js') < html.indexOf('src/image-variant-controls.js')],
  ['controle contextual consome lifecycle sem MutationObserver', controls.includes('catalogotop:editor-selection-changed') && controls.includes('catalogotop:catalog-rendered') && !controls.includes('MutationObserver')],
  ['UI mínima mantém ciclo e Original', controls.includes('data-image-choice-cycle') && controls.includes('data-image-choice-original') && controls.includes('available.length < 2')],
  ['Card com grade comercial não recebe seletor enganoso', controls.includes('commercialGridCard') && controls.includes('Variações comerciais')],
  ['seleção é aplicada antes do framing', renderer.indexOf('ImageVariantRender?.applyImageSelections') >= 0 && renderer.indexOf('ImageVariantRender?.applyImageSelections') < renderer.indexOf('ImageFraming?.applyImageFrames')],
  ['PresentationActions expõe seleção esparsa', actions.includes('setImageSelection') && actions.includes('resetImageSelection') && actions.includes('cycleImageSelection') && actions.includes('delete presentation.imageSelections[id]')],
  ['galeria de cadastro usa AssetClient existente', details.includes('AssetClient.prepareImage') && details.includes('imageGallery: Core.normalizeImageGallery(galleryDraft)')],
  ['cadastro não monkey-patcha normalizeProduct', !details.includes('Core.normalizeProduct =')],
  ['estilos da galeria/inspector são estáticos', css.includes('.inspector-image-choice') && css.includes('.product-image-gallery-editor')]
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  failed.forEach(([name]) => console.error(`FAIL ${name}`));
  process.exit(1);
}
checks.forEach(([name]) => console.log(`PASS ${name}`));
