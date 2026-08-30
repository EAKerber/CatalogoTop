import { readFile } from 'node:fs/promises';

const [html, result, controls] = await Promise.all([
  readFile('index.html', 'utf8'),
  readFile('src/variation-result.js', 'utf8'),
  readFile('src/variation-result-controls.js', 'utf8')
]);

const validateCall = controls.indexOf('await NS.VariationResult.validatePackage(packageData, request)');
const prepareCall = controls.indexOf('await NS.VariationResult.prepareValidated(validated');
const uploadCall = controls.indexOf('await uploadWithSession(prepared');
const revalidateGuard = controls.indexOf('result_request_changed_during_import');
const commitCall = controls.indexOf('NS.VariationResult.commitUploaded(uploaded)');

const checks = [
  ['Dados expõe importação de resultado e status', html.includes('id="importImageVariationResult"') && html.includes('id="variationResultStatus"')],
  ['reader/result têm bootstrap estático e ordenado', html.includes('src/zip-reader.js') && html.includes('src/variation-result.js') && html.indexOf('src/zip-store.js') < html.indexOf('src/zip-reader.js') && html.indexOf('src/variation-bundle.js') < html.indexOf('src/variation-result.js')],
  ['controle de resultado carrega após app', html.includes('src/variation-result-controls.js') && html.indexOf('src/app.js') < html.indexOf('src/variation-result-controls.js')],
  ['resultado aceita somente raster passivo', result.includes("['image/png', 'image/jpeg', 'image/webp']") && result.includes('sniffMime') && !result.includes('image/svg+xml')],
  ['pacote inteiro valida antes de prepare/upload', validateCall >= 0 && prepareCall > validateCall && uploadCall > prepareCall],
  ['capacidade local é verificada antes e depois dos awaits', (controls.match(/checkCapacity\(/g) || []).length >= 3 && controls.includes('MAX_CATALOG_IMAGE_VARIANTS')],
  ['catálogo é revalidado após upload e antes do commit', uploadCall >= 0 && revalidateGuard > uploadCall && commitCall > revalidateGuard],
  ['importação não publica ProductStore', !controls.includes('publishCurrent') && !controls.includes('publishProducts') && !result.includes('publishCurrent') && !result.includes('publishProducts')],
  ['commit escreve apenas presentation.imageVariants', result.includes('presentation.imageVariants') && !result.includes('imageGallery.push') && !result.includes('product.image =')],
  ['resultado não auto-seleciona derivada', !result.includes('presentation.imageSelections[') && !controls.includes('setImageSelection')]
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  failed.forEach(([name]) => console.error(`FAIL ${name}`));
  process.exit(1);
}
checks.forEach(([name]) => console.log(`PASS ${name}`));
