import { readFile } from 'node:fs/promises';

const [html, controls, bundle, zip, css] = await Promise.all([
  readFile('index.html', 'utf8'),
  readFile('src/variation-bundle-controls.js', 'utf8'),
  readFile('src/variation-bundle.js', 'utf8'),
  readFile('src/zip-store.js', 'utf8'),
  readFile('image-variants.css', 'utf8')
]);

const checks = [
  ['Dados expõe exportação e status de imagens', html.includes('id="btnExportImageVariationBundle"') && html.includes('id="variationBundleStatus"')],
  ['ZIP e contrato carregam estaticamente antes do app', html.includes('src/zip-store.js') && html.includes('src/variation-bundle.js') && html.indexOf('src/zip-store.js') < html.indexOf('src/variation-bundle.js') && html.indexOf('src/variation-bundle.js') < html.indexOf('src/app.js')],
  ['controle de exportação carrega depois do app', html.includes('src/variation-bundle-controls.js') && html.indexOf('src/app.js') < html.indexOf('src/variation-bundle-controls.js')],
  ['exportação mede o renderer real e não muta domínio', controls.includes("NS.App.switchTab('catalog')") && controls.includes('root: preview') && controls.includes('buildRequest') && !controls.includes('Core.mutate') && !controls.includes('ProductStore')],
  ['pacote mantém source authority e resultado local explícitos', bundle.includes("sourceAuthority: 'product.image'") && bundle.includes("resultScope: 'catalog-local'") && bundle.includes('identityAndGeometryMustBePreserved: true')],
  ['placement keys não dependem do DOM', bundle.includes('function cardPlacementKey') && bundle.includes('function collectionPlacementKey') && bundle.includes('placementsForDocument(documentModel)')],
  ['writer ZIP tem guards de path e limites', zip.includes('zip_path_invalid') && zip.includes('MAX_ENTRIES') && zip.includes('MAX_TOTAL_BYTES') && zip.includes('zip_duplicate_path')],
  ['status visual é CSS estático', css.includes('.variation-bundle-status') && css.includes('#btnExportImageVariationBundle[data-busy="true"]')],
  ['R3 não injeta script dinamicamente', !controls.includes('createElement(\'script\')') && !bundle.includes('createElement(\'script\')')]
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  failed.forEach(([name]) => console.error(`FAIL ${name}`));
  process.exit(1);
}
checks.forEach(([name]) => console.log(`PASS ${name}`));
