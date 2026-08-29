(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};

  const MAX_PRODUCT_GALLERY_IMAGES = 24;
  const MAX_CATALOG_IMAGE_VARIANTS = 24;
  const IMAGE_SELECTION_SOURCES = Object.freeze(['product', 'catalog']);

  function normalizeImageEntry(value, index, prefix) {
    const item = typeof value === 'string' ? { image: value } : (value && typeof value === 'object' ? value : {});
    const image = String(item.image || item.imageUrl || item.url || '').trim();
    if (!image) return null;
    const provenance = item.provenance && typeof item.provenance === 'object' && !Array.isArray(item.provenance)
      ? { ...item.provenance }
      : null;
    return {
      id: String(item.id || `${prefix}-${index + 1}`).trim() || `${prefix}-${index + 1}`,
      label: String(item.label || item.name || '').trim(),
      image,
      provenance
    };
  }

  function normalizeImageList(value, { prefix = 'image', limit = MAX_PRODUCT_GALLERY_IMAGES } = {}) {
    const source = Array.isArray(value) ? value.slice(0, limit) : [];
    const seen = new Set();
    const result = [];
    source.forEach((valueItem, index) => {
      const entry = normalizeImageEntry(valueItem, index, prefix);
      if (!entry) return;
      let id = entry.id;
      if (seen.has(id)) {
        let suffix = 1;
        id = `${prefix}-${index + 1}`;
        while (seen.has(id)) {
          suffix += 1;
          id = `${prefix}-${index + 1}-${suffix}`;
        }
      }
      seen.add(id);
      result.push({ ...entry, id });
    });
    return result;
  }

  function normalizeProductGallery(value) {
    return normalizeImageList(value, { prefix: 'image', limit: MAX_PRODUCT_GALLERY_IMAGES });
  }

  function normalizeCatalogImageVariants(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const result = {};
    Object.entries(value).forEach(([productId, entries]) => {
      const id = String(productId || '').trim();
      if (!id) return;
      const normalized = normalizeImageList(entries, { prefix: 'variant', limit: MAX_CATALOG_IMAGE_VARIANTS });
      if (normalized.length) result[id] = normalized;
    });
    return result;
  }

  function normalizeImageSelections(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const result = {};
    Object.entries(value).forEach(([productId, rawSelection]) => {
      const id = String(productId || '').trim();
      if (!id || !rawSelection || typeof rawSelection !== 'object' || Array.isArray(rawSelection)) return;
      const source = String(rawSelection.source || '').trim();
      const imageId = String(rawSelection.id || '').trim();
      if (!IMAGE_SELECTION_SOURCES.includes(source) || !imageId) return;
      result[id] = { source, id: imageId };
    });
    return result;
  }

  function imageSelectionFor(presentation, productId) {
    const id = String(productId || '');
    if (!id) return null;
    return normalizeImageSelections(presentation?.imageSelections)[id] || null;
  }

  function availableImages(product, presentation) {
    if (!product) return [];
    const productId = String(product.id || '');
    const result = [];
    const original = String(product.image || '').trim();
    if (original) result.push({ source: 'original', id: 'original', label: 'Original', image: original, provenance: null });
    normalizeProductGallery(product.imageGallery).forEach(entry => result.push({ ...entry, source: 'product' }));
    const catalogVariants = normalizeCatalogImageVariants(presentation?.imageVariants)[productId] || [];
    catalogVariants.forEach(entry => result.push({ ...entry, source: 'catalog' }));
    return result;
  }

  function resolveImage(product, presentation) {
    const original = {
      source: 'original',
      id: 'original',
      label: 'Original',
      image: String(product?.image || '').trim(),
      provenance: null,
      isFallback: false
    };
    if (!product) return original;
    const selection = imageSelectionFor(presentation, product.id);
    if (!selection) return original;
    const available = availableImages(product, presentation);
    const selected = available.find(entry => entry.source === selection.source && entry.id === selection.id);
    return selected ? { ...selected, isFallback: false } : { ...original, isFallback: true };
  }

  NS.ImageVariants = Object.freeze({
    MAX_PRODUCT_GALLERY_IMAGES,
    MAX_CATALOG_IMAGE_VARIANTS,
    IMAGE_SELECTION_SOURCES,
    normalizeImageList,
    normalizeProductGallery,
    normalizeCatalogImageVariants,
    normalizeImageSelections,
    imageSelectionFor,
    availableImages,
    resolveImage
  });

  const CONTENT_PRESETS = Object.freeze([
    { id: 'visual', name: 'Visual' },
    { id: 'essential', name: 'Essencial' },
    { id: 'standard', name: 'Padrão' },
    { id: 'detailed', name: 'Detalhado' },
    { id: 'technical', name: 'Técnico' },
    { id: 'commercial', name: 'Comercial' },
    { id: 'auto', name: 'Auto' }
  ]);

  const EMPHASIS_PRESETS = Object.freeze([
    { id: 'normal', name: 'Normal' },
    { id: 'feature', name: 'Destaque visual' }
  ]);

  const WIDTH_PRESETS = Object.freeze([
    { id: 'simple', name: 'Simples · 1 slot' },
    { id: 'wide', name: 'Largo · 2 slots' },
    { id: 'full', name: 'Linha inteira' }
  ]);

  const PRICE_STYLES = Object.freeze([
    { id: 'standard', name: 'Padrão' },
    { id: 'red', name: 'Vermelho' },
    { id: 'label', name: 'Etiqueta' },
    { id: 'block', name: 'Bloco' }
  ]);

  const DISTRIBUTIONS = Object.freeze([
    { id: 'compact', name: 'Compacta' },
    { id: 'balanced', name: 'Balanceada' },
    { id: 'editorial', name: 'Editorial' }
  ]);

  const TYPOGRAPHY_PRESETS = Object.freeze([
    { id: 'neutral', name: 'Neutra' },
    { id: 'technical', name: 'Técnica' },
    { id: 'editorial', name: 'Editorial' }
  ]);

  function normalizeChoice(value, allowed, fallback) {
    const text = String(value || '');
    return allowed.some(item => item.id === text) ? text : fallback;
  }

  function uniqueIds(values) {
    const seen = new Set();
    return (Array.isArray(values) ? values : []).map(String).filter(id => {
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function widthFromLegacySlots(value) {
    const slots = Number(value);
    if (!Number.isFinite(slots) || slots <= 1) return 'simple';
    if (slots === 2) return 'wide';
    return 'full';
  }

  function normalizeItemStyle(style) {
    const item = style && typeof style === 'object' ? style : {};
    const legacyHero = String(item.emphasis || '') === 'hero';
    const explicitWidth = item.width || item.layoutWidth || '';
    const widthFallback = legacyHero ? 'full' : (item.spanSlots != null ? widthFromLegacySlots(item.spanSlots) : 'simple');
    return {
      contentPreset: normalizeChoice(item.contentPreset, CONTENT_PRESETS, 'visual'),
      emphasis: normalizeChoice(legacyHero ? 'feature' : item.emphasis, EMPHASIS_PRESETS, 'normal'),
      width: normalizeChoice(explicitWidth, WIDTH_PRESETS, widthFallback),
      priceStyle: normalizeChoice(item.priceStyle, PRICE_STYLES, 'standard')
    };
  }

  function normalizeBlockShell(block) {
    if (!block || typeof block !== 'object') return null;
    return {
      ...block,
      id: String(block.id || ''),
      type: String(block.type || ''),
      memberIds: Array.isArray(block.memberIds) ? block.memberIds.map(String) : [],
      itemStyles: block.itemStyles && typeof block.itemStyles === 'object' ? { ...block.itemStyles } : undefined
    };
  }

  function normalizeBlocks(blocks) {
    return (Array.isArray(blocks) ? blocks : []).map(normalizeBlockShell).filter(Boolean);
  }

  function normalizeImageFrames(frames) {
    if (!frames || typeof frames !== 'object' || Array.isArray(frames)) return {};
    return Object.fromEntries(Object.entries(frames).map(([id, value]) => [String(id), value && typeof value === 'object' ? { ...value } : {}]));
  }

  function normalizePresentation(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const itemStyles = {};
    if (source.itemStyles && typeof source.itemStyles === 'object') {
      Object.entries(source.itemStyles).forEach(([id, style]) => {
        if (!id) return;
        itemStyles[String(id)] = normalizeItemStyle(style);
      });
    }
    return {
      distribution: normalizeChoice(source.distribution, DISTRIBUTIONS, 'balanced'),
      typography: normalizeChoice(source.typography, TYPOGRAPHY_PRESETS, 'neutral'),
      order: uniqueIds(source.order),
      itemStyles,
      blocks: normalizeBlocks(source.blocks),
      imageFrames: normalizeImageFrames(source.imageFrames),
      imageSelections: NS.ImageVariants.normalizeImageSelections(source.imageSelections),
      imageVariants: NS.ImageVariants.normalizeCatalogImageVariants(source.imageVariants)
    };
  }

  function styleFor(presentation, productId) {
    const normalized = normalizePresentation(presentation);
    return normalizeItemStyle(normalized.itemStyles[String(productId)]);
  }

  function resolveContentPreset(product, requested = 'visual') {
    const normalized = normalizeChoice(requested, CONTENT_PRESETS, 'visual');
    if (normalized !== 'auto') return normalized;
    const rows = Array.isArray(product?.tableRows) ? product.tableRows.length : 0;
    const specs = Array.isArray(product?.specs) ? product.specs.length : 0;
    const variants = Array.isArray(product?.variants) ? product.variants.length : 0;
    const variantImages = Array.isArray(product?.variants) ? product.variants.filter(item => item?.image).length : 0;
    if (rows >= 3 || specs >= 5) return 'technical';
    if (rows >= 1 || specs >= 3) return 'detailed';
    if (product?.price && rows === 0 && specs <= 1) return 'commercial';
    if ((variantImages >= 2 || variants >= 4) && rows === 0) return 'visual';
    return 'visual';
  }

  function templateSlotCount(template) {
    return Math.max(1, Math.min(3, Number(template?.columns) || 2));
  }

  function slotSpanFor(style, template) {
    const slots = templateSlotCount(template);
    if (style?.width === 'full') return slots;
    if (style?.width === 'wide') return Math.min(2, slots);
    return 1;
  }

  function microColumnsPerSlot(template) {
    return 6 / templateSlotCount(template);
  }

  function microSpanForSlots(slotSpan, template) {
    return Math.round(Math.max(1, Number(slotSpan) || 1) * microColumnsPerSlot(template));
  }

  function microStartForSlot(slotStart, template) {
    return Math.round((Math.max(1, Number(slotStart) || 1) - 1) * microColumnsPerSlot(template)) + 1;
  }

  function orderProductsForLayout(products) {
    return Array.isArray(products) ? products.slice() : [];
  }

  function packRows(products, template, presentation) {
    const normalizedPresentation = normalizePresentation(presentation);
    const orderedProducts = orderProductsForLayout(products);
    const slotsPerRow = templateSlotCount(template);
    const rows = [];
    let current = [];
    let usedSlots = 0;

    const flush = () => {
      if (!current.length) return;
      rows.push(current);
      current = [];
      usedSlots = 0;
    };

    orderedProducts.forEach(product => {
      const style = styleFor(normalizedPresentation, product.id);
      const slotSpan = slotSpanFor(style, template);
      const remainingSlots = slotsPerRow - usedSlots;
      if (current.length && slotSpan > remainingSlots) flush();
      const startSlot = usedSlots + 1;
      current.push({
        product,
        style,
        contentPreset: resolveContentPreset(product, style.contentPreset),
        width: style.width,
        slotSpan,
        startSlot,
        span: microSpanForSlots(slotSpan, template),
        row: rows.length + 1,
        start: microStartForSlot(startSlot, template)
      });
      usedSlots += slotSpan;
      if (usedSlots >= slotsPerRow) flush();
    });
    flush();
    rows.forEach((row, rowIndex) => row.forEach(item => { item.row = rowIndex + 1; }));
    return rows;
  }

  function planProducts(products, template, presentation) {
    const rows = packRows(products, template, presentation);
    return { rows, rowCount: rows.length, items: rows.flat(), slotsPerRow: templateSlotCount(template) };
  }

  function paginateProducts(products, template, presentation) {
    const maxRows = Math.max(1, Number(template?.rows) || 3);
    const ordered = orderProductsForLayout(products);
    const pages = [];
    let current = [];
    for (const product of ordered) {
      const candidate = current.concat(product);
      const candidatePlan = planProducts(candidate, template, presentation);
      if (current.length && candidatePlan.rowCount > maxRows) {
        pages.push({ products: current, layout: planProducts(current, template, presentation) });
        current = [product];
      } else {
        current = candidate;
      }
    }
    if (current.length) pages.push({ products: current, layout: planProducts(current, template, presentation) });
    return pages;
  }

  NS.Composition = {
    CONTENT_PRESETS,
    EMPHASIS_PRESETS,
    WIDTH_PRESETS,
    PRICE_STYLES,
    DISTRIBUTIONS,
    TYPOGRAPHY_PRESETS,
    uniqueIds,
    normalizeItemStyle,
    normalizeBlocks,
    normalizePresentation,
    styleFor,
    resolveContentPreset,
    templateSlotCount,
    slotSpanFor,
    microSpanForSlots,
    orderProductsForLayout,
    packRows,
    planProducts,
    paginateProducts
  };
})();