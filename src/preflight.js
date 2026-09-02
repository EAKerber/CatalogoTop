(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};

  const SEVERITIES = Object.freeze(['blocker', 'warning', 'info']);
  const SEVERITY_ORDER = Object.freeze({ blocker: 0, warning: 1, info: 2 });
  const TEMPLATE_FAILURE_CODES = new Set(['template_unavailable', 'template_registry_unavailable']);

  function uniqueIds(values) {
    const seen = new Set();
    return (Array.isArray(values) ? values : []).map(String).filter(id => {
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function issue({ code, severity, scope, resourceType = '', resourceId = '', message, ...detail }) {
    if (!SEVERITIES.includes(severity)) throw new Error(`Severidade de Preflight inválida: ${severity}.`);
    const normalizedType = String(resourceType || '');
    const normalizedId = String(resourceId || '');
    return Object.freeze({
      id: [code, scope, normalizedType || 'none', normalizedId || 'current'].join(':'),
      code: String(code),
      severity,
      scope: String(scope),
      resourceType: normalizedType,
      resourceId: normalizedId,
      message: String(message || code),
      ...detail
    });
  }

  function sortIssues(issues) {
    return issues.slice().sort((left, right) => {
      const severity = (SEVERITY_ORDER[left.severity] ?? 99) - (SEVERITY_ORDER[right.severity] ?? 99);
      if (severity) return severity;
      const code = String(left.code).localeCompare(String(right.code), 'pt-BR');
      if (code) return code;
      const type = String(left.resourceType || '').localeCompare(String(right.resourceType || ''), 'pt-BR');
      if (type) return type;
      return String(left.resourceId || '').localeCompare(String(right.resourceId || ''), 'pt-BR');
    });
  }

  function reportFor(issues) {
    const ordered = sortIssues(issues);
    const counts = {
      blockers: ordered.filter(item => item.severity === 'blocker').length,
      warnings: ordered.filter(item => item.severity === 'warning').length,
      info: ordered.filter(item => item.severity === 'info').length
    };
    return Object.freeze({
      status: counts.blockers ? 'blocked' : counts.warnings ? 'review' : 'ready',
      counts: Object.freeze(counts),
      issues: Object.freeze(ordered)
    });
  }

  function rawSelectionContext(state) {
    const products = Array.isArray(state?.products) ? state.products : [];
    const byId = new Map(products.map(product => [String(product?.id || ''), product]).filter(([id]) => id));
    const selectedIds = uniqueIds(state?.selectedIds);
    const existing = selectedIds.map(id => byId.get(id)).filter(Boolean);
    const active = existing.filter(product => product.status !== 'Inativo');
    return { byId, selectedIds, existing, active };
  }

  function stateIssues(state) {
    const issues = [];
    const selection = rawSelectionContext(state);

    selection.selectedIds.forEach(id => {
      if (selection.byId.has(id)) return;
      issues.push(issue({
        code: 'selected_product_missing',
        severity: 'blocker',
        scope: 'product',
        resourceType: 'product',
        resourceId: id,
        productId: id,
        message: `O produto selecionado “${id}” não existe mais na base atual.`
      }));
    });

    selection.existing.forEach(product => {
      const productId = String(product.id);
      if (product.status === 'Inativo') {
        issues.push(issue({
          code: 'selected_product_inactive',
          severity: 'warning',
          scope: 'product',
          resourceType: 'product',
          resourceId: productId,
          productId,
          message: `O produto ${String(product.code || productId)} está selecionado, mas está inativo e não será publicado.`
        }));
      }
    });

    selection.active.forEach(product => {
      const missing = [];
      if (!String(product.code || '').trim()) missing.push('código');
      if (!String(product.description || '').trim()) missing.push('descrição');
      if (!missing.length) return;
      const productId = String(product.id);
      issues.push(issue({
        code: 'required_product_fact_missing',
        severity: 'blocker',
        scope: 'product',
        resourceType: 'product',
        resourceId: productId,
        productId,
        missingFields: missing.slice(),
        message: `O produto ${String(product.code || productId)} está sem ${missing.join(' e ')}, campos obrigatórios para publicação.`
      }));
    });

    if (!selection.active.length) {
      issues.push(issue({
        code: 'catalog_empty',
        severity: 'blocker',
        scope: 'catalog',
        resourceType: 'catalog',
        resourceId: 'current',
        message: 'O catálogo não possui produtos ativos existentes para publicar.'
      }));
    }

    return issues;
  }

  function templateUnavailableIssue(state, error) {
    const templateId = String(state?.catalog?.templateId || '');
    const templateVersion = Number(state?.catalog?.templateVersion || 1);
    return issue({
      code: 'template_unavailable',
      severity: 'blocker',
      scope: 'template',
      resourceType: 'template',
      resourceId: `${templateId}@${templateVersion}`,
      templateId,
      templateVersion,
      sourceCode: String(error?.code || ''),
      message: `O template exato ${templateId || 'sem id'}@${templateVersion} está indisponível; o Preflight não fará fallback para outra versão.`
    });
  }

  function blockIssues(state, documentModel) {
    const presentation = NS.Composition?.normalizePresentation
      ? NS.Composition.normalizePresentation(state?.catalog?.presentation)
      : { blocks: [] };
    const materialized = new Set((Array.isArray(documentModel?.blocks) ? documentModel.blocks : [])
      .map(block => `${String(block?.type || '')}:${String(block?.id || '')}`));
    const issues = [];

    (Array.isArray(presentation.blocks) ? presentation.blocks : []).forEach(block => {
      if (!block || !['collection', 'table'].includes(String(block.type || ''))) return;
      const key = `${String(block.type)}:${String(block.id || '')}`;
      if (materialized.has(key)) return;
      const blockId = String(block.id || '');
      const label = block.type === 'collection' ? 'coleção' : 'tabela';
      issues.push(issue({
        code: 'editorial_block_not_materialized',
        severity: 'warning',
        scope: 'block',
        resourceType: String(block.type),
        resourceId: blockId,
        blockId,
        message: `A ${label} “${blockId || 'sem id'}” não pôde ser materializada; seus produtos podem ser publicados por outra unidade editorial existente.`
      }));
    });

    return issues;
  }

  function productHasVariantImages(product) {
    return Array.isArray(product?.variants) && product.variants.some(entry => entry && String(entry.image || '').trim());
  }

  function singleImageUsages(documentModel, state) {
    const byId = new Map((Array.isArray(state?.products) ? state.products : [])
      .map(product => [String(product?.id || ''), product]).filter(([id]) => id));
    const usages = [];
    const seen = new Set();

    function add(product, placement, blockId = '') {
      const productId = String(product?.id || '');
      if (!productId) return;
      const key = `${placement}:${String(blockId || '')}:${productId}`;
      if (seen.has(key)) return;
      seen.add(key);
      usages.push({ product, productId, placement, blockId: String(blockId || '') });
    }

    (Array.isArray(documentModel?.pages) ? documentModel.pages : []).forEach(page => {
      (Array.isArray(page?.items) ? page.items : []).forEach(item => {
        if (item?.type === 'card') {
          if (!productHasVariantImages(item.product)) add(item.product, 'card');
          return;
        }
        if (item?.type === 'collection') {
          (Array.isArray(item.members) ? item.members : []).forEach(product => add(product, 'collection', item.blockId || item.block?.id));
          return;
        }
        if (item?.type !== 'table') return;
        const block = item.block || {};
        if (block.rowSource !== 'products' || !Array.isArray(block.columns) || !block.columns.includes('image')) return;
        (Array.isArray(item.rows) ? item.rows : []).forEach(row => {
          const product = byId.get(String(row?.productId || ''));
          if (product) add(product, 'table-row', item.blockId || block.id);
        });
      });
    });

    return usages;
  }

  function imageIssues(state, documentModel) {
    const ImageVariants = NS.ImageVariants;
    if (!ImageVariants?.resolveImage || !ImageVariants?.imageSelectionFor) return [];
    const presentation = documentModel?.presentation || (NS.Composition?.normalizePresentation
      ? NS.Composition.normalizePresentation(state?.catalog?.presentation)
      : state?.catalog?.presentation || {});
    const issues = [];

    singleImageUsages(documentModel, state).forEach(usage => {
      const selection = ImageVariants.imageSelectionFor(presentation, usage.productId);
      const resolved = ImageVariants.resolveImage(usage.product, presentation);
      if (selection && resolved.isFallback) {
        issues.push(issue({
          code: 'image_selection_fallback',
          severity: 'warning',
          scope: 'image',
          resourceType: 'product',
          resourceId: usage.productId,
          productId: usage.productId,
          placement: usage.placement,
          blockId: usage.blockId,
          selectedImageId: String(selection.id || ''),
          selectedImageSource: String(selection.source || ''),
          message: `A imagem selecionada para ${String(usage.product.code || usage.productId)} não está disponível; este uso voltou para o Original.`
        }));
      }
      if (!String(resolved.image || '').trim()) {
        issues.push(issue({
          code: 'visible_image_missing',
          severity: 'warning',
          scope: 'image',
          resourceType: 'product',
          resourceId: usage.productId,
          productId: usage.productId,
          placement: usage.placement,
          blockId: usage.blockId,
          message: `O uso visual de ${String(usage.product.code || usage.productId)} não possui imagem resolvida e será publicado com o placeholder da aplicação.`
        }));
      }
    });

    return issues;
  }

  function inspect(state) {
    const issues = stateIssues(state);
    let documentModel;
    try {
      if (!NS.CatalogDocument?.build) throw new Error('CatalogDocument indisponível para Preflight.');
      documentModel = NS.CatalogDocument.build(state);
    } catch (error) {
      if (TEMPLATE_FAILURE_CODES.has(String(error?.code || ''))) {
        issues.push(templateUnavailableIssue(state, error));
        return reportFor(issues);
      }
      throw error;
    }

    issues.push(...blockIssues(state, documentModel));
    issues.push(...imageIssues(state, documentModel));
    return reportFor(issues);
  }

  NS.Preflight = Object.freeze({
    SEVERITIES,
    inspect,
    sortIssues,
    singleImageUsages,
    productHasVariantImages
  });
})();
