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

  function moneyFailure(raw, reason) {
    return { ok: false, empty: false, cents: null, canonical: String(raw || '').trim(), raw: String(raw || '').trim(), reason };
  }

  function validGroupedInteger(value, separator) {
    if (!separator || !value.includes(separator)) return /^\d+$/.test(value);
    const groups = value.split(separator);
    return /^\d{1,3}$/.test(groups[0] || '') && groups.slice(1).every(group => /^\d{3}$/.test(group));
  }

  function formatMoneyCents(cents) {
    const value = Number(cents);
    if (!Number.isSafeInteger(value) || value < 0) return '';
    const integer = Math.floor(value / 100);
    const fraction = String(value % 100).padStart(2, '0');
    const grouped = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0, useGrouping: true }).format(integer);
    return `R$ ${grouped},${fraction}`;
  }

  function parseMoney(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return { ok: true, empty: true, cents: null, canonical: '', raw: '' };

    let text = raw.replace(/[\u00a0\u202f]/g, ' ').trim();
    if (/^R\$/i.test(text)) text = text.replace(/^R\$\s*/i, '');
    if (!text || !/^\d[\d\s.,]*$/.test(text)) return moneyFailure(raw, 'Formato monetário não reconhecido.');
    text = text.replace(/\s+/g, '');

    const dotCount = (text.match(/\./g) || []).length;
    const commaCount = (text.match(/,/g) || []).length;
    let integerDigits = '';
    let fractionDigits = '00';

    if (dotCount && commaCount) {
      const decimalSeparator = text.lastIndexOf('.') > text.lastIndexOf(',') ? '.' : ',';
      const groupSeparator = decimalSeparator === '.' ? ',' : '.';
      const decimalCount = decimalSeparator === '.' ? dotCount : commaCount;
      if (decimalCount !== 1) return moneyFailure(raw, 'Separadores monetários ambíguos.');
      const index = text.lastIndexOf(decimalSeparator);
      const integerPart = text.slice(0, index);
      const fractionPart = text.slice(index + 1);
      if (!/^\d{1,2}$/.test(fractionPart) || !validGroupedInteger(integerPart, groupSeparator)) {
        return moneyFailure(raw, 'Formato monetário não reconhecido.');
      }
      integerDigits = integerPart.replaceAll(groupSeparator, '');
      fractionDigits = fractionPart.padEnd(2, '0');
    } else if (dotCount || commaCount) {
      const separator = dotCount ? '.' : ',';
      const count = dotCount || commaCount;
      const parts = text.split(separator);
      if (count === 1) {
        const [integerPart, tail = ''] = parts;
        if (!/^\d+$/.test(integerPart) || !/^\d+$/.test(tail)) return moneyFailure(raw, 'Formato monetário não reconhecido.');
        if (tail.length === 1 || tail.length === 2) {
          integerDigits = integerPart;
          fractionDigits = tail.padEnd(2, '0');
        } else if (tail.length === 3 && /^\d{1,3}$/.test(integerPart)) {
          integerDigits = `${integerPart}${tail}`;
        } else {
          return moneyFailure(raw, 'Formato monetário não reconhecido.');
        }
      } else {
        if (!/^\d{1,3}$/.test(parts[0] || '') || !parts.slice(1).every(part => /^\d{3}$/.test(part))) {
          return moneyFailure(raw, 'Formato monetário não reconhecido.');
        }
        integerDigits = parts.join('');
      }
    } else {
      if (!/^\d+$/.test(text)) return moneyFailure(raw, 'Formato monetário não reconhecido.');
      integerDigits = text;
    }

    const integer = Number(integerDigits);
    const fraction = Number(fractionDigits);
    if (!Number.isSafeInteger(integer) || integer < 0 || !Number.isInteger(fraction) || fraction < 0 || fraction > 99) {
      return moneyFailure(raw, 'Valor monetário fora do intervalo suportado.');
    }
    const cents = integer * 100 + fraction;
    if (!Number.isSafeInteger(cents)) return moneyFailure(raw, 'Valor monetário fora do intervalo suportado.');
    return { ok: true, empty: false, cents, canonical: formatMoneyCents(cents), raw };
  }

  function normalizeMoney(value) {
    const parsed = parseMoney(value);
    return parsed.ok ? parsed.canonical : String(value ?? '').trim();
  }

  NS.Money = Object.freeze({
    parse: parseMoney,
    normalize: normalizeMoney,
    formatBRL: normalizeMoney,
    formatCents: formatMoneyCents,
    isValid(value, { allowEmpty = true } = {}) {
      const parsed = parseMoney(value);
      return parsed.ok && (allowEmpty || !parsed.empty);
    }
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

  function effectiveCatalogDateIso(dateOverride = '') {
    if (NS.CatalogDate?.effectiveIso) return NS.CatalogDate.effectiveIso({ dateOverride });
    if (dateOverride) return new Date(`${dateOverride}T12:00:00`).toISOString();
    return new Date().toISOString();
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
        dateOverride: '',
        createdAt: effectiveCatalogDateIso(''),
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
        price: normalizeMoney(item.price)
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
      price: normalizeMoney(product.price),
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
    const dateOverride = NS.CatalogDate?.normalizeOverride?.(raw.catalog?.dateOverride) || '';
    return {
      schemaVersion: SCHEMA_VERSION,
      products,
      selectedIds,
      catalog: {
        title: String(raw.catalog?.title || raw.selectionName || base.catalog.title),
        templateId: ({ eletrica: 'technical', moveis: 'compact', promo: 'showcase' }[String(raw.catalog?.templateId || raw.currentTemplate || '')] || String(raw.catalog?.templateId || raw.currentTemplate || base.catalog.templateId)),
        showPrices: raw.catalog?.showPrices ?? raw.showPrices ?? true,
        dateOverride,
        createdAt: effectiveCatalogDateIso(dateOverride),
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
      draft.catalog.dateOverride = '';
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