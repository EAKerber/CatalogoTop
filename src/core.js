(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const STORAGE_KEY = 'catalogotop:state:v1';
  const SCHEMA_VERSION = 1;

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

  function createInitialState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      products: [],
      selectedIds: [],
      catalog: {
        title: 'Categoria',
        templateId: 'technical',
        showPrices: true,
        createdAt: new Date().toISOString()
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

  function normalizeProduct(product) {
    return {
      id: product.id || uuid(),
      code: String(product.code || '').trim(),
      description: String(product.description || '').trim(),
      category: String(product.category || '').trim(),
      subcategory: String(product.subcategory || '').trim(),
      price: String(product.price || '').trim(),
      status: product.status === 'Inativo' ? 'Inativo' : 'Ativo',
      notes: String(product.notes || '').trim(),
      image: String(product.image || '').trim(),
      specs: normalizeSpecs(product.specs),
      updatedAt: product.updatedAt || new Date().toISOString()
    };
  }

  function migrate(raw) {
    if (!raw || typeof raw !== 'object') return createInitialState();
    const base = createInitialState();
    return {
      schemaVersion: SCHEMA_VERSION,
      products: Array.isArray(raw.products) ? raw.products.map(normalizeProduct).filter(p => p.code && p.description) : [],
      selectedIds: Array.isArray(raw.selectedIds) ? raw.selectedIds.map(String) : Array.isArray(raw.selected) ? raw.selected.map(String) : [],
      catalog: {
        title: String(raw.catalog?.title || raw.selectionName || base.catalog.title),
        templateId: ({ eletrica: 'technical', moveis: 'compact', promo: 'showcase' }[String(raw.catalog?.templateId || raw.currentTemplate || '')] || String(raw.catalog?.templateId || raw.currentTemplate || base.catalog.templateId)),
        showPrices: raw.catalog?.showPrices ?? raw.showPrices ?? true,
        createdAt: raw.catalog?.createdAt || base.catalog.createdAt
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Falha ao salvar estado:', error);
      throw new Error('Não foi possível salvar. O armazenamento do navegador pode estar cheio; imagens muito grandes são a causa mais comum.');
    }
  }

  function resetCatalog() {
    return mutate(draft => {
      draft.selectedIds = [];
      draft.catalog.createdAt = new Date().toISOString();
      draft.catalog.title = 'Categoria';
    });
  }

  function mergeProducts(incoming, mode = 'merge') {
    const normalized = incoming.map(normalizeProduct).filter(p => p.code && p.description);
    return mutate(draft => {
      if (mode === 'replace') {
        draft.products = normalized;
        draft.selectedIds = [];
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
    parseSpecsText,
    specsToText,
    createInitialState
  };
})();
