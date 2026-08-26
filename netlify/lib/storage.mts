import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';
import { getDeployStore, getStore } from '@netlify/blobs';

declare const Netlify: {
  env: { get(name: string): string | undefined };
  context?: { deploy?: { context?: string } };
};

export const SESSION_COOKIE = 'catalogotop_write';
export const PRODUCT_STORE = 'catalogotop-products';
export const ASSET_STORE = 'catalogotop-assets';
export const MAX_PRODUCTS_BYTES = 3_000_000;
export const MAX_ASSET_BYTES = 6_000_000;

export type ProductSnapshot = {
  schemaVersion: number;
  revision: number;
  updatedAt: string;
  writeId: string;
  products: unknown[];
};

function env(name: string) {
  return Netlify.env.get(name) || '';
}

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

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString('base64url');
}

function sessionSignature(payload: string) {
  const secret = env('CATALOGOTOP_SESSION_SECRET');
  if (!secret) throw new Error('CATALOGOTOP_SESSION_SECRET ausente.');
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function makeSessionCookie(ttlSeconds = 3600) {
  const payload = base64url(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  const value = `${payload}.${sessionSignature(payload)}`;
  return `${SESSION_COOKIE}=${value}; Max-Age=${ttlSeconds}; Path=/api; HttpOnly; Secure; SameSite=Strict`;
}

export function hasWriteSession(request: Request) {
  const value = parseCookies(request).get(SESSION_COOKIE);
  if (!value) return false;
  const [payload, signature] = value.split('.');
  if (!payload || !signature) return false;
  const expected = sessionSignature(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number(parsed.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function verifyAccessPhrase(phrase: string) {
  const encoded = env('CATALOGOTOP_WRITE_PASSWORD_SCRYPT');
  const [kind, nText, rText, pText, saltText, hashText] = encoded.split('$');
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
