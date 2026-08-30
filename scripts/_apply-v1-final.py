from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected 1 occurrence, found {count}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
    'index.html',
    '<section class="header-data-section" aria-label="Imagens">',
    '<section class="header-data-section" aria-label="Imagens" hidden data-retired-feature="external-image-variations">'
)
replace_once(
    'index.html',
    '  <script defer src="src/composition.js"></script>\n  <script defer src="src/catalog-date.js"></script>',
    '  <script defer src="src/composition.js"></script>\n  <script defer src="src/v1-retirement.js"></script>\n  <script defer src="src/catalog-date.js"></script>'
)

replace_once(
    'src/core.js',
    """    const normalized = NS.Composition?.normalizePresentation
      ? NS.Composition.normalizePresentation(value)
      : { distribution: 'balanced', typography: 'neutral', order: [], itemStyles: {}, blocks: [], imageFrames: {}, imageSelections: {}, imageVariants: {} };
    return {
      ...normalized,
      order: uniqueIds(normalized.order || value?.order),
      blocks: Array.isArray(normalized.blocks) ? normalized.blocks : preservedBlocks(value)
    };""",
    """    const normalized = NS.Composition?.normalizePresentation
      ? NS.Composition.normalizePresentation(value)
      : { distribution: 'balanced', typography: 'neutral', order: [], itemStyles: {}, blocks: [], imageFrames: {}, imageSelections: {}, imageVariants: {} };
    const retired = NS.V1Retirement?.cleanPresentation
      ? NS.V1Retirement.cleanPresentation(normalized)
      : normalized;
    return {
      ...retired,
      order: uniqueIds(retired.order || value?.order),
      blocks: Array.isArray(retired.blocks) ? retired.blocks : preservedBlocks(value)
    };"""
)

replace_once('package.json', '"version": "0.1.0"', '"version": "1.0.0"')
replace_once(
    'package.json',
    'node scripts/image-variants-backup-fixture.mjs && node scripts/zip-store-fixture.mjs',
    'node scripts/image-variants-backup-fixture.mjs && node scripts/v1-retirement-fixture.mjs && node scripts/zip-store-fixture.mjs'
)

readme = Path('README.md')
text = readme.read_text(encoding='utf-8')
if '**Versão estável: 1.0.0.**' not in text:
    text = text.replace(
        'Gerador simplificado de catálogos A4 para a Top Mobili.\n',
        'Gerador simplificado de catálogos A4 para a Top Mobili.\n\n**Versão estável: 1.0.0.**\n',
        1
    )
text = text.replace(
    '5. Quando útil, escolha entre a imagem Original, alternativas reutilizáveis do produto ou derivados locais do catálogo.\n',
    '5. Quando útil, escolha entre a imagem Original e alternativas reutilizáveis do produto.\n',
    1
)
start = text.find('## Variation Bundle\n')
end = text.find('## Importação de produtos\n')
if start < 0 or end < 0 or end <= start:
    raise SystemExit('README: Variation Bundle section anchors not found')
replacement = '''## External image variations — retirado da V1\n\nO experimento de geração/importação externa de derivados foi retirado do produto V1 estável. A seção **Dados → Imagens** permanece no HTML com atributo `hidden` para preservar um caminho de compatibilidade, mas não faz parte da interface suportada.\n\nO schema 7 continua reconhecendo `presentation.imageVariants` e `presentation.imageSelections`. Na V1, a normalização remove apenas entradas com `provenance.kind = external-variation` e seleções que apontavam para elas. `product.image`, `product.imageGallery`, framing e alternativas reutilizáveis continuam válidos.\n\nA decisão evita uma migração destrutiva e reserva compatibilidade para uma capability futura, que exige um contrato mais profundo de composição/semântica visual antes de ser reativada. Veja [`docs/v1-stable.md`](docs/v1-stable.md).\n\n'''
text = text[:start] + replacement + text[end:]
text = text.replace(
    '- exportação/importação do Variation Bundle;\n',
    '- fluxo externo de variações de imagem preservado apenas como capability `hidden`/reservada, não suportada na V1 estável;\n',
    1
)
readme.write_text(text, encoding='utf-8')

agents = Path('AGENTS.md')
ag = agents.read_text(encoding='utf-8')
marker = '## V1 stable boundary — external image variations retired'
if marker not in ag:
    ag += '''\n\n## V1 stable boundary — external image variations retired\n\n- A V1 estável é 1.0.0. O fluxo externo Image Variation Request/Result está aposentado e a UI correspondente deve permanecer literalmente `hidden` em `main` V1.\n- Preserve os campos schema 7 `imageVariants`/`imageSelections`; eles são compatibilidade reservada, não autorização para reativar a capability.\n- A normalização V1 remove somente derivados com `provenance.kind = external-variation` e seleções órfãs correspondentes. Não apague `product.imageGallery` nem framing.\n- Não reative geração/importação externa na linha V2 principal sem uma decisão explícita de produto e um contrato de composição semântica/qualidade. Trabalho exploratório deve permanecer isolado.\n'''
    agents.write_text(ag, encoding='utf-8')
