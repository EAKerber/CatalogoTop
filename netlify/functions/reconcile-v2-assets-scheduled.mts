import { createHash } from 'node:crypto';
import type { Config } from '@netlify/functions';
import {
  assetsStore,
  currentAssetIndexSnapshot,
  currentCatalogSnapshot,
  currentSnapshot
} from '../lib/storage.mts';
import { collectAssetUsages } from '../lib/asset-usage.mts';

declare const Netlify: {
  context?: { deploy?: { context?: string } };
};

const SOURCE_ORIGIN = 'https://topcatalogos.netlify.app';
const STAGE_PREFIX = '__asset_reconcile_stage/';

function targetHashes(products: unknown[], catalogs: unknown[], indexedAssets: unknown[]) {
  const result = new Set<string>();
  for (const usage of collectAssetUsages(products, catalogs)) result.add(usage.sha256);
  for (const raw of Array.isArray(indexedAssets) ? indexedAssets : []) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const hash = String((raw as Record<string, unknown>).sha256 || '').toLowerCase();
    if (/^[a-f0-9]{64}$/.test(hash)) result.add(hash);
  }
  return Array.from(result).sort();
}

async function stageFromV1(store: ReturnType<typeof assetsStore>, hash: string) {
  const response = await fetch(`${SOURCE_ORIGIN}/api/assets/sha256/${hash}`, { cache: 'no-store' });
  if (!response.ok) return null;
  const contentType = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!contentType.startsWith('image/')) return null;
  const data = await response.arrayBuffer();
  if (!data.byteLength) return null;
  const actual = createHash('sha256').update(Buffer.from(data)).digest('hex');
  if (actual !== hash) throw new Error(`source_hash_mismatch:${hash}:${actual}`);
  await store.set(`${STAGE_PREFIX}${hash}`, data, { metadata: { contentType, bytes: data.byteLength, source: 'v1' } });
  return true;
}

async function stageFromCurrentV2(store: ReturnType<typeof assetsStore>, hash: string) {
  const [data, meta] = await Promise.all([
    store.get(`sha256/${hash}`, { type: 'arrayBuffer' }),
    store.get(`meta/${hash}`, { type: 'json' })
  ]);
  if (!data) return null;
  const actual = createHash('sha256').update(Buffer.from(data)).digest('hex');
  if (actual !== hash) throw new Error(`v2_hash_mismatch:${hash}:${actual}`);
  const contentType = String(meta?.contentType || 'application/octet-stream');
  const createdAt = String(meta?.createdAt || '');
  await store.set(`${STAGE_PREFIX}${hash}`, data, { metadata: { contentType, bytes: data.byteLength, source: 'v2', createdAt } });
  return true;
}

async function reconcile() {
  const [productsSnapshot, catalogsSnapshot, assetIndexSnapshot] = await Promise.all([
    currentSnapshot(),
    currentCatalogSnapshot(),
    currentAssetIndexSnapshot()
  ]);
  const hashes = targetHashes(productsSnapshot.products, catalogsSnapshot.catalogs, assetIndexSnapshot.assets);
  const store = assetsStore();
  const recoveredFromV1: string[] = [];
  const preservedFromV2: string[] = [];
  const missing: string[] = [];

  for (const hash of hashes) {
    let staged = false;
    try {
      staged = Boolean(await stageFromV1(store, hash));
    } catch (error) {
      console.error('asset reconcile V1 source error', hash, error);
    }
    if (staged) {
      recoveredFromV1.push(hash);
      continue;
    }
    try {
      staged = Boolean(await stageFromCurrentV2(store, hash));
    } catch (error) {
      console.error('asset reconcile V2 fallback error', hash, error);
    }
    if (staged) preservedFromV2.push(hash);
    else missing.push(hash);
  }

  const before = await store.list({ directories: true });
  const deletions = before.blobs.filter(item => !item.key.startsWith(STAGE_PREFIX));
  for (const item of deletions) await store.delete(item.key);

  let restored = 0;
  for (const hash of [...recoveredFromV1, ...preservedFromV2]) {
    const staged = await store.getWithMetadata(`${STAGE_PREFIX}${hash}`, { type: 'arrayBuffer' });
    if (!staged?.data) continue;
    const contentType = String(staged.metadata?.contentType || 'application/octet-stream');
    const bytes = Number(staged.metadata?.bytes || staged.data.byteLength || 0);
    const createdAt = String(staged.metadata?.createdAt || '') || new Date().toISOString();
    await store.set(`sha256/${hash}`, staged.data);
    await store.setJSON(`meta/${hash}`, { contentType, bytes, createdAt });
    restored += 1;
  }

  for (const hash of [...recoveredFromV1, ...preservedFromV2]) {
    await store.delete(`${STAGE_PREFIX}${hash}`);
  }

  const after = await store.list({ directories: true });
  console.log('CATALOGOTOP_V2_ASSET_RECONCILE', JSON.stringify({
    targetHashes: hashes.length,
    recoveredFromV1: recoveredFromV1.length,
    preservedFromV2: preservedFromV2.length,
    missing,
    restored,
    beforeKeys: before.blobs.length,
    deletedKeys: deletions.length,
    finalKeys: after.blobs.length,
    productRevision: productsSnapshot.revision,
    catalogRevision: catalogsSnapshot.revision,
    assetIndexRevision: assetIndexSnapshot.revision
  }));
}

export default async (request: Request) => {
  if (Netlify.context?.deploy?.context !== 'production') return new Response(null, { status: 204 });
  const event = await request.json().catch(() => null) as { next_run?: string } | null;
  if (!event?.next_run) return new Response(null, { status: 204 });
  await reconcile();
  return new Response(null, { status: 204 });
};

export const config: Config = { schedule: '* * * * *' };
