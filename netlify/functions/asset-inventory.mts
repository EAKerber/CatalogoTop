import type { Config, Context } from '@netlify/functions';
import { collectAssetUsages } from '../lib/asset-usage.mts';
import {
  assetsStore,
  currentAssetIndexSnapshot,
  currentCatalogSnapshot,
  currentSnapshot,
  json
} from '../lib/storage.mts';

type IndexRecord = {
  id: string;
  sha256: string;
  folderId?: string | null;
  label?: string;
  contentType?: string;
  bytes?: number;
  createdAt?: string;
  updatedAt?: string;
};

export default async (request: Request, _context: Context) => {
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, { allow: 'GET' });

  const [indexSnapshot, productSnapshot, catalogSnapshot] = await Promise.all([
    currentAssetIndexSnapshot(),
    currentSnapshot(),
    currentCatalogSnapshot()
  ]);

  const usages = collectAssetUsages(productSnapshot.products, catalogSnapshot.catalogs);
  const usesById = new Map<string, typeof usages>();
  for (const usage of usages) {
    const list = usesById.get(usage.assetId) || [];
    list.push(usage);
    usesById.set(usage.assetId, list);
  }

  const indexedById = new Map<string, IndexRecord>();
  for (const raw of Array.isArray(indexSnapshot.assets) ? indexSnapshot.assets : []) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const record = raw as IndexRecord;
    if (record.id && record.sha256) indexedById.set(record.id, record);
  }

  const ids = new Set<string>(indexedById.keys());
  for (const usage of usages) ids.add(usage.assetId);

  const store = assetsStore();
  const assets = await Promise.all(Array.from(ids).sort().map(async id => {
    const record = indexedById.get(id);
    const hash = String(record?.sha256 || id.replace(/^sha256\//, '')).toLowerCase();
    const [physical, technical] = await Promise.all([
      store.getMetadata(`sha256/${hash}`).catch(() => null),
      store.get(`meta/${hash}`, { type: 'json' }).catch(() => null) as Promise<Record<string, unknown> | null>
    ]);
    const assetUsages = usesById.get(id) || [];
    const fallbackLabel = assetUsages[0]?.ownerLabel || `Imagem ${hash.slice(0, 8)}`;
    return {
      id: `sha256/${hash}`,
      sha256: hash,
      url: `/api/assets/sha256/${hash}`,
      folderId: record?.folderId ?? null,
      label: String(record?.label || fallbackLabel),
      indexed: Boolean(record),
      contentType: String(technical?.contentType || record?.contentType || ''),
      bytes: Number(technical?.bytes ?? record?.bytes ?? 0) || 0,
      createdAt: String(technical?.createdAt || record?.createdAt || ''),
      updatedAt: String(record?.updatedAt || ''),
      available: Boolean(physical),
      usages: assetUsages
    };
  }));

  return json({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    assetIndexRevision: indexSnapshot.revision,
    productRevision: productSnapshot.revision,
    catalogRevision: catalogSnapshot.revision,
    assets
  }, 200, { 'cache-control': 'no-store' });
};

export const config: Config = { path: '/api/asset-inventory' };
