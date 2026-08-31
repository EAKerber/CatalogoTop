import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.csv': 'text/csv; charset=utf-8'
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'fixture_offline' }));
      return;
    }
    const relative = decodeURIComponent(url.pathname) === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const safe = normalize(relative).replace(/^(\.\.[/\\])+/, '');
    const file = join(root, safe);
    if (!(await stat(file)).isFile()) throw new Error('not file');
    response.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404);
    response.end('not found');
  }
});

function seedState() {
  const NS = window.CatalogoTop;
  const svg = label => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="white"/><text x="300" y="215" text-anchor="middle" font-family="Arial" font-size="56">${label}</text></svg>`)}`;
  const product = (id, label) => ({
    id, code: id.toUpperCase(), description: `Produto ${id}`, category: 'Teste', subcategory: '', price: 'R$ 39,90', status: 'Ativo', notes: '',
    image: svg(`${label}-original`),
    imageGallery: [
      { id: 'front', label: 'Frente', image: svg(`${label}-front`), provenance: { kind: 'manual' } },
      { id: 'detail', label: 'Detalhe', image: svg(`${label}-detail`), provenance: { kind: 'manual' } }
    ],
    specs: [], variants: [], tableRows: [], updatedAt: '2026-08-29T00:00:00.000Z'
  });
  const p1 = product('p1', 'card');
  const p2 = product('p2', 'collection');
  const p3 = product('p3', 'commercial-grid');
  p3.variants = [{ id: 'white', label: 'Branco', image: svg('white') }, { id: 'black', label: 'Preto', image: svg('black') }];
  const products = [p1, p2, p3];
  NS.Core.setState({
    schemaVersion: 7,
    products,
    selectedIds: products.map(item => item.id),
    catalog: {
      title: 'Image variants gate', templateId: 'technical', showPrices: true, createdAt: '2026-08-29T00:00:00.000Z',
      presentation: NS.Composition.normalizePresentation({
        order: ['p1', 'p2', 'p3'],
        imageFrames: {},
        imageSelections: {},
        imageVariants: {
          p1: [{ id: 'catalog-a', label: 'Derivada local', image: svg('card-catalog'), provenance: { kind: 'derived' } }]
        },
        blocks: [{ id: 'collection-images', type: 'collection', memberIds: ['p2'], title: 'Invalida sozinha', subtitle: '', theme: 'light', columns: 2, itemPreset: 'visual', itemStyles: {} }]
      })
    }
  }, { persist: false });
  // Collection exige pelo menos 2 membros; use p2+p3 e mantenha p3 comercial para provar que Card grid não é afetado quando fora do bloco em seguida.
  NS.Core.mutate(draft => {
    draft.catalog.presentation.blocks = [{ id: 'collection-images', type: 'collection', memberIds: ['p2'], title: '', subtitle: '', theme: 'light', columns: 2, itemPreset: 'visual', itemStyles: {} }];
  });
  // Estado final sem bloco inválido; o gate cria Collection válida temporariamente depois.
  NS.Core.mutate(draft => { draft.catalog.presentation.blocks = []; });
  window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
  return { originalP1: p1.image, originalP2: p2.image };
}

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.CatalogoTop?.ImageVariants && window.CatalogoTop?.ImageVariantRender && window.CatalogoTop?.ImageVariantControls && window.CatalogoTop?.PresentationActions && window.CatalogoTop?.Print));
  const originals = await page.evaluate(seedState);
  await page.click('[data-tab="catalog"]');
  await page.waitForSelector('#catalogPreview .catalog-card[data-product-id="p1"] .catalog-card-visuals.single > img');

  let visual = await page.evaluate(() => {
    const image = document.querySelector('#catalogPreview .catalog-card[data-product-id="p1"] .catalog-card-visuals.single > img');
    return { source: image?.dataset.imageVariantSource, id: image?.dataset.imageVariantId, productImage: window.CatalogoTop.Core.getState().products[0].image };
  });
  if (visual.source !== 'original' || visual.id !== 'original' || visual.productImage !== originals.originalP1) throw new Error(`Original inicial inválida: ${JSON.stringify(visual)}`);

  // UI real do inspector: navegar e voltar ao Original sem editar product.image.
  await page.click('#catalogPreview .catalog-card[data-product-id="p1"]');
  await page.waitForSelector('#contextualInspector [data-image-choice-editor="p1"] [data-image-choice-cycle="1"]');
  let inspectorChoice = await page.evaluate(() => ({
    label: document.querySelector('#contextualInspector [data-image-choice-editor="p1"] figcaption strong')?.textContent,
    source: document.querySelector('#contextualInspector [data-image-choice-editor="p1"] figcaption span')?.textContent,
    originalDisabled: document.querySelector('#contextualInspector [data-image-choice-original="p1"]')?.disabled
  }));
  if (inspectorChoice.label !== 'Original' || inspectorChoice.source !== 'Original' || !inspectorChoice.originalDisabled) throw new Error(`inspector não iniciou no Original: ${JSON.stringify(inspectorChoice)}`);
  await page.click('#contextualInspector [data-image-choice-editor="p1"] [data-image-choice-cycle="1"]');
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().catalog.presentation.imageSelections.p1?.id === 'front');
  inspectorChoice = await page.evaluate(() => ({
    label: document.querySelector('#contextualInspector [data-image-choice-editor="p1"] figcaption strong')?.textContent,
    source: document.querySelector('#contextualInspector [data-image-choice-editor="p1"] figcaption span')?.textContent,
    productImage: window.CatalogoTop.Core.getState().products.find(item => item.id === 'p1')?.image
  }));
  if (inspectorChoice.label !== 'Frente' || inspectorChoice.source !== 'Produto' || inspectorChoice.productImage !== originals.originalP1) throw new Error(`navegação do inspector não selecionou gallery sem tocar Original: ${JSON.stringify(inspectorChoice)}`);
  await page.click('#contextualInspector [data-image-choice-original="p1"]');
  await page.waitForFunction(() => !Object.prototype.hasOwnProperty.call(window.CatalogoTop.Core.getState().catalog.presentation.imageSelections, 'p1'));

  await page.evaluate(() => window.CatalogoTop.PresentationActions.cycleImageSelection('p1', 1));
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().catalog.presentation.imageSelections.p1?.id === 'front');
  visual = await page.evaluate(() => {
    const NS = window.CatalogoTop;
    const image = document.querySelector('#catalogPreview .catalog-card[data-product-id="p1"] .catalog-card-visuals.single > img');
    return { source: image?.dataset.imageVariantSource, id: image?.dataset.imageVariantId, productImage: NS.Core.getState().products.find(p => p.id === 'p1')?.image };
  });
  if (visual.source !== 'product' || visual.id !== 'front' || visual.productImage !== originals.originalP1) throw new Error(`Galeria compartilhada não chegou ao Card: ${JSON.stringify(visual)}`);

  await page.evaluate(() => window.CatalogoTop.PresentationActions.setImageFrame('p1', { fit: 'cover', zoom: 1.6, x: 22, y: 74 }));
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().catalog.presentation.imageFrames.p1?.zoom === 1.6);
  await page.evaluate(() => window.CatalogoTop.PresentationActions.cycleImageSelection('p1', 1));
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().catalog.presentation.imageSelections.p1?.id === 'detail');
  visual = await page.evaluate(() => {
    const image = document.querySelector('#catalogPreview .catalog-card[data-product-id="p1"] .catalog-card-visuals.single > img');
    return { id: image?.dataset.imageVariantId, transform: image?.style.transform, position: image?.style.objectPosition };
  });
  if (visual.id !== 'detail' || visual.transform !== 'scale(1.6)' || visual.position !== '22% 74%') throw new Error(`framing não sobreviveu à troca de imagem: ${JSON.stringify(visual)}`);

  await page.evaluate(() => window.CatalogoTop.PresentationActions.cycleImageSelection('p1', 1));
  await page.waitForFunction(() => window.CatalogoTop.Core.getState().catalog.presentation.imageSelections.p1?.source === 'catalog');
  visual = await page.evaluate(() => {
    const image = document.querySelector('#catalogPreview .catalog-card[data-product-id="p1"] .catalog-card-visuals.single > img');
    return { source: image?.dataset.imageVariantSource, id: image?.dataset.imageVariantId };
  });
  if (visual.source !== 'catalog' || visual.id !== 'catalog-a') throw new Error(`variante local não chegou ao Card: ${JSON.stringify(visual)}`);

  await page.evaluate(() => window.CatalogoTop.PresentationActions.resetImageSelection('p1'));
  await page.waitForFunction(() => !Object.prototype.hasOwnProperty.call(window.CatalogoTop.Core.getState().catalog.presentation.imageSelections, 'p1'));
  visual = await page.evaluate(() => {
    const image = document.querySelector('#catalogPreview .catalog-card[data-product-id="p1"] .catalog-card-visuals.single > img');
    return { source: image?.dataset.imageVariantSource, id: image?.dataset.imageVariantId, transform: image?.style.transform };
  });
  if (visual.source !== 'original' || visual.id !== 'original' || visual.transform !== 'scale(1.6)') throw new Error(`retorno ao Original perdeu framing: ${JSON.stringify(visual)}`);

  // Cria uma Collection válida apenas para provar a mesma seleção sobre membro.
  await page.evaluate(() => {
    const NS = window.CatalogoTop;
    NS.Core.mutate(draft => {
      draft.catalog.presentation.blocks = [{ id: 'collection-images', type: 'collection', memberIds: ['p1', 'p2'], title: 'Imagens', subtitle: '', theme: 'light', columns: 2, itemPreset: 'visual', itemStyles: {} }];
    });
    window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
  });
  await page.waitForSelector('#catalogPreview .catalog-collection-item[data-product-id="p2"] .catalog-collection-image > img');
  await page.evaluate(() => window.CatalogoTop.PresentationActions.setImageSelection('p2', { source: 'product', id: 'detail' }));
  await page.waitForFunction(() => document.querySelector('#catalogPreview .catalog-collection-item[data-product-id="p2"] .catalog-collection-image > img')?.dataset.imageVariantId === 'detail');
  const collection = await page.evaluate(() => {
    const NS = window.CatalogoTop;
    const image = document.querySelector('#catalogPreview .catalog-collection-item[data-product-id="p2"] .catalog-collection-image > img');
    return { source: image?.dataset.imageVariantSource, id: image?.dataset.imageVariantId, productImage: NS.Core.getState().products.find(p => p.id === 'p2')?.image };
  });
  if (collection.source !== 'product' || collection.id !== 'detail' || collection.productImage !== originals.originalP2) throw new Error(`seleção não chegou à Collection: ${JSON.stringify(collection)}`);

  // Remove o bloco para provar que a grade comercial de product.variants segue independente.
  await page.evaluate(() => {
    const NS = window.CatalogoTop;
    NS.Core.mutate(draft => { draft.catalog.presentation.blocks = []; });
    window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
  });
  await page.waitForSelector('#catalogPreview .catalog-card[data-product-id="p3"] .catalog-card-visuals.multi');
  const commercialGrid = await page.evaluate(() => ({
    gridImages: document.querySelectorAll('#catalogPreview .catalog-card[data-product-id="p3"] .catalog-variant-image-grid img').length,
    single: document.querySelectorAll('#catalogPreview .catalog-card[data-product-id="p3"] .catalog-card-visuals.single > img').length
  }));
  if (commercialGrid.gridImages !== 2 || commercialGrid.single) throw new Error(`imageGallery interferiu na grade comercial: ${JSON.stringify(commercialGrid)}`);

  await page.click('#catalogPreview .catalog-card[data-product-id="p3"]');
  await page.waitForSelector('#contextualInspector .inspector-image-choice.is-unavailable');
  const gridInspector = await page.evaluate(() => ({
    text: document.querySelector('#contextualInspector .inspector-image-choice.is-unavailable')?.textContent || '',
    cycleButtons: document.querySelectorAll('#contextualInspector [data-image-choice-cycle]').length
  }));
  if (!gridInspector.text.includes('Variações comerciais') || gridInspector.cycleButtons) throw new Error(`Card comercial recebeu seletor de imagem inadequado: ${JSON.stringify(gridInspector)}`);

  await page.evaluate(() => window.CatalogoTop.PresentationActions.setImageSelection('p1', { source: 'product', id: 'front' }));
  const printableHtml = await page.evaluate(() => window.CatalogoTop.Print.buildPrintableHtml(window.CatalogoTop.Core.getState()));
  const printPage = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await printPage.setContent(printableHtml, { waitUntil: 'networkidle' });
  const printVisual = await printPage.evaluate(() => {
    const image = document.querySelector('.catalog-card[data-product-id="p1"] .catalog-card-visuals.single > img');
    return { source: image?.dataset.imageVariantSource, id: image?.dataset.imageVariantId, transform: image?.style.transform, position: image?.style.objectPosition };
  });
  if (printVisual.source !== 'product' || printVisual.id !== 'front' || printVisual.transform !== 'scale(1.6)' || printVisual.position !== '22% 74%') {
    throw new Error(`preview/print divergem na imagem selecionada: ${JSON.stringify(printVisual)}`);
  }
  await printPage.close();

  // Editor de galeria do produto: carrega, edita e remove em rascunho; estado só muda no submit.
  await page.click('[data-tab="products"]');
  await page.click('[data-cadastro-edit="p1"]');
  await page.click('[data-form-step-target="2"]');
  await page.waitForSelector('#productImageGalleryList .product-image-gallery-item:nth-child(2)');
  let galleryUi = await page.evaluate(() => ({
    rows: document.querySelectorAll('#productImageGalleryList .product-image-gallery-item').length,
    stateRows: window.CatalogoTop.Core.getState().products.find(item => item.id === 'p1')?.imageGallery?.length,
    draftRows: window.CatalogoTop.ProductDetails.read().imageGallery.length
  }));
  if (galleryUi.rows !== 2 || galleryUi.stateRows !== 2 || galleryUi.draftRows !== 2) throw new Error(`galeria não carregou no cadastro: ${JSON.stringify(galleryUi)}`);
  await page.fill('#productImageGalleryList [data-gallery-label="0"]', 'Frente revisada');
  await page.click('#productImageGalleryList [data-gallery-remove="1"]');
  galleryUi = await page.evaluate(() => ({
    rows: document.querySelectorAll('#productImageGalleryList .product-image-gallery-item').length,
    stateRows: window.CatalogoTop.Core.getState().products.find(item => item.id === 'p1')?.imageGallery?.length,
    draft: window.CatalogoTop.ProductDetails.read().imageGallery.map(item => ({ id: item.id, label: item.label }))
  }));
  if (galleryUi.rows !== 1 || galleryUi.stateRows !== 2 || galleryUi.draft.length !== 1 || galleryUi.draft[0].label !== 'Frente revisada') {
    throw new Error(`editor da galeria não preservou fronteira rascunho/estado: ${JSON.stringify(galleryUi)}`);
  }

  console.log('PASS browser image variants gate: Original, inspector, gallery, local variant, Collection, framing, grid comercial e print');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
