(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const button = document.getElementById('btnExportImageVariationBundle');
  const status = document.getElementById('variationBundleStatus');
  const preview = document.getElementById('catalogPreview');
  if (!button || !status || !preview || !NS.Core || !NS.App || !NS.VariationBundle) return;

  const ISSUE_LABELS = Object.freeze({
    'missing-source': 'sem imagem original',
    'commercial-image-grid': 'grade comercial',
    'target-not-measured': 'sem medida de destino',
    'source-unavailable': 'fonte indisponível'
  });

  function setStatus(message, state = 'idle') {
    status.textContent = message;
    status.dataset.state = state;
    status.hidden = !message;
  }

  function issueSummary(issues) {
    const counts = new Map();
    (Array.isArray(issues) ? issues : []).forEach(issue => {
      const reason = String(issue?.reason || 'unknown');
      counts.set(reason, (counts.get(reason) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([reason, count]) => `${count} ${ISSUE_LABELS[reason] || reason}`)
      .join(' · ');
  }

  function afterLayout() {
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  function downloadBundle(result) {
    const url = URL.createObjectURL(result.archive.blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = result.fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function exportRequest() {
    if (button.disabled) return null;
    button.disabled = true;
    button.dataset.busy = 'true';
    setStatus('Preparando contexto e imagens…', 'working');
    try {
      NS.App.switchTab('catalog');
      const summary = NS.App.renderCatalog();
      await afterLayout();
      const state = NS.Core.getState();
      const buildOptions = {
        root: preview,
        documentModel: summary?.document || NS.CatalogDocument?.build?.(state)
      };
      let result;
      try {
        result = await NS.VariationBundle.buildRequest(state, buildOptions);
      } catch (error) {
        if (error?.code !== 'write_session_required' || !NS.ProductStore?.unlock) throw error;
        setStatus('A fonte externa precisa ser incorporada ao AssetStore. Liberando escrita…', 'working');
        const unlocked = await NS.ProductStore.unlock();
        if (!unlocked) throw new Error('Exportação cancelada: a fonte externa não pôde ser incorporada sem liberar a escrita.');
        result = await NS.VariationBundle.buildRequest(state, buildOptions);
      }
      const jobs = result.manifest.jobs.length;
      const issues = result.manifest.issues;
      const remoteJobs = result.manifest.jobs.filter(job => job?.source?.mode === 'remote-url').length;
      const issueText = issueSummary(issues);
      const remoteText = remoteJobs ? `${remoteJobs} ${remoteJobs === 1 ? 'por URL externa' : 'por URLs externas'}` : '';
      if (!jobs) {
        setStatus(`Nenhuma imagem elegível para exportar${issueText ? ` · ${issueText}` : ''}.`, 'error');
        window.dispatchEvent(new CustomEvent('catalogotop:variation-request-blocked', {
          detail: { requestId: result.requestId, jobs, issues: structuredClone(issues) }
        }));
        return result;
      }
      downloadBundle(result);
      setStatus(`${jobs} ${jobs === 1 ? 'imagem preparada' : 'imagens preparadas'}${remoteText ? ` · ${remoteText}` : ''}${issueText ? ` · ${issueText}` : ''}.`, remoteJobs || issues.length ? 'warning' : 'success');
      window.dispatchEvent(new CustomEvent('catalogotop:variation-request-exported', {
        detail: {
          requestId: result.requestId,
          fileName: result.fileName,
          jobs,
          remoteJobs,
          issues: structuredClone(issues),
          byteLength: result.archive.byteLength
        }
      }));
      return result;
    } catch (error) {
      setStatus(`Não foi possível exportar: ${error?.message || String(error)}`, 'error');
      window.dispatchEvent(new CustomEvent('catalogotop:variation-request-error', {
        detail: { message: error?.message || String(error) }
      }));
      return null;
    } finally {
      button.disabled = false;
      delete button.dataset.busy;
    }
  }

  button.addEventListener('click', exportRequest);

  NS.VariationBundleControls = Object.freeze({
    exportRequest,
    issueSummary,
    setStatus
  });
})();
