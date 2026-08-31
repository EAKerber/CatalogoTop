import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { getDeployStore, getStore } from '@netlify/blobs';
import { ASSET_INDEX_SNAPSHOT_VERSION, validateAssetIndexSnapshot } from './asset-index-snapshot.mts';
import { CATALOG_SNAPSHOT_VERSION, validateCatalogSnapshot } from './catalog-snapshot.mts';
import { validateProductFolders } from './product-folders.mts';
import { validateUniqueProductCodes } from './product-codes.mts';

declare const Netlify: {
  context?: { deploy?: { context?: string } };
};

export const SESSION_COOKIE = 'catalogotop_write';
export const PRODUCT_STORE = 'catalogotop-products';
export const CATALOG_STORE = 'catalogotop-catalogs';
export const ASSET_STORE = 'catalogotop-assets';
export const ASSET_INDEX_STORE = 'catalogotop-asset-index';
export const SESSION_STORE = 'catalogotop-sessions';
export const MAX_PRODUCTS_BYTES = 3_000_000;
export const MAX_CATALOGS_BYTES = 3_000_000;
export const MAX_ASSET_INDEX_BYTES = 2_000_000;
export const MAX_ASSET_BYTES = 6_000_000;

const ACCESS_PHRASE_SCRYPT = 'scrypt$16384$8$1$cA6iGPNH7ZJb8kK_TfSHxQ$NLnD8tXtJTr67OvFoj0_m7c79bekQg2XTaXp37cI-O10Y8E1qYWeuzR5-8u_KW_GSAh-GGn9w7yt691A6s_JuA';

export type ProductSnapshot = {
  schemaVersion: number;
  revision: number;
  updatedAt: string;
  writeId: string;
  folders?: unknown[];
  products: unknown[];
};

export type CatalogStoreSnapshot = {
  schemaVersion: number;
  revision: number;
  updatedAt: string;
  writeId: string;
  folders?: unknown[];
  catalogs: unknown[];
};

export type AssetIndexStoreSnapshot = {
  schemaVersion: number;
  revision: number;
  updatedAt: string;
  writeId: string;
  folders?: unknown[];
  assets: unknown[];
};

type WriteSession = {
  exp: number;
  createdAt: string;
};

function isProduction() {
  return Netlify.context?.deploy?.context === 'production';
}

function deployStore(name: string) {
  return getDeployStore({ name, consistency: 'strong' });
}

export function productsStore() {
  return isProduction() ? getStore(PRODUCT_STORE, { consistency: 'strong' }) : deployStore(PRODUCT_STORE);
}

export function catalogsStore() {
  return isProduction() ? getStore(CATALOG_STORE, { consistency: 'strong' }) : deployStore(CATALOG_STORE);
}

export function assetsStore() {
  return isProduction() ? getStore(ASSET_STORE, { consistency: 'strong' }) : deployStore(ASSET_STORE);
}

export function assetIndexStore() {
  return isProduction() ? getStore(ASSET_INDEX_STORE, { consistency: 'strong' }) : deployStore(ASSET_INDEX_STORE);
}

export function sessionsStore() {
  return isProduction() ? getStore(SESSION_STORE, { consistency: 'strong' }) : deployStore(SESSION_STORE);
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
  const record: WriteSession = { exp: now + ttlSeconds, createdAt: new Date().toISOString() };
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

function validImageGallery(value: unknown) {
  if (value == null) return true;
  if (!Array.isArray(value) || value.length > 24) return false;
  return value.every(entry => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const item = entry as Record<string, unknown>;
    if (typeof item.id !== 'string' || !item.id.trim() || item.id.length > 180) return false;
    if (typeof item.image !== 'string' || !item.image.trim() || item.image.length > 2400) return false;
    if (item.label != null && (typeof item.label !== 'string' || item.label.length > 300)) return false;
    if (item.provenance != null && (typeof item.provenance !== 'object' || Array.isArray(item.provenance))) return false;
    return true;
  });
}

export function validateProducts(products: unknown) {
  if (!Array.isArray(products)) return 'products deve ser um array.';
  if (products.length > 5000) return 'Limite de 5000 produtos excedido.';
  const codeError = validateUniqueProductCodes(products);
  if (codeError) return codeError;
  for (const item of products) {
    if (!item || typeof item !== 'object') return 'Produto inválido.';
    const product = item as Record<string, unknown>;
    if (typeof product.id !== 'string' || product.id.length > 180) return 'Produto sem id válido.';
    if (typeof product.code !== 'string' || !product.code.trim() || product.code.length > 180) return 'Produto sem código válido.';
    if (typeof product.description !== 'string' || !product.description.trim() || product.description.length > 1200) return 'Produto sem descrição válida.';
    if (!validImageGallery(product.imageGallery)) return 'Galeria de imagens inválida.';
    if (product.variants && (!Array.isArray(product.variants) || product.variants.length > 24)) return 'Variações inválidas.';
    if (product.tableRows && (!Array.isArray(product.tableRows) || product.tableRows.length > 48)) return 'Tabela comercial inválida.';
    if (product.specs && (!Array.isArray(product.specs) || product.specs.length > 64)) return 'Especificações inválidas.';
  }
  return '';
}

export function validateProductSnapshot(folders: unknown, products: unknown) {
  const productError = validateProducts(products);
  if (productError) return productError;
  return validateProductFolders(folders, products);
}

export function validateCatalogStoreSnapshot(folders: unknown, catalogs: unknown) {
  return validateCatalogSnapshot(folders, catalogs);
}

export function validateAssetIndexStoreSnapshot(folders: unknown, assets: unknown) {
  return validateAssetIndexSnapshot(folders, assets);
}

export async function currentSnapshot(): Promise<ProductSnapshot> {
  const store = productsStore();
  const current = await store.get('current', { type: 'json' });
  if (!current) return { schemaVersion: 1, revision: 0, updatedAt: '', writeId: '', products: [] };
  return current as ProductSnapshot;
}

export async function currentCatalogSnapshot(): Promise<CatalogStoreSnapshot> {
  const store = catalogsStore();
  const current = await store.get('current', { type: 'json' });
  if (!current) return { schemaVersion: CATALOG_SNAPSHOT_VERSION, revision: 0, updatedAt: '', writeId: '', folders: [], catalogs: [] };
  return current as CatalogStoreSnapshot;
}

export async function currentAssetIndexSnapshot(): Promise<AssetIndexStoreSnapshot> {
  const store = assetIndexStore();
  const current = await store.get('current', { type: 'json' });
  if (!current) return { schemaVersion: ASSET_INDEX_SNAPSHOT_VERSION, revision: 0, updatedAt: '', writeId: '', folders: [], assets: [] };
  return current as AssetIndexStoreSnapshot;
}
