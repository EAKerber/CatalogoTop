import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile('src/v1-retirement.js', 'utf8');
const context = { window: { CatalogoTop: {} } };
vm.runInNewContext(source, context, { filename: 'src/v1-retirement.js' });
const Retirement = context.window.CatalogoTop.V1Retirement;

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
}

assert(Retirement.EXTERNAL_IMAGE_VARIATION_FLOW_ENABLED === false, 'fluxo externo está aposentado na V1');

const cleaned = Retirement.cleanPresentation({
  imageVariants: {
    p1: [
      { id: 'external-1', image: '/api/assets/a', provenance: { kind: 'external-variation', requestId: 'r1' } },
      { id: 'manual-1', image: '/api/assets/b', provenance: { kind: 'manual-local' } }
    ],
    p2: [
      { id: 'external-2', image: '/api/assets/c', provenance: { kind: 'external-variation' } }
    ]
  },
  imageSelections: {
    p1: { source: 'catalog', id: 'external-1' },
    p2: { source: 'catalog', id: 'external-2' },
    p3: { source: 'product', id: 'gallery-1' },
    p4: { source: 'catalog', id: 'manual-4' }
  }
});

assert(cleaned.imageVariants.p1?.length === 1 && cleaned.imageVariants.p1[0].id === 'manual-1', 'derivado externo é removido sem apagar variante catalog-local não externa');
assert(!cleaned.imageVariants.p2, 'produto contendo somente derivados externos fica sem imageVariants');
assert(!cleaned.imageSelections.p1 && !cleaned.imageSelections.p2, 'seleções para derivados removidos voltam ao fallback original');
assert(cleaned.imageSelections.p3?.source === 'product', 'seleção de imageGallery reutilizável é preservada');
assert(!cleaned.imageSelections.p4, 'seleção catalog-local órfã é removida');

const html = await readFile('index.html', 'utf8');
assert(/<section class="header-data-section" aria-label="Imagens"[^>]*\bhidden\b/.test(html), 'seção externa de imagens está literalmente hidden');
assert(html.includes('src/v1-retirement.js') && html.indexOf('src/v1-retirement.js') < html.indexOf('src/core.js'), 'retirement policy carrega antes do Core');

const core = await readFile('src/core.js', 'utf8');
assert(core.includes('NS.V1Retirement?.cleanPresentation'), 'Core aplica retirement policy na normalização de presentation');
