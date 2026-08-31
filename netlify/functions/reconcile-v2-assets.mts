import { createHash, timingSafeEqual } from 'node:crypto';
import type { Config, Context } from '@netlify/functions';
import {
  assetsStore,
  currentAssetIndexSnapshot,
  currentCatalogSnapshot,
  currentSnapshot,
  json
} from '../lib/storage.mts';
import { collectAssetUsages } from '../lib/asset-usage.mts';

const TARGET_HOST = 'catalogotop-v2-test.netlify.app';
const SOURCE_ORIGIN = 'https://topcatalogos.netlify.app';
const STAGE_PREFIX = '__asset_reconcile_stage/';

function authorized(request: Request) {
  const expected = String(process.env.CATALOGOTOP_ASSET_RECONCILE_TOKEN || '');
  const provided = new URL(request.url).searchParams.get('token') || '';
  if (!expected || !provided) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  return left.length === right.length && timingSafeEqual(left, right);
}

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
  return { source: 'v1', contentType, bytes: data.byteLength, createdAt: '' };
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
  return { source: 'v2', contentType, bytes: data.byteLength, createdAt };
}

async function clearCanonicalStore(store: ReturnType<typeof assetsStore>) {
  const before = await store.list({ directories: true });
  const deletions = before.blobs.filter(item => !item.key.startsWith(STAGE_PREFIX));
  for (const item of deletions) await store.delete(item.key);
  return { beforeKeys: before.blobs.length, deletedKeys: deletions.length };
}

async function restoreStaged(store: ReturnType<typeof assetsStore>, hashes: string[]) {
  let restored = 0;
  for (const hash of hashes) {
    const staged = await store.getWithMetadata(`${STAGE_PREFIX}${hash}`, { type: 'arrayBuffer' });
    if (!staged?.data) continue;
    const contentType = String(staged.metadata?.contentType || 'application/octet-stream');
    const bytes = Number(staged.metadata?.bytes || staged.data.byteLength || 0);
    const createdAt = String(staged.metadata?.createdAt || '') || new Date().toISOString();
    await store.set(`sha256/${hash}`, staged.data);
    await store.setJSON(`meta/${hash}`, { contentType, bytes, createdAt });
    restored += 1;
  }
  for (const hash of hashes) await store.delete(`${STAGE_PREFIX}${hash}`);
  return restored;
}

export default async (request: Request, _context: Context) => {
  const url = new URL(request.url);
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, { allow: 'GET' });
  if (url.hostname !== TARGET_HOST) return json({ error: 'wrong_site' }, 403);
  if (!authorized(request)) return json({ error: 'unauthorized' }, 401);

  const [productsSnapshot, catalogsSnapshot, assetIndexSnapshot] = await Promise.all([
    currentSnapshot(),
    currentCatalogSnapshot(),
    currentAssetIndexSnapshot()
  ]);
  const hashes = targetHashes(productsSnapshot.products, catalogsSnapshot.catalogs, assetIndexSnapshot.assets);
  const store = assetsStore();
  const current = await store.list({ directories: true });

  if (url.searchParams.get('apply') !== '1') {
    return json({
      mode: 'plan',
      targetHashes: hashes.length,
      currentAssetKeys: current.blobs.length,
      productRevision: productsSnapshot.revision,
      catalogRevision: catalogsSnapshot.revision,
      assetIndexRevision: assetIndexSnapshot.revision
    }, 200, { 'cache-control': 'no-store' });
  }

  const staged: string[] = [];
  const recoveredFromV1: string[] = [];
  const preservedFromV2: string[] = [];
  const missing: string[] = [];

  for (const hash of hashes) {
    const fromV1 = await stageFromV1(store, hash).catch(error => {
      console.error('asset reconcile V1 source error', hash, error);
      return null;
    });
    if (fromV1) {
      staged.push(hash);
      recoveredFromV1.push(hash);
      continue;
    }
    const fromV2 = await stageFromCurrentV2(store, hash).catch(error => {
      console.error('asset reconcile V2 fallback error', hash, error);
      return null;
    });
    if (fromV2) {
      staged.push(hash);
      preservedFromV2.push(hash);
    } else {
      missing.push(hash);
    }
  }

  const cleared = await clearCanonicalStore(store);
  const restored = await restoreStaged(store, staged);
  const after = await store.list({ directories: true });

  return json({
    mode: 'applied',
    targetHashes: hashes.length,
    recoveredFromV1: recoveredFromV1.length,
    preservedFromV2: preservedFromV2.length,
    missing,
    restored,
    beforeKeys: cleared.beforeKeys,
    deletedKeys: cleared.deletedKeys,
    finalKeys: after.blobs.length,
    productRevision: productsSnapshot.revision,
    catalogRevision: catalogsSnapshot.revision,
    assetIndexRevision: assetIndexSnapshot.revision
  }, missing.length ? 207 : 200, { 'cache-control': 'no-store' });
};

export const config: Config = { path: '/api/internal/reconcile-v2-assets' };
