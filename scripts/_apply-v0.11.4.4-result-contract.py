from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one anchor, found {count}")
    return text.replace(old, new, 1)

bundle_path = Path('src/variation-bundle.js')
bundle = bundle_path.read_text(encoding='utf-8')

bundle = replace_once(
    bundle,
    "  const REQUEST_VERSION = 2;\n  const SOURCE_TIMEOUT_MS = 10000;",
    "  const REQUEST_VERSION = 2;\n  const RESULT_CONTRACT_KIND = 'catalogotop.image-variation-result-contract';\n  const RESULT_CONTRACT_VERSION = 1;\n  const RESULT_KIND = 'catalogotop.image-variation-result';\n  const RESULT_VERSION = 1;\n  const RESULT_MIME_TYPES = Object.freeze(['image/png', 'image/jpeg', 'image/webp']);\n  const SOURCE_TIMEOUT_MS = 10000;",
    'result constants'
)

result_contract = r'''  function resultContract(requestId = '') {
    return {
      kind: RESULT_CONTRACT_KIND,
      version: RESULT_CONTRACT_VERSION,
      requestManifest: {
        kind: REQUEST_KIND,
        version: REQUEST_VERSION,
        requestId: String(requestId || '')
      },
      resultManifest: {
        kind: RESULT_KIND,
        version: RESULT_VERSION,
        topLevelArray: 'variants',
        forbiddenTopLevelArrays: ['results'],
        required: ['kind', 'version', 'requestId', 'variants'],
        variantRequired: ['jobId', 'usageSignature', 'productId', 'placementKey', 'asset'],
        assetRequired: ['path', 'mimeType', 'sha256']
      },
      allowedMimeTypes: Array.from(RESULT_MIME_TYPES),
      allowedTransforms: Array.from(ALLOWED_TRANSFORMS),
      rules: [
        'Request and Result versions are independent. Do not mirror the request version.',
        'Return manifest.json with kind catalogotop.image-variation-result, version 1 and variants[]. Never return results[].',
        'Copy requestId from the request manifest and copy jobId, usageSignature, productId and placementKey from each matching job.',
        'Declare only transformation tokens present in allowedTransforms.',
        'Raster resize/downscale needed to fit the declared target is output sizing, not an additional transform token named downscale.',
        'Each asset sha256 must hash the exact bytes stored at asset.path.'
      ],
      example: {
        kind: RESULT_KIND,
        version: RESULT_VERSION,
        requestId: '<copy manifest.requestId>',
        generatedAt: '<ISO-8601 timestamp>',
        generator: '<generator name>',
        variants: [{
          resultId: '<stable result id>',
          jobId: '<copy job.jobId>',
          usageSignature: '<copy job.usageSignature>',
          productId: '<copy job.productId>',
          placementKey: '<copy job.placementKey>',
          label: 'Variação externa',
          generator: '<generator name>',
          transforms: ['focus-reframe'],
          asset: {
            path: 'images/<file>.png',
            mimeType: 'image/png',
            sha256: '<64 lowercase hex chars for the exact file bytes>'
          }
        }]
      }
    };
  }

'''
bundle = replace_once(bundle, "  function requestReadme() {\n", result_contract + "  function requestReadme() {\n", 'resultContract insertion')

bundle = replace_once(
    bundle,
    "      'Use manifest.json as the authoritative contract.',\n",
    "      'Use manifest.json as the authoritative request contract.',\n      'IMPORTANT: Request manifest version = 2; Result manifest version = 1. These versions are independent. Do not mirror the request version.',\n      'Before generating output, read context/result-contract.json. Return manifest.json exactly as catalogotop.image-variation-result version 1 with variants[]. Never return version 2 or results[].',\n",
    'README version authority'
)

bundle = replace_once(
    bundle,
    "      `Allowed transformations: ${ALLOWED_TRANSFORMS.join(', ')}.`,\n",
    "      `Allowed transformations: ${ALLOWED_TRANSFORMS.join(', ')}.`,\n      'Only declare transform tokens from that list. Raster resize/downscale needed to fit target dimensions is output sizing and must not be emitted as a transform token named downscale.',\n",
    'README transform authority'
)

bundle = replace_once(
    bundle,
    "      'Do not modify commercial facts. Return generated images through the matching result-bundle contract using jobId and usageSignature.'\n",
    "      'Do not modify commercial facts. Return the Result Bundle v1 described by context/result-contract.json using the matching jobId and usageSignature.'\n",
    'README closing contract'
)

bundle = replace_once(
    bundle,
    "      { path: 'context/layout.json', data: `${JSON.stringify(layoutContext(documentModel), null, 2)}\\n` },\n      { path: 'README.txt', data: `${requestReadme()}\\n` },",
    "      { path: 'context/layout.json', data: `${JSON.stringify(layoutContext(documentModel), null, 2)}\\n` },\n      { path: 'context/result-contract.json', data: `${JSON.stringify(resultContract(requestId), null, 2)}\\n` },\n      { path: 'README.txt', data: `${requestReadme()}\\n` },",
    'result contract ZIP entry'
)

bundle = replace_once(
    bundle,
    "    REQUEST_VERSION,\n    SOURCE_TIMEOUT_MS,",
    "    REQUEST_VERSION,\n    RESULT_CONTRACT_KIND,\n    RESULT_CONTRACT_VERSION,\n    RESULT_KIND,\n    RESULT_VERSION,\n    RESULT_MIME_TYPES,\n    SOURCE_TIMEOUT_MS,",
    'exports constants'
)

bundle = replace_once(
    bundle,
    "    layoutContext,\n    buildRequest",
    "    layoutContext,\n    resultContract,\n    buildRequest",
    'exports resultContract'
)

bundle_path.write_text(bundle, encoding='utf-8')

fixture_path = Path('scripts/variation-bundle-request-fixture.mjs')
fixture = fixture_path.read_text(encoding='utf-8')
fixture = replace_once(
    fixture,
    "if (first.manifest.policy.resultScope !== 'catalog-local' || !first.manifest.policy.identityAndGeometryMustBePreserved) fail('policy não mantém resultado local/fidelidade');\n",
    "if (first.manifest.policy.resultScope !== 'catalog-local' || !first.manifest.policy.identityAndGeometryMustBePreserved) fail('policy não mantém resultado local/fidelidade');\nconst resultContract = VariationBundle.resultContract(first.requestId);\nif (resultContract.kind !== 'catalogotop.image-variation-result-contract' || resultContract.version !== 1) fail(`contrato de resultado inválido: ${JSON.stringify(resultContract)}`);\nif (resultContract.requestManifest.version !== 2 || resultContract.resultManifest.kind !== 'catalogotop.image-variation-result' || resultContract.resultManifest.version !== 1 || resultContract.resultManifest.topLevelArray !== 'variants' || !resultContract.resultManifest.forbiddenTopLevelArrays.includes('results')) fail(`Request v2 precisa declarar Result v1/variants sem espelhamento: ${JSON.stringify(resultContract)}`);\nif (!resultContract.allowedMimeTypes.includes('image/png') || resultContract.allowedMimeTypes.includes('image/svg+xml') || !resultContract.allowedTransforms.includes('focus-reframe') || resultContract.allowedTransforms.includes('downscale')) fail(`whitelists do Result contract divergiram: ${JSON.stringify(resultContract)}`);\n",
    'request fixture result contract'
)
fixture = replace_once(
    fixture,
    "if (!first.archive.entries.some(item => item.path === 'manifest.json') || !first.archive.entries.some(item => item.path === 'context/layout.json')) fail('ZIP precisa conter manifest e layout context');\n",
    "if (!first.archive.entries.some(item => item.path === 'manifest.json') || !first.archive.entries.some(item => item.path === 'context/layout.json')) fail('ZIP precisa conter manifest e layout context');\nif (!first.archive.entries.some(item => item.path === 'context/result-contract.json')) fail('ZIP precisa carregar contrato machine-readable do Result Bundle v1');\n",
    'request fixture archive contract'
)
fixture_path.write_text(fixture, encoding='utf-8')

static_path = Path('scripts/variation-bundle-static-fixture.mjs')
static = static_path.read_text(encoding='utf-8')
static = replace_once(
    static,
    "  ['pacote mantém source authority e resultado local explícitos', bundle.includes(\"sourceAuthority: 'product.image'\") && bundle.includes(\"resultScope: 'catalog-local'\") && bundle.includes('identityAndGeometryMustBePreserved: true')],\n",
    "  ['pacote mantém source authority e resultado local explícitos', bundle.includes(\"sourceAuthority: 'product.image'\") && bundle.includes(\"resultScope: 'catalog-local'\") && bundle.includes('identityAndGeometryMustBePreserved: true')],\n  ['Request v2 carrega contrato explícito de Result v1', bundle.includes(\"const RESULT_VERSION = 1\") && bundle.includes(\"topLevelArray: 'variants'\") && bundle.includes(\"forbiddenTopLevelArrays: ['results']\") && bundle.includes('context/result-contract.json') && bundle.includes('Request manifest version = 2; Result manifest version = 1') && bundle.includes('Do not mirror the request version') && bundle.includes('must not be emitted as a transform token named downscale')],\n",
    'static result contract check'
)
static_path.write_text(static, encoding='utf-8')

doc = '''# v0.11.4.4 — Self-Describing Result Contract\n\n## Evidência\n\nUm Result Bundle real, produzido a partir de um Request v2 válido com 10 fontes embedded, foi rejeitado com `result_manifest_version`. O pacote externo havia inferido `Result version: 2` e `results[]` a partir do Request v2. O importador canônico, porém, define `catalogotop.image-variation-result` version 1 com `variants[]`.\n\nO mesmo pacote também declarou `downscale` em provenance, embora o Request exponha um vocabulário fechado de transforms que não contém esse token. O problema era de orientação do produtor: o README dizia apenas para usar o “matching result-bundle contract”, mas não transportava esse contrato.\n\n## Decisão\n\nNão ampliar o importador para aceitar o schema acidental. O fail-closed permanece. Em vez disso, todo Request ZIP passa a carregar `context/result-contract.json` e o README declara explicitamente:\n\n- Request manifest: v2;\n- Result manifest: v1;\n- versões independentes;\n- Result usa `variants[]`, nunca `results[]`;\n- MIME aceitos: PNG/JPEG/WebP;\n- transforms declarados precisam pertencer à whitelist do Request;\n- resize/downscale necessário ao target é sizing do raster de saída, não um token adicional chamado `downscale`.\n\nO arquivo machine-readable também fornece os campos obrigatórios e um exemplo mínimo de manifest v1.\n\n## Compatibilidade\n\nNenhum schema de estado muda. Request permanece v2 e Result permanece v1. O conteúdo material que entra em `requestId`/`usageSignature` não muda; portanto adicionar o contrato informativo ao ZIP não invalida semanticamente o pedido.\n\n## Gate\n\n`variation-bundle-request-fixture` exige o novo arquivo e valida a independência Request v2 → Result v1. O fixture estático impede regressão para orientação ambígua.\n'''
Path('docs/v0.11.4.4-result-contract-self-description.md').write_text(doc, encoding='utf-8')

print('v0.11.4.4 patch staged')
