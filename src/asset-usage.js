(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const AssetIndexSnapshot = NS.AssetIndexSnapshot;
  if (!AssetIndexSnapshot) return;

  function usageKey(usage) {
    return [usage.assetId, usage.ownerType, usage.ownerId, usage.field, usage.productId || '', usage.variantId || ''].join('|');
  }

  function pushUsage(target, seen, value, detail) {
    const hash = AssetIndexSnapshot.hashFrom(value);
    if (!hash) return;
    const usage = {
      assetId: `sha256/${hash}`,
      sha256: hash,
      url: `/api/assets/sha256/${hash}`,
      ownerType: detail.ownerType,
      ownerId: String(detail.ownerId || ''),
      ownerLabel: String(detail.ownerLabel || ''),
      field: detail.field,
      productId: detail.productId == null ? '' : String(detail.productId),
      variantId: detail.variantId == null ? '' : String(detail.variantId)
    };
    const key = usageKey(usage);
    if (seen.has(key)) return;
    seen.add(key);
    target.push(usage);
  }

  function collect(products = [], catalogs = []) {
    const usages = [];
    const seen = new Set();

    (Array.isArray(products) ? products : []).forEach(product => {
      if (!product || typeof product !== 'object') return;
      const ownerId = String(product.id || '');
      const ownerLabel = [product.code, product.description].filter(Boolean).join(' · ') || ownerId;
      pushUsage(usages, seen, product.image, { ownerType: 'product', ownerId, ownerLabel, field: 'image' });
      (Array.isArray(product.imageGallery) ? product.imageGallery : []).forEach(entry => {
        pushUsage(usages, seen, entry?.image, { ownerType: 'product', ownerId, ownerLabel, field: 'imageGallery', variantId: entry?.id });
      });
      (Array.isArray(product.variants) ? product.variants : []).forEach(entry => {
        pushUsage(usages, seen, entry?.image, { ownerType: 'product', ownerId, ownerLabel, field: 'variants', variantId: entry?.id });
      });
    });

    (Array.isArray(catalogs) ? catalogs : []).forEach(record => {
      if (!record || typeof record !== 'object') return;
      const ownerId = String(record.id || '');
      const ownerLabel = String(record.catalog?.title || ownerId);
      const variants = record.catalog?.presentation?.imageVariants;
      if (!variants || typeof variants !== 'object' || Array.isArray(variants)) return;
      Object.entries(variants).forEach(([productId, entries]) => {
        (Array.isArray(entries) ? entries : []).forEach(entry => {
          pushUsage(usages, seen, entry?.image, {
            ownerType: 'catalog', ownerId, ownerLabel, field: 'presentation.imageVariants', productId, variantId: entry?.id
          });
        });
      });
    });

    return usages;
  }

  function inventory({ indexSnapshot, products = [], catalogs = [], physical = {} } = {}) {
    const snapshot = AssetIndexSnapshot.read(indexSnapshot || AssetIndexSnapshot.forWrite()).snapshot;
    const usages = collect(products, catalogs);
    const usesById = new Map();
    usages.forEach(usage => {
      const list = usesById.get(usage.assetId) || [];
      list.push(usage);
      usesById.set(usage.assetId, list);
    });
    const byId = new Map(snapshot.assets.map(record => [record.id, record]));
    usages.forEach(usage => {
      if (!byId.has(usage.assetId)) byId.set(usage.assetId, AssetIndexSnapshot.fromManaged(usage.url));
    });
    return Array.from(byId.values()).map(record => {
      const technical = physical[record.id] || physical[record.sha256] || {};
      const uses = usesById.get(record.id) || [];
      return {
        ...record,
        contentType: String(technical.contentType || record.contentType || ''),
        bytes: Number.isSafeInteger(Number(technical.bytes)) ? Number(technical.bytes) : record.bytes,
        createdAt: String(technical.createdAt || record.createdAt || ''),
        url: AssetIndexSnapshot.urlFrom(record.sha256),
        label: record.label || uses[0]?.ownerLabel || `Imagem ${record.sha256.slice(0, 8)}`,
        indexed: snapshot.assets.some(item => item.id === record.id),
        usages: uses
      };
    });
  }

  NS.AssetUsage = Object.freeze({ collect, inventory });
})();
