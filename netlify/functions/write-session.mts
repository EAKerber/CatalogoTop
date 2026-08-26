import type { Config, Context } from '@netlify/functions';
import {
  hasWriteSession,
  issueWriteSession,
  json,
  makeSessionCookie,
  sameOriginOrNonBrowser,
  verifyAccessPhrase
} from '../lib/storage.mts';

export default async (request: Request, _context: Context) => {
  if (request.method === 'GET') {
    return json(
      { writable: await hasWriteSession(request) },
      200,
      { 'cache-control': 'no-store' }
    );
  }

  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { allow: 'GET, POST' });
  if (!sameOriginOrNonBrowser(request)) return json({ error: 'origin_rejected' }, 403);
  if (!request.headers.get('content-type')?.includes('application/json')) return json({ error: 'content_type_required' }, 415);

  let body: { phrase?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  if (!verifyAccessPhrase(String(body.phrase || ''))) return json({ error: 'invalid_phrase' }, 401);

  const ttlSeconds = 3600;
  const token = await issueWriteSession(ttlSeconds);
  return json(
    { ok: true, writable: true, expiresIn: ttlSeconds },
    200,
    { 'set-cookie': makeSessionCookie(token, ttlSeconds), 'cache-control': 'no-store' }
  );
};

export const config: Config = { path: '/api/write-session' };
