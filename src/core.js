(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const STORAGE_KEY = 'catalogotop:state:v1';
  const SCHEMA_VERSION = 8;

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

  function normalizeQuantityPrice(value) {
    if (!value || typeof value !== 'object') return null;
    const minQuantity = Number(value.minQuantity ?? value.quantity ?? value.minimumQuantity);
    const parsed = parseMoney(value.price ?? value.value);
    if (!Number.isSafeInteger(minQuantity) || minQuantity < 2 || !parsed.ok || parsed.empty) return null;
    return { minQuantity, price: parsed.canonical };
  }

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return `p-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function folderUuid() {
    return `folder-${uuid()}`;
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
      : { distribution: 'balanced', typography: 'neutral', order: [], itemStyles: {}, blocks: [], imageFrames: {}, imageSelections: {}, imageVariants: {} };
    const retired = NS.V1Retirement?.cleanPresentation
      ? NS.V1Retirement.cleanPresentation(normalized)
      : normalized;
    return {
      ...retired,
      order: uniqueIds(retired.order || value?.order),
      blocks: Array.isArray(retired.blocks) ? retired.blocks : preservedBlocks(value)
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
      folders: [],
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

  function normalizeImageGallery(value) {
    return NS.ImageVariants?.normalizeProductGallery ? NS.ImageVariants.normalizeProductGallery(value) : [];
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
        price: normalizeMoney(item.price),
        quantityPrice: normalizeQuantityPrice(item.quantityPrice)
      };
    }).filter(item => item.variant || item.code || item.package || item.price || item.quantityPrice);
  }

  function parseTableRowsText(text) {
    return normalizeTableRows(String(text || '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const [variant = '', code = '', packageValue = '', price = '', minQuantity = '', quantityPrice = ''] = line.split('|').map(part => part.trim());
        return {
          id: `row-${index + 1}`,
          variant,
          code,
          package: packageValue,
          price,
          quantityPrice: minQuantity || quantityPrice ? { minQuantity, price: quantityPrice } : null
        };
      }));
  }

  function tableRowsToText(rows) {
    return normalizeTableRows(rows)
      .map(item => [
        item.variant,
        item.code,
        item.package,
        item.price,
        item.quantityPrice?.minQuantity || '',
        item.quantityPrice?.price || ''
      ].join(' | ').replace(/(?:\s*\|\s*)+$/g, ''))
      .join('\n');
  }

  function normalizeProduct(product) {
    const category = String(product.category || '').trim() || 'Sem categoria';
    return {
      id: product.id || uuid(),
      folderId: String(product.folderId || '').trim(),
      code: String(product.code || '').trim(),
      description: String(product.description || '').trim(),
      category,
      subcategory: String(product.subcategory || '').trim(),
      price: normalizeMoney(product.price),
      quantityPrice: normalizeQuantityPrice(product.quantityPrice),
      status: product.status === 'Inativo' ? 'Inativo' : 'Ativo',
      notes: String(product.notes || '').trim(),
      image: String(product.image || '').trim(),
      imageGallery: normalizeImageGallery(product.imageGallery),
      specs: normalizeSpecs(product.specs),
      variants: normalizeVariants(product.variants),
      tableRows: normalizeTableRows(product.tableRows),
      updatedAt: product.updatedAt || new Date().toISOString()
    };
  }

  function normalizeOrganization(raw, productInputs) {
    const ProductSnapshot = NS.ProductSnapshot;
    if (!ProductSnapshot) return { folders: [], products: productInputs };
    const explicitV2 = Number(raw?.schemaVersion) >= SCHEMA_VERSION || Object.prototype.hasOwnProperty.call(raw || {}, 'folders');
    const result = explicitV2
      ? ProductSnapshot.read({ schemaVersion: 2, folders: raw?.folders || [], products: productInputs })
      : ProductSnapshot.read({ schemaVersion: 1, products: productInputs });
    return result.snapshot;
  }

  function migrate(raw) {
    if (!raw || typeof raw !== 'object') return createInitialState();
    const base = createInitialState();
    const productInputs = Array.isArray(raw.products) ? raw.products.map(normalizeProduct).filter(p => p.code && p.description) : [];
    const organization = normalizeOrganization(raw, productInputs);
    const products = organization.products.map(normalizeProduct).filter(p => p.code && p.description);
    const selectedIds = uniqueIds(Array.isArray(raw.selectedIds) ? raw.selectedIds : Array.isArray(raw.selected) ? raw.selected : []);
    const rawPresentation = raw.catalog?.presentation && typeof raw.catalog.presentation === 'object' ? raw.catalog.presentation : {};
    const presentation = normalizePresentation({
      ...rawPresentation,
      order: Array.isArray(rawPresentation.order) ? rawPresentation.order : selectedIds
    });
    const dateOverride = NS.CatalogDate?.normalizeOverride?.(raw.catalog?.dateOverride) || '';
    return {
      schemaVersion: SCHEMA_VERSION,
      folders: organization.folders || [],
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
        folders: [],
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
        blocks: [],
        imageSelections: {},
        imageVariants: {}
      });
    });
  }

  function assignProductToLegacyPath(draft, product) {
    const normalized = normalizeProduct(product);
    if (!NS.ProductSnapshot) return normalized;

    if (normalized.folderId && NS.ProductFolderMigration) {
      try {
        const projection = NS.ProductFolderMigration.projectLegacyForFolder(draft.folders || [], normalized.folderId);
        if (projection.category === normalized.category && projection.subcategory === normalized.subcategory) {
          return normalizeProduct({ ...normalized, ...projection });
        }
      } catch (error) {
        if (error?.code !== 'folder_not_found') throw error;
      }
    }

    const assigned = NS.ProductSnapshot.assignLegacyProduct(draft.folders || [], normalized, { idFactory: folderUuid });
    draft.folders = assigned.folders;
    return normalizeProduct(assigned.product);
  }

  function mergeProducts(incoming, mode = 'merge') {
    const source = Array.isArray(incoming) ? incoming : [];
    const explicitQuantityByCode = new Set(source
      .filter(product => product && Object.prototype.hasOwnProperty.call(product, 'quantityPrice'))
      .map(product => String(product.code || '').trim().toLowerCase())
      .filter(Boolean));
    const explicitGalleryByCode = new Set(source
      .filter(product => product && Object.prototype.hasOwnProperty.call(product, 'imageGallery'))
      .map(product => String(product.code || '').trim().toLowerCase())
      .filter(Boolean));
    const normalized = source.map(normalizeProduct).filter(p => p.code && p.description);
    return mutate(draft => {
      const prepared = normalized.map(product => assignProductToLegacyPath(draft, product));
      if (mode === 'replace') {
        draft.products = prepared;
        draft.selectedIds = [];
        draft.catalog.presentation.order = [];
        draft.catalog.presentation.itemStyles = {};
        draft.catalog.presentation.blocks = [];
        draft.catalog.presentation.imageSelections = {};
        draft.catalog.presentation.imageVariants = {};
        return;
      }
      const byCode = new Map(draft.products.map((p, index) => [p.code.trim().toLowerCase(), index]));
      prepared.forEach(product => {
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
            imageGallery: explicitGalleryByCode.has(key) ? product.imageGallery : existing.imageGallery,
            quantityPrice: explicitQuantityByCode.has(key) ? product.quantityPrice : existing.quantityPrice,
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
    assignProductToLegacyPath,
    normalizeProduct,
    normalizeQuantityPrice,
    normalizeVariants,
    normalizeImageGallery,
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
