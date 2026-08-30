import { createHash } from 'node:crypto';
import type { Config, Context } from '@netlify/functions';
import {
  MAX_ASSET_BYTES,
  assetsStore,
  currentSnapshot,
  hasWriteSession,
  json,
  sameOriginOrNonBrowser
} from '../lib/storage.mts';
import { fetchRemoteProductSource } from '../lib/remote-product-source.mts';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']);

function pathname(request: Request) {
  return new URL(request.url).pathname;
}

function hashFromPath(request: Request) {
  const match = pathname(request).match(/^\/api\/assets\/sha256\/([a-f0-9]{64})$/i);
  return match?.[1]?.toLowerCase() || '';
}

async function persistAsset(store: ReturnType<typeof assetsStore>, data: ArrayBuffer | Uint8Array, contentType: string) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const hash = createHash('sha256').update(Buffer.from(bytes)).digest('hex');
  const key = `sha256/${hash}`;
  const existing = await store.getMetadata(key);
  if (!existing) {
    await store.set(key, bytes);
    await store.setJSON(`meta/${hash}`, {
      contentType,
      bytes: bytes.byteLength,
      createdAt: new Date().toISOString()
    });
  }
  return {
    assetId: `sha256/${hash}`,
    url: `/api/assets/sha256/${hash}`,
    contentType,
    bytes: bytes.byteLength,
    deduplicated: Boolean(existing)
  };
}

async function materializeProductSource(request: Request, store: ReturnType<typeof assetsStore>) {
  if (!sameOriginOrNonBrowser(request)) return json({ error: 'origin_rejected' }, 403);
  if (!String(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
    return json({ error: 'content_type_required' }, 415);
  }
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  const productId = String(payload?.productId || '').trim();
  const sourceRef = String(payload?.sourceRef || '').trim();
  if (!productId || productId.length > 180 || !sourceRef || sourceRef.length > 2400) return json({ error: 'materialization_request_invalid' }, 400);

  const snapshot = await currentSnapshot();
  const product = (Array.isArray(snapshot.products) ? snapshot.products : [])
    .find(item => item && typeof item === 'object' && String((item as Record<string, unknown>).id || '') === productId) as Record<string, unknown> | undefined;
  if (!product) return json({ error: 'product_not_found' }, 404);
  const authorizedSource = String(product.image || '').trim();
  if (authorizedSource !== sourceRef) return json({ error: 'source_authority_changed' }, 409);
  if (!await hasWriteSession(request)) return json({ error: 'write_session_required' }, 401);

  try {
    const remote = await fetchRemoteProductSource(sourceRef, { maxBytes: MAX_ASSET_BYTES });
    const result = await persistAsset(store, remote.bytes, remote.contentType);
    return json({ ...result, finalUrl: remote.finalUrl }, result.deduplicated ? 200 : 201, { 'cache-control': 'no-store' });
  } catch (error) {
    const detail = String((error as Error)?.message || error);
    const rejected = /(?:forbidden|blocked|invalid|unsupported|mismatch|https-required|port-forbidden|credentials-forbidden)/.test(detail);
    return json({ error: rejected ? 'remote_source_rejected' : 'remote_source_unavailable', detail }, rejected ? 422 : 502, { 'cache-control': 'no-store' });
  }
}

export default async (request: Request, _context: Context) => {
  const store = assetsStore();
  const path = pathname(request);

  if (request.method === 'GET') {
    const hash = hashFromPath(request);
    if (!hash) return json({ error: 'asset_not_found' }, 404);
    const [data, meta] = await Promise.all([
      store.get(`sha256/${hash}`, { type: 'arrayBuffer' }),
      store.get(`meta/${hash}`, { type: 'json' })
    ]);
    if (!data) return json({ error: 'asset_not_found' }, 404);
    return new Response(data, {
      status: 200,
      headers: {
        'content-type': String(meta?.contentType || 'application/octet-stream'),
        'cache-control': 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff'
      }
    });
  }

  if (request.method === 'POST' && path === '/api/assets/materialize-product-source') {
    return materializeProductSource(request, store);
  }
  if (request.method !== 'POST' || path !== '/api/assets') return json({ error: 'method_not_allowed' }, 405, { allow: 'GET, POST' });
  if (!sameOriginOrNonBrowser(request)) return json({ error: 'origin_rejected' }, 403);
  if (!await hasWriteSession(request)) return json({ error: 'write_session_required' }, 401);

  const contentType = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!allowedTypes.has(contentType)) return json({ error: 'unsupported_image_type' }, 415);
  const length = Number(request.headers.get('content-length') || 0);
  if (length && length > MAX_ASSET_BYTES) return json({ error: 'asset_too_large' }, 413);

  const data = await request.arrayBuffer();
  if (!data.byteLength || data.byteLength > MAX_ASSET_BYTES) return json({ error: 'asset_too_large' }, 413);
  const result = await persistAsset(store, data, contentType);
  return json(result, result.deduplicated ? 200 : 201, { 'cache-control': 'no-store' });
};

export const config: Config = { path: ['/api/assets', '/api/assets/*'] };
