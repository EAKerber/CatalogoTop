import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { getDeployStore, getStore } from '@netlify/blobs';

declare const Netlify: {
  context?: { deploy?: { context?: string } };
};

export const SESSION_COOKIE = 'catalogotop_write';
export const PRODUCT_STORE = 'catalogotop-products';
export const ASSET_STORE = 'catalogotop-assets';
export const SESSION_STORE = 'catalogotop-sessions';
export const MAX_PRODUCTS_BYTES = 3_000_000;
export const MAX_ASSET_BYTES = 6_000_000;

// Verificador público da frase compartilhada. A frase em si nunca entra no código.
// Como a frase gerada tem alta entropia, manter apenas o scrypt verifier no repo
// evita depender de secrets/env vars para o bootstrap do pequeno app interno.
const ACCESS_PHRASE_SCRYPT = 'scrypt$16384$8$1$cA6iGPNH7ZJb8kK_TfSHxQ$NLnD8tXtJTr67OvFoj0_m7c79bekQg2XTaXp37cI-O10Y8E1qYWeuzR5-8u_KW_GSAh-GGn9w7yt691A6s_JuA';

export type ProductSnapshot = {
  schemaVersion: number;
  revision: number;
  updatedAt: string;
  writeId: string;
  products: unknown[];
};

type WriteSession = {
  exp: number;
  createdAt: string;
};

function isProduction() {
  return Netlify.context?.deploy?.context === 'production';
}

export function productsStore() {
  return isProduction()
    ? getStore(PRODUCT_STORE, { consistency: 'strong' })
    : getDeployStore(PRODUCT_STORE);
}

export function assetsStore() {
  return isProduction()
    ? getStore(ASSET_STORE, { consistency: 'strong' })
    : getDeployStore(ASSET_STORE);
}

export function sessionsStore() {
  return isProduction()
    ? getStore(SESSION_STORE, { consistency: 'strong' })
    : getDeployStore(SESSION_STORE);
}

export function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers }
  });
}

export function sameOriginOrNonBrowser(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function parseCookies(request: Request) {
  const result = new Map<string, string>();
  const header = request.headers.get('cookie') || '';
  for (const segment of header.split(';')) {
    const index = segment.indexOf('=');
    if (index <= 0) continue;
    result.set(segment.slice(0, index).trim(), segment.slice(index + 1).trim());
  }
  return result;
}

function sessionKey(token: string) {
  return `sha256/${createHash('sha256').update(token).digest('hex')}`;
}

export async function issueWriteSession(ttlSeconds = 3600) {
  const token = randomBytes(32).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const record: WriteSession = {
    exp: now + ttlSeconds,
    createdAt: new Date().toISOString()
  };
  await sessionsStore().setJSON(sessionKey(token), record);
  return token;
}

export function makeSessionCookie(token: string, ttlSeconds = 3600) {
  return `${SESSION_COOKIE}=${token}; Max-Age=${ttlSeconds}; Path=/api; HttpOnly; Secure; SameSite=Strict`;
}

export async function hasWriteSession(request: Request) {
  const token = parseCookies(request).get(SESSION_COOKIE);
  if (!token || token.length < 32 || token.length > 256) return false;
  const store = sessionsStore();
  const record = await store.get(sessionKey(token), { type: 'json' }) as WriteSession | null;
  if (!record || !Number.isFinite(Number(record.exp))) return false;
  if (Number(record.exp) <= Math.floor(Date.now() / 1000)) {
    await store.delete(sessionKey(token));
    return false;
  }
  return true;
}

export function verifyAccessPhrase(phrase: string) {
  const [kind, nText, rText, pText, saltText, hashText] = ACCESS_PHRASE_SCRYPT.split('$');
  if (kind !== 'scrypt' || !saltText || !hashText) return false;
  const expected = Buffer.from(hashText, 'base64url');
  const actual = scryptSync(String(phrase || ''), Buffer.from(saltText, 'base64url'), expected.length, {
    N: Number(nText), r: Number(rText), p: Number(pText)
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function validateProducts(products: unknown) {
  if (!Array.isArray(products)) return 'products deve ser um array.';
  if (products.length > 5000) return 'Limite de 5000 produtos excedido.';
  for (const item of products) {
    if (!item || typeof item !== 'object') return 'Produto inválido.';
    const product = item as Record<string, unknown>;
    if (typeof product.id !== 'string' || product.id.length > 180) return 'Produto sem id válido.';
    if (typeof product.code !== 'string' || !product.code.trim() || product.code.length > 180) return 'Produto sem código válido.';
    if (typeof product.description !== 'string' || !product.description.trim() || product.description.length > 1200) return 'Produto sem descrição válida.';
    if (product.variants && (!Array.isArray(product.variants) || product.variants.length > 24)) return 'Variações inválidas.';
    if (product.tableRows && (!Array.isArray(product.tableRows) || product.tableRows.length > 48)) return 'Tabela comercial inválida.';
    if (product.specs && (!Array.isArray(product.specs) || product.specs.length > 64)) return 'Especificações inválidas.';
  }
  return '';
}

export async function currentSnapshot(): Promise<ProductSnapshot> {
  const store = productsStore();
  const current = await store.get('current', { type: 'json' });
  if (!current) {
    return { schemaVersion: 1, revision: 0, updatedAt: '', writeId: '', products: [] };
  }
  return current as ProductSnapshot;
}
