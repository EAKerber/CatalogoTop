(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const STORAGE_KEY = 'catalogotop:state:v1';
  const SCHEMA_VERSION = 5;

  const APP_CONFIG = Object.freeze({
    brandName: 'Top Mobili',
    location: 'Canoas - RS',
    whatsapp: '51 98977-6262',
    services: ['Qualidade', 'Estoque', 'Entrega rápida', 'Atendimento']
  });

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return `p-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function preservedBlocks(value) {
    const blocks = Array.isArray(value?.blocks) ? value.blocks : [];
    return blocks.map(block => ({
      ...block,
      memberIds: Array.isArray(block?.memberIds) ? block.memberIds.map(String) : [],
      itemStyles: block?.itemStyles && typeof block.itemStyles === 'object' ? { ...block.itemStyles } : {}
    }));
  }

  function uniqueIds(values) {
    const seen = new Set();
    return (Array.isArray(values) ? values : []).map(String).filter(id => {
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function normalizePresentation(value) {
    const normalized = NS.Composition?.normalizePresentation
      ? NS.Composition.normalizePresentation(value)
      : { distribution: 'balanced', typography: 'neutral', order: [], itemStyles: {}, blocks: [], imageFrames: {} };
    return {
      ...normalized,
      order: uniqueIds(normalized.order || value?.order),
      blocks: Array.isArray(normalized.blocks) ? normalized.blocks : preservedBlocks(value)
    };
  }

  function createInitialState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      products: [],
      selectedIds: [],
      catalog: {
        title: 'Categoria',
        templateId: 'technical',
        showPrices: true,
        createdAt: new Date().toISOString(),
        presentation: normalizePresentation({ order: [], blocks: [] })
      }
    };
  }

  function normalizeSpecs(specs) {
    if (Array.isArray(specs)) {
      return specs
        .map(item => typeof item === 'string' ? { label: '', value: item } : item)
        .filter(item => item && String(item.value || '').trim())
        .map(item => ({ label: String(item.label || '').trim(), value: String(item.value || '').trim() }));
    }
    if (typeof specs === 'string') return parseSpecsText(specs);
    return [];
  }

  function parseSpecsText(text) {
    return String(text || '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const index = line.indexOf(':');
        if (index < 0) return { label: '', value: line };
        return { label: line.slice(0, index).trim(), value: line.slice(index + 1).trim() };
      })
      .filter(item => item.value);
  }

  function specsToText(specs) {
    return normalizeSpecs(specs).map(item => item.label ? `${item.label}: ${item.value}` : item.value).join('\n');
  }

  function normalizeVariants(variants) {
    if (!Array.isArray(variants)) return [];
    return variants.slice(0, 12).map((variant, index) => {
      const item = typeof variant === 'string' ? { label: variant } : (variant || {});
      return {
        id: String(item.id || `variant-${index + 1}`),
        label: String(item.label || item.color || item.name || '').trim(),
        image: String(item.image || item.imageUrl || '').trim()
      };
    }).filter(item => item.label || item.image);
  }

  function parseVariantsText(text) {
    return normalizeVariants(String(text || '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const [label = '', image = ''] = line.split('|').map(part => part.trim());
        return { id: `variant-${index + 1}`, label, image };
      }));
  }

  function variantsToText(variants) {
    return normalizeVariants(variants)
      .map(item => item.image ? `${item.label} | ${item.image}` : item.label)
      .join('\n');
  }

  function normalizeTableRows(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.slice(0, 24).map((row, index) => {
      const item = row || {};
      return {
        id: String(item.id || `row-${index + 1}`),
        variant: String(item.variant || item.color || item.finish || '').trim(),
        code: String(item.code || item.sku || item.reference || '').trim(),
        package: String(item.package || item.packaging || '').trim(),
        price: String(item.price || '').trim()
      };
    }).filter(item => item.variant || item.code || item.package || item.price);
  }

  function parseTableRowsText(text) {
    return normalizeTableRows(String(text || '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const [variant = '', code = '', packageValue = '', price = ''] = line.split('|').map(part => part.trim());
        return { id: `row-${index + 1}`, variant, code, package: packageValue, price };
      }));
  }

  function tableRowsToText(rows) {
    return normalizeTableRows(rows)
      .map(item => [item.variant, item.code, item.package, item.price].join(' | ').replace(/(?:\s*\|\s*)+$/g, ''))
      .join('\n');
  }

  function normalizeProduct(product) {
    const category = String(product.category || '').trim() || 'Sem categoria';
    return {
      id: product.id || uuid(),
      code: String(product.code || '').trim(),
      description: String(product.description || '').trim(),
      category,
      subcategory: String(product.subcategory || '').trim(),
      price: String(product.price || '').trim(),
      status: product.status === 'Inativo' ? 'Inativo' : 'Ativo',
      notes: String(product.notes || '').trim(),
      image: String(product.image || '').trim(),
      specs: normalizeSpecs(product.specs),
      variants: normalizeVariants(product.variants),
      tableRows: normalizeTableRows(product.tableRows),
      updatedAt: product.updatedAt || new Date().toISOString()
    };
  }

  function migrate(raw) {
    if (!raw || typeof raw !== 'object') return createInitialState();
    const base = createInitialState();
    const products = Array.isArray(raw.products) ? raw.products.map(normalizeProduct).filter(p => p.code && p.description) : [];
    const selectedIds = uniqueIds(Array.isArray(raw.selectedIds) ? raw.selectedIds : Array.isArray(raw.selected) ? raw.selected : []);
    const rawPresentation = raw.catalog?.presentation && typeof raw.catalog.presentation === 'object' ? raw.catalog.presentation : {};
    const presentation = normalizePresentation({
      ...rawPresentation,
      order: Array.isArray(rawPresentation.order) ? rawPresentation.order : selectedIds
    });
    return {
      schemaVersion: SCHEMA_VERSION,
      products,
      selectedIds,
      catalog: {
        title: String(raw.catalog?.title || raw.selectionName || base.catalog.title),
        templateId: ({ eletrica: 'technical', moveis: 'compact', promo: 'showcase' }[String(raw.catalog?.templateId || raw.currentTemplate || '')] || String(raw.catalog?.templateId || raw.currentTemplate || base.catalog.templateId)),
        showPrices: raw.catalog?.showPrices ?? raw.showPrices ?? true,
        createdAt: raw.catalog?.createdAt || base.catalog.createdAt,
        presentation
      }
    };
  }

  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return migrate(raw);
    } catch (error) {
      console.warn('Falha ao ler estado local:', error);
      return createInitialState();
    }
  }

  let state = loadState();

  function getState() {
    return state;
  }

  function setState(nextState, { persist = true } = {}) {
    state = migrate(nextState);
    if (persist) saveState();
    return state;
  }

  function mutate(mutator) {
    const draft = typeof structuredClone === 'function' ? structuredClone(state) : JSON.parse(JSON.stringify(state));
    mutator(draft);
    return setState(draft);
  }

  function saveState() {
    try {
      const sessionOnly = {
        schemaVersion: state.schemaVersion,
        products: [],
        selectedIds: state.selectedIds,
        catalog: state.catalog
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionOnly));
    } catch (error) {
      console.error('Falha ao salvar estado da sessão:', error);
      throw new Error('Não foi possível salvar o estado local desta sessão.');
    }
  }

  function resetCatalog() {
    return mutate(draft => {
      draft.selectedIds = [];
      draft.catalog.createdAt = new Date().toISOString();
      draft.catalog.title = 'Categoria';
      draft.catalog.presentation = normalizePresentation({
        ...draft.catalog.presentation,
        order: [],
        itemStyles: {},
        blocks: []
      });
    });
  }

  function mergeProducts(incoming, mode = 'merge') {
    const normalized = incoming.map(normalizeProduct).filter(p => p.code && p.description);
    return mutate(draft => {
      if (mode === 'replace') {
        draft.products = normalized;
        draft.selectedIds = [];
        draft.catalog.presentation.order = [];
        draft.catalog.presentation.itemStyles = {};
        draft.catalog.presentation.blocks = [];
        return;
      }
      const byCode = new Map(draft.products.map((p, index) => [p.code.trim().toLowerCase(), index]));
      normalized.forEach(product => {
        const key = product.code.toLowerCase();
        const existingIndex = byCode.get(key);
        if (existingIndex === undefined) {
          byCode.set(key, draft.products.length);
          draft.products.push(product);
        } else {
          const existing = draft.products[existingIndex];
          draft.products[existingIndex] = {
            ...existing,
            ...product,
            id: existing.id,
            image: product.image || existing.image,
            variants: product.variants.length ? product.variants : existing.variants,
            tableRows: product.tableRows.length ? product.tableRows : existing.tableRows,
            updatedAt: new Date().toISOString()
          };
        }
      });
    });
  }

  NS.Core = {
    APP_CONFIG,
    SCHEMA_VERSION,
    STORAGE_KEY,
    uuid,
    getState,
    setState,
    mutate,
    resetCatalog,
    mergeProducts,
    normalizeProduct,
    normalizeVariants,
    normalizeTableRows,
    parseSpecsText,
    specsToText,
    parseVariantsText,
    variantsToText,
    parseTableRowsText,
    tableRowsToText,
    createInitialState,
    migrate
  };
})();