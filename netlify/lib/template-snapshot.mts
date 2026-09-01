export const TEMPLATE_SNAPSHOT_VERSION = 1;
export const MAX_TEMPLATE_RESOURCES = 500;
export const MAX_TEMPLATE_VERSIONS = 100;
export const RESERVED_TEMPLATE_IDS = new Set(['technical', 'compact', 'showcase']);

const CHOICES = {
  size: new Set(['A4']), orientation: new Set(['portrait']), chrome: new Set(['top-mobili-v1']),
  cardOrientation: new Set(['horizontal', 'vertical']), scale: new Set(['compact', 'standard', 'large']),
  distribution: new Set(['compact', 'balanced', 'editorial']), typography: new Set(['neutral', 'technical', 'editorial']),
  blockTypes: new Set(['card', 'collection', 'table']), widths: new Set(['simple', 'wide', 'full']),
  contentPresets: new Set(['visual', 'essential', 'standard', 'detailed', 'technical', 'commercial', 'auto'])
};
const FORBIDDEN = new Set(['html', 'css', 'javascript', 'js', 'script', 'style', 'stylesheet', 'stylesheetUrl', 'selector', 'x', 'y', 'left', 'top']);

function isObject(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
function keys(value: Record<string, unknown>, allowed: string[], label: string) {
  for (const key of Object.keys(value)) {
    if (FORBIDDEN.has(key)) return `${label} contém campo proibido: ${key}.`;
    if (!allowed.includes(key)) return `${label} contém campo desconhecido: ${key}.`;
  }
  return '';
}
function text(value: unknown, max: number, required = true) { return typeof value === 'string' && value === value.trim() && value.length <= max && (!required || value.length > 0); }
function integer(value: unknown, min: number, max: number) { const n = Number(value); return Number.isInteger(n) && n >= min && n <= max; }
function choice(value: unknown, set: Set<string>) { return typeof value === 'string' && set.has(value); }
function uniqueChoices(value: unknown, set: Set<string>) { return Array.isArray(value) && value.length > 0 && value.every(item => choice(item, set)) && new Set(value).size === value.length; }

export function validateTemplateContract(raw: unknown, expectedId?: string, expectedVersion?: number) {
  if (!isObject(raw)) return 'TemplateContract inválido.';
  let error = keys(raw, ['schemaVersion','id','version','name','description','page','layout','card','defaults','capabilities'], 'TemplateContract'); if (error) return error;
  if (!integer(raw.schemaVersion ?? 1, 1, 1)) return 'schemaVersion de template inválido.';
  if (!text(raw.id, 80) || RESERVED_TEMPLATE_IDS.has(String(raw.id))) return `ID de template customizado inválido/reservado: ${String(raw.id || '')}.`;
  if (expectedId && raw.id !== expectedId) return `Contrato não corresponde ao recurso ${expectedId}.`;
  if (!integer(raw.version, 1, 999999) || (expectedVersion != null && raw.version !== expectedVersion)) return 'Versão de contrato inválida.';
  if (!text(raw.name, 120) || !text(raw.description, 500)) return 'Nome/descrição de template inválidos.';

  const page = raw.page; if (!isObject(page)) return 'page inválido.'; error = keys(page, ['size','orientation','header','footer'], 'page'); if (error) return error;
  if (!choice(page.size, CHOICES.size) || !choice(page.orientation, CHOICES.orientation) || !choice(page.header, CHOICES.chrome) || !choice(page.footer, CHOICES.chrome)) return 'page contém escolha inválida.';
  const layout = raw.layout; if (!isObject(layout)) return 'layout inválido.'; error = keys(layout, ['columns','rows'], 'layout'); if (error) return error;
  if (!integer(layout.columns,1,3) || !integer(layout.rows,1,8)) return 'layout fora dos limites.';
  const card = raw.card; if (!isObject(card)) return 'card inválido.'; error = keys(card, ['orientation','scale','visualScale','tableScale','contentBudget'], 'card'); if (error) return error;
  if (!choice(card.orientation, CHOICES.cardOrientation) || !choice(card.scale, CHOICES.scale) || !choice(card.visualScale, CHOICES.scale) || !choice(card.tableScale, CHOICES.scale)) return 'card contém escolha inválida.';
  const budget = card.contentBudget; if (!isObject(budget)) return 'contentBudget inválido.'; error = keys(budget, ['variants','rows','specs','specsWithTable'], 'contentBudget'); if (error) return error;
  if (!integer(budget.variants,0,24) || !integer(budget.rows,0,24) || !integer(budget.specs,0,24) || !integer(budget.specsWithTable,0,24)) return 'contentBudget fora dos limites.';
  const defaults = raw.defaults; if (!isObject(defaults)) return 'defaults inválido.'; error = keys(defaults, ['distribution','typography'], 'defaults'); if (error) return error;
  if (!choice(defaults.distribution, CHOICES.distribution) || !choice(defaults.typography, CHOICES.typography)) return 'defaults contém escolha inválida.';
  const capabilities = raw.capabilities; if (!isObject(capabilities)) return 'capabilities inválido.'; error = keys(capabilities, ['blockTypes','widths','contentPresets','distributions','typography'], 'capabilities'); if (error) return error;
  if (!uniqueChoices(capabilities.blockTypes, CHOICES.blockTypes) || !uniqueChoices(capabilities.widths, CHOICES.widths) || !uniqueChoices(capabilities.contentPresets, CHOICES.contentPresets) || !uniqueChoices(capabilities.distributions, CHOICES.distribution) || !uniqueChoices(capabilities.typography, CHOICES.typography)) return 'capabilities inválidas.';
  return '';
}

export function validateTemplateSnapshot(templates: unknown) {
  if (!Array.isArray(templates)) return 'templates deve ser um array.';
  if (templates.length > MAX_TEMPLATE_RESOURCES) return `Limite de ${MAX_TEMPLATE_RESOURCES} templates excedido.`;
  const ids = new Set<string>();
  for (let index = 0; index < templates.length; index += 1) {
    const resource = templates[index]; if (!isObject(resource)) return `TemplateResource inválido no índice ${index}.`;
    let error = keys(resource, ['id','createdAt','updatedAt','versions'], 'TemplateResource'); if (error) return error;
    const id = String(resource.id || '');
    if (!text(resource.id,80) || RESERVED_TEMPLATE_IDS.has(id)) return `ID customizado inválido/reservado: ${id}.`;
    if (ids.has(id)) return `Template duplicado: ${id}.`; ids.add(id);
    if (!text(resource.createdAt,100) || !text(resource.updatedAt,100)) return `Metadata temporal inválida em ${id}.`;
    if (!Array.isArray(resource.versions) || resource.versions.length < 1 || resource.versions.length > MAX_TEMPLATE_VERSIONS) return `Versões inválidas em ${id}.`;
    for (let versionIndex = 0; versionIndex < resource.versions.length; versionIndex += 1) {
      const record = resource.versions[versionIndex]; if (!isObject(record)) return `TemplateVersionRecord inválido em ${id}.`;
      error = keys(record, ['version','createdAt','contract'], 'TemplateVersionRecord'); if (error) return error;
      const expected = versionIndex + 1;
      if (record.version !== expected || !text(record.createdAt,100)) return `Sequência de versões inválida em ${id}.`;
      error = validateTemplateContract(record.contract, id, expected); if (error) return error;
    }
  }
  return '';
}

function stable(value: unknown) { return JSON.stringify(value); }
export function validateTemplateSnapshotTransition(currentTemplates: unknown, nextTemplates: unknown) {
  const currentError = validateTemplateSnapshot(currentTemplates); if (currentError) return `Snapshot atual inválido: ${currentError}`;
  const nextError = validateTemplateSnapshot(nextTemplates); if (nextError) return nextError;
  const current = currentTemplates as Record<string, unknown>[];
  const next = nextTemplates as Record<string, unknown>[];
  const nextById = new Map(next.map(resource => [String(resource.id), resource]));
  for (const previous of current) {
    const id = String(previous.id); const candidate = nextById.get(id); if (!candidate) return `Template publicado não pode ser removido: ${id}.`;
    if (candidate.createdAt !== previous.createdAt) return `createdAt imutável alterado em ${id}.`;
    const before = previous.versions as unknown[]; const after = candidate.versions as unknown[];
    if (after.length < before.length || after.length > before.length + 1) return `Transição de versões inválida em ${id}.`;
    for (let i = 0; i < before.length; i += 1) if (stable(after[i]) !== stable(before[i])) return `Versão histórica reescrita: ${id}@${i + 1}.`;
    if (after.length === before.length && candidate.updatedAt !== previous.updatedAt) return `updatedAt não pode mudar sem nova versão em ${id}.`;
  }
  for (const candidate of next) {
    if (!current.some(resource => resource.id === candidate.id) && (candidate.versions as unknown[]).length !== 1) return `Novo template deve iniciar apenas com v1: ${String(candidate.id)}.`;
  }
  return '';
}
