(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const SCHEMA_VERSION = 1;
  const CHOICES = Object.freeze({
    size: Object.freeze(['A4']),
    orientation: Object.freeze(['portrait']),
    chrome: Object.freeze(['top-mobili-v1']),
    cardOrientation: Object.freeze(['horizontal', 'vertical']),
    scale: Object.freeze(['compact', 'standard', 'large']),
    distribution: Object.freeze(['compact', 'balanced', 'editorial']),
    typography: Object.freeze(['neutral', 'technical', 'editorial']),
    blockTypes: Object.freeze(['card', 'collection', 'table']),
    widths: Object.freeze(['simple', 'wide', 'full']),
    contentPresets: Object.freeze(['visual', 'essential', 'standard', 'detailed', 'technical', 'commercial', 'auto'])
  });
  const FORBIDDEN_KEYS = Object.freeze(['html', 'css', 'javascript', 'js', 'script', 'style', 'stylesheet', 'stylesheetUrl', 'selector', 'x', 'y', 'left', 'top']);

  function issue(code, message, detail = {}) {
    const error = new Error(message || code);
    error.code = code;
    Object.assign(error, detail);
    return error;
  }
  function object(value, code, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw issue(code, `${label} inválido.`);
    return value;
  }
  function assertAllowedKeys(value, allowed, label) {
    Object.keys(value).forEach(key => {
      if (FORBIDDEN_KEYS.includes(key)) throw issue('template_executable_field_forbidden', `${label} contém campo proibido: ${key}.`, { key });
      if (!allowed.includes(key)) throw issue('template_field_unknown', `${label} contém campo desconhecido: ${key}.`, { key });
    });
  }
  function text(value, { label, max = 240 } = {}) {
    const result = String(value || '').trim();
    if (!result || result.length > max) throw issue('template_text_invalid', `${label || 'Texto'} inválido.`);
    return result;
  }
  function integer(value, { label, min = 0, max = 100 } = {}) {
    const result = Number(value);
    if (!Number.isInteger(result) || result < min || result > max) throw issue('template_number_invalid', `${label || 'Número'} inválido.`);
    return result;
  }
  function choice(value, allowed, label) {
    const result = String(value || '').trim();
    if (!allowed.includes(result)) throw issue('template_choice_invalid', `${label} inválido: ${result || 'vazio'}.`, { value: result });
    return result;
  }
  function uniqueChoices(value, allowed, label) {
    if (!Array.isArray(value) || !value.length) throw issue('template_capability_invalid', `${label} deve ser uma lista não vazia.`);
    const seen = new Set();
    return value.map(item => choice(item, allowed, label)).filter(item => {
      if (seen.has(item)) throw issue('template_capability_duplicate', `${label} contém valor duplicado: ${item}.`, { value: item });
      seen.add(item);
      return true;
    });
  }
  function normalizePage(raw) {
    const value = object(raw, 'template_page_invalid', 'page');
    assertAllowedKeys(value, ['size', 'orientation', 'header', 'footer'], 'page');
    return { size: choice(value.size, CHOICES.size, 'page.size'), orientation: choice(value.orientation, CHOICES.orientation, 'page.orientation'), header: choice(value.header, CHOICES.chrome, 'page.header'), footer: choice(value.footer, CHOICES.chrome, 'page.footer') };
  }
  function normalizeLayout(raw) {
    const value = object(raw, 'template_layout_invalid', 'layout');
    assertAllowedKeys(value, ['columns', 'rows'], 'layout');
    return { columns: integer(value.columns, { label: 'layout.columns', min: 1, max: 3 }), rows: integer(value.rows, { label: 'layout.rows', min: 1, max: 8 }) };
  }
  function normalizeBudget(raw) {
    const value = object(raw, 'template_budget_invalid', 'card.contentBudget');
    assertAllowedKeys(value, ['variants', 'rows', 'specs', 'specsWithTable'], 'card.contentBudget');
    return {
      variants: integer(value.variants, { label: 'contentBudget.variants', min: 0, max: 24 }),
      rows: integer(value.rows, { label: 'contentBudget.rows', min: 0, max: 24 }),
      specs: integer(value.specs, { label: 'contentBudget.specs', min: 0, max: 24 }),
      specsWithTable: integer(value.specsWithTable, { label: 'contentBudget.specsWithTable', min: 0, max: 24 })
    };
  }
  function normalizeCard(raw) {
    const value = object(raw, 'template_card_invalid', 'card');
    assertAllowedKeys(value, ['orientation', 'scale', 'visualScale', 'tableScale', 'contentBudget'], 'card');
    return {
      orientation: choice(value.orientation, CHOICES.cardOrientation, 'card.orientation'),
      scale: choice(value.scale, CHOICES.scale, 'card.scale'),
      visualScale: choice(value.visualScale, CHOICES.scale, 'card.visualScale'),
      tableScale: choice(value.tableScale, CHOICES.scale, 'card.tableScale'),
      contentBudget: normalizeBudget(value.contentBudget)
    };
  }
  function normalizeDefaults(raw) {
    const value = object(raw, 'template_defaults_invalid', 'defaults');
    assertAllowedKeys(value, ['distribution', 'typography'], 'defaults');
    return { distribution: choice(value.distribution, CHOICES.distribution, 'defaults.distribution'), typography: choice(value.typography, CHOICES.typography, 'defaults.typography') };
  }
  function normalizeCapabilities(raw) {
    const value = object(raw, 'template_capabilities_invalid', 'capabilities');
    assertAllowedKeys(value, ['blockTypes', 'widths', 'contentPresets', 'distributions', 'typography'], 'capabilities');
    return {
      blockTypes: uniqueChoices(value.blockTypes, CHOICES.blockTypes, 'capabilities.blockTypes'),
      widths: uniqueChoices(value.widths, CHOICES.widths, 'capabilities.widths'),
      contentPresets: uniqueChoices(value.contentPresets, CHOICES.contentPresets, 'capabilities.contentPresets'),
      distributions: uniqueChoices(value.distributions, CHOICES.distribution, 'capabilities.distributions'),
      typography: uniqueChoices(value.typography, CHOICES.typography, 'capabilities.typography')
    };
  }
  function normalize(raw) {
    const value = object(raw, 'template_invalid', 'TemplateContract');
    assertAllowedKeys(value, ['schemaVersion', 'id', 'version', 'name', 'description', 'page', 'layout', 'card', 'defaults', 'capabilities'], 'TemplateContract');
    const template = {
      schemaVersion: integer(value.schemaVersion ?? SCHEMA_VERSION, { label: 'schemaVersion', min: SCHEMA_VERSION, max: SCHEMA_VERSION }),
      id: text(value.id, { label: 'id', max: 80 }),
      version: integer(value.version, { label: 'version', min: 1, max: 999999 }),
      name: text(value.name, { label: 'name', max: 120 }),
      description: text(value.description, { label: 'description', max: 500 }),
      page: normalizePage(value.page), layout: normalizeLayout(value.layout), card: normalizeCard(value.card), defaults: normalizeDefaults(value.defaults), capabilities: normalizeCapabilities(value.capabilities)
    };
    return Object.freeze({ ...template, page: Object.freeze(template.page), layout: Object.freeze(template.layout), card: Object.freeze({ ...template.card, contentBudget: Object.freeze(template.card.contentBudget) }), defaults: Object.freeze(template.defaults), capabilities: Object.freeze(Object.fromEntries(Object.entries(template.capabilities).map(([key, list]) => [key, Object.freeze(list.slice())]))) });
  }
  function perPage(template) { const normalized = normalize(template); return normalized.layout.columns * normalized.layout.rows; }

  const TemplateContract = Object.freeze({ SCHEMA_VERSION, CHOICES, FORBIDDEN_KEYS, normalize, perPage });
  NS.TemplateContract = TemplateContract;

  const COMMON_CAPABILITIES = Object.freeze({
    blockTypes: ['card', 'collection', 'table'], widths: ['simple', 'wide', 'full'], contentPresets: ['visual', 'essential', 'standard', 'detailed', 'technical', 'commercial', 'auto'], distributions: ['compact', 'balanced', 'editorial'], typography: ['neutral', 'technical', 'editorial']
  });
  const BUILT_INS = Object.freeze([
    normalize({ schemaVersion: 1, id: 'technical', version: 1, name: 'Técnico 2×4', description: 'Oito cards por página. Equilíbrio entre foto, descrição e especificações.', page: { size: 'A4', orientation: 'portrait', header: 'top-mobili-v1', footer: 'top-mobili-v1' }, layout: { columns: 2, rows: 4 }, card: { orientation: 'horizontal', scale: 'standard', visualScale: 'standard', tableScale: 'standard', contentBudget: { variants: 4, rows: 6, specs: 3, specsWithTable: 1 } }, defaults: { distribution: 'balanced', typography: 'neutral' }, capabilities: COMMON_CAPABILITIES }),
    normalize({ schemaVersion: 1, id: 'compact', version: 1, name: 'Compacto 3×4', description: 'Doze cards por página. Prioriza densidade para famílias com muitos itens.', page: { size: 'A4', orientation: 'portrait', header: 'top-mobili-v1', footer: 'top-mobili-v1' }, layout: { columns: 3, rows: 4 }, card: { orientation: 'vertical', scale: 'compact', visualScale: 'compact', tableScale: 'compact', contentBudget: { variants: 3, rows: 3, specs: 2, specsWithTable: 0 } }, defaults: { distribution: 'balanced', typography: 'neutral' }, capabilities: COMMON_CAPABILITIES }),
    normalize({ schemaVersion: 1, id: 'showcase', version: 1, name: 'Destaque 2×3', description: 'Seis cards maiores por página. Melhor para produto visual ou lançamento.', page: { size: 'A4', orientation: 'portrait', header: 'top-mobili-v1', footer: 'top-mobili-v1' }, layout: { columns: 2, rows: 3 }, card: { orientation: 'horizontal', scale: 'large', visualScale: 'large', tableScale: 'large', contentBudget: { variants: 5, rows: 8, specs: 5, specsWithTable: 2 } }, defaults: { distribution: 'balanced', typography: 'neutral' }, capabilities: COMMON_CAPABILITIES })
  ]);
  const byKey = new Map(BUILT_INS.map(template => [`${template.id}@${template.version}`, template]));
  const latestById = new Map();
  BUILT_INS.forEach(template => { const current = latestById.get(template.id); if (!current || template.version > current.version) latestById.set(template.id, template); });

  function runtimeView(template) {
    if (!template) return null;
    return Object.freeze({ ...template, columns: template.layout.columns, rows: template.layout.rows, perPage: template.layout.columns * template.layout.rows, className: `template-${template.id}` });
  }
  const templates = Object.freeze(BUILT_INS.map(runtimeView));
  function resolve(id, version = 1) {
    const normalizedId = String(id || '').trim();
    const normalizedVersion = Number(version);
    const template = byKey.get(`${normalizedId}@${normalizedVersion}`);
    if (!template) throw issue('template_unavailable', `Template indisponível: ${normalizedId}@${normalizedVersion}.`, { templateId: normalizedId, templateVersion: normalizedVersion });
    return runtimeView(template);
  }
  function latest(id) { const template = latestById.get(String(id || '').trim()); return template ? runtimeView(template) : null; }
  function getTemplate(id, version) {
    const normalizedId = String(id || '').trim();
    if (version != null) return resolve(normalizedId, version);
    return latest(normalizedId) || templates[0];
  }

  NS.Templates = Object.freeze({ templates, builtIns: BUILT_INS, resolve, latest, getTemplate, runtimeView });
})();
