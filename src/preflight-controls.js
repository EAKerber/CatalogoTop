(function () {
  'use strict';

  const NS = window.CatalogoTop;
  const statusButton = document.getElementById('preflightStatus');
  const panel = document.getElementById('preflightPanel');
  const preview = document.getElementById('catalogPreview');
  if (!statusButton || !panel || !NS.Preflight || !NS.Core) return;

  let lastReport = null;

  function esc(value) {
    if (NS.Render?.esc) return NS.Render.esc(value);
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function statusLabel(report) {
    if (report.status === 'blocked') return `Bloqueios · ${report.counts.blockers}`;
    if (report.status === 'review') return `Revisar · ${report.counts.warnings}`;
    return 'Pronto';
  }

  function resourceLabel(item) {
    if (item.scope === 'template') return `Template · ${item.resourceId}`;
    if (item.scope === 'block') return `${item.resourceType === 'collection' ? 'Coleção' : item.resourceType === 'table' ? 'Tabela' : 'Bloco'} · ${item.resourceId || 'sem id'}`;
    if (item.scope === 'product' || item.scope === 'image') return `Produto · ${item.productId || item.resourceId}`;
    return 'Catálogo atual';
  }

  function issueMarkup(item) {
    return `<li class="preflight-issue severity-${esc(item.severity)}" data-preflight-issue="${esc(item.code)}" data-preflight-resource="${esc(item.resourceId)}">
      <div class="preflight-issue-marker" aria-hidden="true"></div>
      <div class="preflight-issue-copy"><strong>${esc(item.message)}</strong><span>${esc(resourceLabel(item))}</span></div>
    </li>`;
  }

  function render(report) {
    lastReport = report;
    statusButton.dataset.preflightStatus = report.status;
    statusButton.textContent = statusLabel(report);
    statusButton.setAttribute('title', report.status === 'ready'
      ? 'Preflight estrutural e renderizado sem issues.'
      : `${report.counts.blockers} bloqueio(s) · ${report.counts.warnings} aviso(s).`);

    const summary = report.status === 'ready'
      ? '<strong>Pronto para revisão final.</strong><span>Nenhum problema detectado pelos checks atuais.</span>'
      : `<strong>${report.counts.blockers} bloqueio(s) · ${report.counts.warnings} aviso(s)</strong><span>Preflight observa o documento atual; nenhuma correção é aplicada automaticamente.</span>`;
    const issues = report.issues.length
      ? `<ol class="preflight-issues">${report.issues.map(issueMarkup).join('')}</ol>`
      : '<div class="preflight-ready-copy">Estrutura e sinais renderizados atuais sem issues cobertos pelo Preflight.</div>';

    panel.innerHTML = `<div class="preflight-panel-head"><div><p class="eyebrow">PREFLIGHT</p>${summary}</div><button class="icon-button" type="button" data-preflight-close aria-label="Fechar Preflight">×</button></div>${issues}`;
  }

  function reportForCurrentState(includeRendered = true) {
    const structural = NS.Preflight.inspect(NS.Core.getState());
    if (!includeRendered || !preview || !NS.PreflightRender?.inspect || !NS.Preflight.withIssues) return structural;
    return NS.Preflight.withIssues(structural, NS.PreflightRender.inspect(preview));
  }

  function refresh(includeRendered = true) {
    try {
      render(reportForCurrentState(includeRendered));
    } catch (error) {
      console.error('Falha inesperada no Preflight:', error);
      lastReport = null;
      statusButton.dataset.preflightStatus = 'error';
      statusButton.textContent = 'Preflight indisponível';
      panel.innerHTML = `<div class="preflight-panel-head"><div><p class="eyebrow">PREFLIGHT</p><strong>Não foi possível avaliar o documento.</strong><span>${esc(error?.message || error)}</span></div><button class="icon-button" type="button" data-preflight-close aria-label="Fechar Preflight">×</button></div>`;
    }
  }

  function setOpen(open) {
    panel.hidden = !open;
    statusButton.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  statusButton.addEventListener('click', () => setOpen(panel.hidden));
  panel.addEventListener('click', event => {
    if (event.target.closest('[data-preflight-close]')) setOpen(false);
  });

  window.addEventListener('catalogotop:catalog-rendered', () => refresh(true));
  ['catalogotop:products-updated', 'catalogotop:catalogs-updated', 'catalogotop:templates-updated'].forEach(name => {
    window.addEventListener(name, () => refresh(false));
  });
  window.addEventListener('catalogotop:tab-changed', event => {
    if (event.detail?.tabId === 'catalog') refresh(true);
  });

  NS.PreflightControls = Object.freeze({
    refresh,
    getLastReport: () => lastReport,
    isOpen: () => !panel.hidden,
    setOpen
  });

  refresh(true);
})();