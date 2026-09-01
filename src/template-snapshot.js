(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const { TemplateContract } = NS;
  if (!TemplateContract) return;

  const SCHEMA_VERSION = 1;
  const MAX_RESOURCES = 500;
  const MAX_VERSIONS = 100;
  const RESERVED_IDS = Object.freeze(['technical', 'compact', 'showcase']);

  function issue(code, message, detail = {}) {
    const error = new Error(message || code);
    error.code = code;
    Object.assign(error, detail);
    return error;
  }

  function assertKeys(value, allowed, label) {
    Object.keys(value).forEach(key => {
      if (!allowed.includes(key)) throw issue('template_snapshot_field_unknown', `${label} contém campo desconhecido: ${key}.`, { key });
    });
  }

  function object(value, code, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw issue(code, `${label} inválido.`);
    return value;
  }

  function text(value, { label = 'Texto', max = 180, required = false } = {}) {
    if (typeof value !== 'string' || value !== value.trim() || value.length > max || (required && !value)) {
      throw issue('template_snapshot_text_invalid', `${label} inválido.`);
    }
    return value;
  }

  function timestamp(value, label, required = true) {
    return text(value, { label, max: 100, required });
  }

  function metadata(raw) {
    const revision = Number(raw?.revision);
    return {
      revision: Number.isInteger(revision) && revision >= 0 ? revision : 0,
      updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt.trim() : '',
      writeId: typeof raw?.writeId === 'string' ? raw.writeId.trim() : ''
    };
  }

  function normalizeVersion(raw, resourceId, expectedVersion) {
    const value = object(raw, 'template_version_record_invalid', 'TemplateVersionRecord');
    assertKeys(value, ['version', 'createdAt', 'contract'], 'TemplateVersionRecord');
    const version = Number(value.version);
    if (!Number.isInteger(version) || version !== expectedVersion) {
      throw issue('template_version_sequence_invalid', `Versão esperada ${expectedVersion} para ${resourceId}.`, { resourceId, version });
    }
    const contract = TemplateContract.normalize(value.contract);
    if (contract.id !== resourceId || contract.version !== version) {
      throw issue('template_version_binding_invalid', `Contrato ${contract.id}@${contract.version} não corresponde a ${resourceId}@${version}.`, { resourceId, version });
    }
    return Object.freeze({ version, createdAt: timestamp(value.createdAt, 'version.createdAt'), contract });
  }

  function normalizeResource(raw, index = -1) {
    const value = object(raw, 'template_resource_invalid', `TemplateResource${index >= 0 ? ` ${index}` : ''}`);
    assertKeys(value, ['id', 'createdAt', 'updatedAt', 'versions'], 'TemplateResource');
    const id = text(value.id, { label: 'template.id', max: 80, required: true });
    if (RESERVED_IDS.includes(id)) throw issue('template_builtin_id_reserved', `ID reservado para built-in: ${id}.`, { id });
    if (!Array.isArray(value.versions) || !value.versions.length || value.versions.length > MAX_VERSIONS) {
      throw issue('template_versions_invalid', `Template ${id} deve possuir entre 1 e ${MAX_VERSIONS} versões.`);
    }
    const versions = value.versions.map((version, versionIndex) => normalizeVersion(version, id, versionIndex + 1));
    return Object.freeze({
      id,
      createdAt: timestamp(value.createdAt, 'template.createdAt'),
      updatedAt: timestamp(value.updatedAt, 'template.updatedAt'),
      versions: Object.freeze(versions)
    });
  }

  function normalizeV1(raw) {
    const value = object(raw, 'template_snapshot_invalid', 'TemplateSnapshot');
    assertKeys(value, ['schemaVersion', 'revision', 'updatedAt', 'writeId', 'templates', 'pendingWrite', 'conflict'], 'TemplateSnapshot');
    if (!Array.isArray(value.templates)) throw issue('template_snapshot_templates_invalid', 'templates deve ser um array.');
    if (value.templates.length > MAX_RESOURCES) throw issue('template_snapshot_too_large', `Limite de ${MAX_RESOURCES} templates excedido.`);
    const ids = new Set();
    const templates = value.templates.map((record, index) => {
      const normalized = normalizeResource(record, index);
      if (ids.has(normalized.id)) throw issue('template_resource_duplicate', `Template duplicado: ${normalized.id}.`, { id: normalized.id });
      ids.add(normalized.id);
      return normalized;
    });
    return Object.freeze({ schemaVersion: SCHEMA_VERSION, ...metadata(value), templates: Object.freeze(templates) });
  }

  function read(raw) {
    const value = object(raw, 'template_snapshot_invalid', 'TemplateSnapshot');
    const version = Number(value.schemaVersion || SCHEMA_VERSION);
    if (version !== SCHEMA_VERSION) throw issue('template_snapshot_version', `Versão de TemplateSnapshot não suportada: ${version}.`, { version });
    return { snapshot: normalizeV1(value), migratedFromVersion: null };
  }

  function forWrite({ revision = 0, updatedAt = '', writeId = '', templates = [] } = {}) {
    return normalizeV1({ schemaVersion: SCHEMA_VERSION, revision, updatedAt, writeId, templates });
  }

  function resourceById(snapshot, id) {
    return snapshot.templates.find(record => record.id === String(id || '').trim()) || null;
  }

  function latestContract(resource) {
    const version = resource?.versions?.[resource.versions.length - 1];
    return version?.contract || null;
  }

  function appendVersion(rawSnapshot, rawContract, { createdAt = new Date().toISOString() } = {}) {
    const current = read(rawSnapshot).snapshot;
    const contract = TemplateContract.normalize(rawContract);
    if (RESERVED_IDS.includes(contract.id)) throw issue('template_builtin_id_reserved', `ID reservado para built-in: ${contract.id}.`, { id: contract.id });
    const now = timestamp(String(createdAt), 'version.createdAt');
    const existing = resourceById(current, contract.id);
    let templates;
    if (!existing) {
      if (contract.version !== 1) throw issue('template_version_sequence_invalid', `Novo template ${contract.id} deve iniciar em v1.`);
      templates = [...current.templates, { id: contract.id, createdAt: now, updatedAt: now, versions: [{ version: 1, createdAt: now, contract }] }];
    } else {
      const nextVersion = existing.versions.length + 1;
      if (contract.version !== nextVersion) throw issue('template_version_sequence_invalid', `Próxima versão de ${contract.id} deve ser v${nextVersion}.`, { expectedVersion: nextVersion, version: contract.version });
      templates = current.templates.map(record => record.id === existing.id
        ? { id: record.id, createdAt: record.createdAt, updatedAt: now, versions: [...record.versions, { version: contract.version, createdAt: now, contract }] }
        : record);
    }
    return forWrite({ revision: current.revision, templates });
  }

  function stable(value) {
    return JSON.stringify(value);
  }

  function transitionError(rawCurrent, rawNext) {
    let current;
    let next;
    try { current = read(rawCurrent).snapshot; next = read(rawNext).snapshot; }
    catch (error) { return error.message || String(error); }
    const nextById = new Map(next.templates.map(record => [record.id, record]));
    for (const previous of current.templates) {
      const candidate = nextById.get(previous.id);
      if (!candidate) return `Template publicado não pode ser removido: ${previous.id}.`;
      if (candidate.createdAt !== previous.createdAt) return `createdAt imutável alterado em ${previous.id}.`;
      if (candidate.versions.length < previous.versions.length || candidate.versions.length > previous.versions.length + 1) return `Transição de versões inválida em ${previous.id}.`;
      for (let index = 0; index < previous.versions.length; index += 1) {
        if (stable(candidate.versions[index]) !== stable(previous.versions[index])) return `Versão histórica reescrita: ${previous.id}@${index + 1}.`;
      }
      if (candidate.versions.length === previous.versions.length && candidate.updatedAt !== previous.updatedAt) return `updatedAt não pode mudar sem nova versão em ${previous.id}.`;
    }
    for (const candidate of next.templates) {
      if (!current.templates.some(record => record.id === candidate.id) && candidate.versions.length !== 1) return `Novo template deve iniciar apenas com v1: ${candidate.id}.`;
    }
    return '';
  }

  NS.TemplateSnapshot = Object.freeze({
    SCHEMA_VERSION,
    MAX_RESOURCES,
    MAX_VERSIONS,
    RESERVED_IDS,
    normalizeResource,
    normalizeV1,
    read,
    forWrite,
    resourceById,
    latestContract,
    appendVersion,
    transitionError
  });
})();