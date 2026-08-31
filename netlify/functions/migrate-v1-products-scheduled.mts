import { createHash, randomUUID } from 'node:crypto';
import type { Config } from '@netlify/functions';
import { PRODUCT_SNAPSHOT_VERSION } from '../lib/product-folders.mts';
import {
  assetsStore,
  currentSnapshot,
  productsStore,
  validateProductSnapshot
} from '../lib/storage.mts';

declare const Netlify: {
  context?: { deploy?: { context?: string } };
};

const SOURCE = 'https://topcatalogos.netlify.app';
const MARKER = 'ops/v1-to-v2-product-import-2026-08-31';
const PATH_SEPARATOR = '\u001f';
const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;
const ID_PREFIX = 'pf1-';
const MIGRATION_NAMESPACE = 'product-folders-v1';

function displayName(value: unknown) {
  return String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
}

function nameKey(value: unknown) {
  return displayName(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function fnv1a64(text: string) {
  let hash = FNV_OFFSET;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash.toString(16).padStart(16, '0');
}

function deterministicFolderId(keys: string[]) {
  const canonical = `${MIGRATION_NAMESPACE}\u0000${keys.join(PATH_SEPARATOR)}`;
  return `${ID_PREFIX}${fnv1a64(`a\u0000${canonical}`)}${fnv1a64(`b\u0000${canonical}`)}`;
}

function legacyPath(product: Record<string, unknown>) {
  const category = displayName(product.category) || 'Sem categoria';
  // R1 compatibility invariant: historical subcategory strings containing '/' are one legacy segment.
  const subcategory = displayName(product.subcategory);
  return subcategory ? [category, subcategory] : [category];
}

function migrateLegacyProducts(rawProducts: unknown[]) {
  const products = rawProducts.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`invalid_v1_product:${index}`);
    return { ...(raw as Record<string, unknown>) };
  });

  const records = new Map<string, { segments: string[]; keys: string[] }>();
  const paths = products.map(product => legacyPath(product));

  for (const path of paths) {
    for (let depth = 1; depth <= path.length; depth += 1) {
      const segments = path.slice(0, depth);
      const keys = segments.map(nameKey);
      const key = keys.join(PATH_SEPARATOR);
      if (!records.has(key)) records.set(key, { segments, keys });
    }
  }

  const sorted = Array.from(records.entries()).sort((a, b) => {
    const depth = a[1].keys.length - b[1].keys.length;
    return depth || a[0].localeCompare(b[0]);
  });

  const folders = sorted.map(([, record]) => {
    const parentKeys = record.keys.slice(0, -1);
    return {
      id: deterministicFolderId(record.keys),
      parentId: parentKeys.length ? deterministicFolderId(parentKeys) : null,
      name: record.segments[record.segments.length - 1]
    };
  });

  const folderIdByPath = new Map(sorted.map(([key, record]) => [key, deterministicFolderId(record.keys)]));
  const migratedProducts = products.map((product, index) => {
    const path = paths[index];
    const folderId = folderIdByPath.get(path.map(nameKey).join(PATH_SEPARATOR));
    if (!folderId) throw new Error(`folder_resolution_failed:${index}`);
    return {
      ...product,
      folderId,
      category: path[0] || 'Sem categoria',
      subcategory: path.slice(1).join(' / ')
    };
  });

  return { folders, products: migratedProducts };
}

function managedHashes(products: Record<string, unknown>[]) {
  const hashes = new Set<string>();
  const inspect = (value: unknown) => {
    const match = String(value || '').trim().match(/^\/api\/assets\/sha256\/([a-f0-9]{64})$/i);
    if (match) hashes.add(match[1].toLowerCase());
  };
  for (const product of products) {
    inspect(product.image);
    for (const raw of Array.isArray(product.imageGallery) ? product.imageGallery : []) {
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) inspect((raw as Record<string, unknown>).image);
    }
    for (const raw of Array.isArray(product.variants) ? product.variants : []) {
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) inspect((raw as Record<string, unknown>).image);
    }
  }
  return Array.from(hashes).sort();
}

async function clearV2Assets() {
  const store = assetsStore();
  const listed = await store.list({ directories: true });
  for (const item of listed.blobs) await store.delete(item.key);
  return listed.blobs.length;
}

async function copyManagedAssets(hashes: string[]) {
  const store = assetsStore();
  const copied: string[] = [];
  const missing: string[] = [];
  for (const hash of hashes) {
    const response = await fetch(`${SOURCE}/api/assets/sha256/${hash}`, { cache: 'no-store' });
    if (!response.ok) {
      missing.push(hash);
      continue;
    }
    const data = await response.arrayBuffer();
    const actual = createHash('sha256').update(Buffer.from(data)).digest('hex');
    if (actual !== hash) throw new Error(`asset_hash_mismatch:${hash}:${actual}`);
    const contentType = String(response.headers.get('content-type') || 'application/octet-stream').split(';', 1)[0].trim().toLowerCase();
    await store.set(`sha256/${hash}`, data);
    await store.setJSON(`meta/${hash}`, { contentType, bytes: data.byteLength, createdAt: new Date().toISOString() });
    copied.push(hash);
  }
  return { copied, missing };
}

async function migrate() {
  const store = productsStore();
  const marker = await store.get(MARKER, { type: 'json' }) as Record<string, unknown> | null;
  if (marker?.completed) {
    console.log('CATALOGOTOP_V1_TO_V2_IMPORT already_complete', JSON.stringify(marker));
    return;
  }

  const response = await fetch(`${SOURCE}/api/products`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`v1_products_fetch_failed:${response.status}`);
  const source = await response.json() as Record<string, unknown>;
  if (Number(source.schemaVersion || 1) !== 1 || !Array.isArray(source.products)) {
    throw new Error(`unexpected_v1_snapshot:${String(source.schemaVersion)}`);
  }

  const migrated = migrateLegacyProducts(source.products);
  const validation = validateProductSnapshot(migrated.folders, migrated.products);
  if (validation) throw new Error(`migrated_snapshot_invalid:${validation}`);

  const hashes = managedHashes(migrated.products);
  const deletedAssetKeys = await clearV2Assets();
  const assetCopy = await copyManagedAssets(hashes);
  if (assetCopy.missing.length) throw new Error(`managed_assets_missing:${assetCopy.missing.join(',')}`);

  const current = await currentSnapshot();
  const next = {
    schemaVersion: PRODUCT_SNAPSHOT_VERSION,
    revision: current.revision + 1,
    updatedAt: new Date().toISOString(),
    writeId: `v1-import-${randomUUID()}`,
    folders: migrated.folders,
    products: migrated.products
  };

  if (current.revision > 0) await store.setJSON(`history/${String(current.revision).padStart(8, '0')}`, current);
  await store.setJSON('current', next);
  const readback = await currentSnapshot();
  if (readback.writeId !== next.writeId) throw new Error(`product_readback_mismatch:${readback.writeId}`);

  const result = {
    completed: true,
    completedAt: new Date().toISOString(),
    sourceRevision: Number(source.revision || 0),
    sourceProducts: source.products.length,
    targetRevision: readback.revision,
    targetProducts: readback.products.length,
    targetFolders: Array.isArray(readback.folders) ? readback.folders.length : 0,
    managedAssets: hashes.length,
    copiedManagedAssets: assetCopy.copied.length,
    deletedPriorAssetKeys: deletedAssetKeys
  };
  await store.setJSON(MARKER, result);
  console.log('CATALOGOTOP_V1_TO_V2_IMPORT', JSON.stringify(result));
}

export default async (request: Request) => {
  if (Netlify.context?.deploy?.context !== 'production') return new Response(null, { status: 204 });
  const event = await request.json().catch(() => null) as { next_run?: string } | null;
  if (!event?.next_run) return new Response(null, { status: 204 });
  await migrate();
  return new Response(null, { status: 204 });
};

export const config: Config = { schedule: '* * * * *' };
