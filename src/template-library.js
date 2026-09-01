(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const root = document.getElementById('templateLibraryRoot');
  if (!root) return;

  let draft = null;
  const esc = value => NS.Render?.esc ? NS.Render.esc(String(value ?? '')) : String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const clone = value => JSON.parse(JSON.stringify(value));

  function store() { return NS.TemplateStore; }
  function templates() { return NS.Templates; }
  function snapshot() { return store()?.getSnapshot?.() || { revision: 0, templates: [] }; }
  function catalogSnapshot() { return NS.CatalogStore?.getSnapshot?.() || { catalogs: [] }; }

  function usages(id, version = null) {
    return (catalogSnapshot().catalogs || []).filter(record => {
      const catalog = record?.catalog || {};
      if (String(catalog.templateId) !== String(id)) return false;
      return version == null || Number(catalog.templateVersion || 1) === Number(version);
    }).length;
  }

  function resourceRows() {
    const builtIns = (templates()?.builtIns || []).map(contract => ({
      id: contract.id,
      builtIn: true,
      latestVersion: contract.version,
      versions: [{ version: contract.version, contract }]
    }));
    const custom = (snapshot().templates || []).map(resource => ({
      id: resource.id,
      builtIn: false,
      latestVersion: resource.versions.length,
      versions: resource.versions
    }));
    return [...builtIns, ...custom].sort((a, b) => Number(a.builtIn !== true) - Number(b.builtIn !== true) || a.versions[a.versions.length - 1].contract.name.localeCompare(b.versions[b.versions.length - 1].contract.name, 'pt-BR'));
  }

  function layoutSummary(contract) {
    return `${contract.layout.columns}×${contract.layout.rows} · ${contract.card.orientation === 'vertical' ? 'vertical' : 'horizontal'} · ${contract.card.scale}`;
  }

  function versionOptions(resource) {
    return resource.versions.slice().reverse().map(record => {
      const contract = record.contract;
      return `<option value="${record.version}">v${record.version} · ${esc(contract.name)}</option>`;
    }).join('');
  }

  function resourceMarkup(resource) {
    const latestRecord = resource.versions[resource.versions.length - 1];
    const contract = latestRecord.contract;
    const useCount = usages(resource.id);
    return `<article class="template-library-row" data-template-resource="${esc(resource.id)}" data-built-in="${resource.builtIn ? 'true' : 'false'}">
      <div class="template-library-copy">
        <div class="template-library-title"><strong>${esc(contract.name)}</strong><span class="template-kind">${resource.builtIn ? 'Built-in' : 'Customizado'}</span></div>
        <span>${esc(layoutSummary(contract))}</span>
        <small>${resource.builtIn ? 'Fonte imutável do aplicativo' : `${resource.versions.length} ${resource.versions.length === 1 ? 'versão publicada' : 'versões publicadas'}`} · ${useCount} ${useCount === 1 ? 'catálogo salvo usa' : 'catálogos salvos usam'} este recurso</small>
      </div>
      <div class="template-library-actions">
        <select data-template-version aria-label="Versão de ${esc(contract.name)}">${versionOptions(resource)}</select>
        ${resource.builtIn ? '' : '<button class="button secondary compact" type="button" data-template-edit>Editar</button>'}
        <button class="button secondary compact" type="button" data-template-duplicate>Duplicar</button>
        <button class="button primary compact" type="button" data-template-use>Usar no catálogo</button>
      </div>
    </article>`;
  }

  function selectOptions(values, selected) {
    return values.map(value => `<option value="${esc(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${esc(value)}</option>`).join('');
  }

  function editorMarkup() {
    if (!draft) return '';
    const creating = Number(draft.version) === 1 && !snapshot().templates.some(resource => resource.id === draft.id);
    return `<form class="card template-editor" id="templateEditorForm">
      <div class="template-editor-head"><div><p class="eyebrow">${creating ? 'NOVO TEMPLATE' : 'NOVA VERSÃO'}</p><h3>${creating ? 'Criar template customizado' : `Publicar ${esc(draft.id)}@${draft.version}`}</h3></div><button class="button secondary compact" type="button" data-template-cancel>Cancelar</button></div>
      <div class="template-editor-grid">
        <label>Nome<input id="templateDraftName" maxlength="120" required value="${esc(draft.name)}" /></label>
        <label class="template-editor-wide">Descrição<textarea id="templateDraftDescription" maxlength="500" rows="2" required>${esc(draft.description)}</textarea></label>
        <label>Colunas<select id="templateDraftColumns">${selectOptions([1,2,3], draft.layout.columns)}</select></label>
        <label>Linhas<select id="templateDraftRows">${selectOptions([1,2,3,4,5,6,7,8], draft.layout.rows)}</select></label>
        <label>Orientação do card<select id="templateDraftOrientation">${selectOptions(['horizontal','vertical'], draft.card.orientation)}</select></label>
        <label>Escala do card<select id="templateDraftScale">${selectOptions(['compact','standard','large'], draft.card.scale)}</select></label>
        <label>Escala visual<select id="templateDraftVisualScale">${selectOptions(['compact','standard','large'], draft.card.visualScale)}</select></label>
        <label>Escala de tabela<select id="templateDraftTableScale">${selectOptions(['compact','standard','large'], draft.card.tableScale)}</select></label>
        <label>Variações visíveis<input id="templateDraftBudgetVariants" type="number" min="0" max="24" value="${draft.card.contentBudget.variants}" /></label>
        <label>Linhas comerciais<input id="templateDraftBudgetRows" type="number" min="0" max="24" value="${draft.card.contentBudget.rows}" /></label>
        <label>Specs<input id="templateDraftBudgetSpecs" type="number" min="0" max="24" value="${draft.card.contentBudget.specs}" /></label>
        <label>Specs com tabela<input id="templateDraftBudgetSpecsTable" type="number" min="0" max="24" value="${draft.card.contentBudget.specsWithTable}" /></label>
        <label>Distribuição padrão<select id="templateDraftDistribution">${selectOptions(['compact','balanced','editorial'], draft.defaults.distribution)}</select></label>
        <label>Tipografia padrão<select id="templateDraftTypography">${selectOptions(['neutral','technical','editorial'], draft.defaults.typography)}</select></label>
      </div>
      <div class="template-editor-readonly"><strong>Herdado e bloqueado neste recorte</strong><span>A4 portrait · header/footer top-mobili-v1 · capabilities do contrato de origem.</span></div>
      <div class="template-editor-actions"><span>${esc(draft.id)}@${draft.version}</span><button class="button primary" type="submit">${creating ? 'Criar template' : 'Publicar nova versão'}</button></div>
    </form>`;
  }

  function render() {
    const TemplateStore = store();
    const ready = Boolean(TemplateStore);
    const current = snapshot();
    const rows = ready ? resourceRows() : [];
    const conflict = Boolean(TemplateStore?.hasConflict?.());
    root.innerHTML = `<div class="template-library-shell">
      <section class="card template-library-pane">
        <div class="library-toolbar"><div><strong>Templates</strong><span class="template-authority">${ready ? `authority r${TemplateStore.getRevision()}${TemplateStore.hasPendingWrite() ? ' · alterações locais' : ''}` : 'carregando authority…'}</span></div><span class="counter">${rows.length} recursos</span></div>
        ${conflict ? '<div class="template-conflict">Conflito de revisão. <button class="button secondary compact" type="button" data-template-reload>Recarregar</button></div>' : ''}
        <div class="template-library-list">${rows.map(resourceMarkup).join('')}</div>
        ${ready && !rows.length ? '<div class="empty-state"><strong>Nenhum template disponível.</strong></div>' : ''}
      </section>
      ${editorMarkup()}
    </div>`;
    bindRenderedEvents();
  }

  function selectedVersion(row) {
    return Number(row.querySelector('[data-template-version]')?.value || 1);
  }

  function readDraft() {
    const next = clone(draft);
    next.name = document.getElementById('templateDraftName').value.trim();
    next.description = document.getElementById('templateDraftDescription').value.trim();
    next.layout.columns = Number(document.getElementById('templateDraftColumns').value);
    next.layout.rows = Number(document.getElementById('templateDraftRows').value);
    next.card.orientation = document.getElementById('templateDraftOrientation').value;
    next.card.scale = document.getElementById('templateDraftScale').value;
    next.card.visualScale = document.getElementById('templateDraftVisualScale').value;
    next.card.tableScale = document.getElementById('templateDraftTableScale').value;
    next.card.contentBudget.variants = Number(document.getElementById('templateDraftBudgetVariants').value);
    next.card.contentBudget.rows = Number(document.getElementById('templateDraftBudgetRows').value);
    next.card.contentBudget.specs = Number(document.getElementById('templateDraftBudgetSpecs').value);
    next.card.contentBudget.specsWithTable = Number(document.getElementById('templateDraftBudgetSpecsTable').value);
    next.defaults.distribution = document.getElementById('templateDraftDistribution').value;
    next.defaults.typography = document.getElementById('templateDraftTypography').value;
    return next;
  }

  function useTemplate(id, version) {
    try {
      NS.Templates.resolve(id, version);
      NS.Core.mutate(state => {
        state.catalog.templateId = id;
        state.catalog.templateVersion = Number(version);
      });
      NS.App?.renderAll?.();
      NS.App?.switchTab?.('catalog');
    } catch (error) { alert(error.message || String(error)); }
  }

  function bindRenderedEvents() {
    root.querySelector('[data-template-reload]')?.addEventListener('click', async () => { await store()?.reloadRemote?.(); render(); });
    root.querySelector('[data-template-cancel]')?.addEventListener('click', () => { draft = null; render(); });
    root.querySelectorAll('[data-template-resource]').forEach(row => {
      const id = row.dataset.templateResource;
      row.querySelector('[data-template-duplicate]')?.addEventListener('click', () => {
        try { draft = store().duplicateAsDraft(id, selectedVersion(row)); render(); }
        catch (error) { alert(error.message || String(error)); }
      });
      row.querySelector('[data-template-edit]')?.addEventListener('click', () => {
        try { draft = store().editAsDraft(id); render(); }
        catch (error) { alert(error.message || String(error)); }
      });
      row.querySelector('[data-template-use]')?.addEventListener('click', () => useTemplate(id, selectedVersion(row)));
    });
    root.querySelector('#templateEditorForm')?.addEventListener('submit', async event => {
      event.preventDefault();
      try {
        const ok = await store().publishDraft(readDraft());
        if (ok) draft = null;
        render();
      } catch (error) { alert(error.message || String(error)); }
    });
  }

  function init() {
    render();
    window.addEventListener('catalogotop:templates-updated', render);
    window.addEventListener('catalogotop:catalogs-updated', render);
    window.addEventListener('catalogotop:library-provider-changed', event => { if (event.detail?.provider === 'templates') render(); });
  }

  Promise.resolve(NS.TemplatePersistenceReady).then(init).catch(() => init());
  NS.TemplateLibrary = Object.freeze({ render, getDraft: () => draft && clone(draft) });
})();
