(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const input = document.getElementById('importImageVariationResult');
  const status = document.getElementById('variationResultStatus');
  const preview = document.getElementById('catalogPreview');
  if (!input || !status || !preview || !NS.Core || !NS.App || !NS.VariationBundle || !NS.VariationResult) return;

  function setStatus(message, state = 'idle') {
    status.textContent = message;
    status.dataset.state = state;
    status.hidden = !message;
  }

  function afterLayout() {
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  async function currentRequest() {
    NS.App.switchTab('catalog');
    const summary = NS.App.renderCatalog();
    await afterLayout();
    const state = NS.Core.getState();
    return NS.VariationBundle.buildRequest(state, {
      root: preview,
      documentModel: summary?.document || NS.CatalogDocument?.build?.(state)
    });
  }

  function provenanceMatches(entry, asset, requestId) {
    const provenance = entry?.provenance;
    return provenance?.kind === 'external-variation'
      && provenance.requestId === requestId
      && provenance.jobId === asset.variant.jobId
      && provenance.resultSha256 === asset.variant.asset.sha256;
  }

  function checkCapacity(validated, state = NS.Core.getState()) {
    const presentation = NS.Composition.normalizePresentation(state.catalog?.presentation);
    const max = Number(NS.ImageVariants?.MAX_CATALOG_IMAGE_VARIANTS) || 24;
    const incomingByProduct = new Map();
    const assets = [];
    let duplicates = 0;
    validated.assets.forEach(asset => {
      const id = asset.variant.productId;
      const existing = Array.isArray(presentation.imageVariants?.[id]) ? presentation.imageVariants[id] : [];
      if (existing.some(entry => provenanceMatches(entry, asset, validated.manifest.requestId))) {
        duplicates += 1;
        return;
      }
      assets.push(asset);
      incomingByProduct.set(id, (incomingByProduct.get(id) || 0) + 1);
    });
    incomingByProduct.forEach((incoming, productId) => {
      const existing = Array.isArray(presentation.imageVariants?.[productId]) ? presentation.imageVariants[productId].length : 0;
      if (existing + incoming > max) {
        const error = new Error(`result_variant_capacity:${productId}:${existing}+${incoming}>${max}`);
        error.code = 'result_variant_capacity';
        throw error;
      }
    });
    return { duplicates, incoming: assets.length, assets };
  }

  async function ensureWritableDefault() {
    if (!NS.ProductStore) return true;
    if (NS.ProductStore.isWritable?.()) return true;
    return Boolean(await NS.ProductStore.unlock?.());
  }

  async function uploadWithSession(prepared, options = {}) {
    const uploadBlob = options.uploadBlob || NS.AssetClient?.uploadBlob;
    if (typeof uploadBlob !== 'function') throw new Error('result_uploader_missing');
    try {
      return await NS.VariationResult.uploadPrepared(prepared, uploadBlob);
    } catch (error) {
      if (error?.code !== 'write_session_required' || options.uploadBlob) throw error;
      if (!await ensureWritableDefault()) throw error;
      return NS.VariationResult.uploadPrepared(prepared, uploadBlob);
    }
  }

  function reportText(report, validated, preexistingDuplicates = 0) {
    const parts = [];
    parts.push(`${report.imported} ${report.imported === 1 ? 'variante importada' : 'variantes importadas'}`);
    const duplicates = report.duplicates + preexistingDuplicates;
    if (duplicates) parts.push(`${duplicates} ${duplicates === 1 ? 'duplicada' : 'duplicadas'}`);
    if (validated.missingJobs.length) parts.push(`${validated.missingJobs.length} ${validated.missingJobs.length === 1 ? 'uso sem resultado' : 'usos sem resultado'}`);
    if (validated.ignoredFiles.length) parts.push(`${validated.ignoredFiles.length} ${validated.ignoredFiles.length === 1 ? 'arquivo ignorado' : 'arquivos ignorados'}`);
    return `${parts.join(' · ')}.`;
  }

  async function importResult(file, options = {}) {
    if (!file) return null;
    input.disabled = true;
    setStatus('Validando pacote e assinaturas…', 'working');
    try {
      const request = options.currentRequest || await currentRequest();
      const packageData = await NS.VariationResult.readPackage(file, options.zipOptions || {});
      const validated = await NS.VariationResult.validatePackage(packageData, request);
      const capacity = checkCapacity(validated);
      if (!capacity.incoming) {
        setStatus(`Nenhuma variante nova · ${capacity.duplicates} ${capacity.duplicates === 1 ? 'duplicada' : 'duplicadas'}.`, 'warning');
        return { request, packageData, validated, report: { imported: 0, duplicates: capacity.duplicates } };
      }
      const importable = Object.freeze({ ...validated, assets: capacity.assets });

      setStatus('Preparando imagens validadas…', 'working');
      const prepared = await NS.VariationResult.prepareValidated(importable, options.prepareImage || NS.AssetClient?.prepareImage);
      const ensureWritable = options.ensureWritable || ensureWritableDefault;
      if (!await ensureWritable()) {
        setStatus('Importação cancelada antes do upload.', 'warning');
        return null;
      }

      setStatus('Armazenando imagens validadas…', 'working');
      const uploaded = await uploadWithSession(prepared, options);

      // Não confia que o catálogo ficou parado durante awaits de decode/upload.
      if (!options.skipRevalidation) {
        const refreshed = options.revalidateRequest ? await options.revalidateRequest() : await currentRequest();
        if (refreshed.requestId !== packageData.manifest.requestId) {
          const error = new Error('result_request_changed_during_import');
          error.code = 'result_request_changed_during_import';
          throw error;
        }
      }
      checkCapacity(importable);

      const report = NS.VariationResult.commitUploaded(uploaded);
      const text = reportText(report, validated, capacity.duplicates);
      setStatus(text, validated.missingJobs.length || validated.ignoredFiles.length || capacity.duplicates ? 'warning' : 'success');
      window.dispatchEvent(new CustomEvent('catalogotop:variation-result-imported', {
        detail: { ...report, preexistingDuplicates: capacity.duplicates, missingJobs: validated.missingJobs.length, ignoredFiles: validated.ignoredFiles.length }
      }));
      return { request, packageData, validated, uploaded, report };
    } catch (error) {
      setStatus(`Pacote rejeitado: ${error?.message || String(error)}`, 'error');
      window.dispatchEvent(new CustomEvent('catalogotop:variation-result-error', {
        detail: { code: error?.code || 'error', message: error?.message || String(error) }
      }));
      return null;
    } finally {
      input.disabled = false;
      input.value = '';
    }
  }

  input.addEventListener('change', event => importResult(event.target.files?.[0]));

  NS.VariationResultControls = Object.freeze({
    importResult,
    currentRequest,
    checkCapacity,
    setStatus
  });
})();
