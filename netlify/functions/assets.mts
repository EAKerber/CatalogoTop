import { createHash } from 'node:crypto';
import type { Config, Context } from '@netlify/functions';
import {
  MAX_ASSET_BYTES,
  assetsStore,
  hasWriteSession,
  json,
  sameOriginOrNonBrowser
} from '../lib/storage.mts';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']);

function hashFromPath(request: Request) {
  const pathname = new URL(request.url).pathname;
  const match = pathname.match(/^\/api\/assets\/sha256\/([a-f0-9]{64})$/i);
  return match?.[1]?.toLowerCase() || '';
}

export default async (request: Request, _context: Context) => {
  const store = assetsStore();

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

  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { allow: 'GET, POST' });
  if (!sameOriginOrNonBrowser(request)) return json({ error: 'origin_rejected' }, 403);
  if (!hasWriteSession(request)) return json({ error: 'write_session_required' }, 401);

  const contentType = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!allowedTypes.has(contentType)) return json({ error: 'unsupported_image_type' }, 415);
  const length = Number(request.headers.get('content-length') || 0);
  if (length && length > MAX_ASSET_BYTES) return json({ error: 'asset_too_large' }, 413);

  const data = await request.arrayBuffer();
  if (!data.byteLength || data.byteLength > MAX_ASSET_BYTES) return json({ error: 'asset_too_large' }, 413);

  const hash = createHash('sha256').update(Buffer.from(data)).digest('hex');
  const key = `sha256/${hash}`;
  const existing = await store.getMetadata(key);
  if (!existing) {
    await store.set(key, data);
    await store.setJSON(`meta/${hash}`, {
      contentType,
      bytes: data.byteLength,
      createdAt: new Date().toISOString()
    });
  }

  return json({
    assetId: `sha256/${hash}`,
    url: `/api/assets/sha256/${hash}`,
    contentType,
    bytes: data.byteLength,
    deduplicated: Boolean(existing)
  }, existing ? 200 : 201, { 'cache-control': 'no-store' });
};

export const config: Config = { path: ['/api/assets', '/api/assets/*'] };
