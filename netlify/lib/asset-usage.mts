import { hashFromManagedRef } from './asset-index-snapshot.mts';

export type AssetUsageRecord = {
  assetId: string;
  sha256: string;
  url: string;
  ownerType: 'product' | 'catalog';
  ownerId: string;
  ownerLabel: string;
  field: string;
  productId: string;
  variantId: string;
};

function usageKey(usage: AssetUsageRecord) {
  return [usage.assetId, usage.ownerType, usage.ownerId, usage.field, usage.productId, usage.variantId].join('|');
}

function pushUsage(target: AssetUsageRecord[], seen: Set<string>, value: unknown, detail: Omit<AssetUsageRecord, 'assetId' | 'sha256' | 'url'>) {
  const hash = hashFromManagedRef(value);
  if (!hash) return;
  const usage: AssetUsageRecord = {
    assetId: `sha256/${hash}`,
    sha256: hash,
    url: `/api/assets/sha256/${hash}`,
    ...detail
  };
  const key = usageKey(usage);
  if (seen.has(key)) return;
  seen.add(key);
  target.push(usage);
}

export function collectAssetUsages(products: unknown, catalogs: unknown) {
  const usages: AssetUsageRecord[] = [];
  const seen = new Set<string>();

  for (const rawProduct of Array.isArray(products) ? products : []) {
    if (!rawProduct || typeof rawProduct !== 'object' || Array.isArray(rawProduct)) continue;
    const product = rawProduct as Record<string, unknown>;
    const ownerId = String(product.id || '');
    const ownerLabel = [product.code, product.description].filter(Boolean).map(String).join(' · ') || ownerId;
    pushUsage(usages, seen, product.image, { ownerType: 'product', ownerId, ownerLabel, field: 'image', productId: '', variantId: '' });
    for (const rawEntry of Array.isArray(product.imageGallery) ? product.imageGallery : []) {
      const entry = rawEntry && typeof rawEntry === 'object' ? rawEntry as Record<string, unknown> : {};
      pushUsage(usages, seen, entry.image, { ownerType: 'product', ownerId, ownerLabel, field: 'imageGallery', productId: '', variantId: String(entry.id || '') });
    }
    for (const rawEntry of Array.isArray(product.variants) ? product.variants : []) {
      const entry = rawEntry && typeof rawEntry === 'object' ? rawEntry as Record<string, unknown> : {};
      pushUsage(usages, seen, entry.image, { ownerType: 'product', ownerId, ownerLabel, field: 'variants', productId: '', variantId: String(entry.id || '') });
    }
  }

  for (const rawRecord of Array.isArray(catalogs) ? catalogs : []) {
    if (!rawRecord || typeof rawRecord !== 'object' || Array.isArray(rawRecord)) continue;
    const record = rawRecord as Record<string, unknown>;
    const catalog = record.catalog && typeof record.catalog === 'object' && !Array.isArray(record.catalog) ? record.catalog as Record<string, unknown> : {};
    const presentation = catalog.presentation && typeof catalog.presentation === 'object' && !Array.isArray(catalog.presentation) ? catalog.presentation as Record<string, unknown> : {};
    const imageVariants = presentation.imageVariants && typeof presentation.imageVariants === 'object' && !Array.isArray(presentation.imageVariants)
      ? presentation.imageVariants as Record<string, unknown>
      : {};
    const ownerId = String(record.id || '');
    const ownerLabel = String(catalog.title || ownerId);
    for (const [productId, rawEntries] of Object.entries(imageVariants)) {
      for (const rawEntry of Array.isArray(rawEntries) ? rawEntries : []) {
        const entry = rawEntry && typeof rawEntry === 'object' ? rawEntry as Record<string, unknown> : {};
        pushUsage(usages, seen, entry.image, {
          ownerType: 'catalog', ownerId, ownerLabel, field: 'presentation.imageVariants', productId, variantId: String(entry.id || '')
        });
      }
    }
  }

  return usages;
}
