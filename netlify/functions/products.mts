import { randomUUID } from 'node:crypto';
import type { Config, Context } from '@netlify/functions';
import {
  MAX_PRODUCTS_BYTES,
  currentSnapshot,
  hasWriteSession,
  json,
  productsStore,
  sameOriginOrNonBrowser,
  validateProducts
} from '../lib/storage.mts';

export default async (request: Request, _context: Context) => {
  if (request.method === 'GET') {
    const snapshot = await currentSnapshot();
    return json(snapshot, 200, { 'cache-control': 'no-store' });
  }

  if (request.method !== 'PUT') return json({ error: 'method_not_allowed' }, 405, { allow: 'GET, PUT' });
  if (!sameOriginOrNonBrowser(request)) return json({ error: 'origin_rejected' }, 403);
  if (!await hasWriteSession(request)) return json({ error: 'write_session_required' }, 401);
  if (!request.headers.get('content-type')?.includes('application/json')) return json({ error: 'content_type_required' }, 415);
  const length = Number(request.headers.get('content-length') || 0);
  if (length && length > MAX_PRODUCTS_BYTES) return json({ error: 'payload_too_large' }, 413);

  let body: { expectedRevision?: number; products?: unknown[]; writeId?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const serializedSize = Buffer.byteLength(JSON.stringify(body));
  if (serializedSize > MAX_PRODUCTS_BYTES) return json({ error: 'payload_too_large' }, 413);

  const validationError = validateProducts(body.products);
  if (validationError) return json({ error: 'invalid_products', message: validationError }, 422);

  const current = await currentSnapshot();
  const expectedRevision = Number(body.expectedRevision);
  if (!Number.isInteger(expectedRevision) || expectedRevision !== current.revision) {
    return json({ error: 'revision_conflict', currentRevision: current.revision }, 409);
  }

  const next = {
    schemaVersion: 1,
    revision: current.revision + 1,
    updatedAt: new Date().toISOString(),
    writeId: String(body.writeId || randomUUID()),
    products: body.products || []
  };

  const store = productsStore();
  if (current.revision > 0) await store.setJSON(`history/${String(current.revision).padStart(8, '0')}`, current);
  await store.setJSON('current', next);

  const readback = await currentSnapshot();
  if (readback.writeId !== next.writeId) {
    await store.setJSON(`conflicts/${Date.now()}-${next.writeId}`, next);
    return json({ error: 'concurrent_write', currentRevision: readback.revision }, 409);
  }

  return json(readback, 200, { 'cache-control': 'no-store' });
};

export const config: Config = { path: '/api/products' };
