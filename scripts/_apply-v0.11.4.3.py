from pathlib import Path


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, content):
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')


def replace_once(path, old, new):
    text = read(path)
    if text.count(old) != 1:
        raise RuntimeError(f'anchor mismatch in {path}: {old[:80]!r} count={text.count(old)}')
    write(path, text.replace(old, new, 1))


def replace_between(path, start_marker, end_marker, replacement):
    text = read(path)
    start = text.find(start_marker)
    if start < 0:
        raise RuntimeError(f'start marker missing in {path}: {start_marker!r}')
    end = text.find(end_marker, start)
    if end < 0:
        raise RuntimeError(f'end marker missing in {path}: {end_marker!r}')
    write(path, text[:start] + replacement + text[end:])


remote_lib = r'''import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export const REMOTE_SOURCE_TIMEOUT_MS = 12_000;
export const REMOTE_SOURCE_MAX_REDIRECTS = 5;
export const DEFAULT_REMOTE_SOURCE_MAX_BYTES = 6_000_000;

const PASSIVE_RASTER_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

function normalizeHost(value) {
  return String(value || '').trim().replace(/^\[/, '').replace(/\]$/, '').replace(/\.$/, '').toLowerCase();
}

function publicIpv4(address) {
  const parts = String(address || '').split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0 && c === 0) return false;
  if (a === 192 && b === 0 && c === 2) return false;
  if (a === 192 && b === 168) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  if (a >= 224) return false;
  return true;
}

function publicIpv6(address) {
  const value = String(address || '').split('%', 1)[0].toLowerCase();
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return publicIpv4(mapped[1]);
  if (value === '::' || value === '::1') return false;
  if (/^(fc|fd)/.test(value)) return false;
  if (/^fe[89ab]/.test(value) || /^fe[c-f]/.test(value)) return false;
  if (/^ff/.test(value)) return false;
  if (/^2001:db8(?::|$)/.test(value)) return false;
  return true;
}

export function isPublicAddress(address) {
  const value = normalizeHost(String(address || '').split('%', 1)[0]);
  const family = isIP(value);
  if (family === 4) return publicIpv4(value);
  if (family === 6) return publicIpv6(value);
  return false;
}

export function parseRemoteSourceUrl(value) {
  let url;
  try {
    url = new URL(String(value || '').trim());
  } catch {
    throw new Error('remote-source-url-invalid');
  }
  if (url.protocol !== 'https:') throw new Error('remote-source-https-required');
  if (url.username || url.password) throw new Error('remote-source-credentials-forbidden');
  if (url.port && url.port !== '443') throw new Error('remote-source-port-forbidden');
  const host = normalizeHost(url.hostname);
  if (!host || host === 'localhost' || ['.localhost', '.local', '.internal', '.lan'].some(suffix => host.endsWith(suffix))) {
    throw new Error('remote-source-host-forbidden');
  }
  if (isIP(host) && !isPublicAddress(host)) throw new Error('remote-source-address-blocked');
  return url;
}

export async function assertPublicRemoteSource(value, lookupFn = dnsLookup) {
  const url = parseRemoteSourceUrl(value);
  const host = normalizeHost(url.hostname);
  if (isIP(host)) return url;
  let records;
  try {
    records = await lookupFn(host, { all: true, verbatim: true });
  } catch (error) {
    throw new Error(`remote-source-dns-failed:${error?.message || error}`);
  }
  const list = Array.isArray(records) ? records : records ? [records] : [];
  if (!list.length) throw new Error('remote-source-dns-empty');
  if (list.some(record => !isPublicAddress(record?.address))) throw new Error('remote-source-address-blocked');
  return url;
}

export function sniffPassiveRaster(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0);
  if (data.length >= 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47 && data[4] === 0x0d && data[5] === 0x0a && data[6] === 0x1a && data[7] === 0x0a) return 'image/png';
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  if (data.length >= 12 && String.fromCharCode(...data.slice(0, 4)) === 'RIFF' && String.fromCharCode(...data.slice(8, 12)) === 'WEBP') return 'image/webp';
  if (data.length >= 6) {
    const header = String.fromCharCode(...data.slice(0, 6));
    if (header === 'GIF87a' || header === 'GIF89a') return 'image/gif';
  }
  throw new Error('remote-source-image-signature-unsupported');
}

async function readLimitedBody(response, maxBytes) {
  const length = Number(response.headers.get('content-length') || 0);
  if (Number.isFinite(length) && length > maxBytes) throw new Error('remote-source-too-large');
  if (!response.body?.getReader) {
    const data = new Uint8Array(await response.arrayBuffer());
    if (!data.length || data.length > maxBytes) throw new Error(data.length ? 'remote-source-too-large' : 'remote-source-empty');
    return data;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = value instanceof Uint8Array ? value : new Uint8Array(value || 0);
    total += chunk.length;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new Error('remote-source-too-large');
    }
    chunks.push(chunk);
  }
  if (!total) throw new Error('remote-source-empty');
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

export async function fetchRemoteProductSource(value, options = {}) {
  const fetchFn = options.fetchFn || fetch;
  const lookupFn = options.lookupFn || dnsLookup;
  const maxBytes = Number(options.maxBytes) > 0 ? Number(options.maxBytes) : DEFAULT_REMOTE_SOURCE_MAX_BYTES;
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : REMOTE_SOURCE_TIMEOUT_MS;
  let current = String(value || '').trim();

  for (let redirectCount = 0; redirectCount <= REMOTE_SOURCE_MAX_REDIRECTS; redirectCount += 1) {
    const validated = await assertPublicRemoteSource(current, lookupFn);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchFn(validated.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'user-agent': 'CatalogoTop-Producer-Materializer/1.0',
          accept: 'image/png,image/jpeg,image/webp,image/gif;q=0.9,*/*;q=0.1'
        }
      });
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('remote-source-timeout');
      throw new Error(`remote-source-fetch-failed:${error?.message || error}`);
    } finally {
      clearTimeout(timer);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('remote-source-redirect-without-location');
      if (redirectCount >= REMOTE_SOURCE_MAX_REDIRECTS) throw new Error('remote-source-redirect-limit');
      current = new URL(location, validated).toString();
      continue;
    }
    if (!response.ok) throw new Error(`remote-source-http:${response.status}`);

    const declared = String(response.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase();
    if (declared && declared !== 'application/octet-stream' && !PASSIVE_RASTER_TYPES.has(declared)) {
      throw new Error(`remote-source-content-type-unsupported:${declared}`);
    }
    const bytes = await readLimitedBody(response, maxBytes);
    const detected = sniffPassiveRaster(bytes);
    if (declared && declared !== 'application/octet-stream' && declared !== detected) {
      throw new Error(`remote-source-content-type-mismatch:${declared}:${detected}`);
    }
    return { bytes, contentType: detected, finalUrl: validated.toString() };
  }
  throw new Error('remote-source-redirect-limit');
}
'''
write('netlify/lib/remote-product-source.mts', remote_lib)

assets = r'''import { createHash } from 'node:crypto';
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
'''
write('netlify/functions/assets.mts', assets)

replace_once(
    'src/asset-client.js',
    "  async function materializeImageValue(value) {\n",
    r'''  async function materializeProductSource(productId, value) {
    const sourceRef = String(value || '').trim();
    if (!sourceRef) throw new Error('remote_source_missing');
    if (isManagedAsset(sourceRef)) {
      const existing = await fetch(sourceRef, { credentials: 'same-origin', cache: 'force-cache' });
      if (!existing.ok) throw new Error(`managed_source_fetch:${existing.status}`);
      return { url: sourceRef, blob: await existing.blob(), sourceRef };
    }
    if (!/^https:\/\/[^\s]+$/i.test(sourceRef)) throw new Error('remote_source_https_required');
    const response = await fetch('/api/assets/materialize-product-source', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId: String(productId || ''), sourceRef })
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) {
      const error = new Error('write_session_required');
      error.code = 'write_session_required';
      throw error;
    }
    if (response.status === 409) {
      const error = new Error('source_authority_changed');
      error.code = 'source_authority_changed';
      throw error;
    }
    if (!response.ok || !isManagedAsset(payload.url)) {
      const error = new Error(payload.detail || payload.error || `remote_source_materialization:${response.status}`);
      error.code = payload.error || 'remote_source_materialization_failed';
      throw error;
    }
    const asset = await fetch(payload.url, { credentials: 'same-origin', cache: 'force-cache' });
    if (!asset.ok) throw new Error(`materialized_source_fetch:${asset.status}`);
    const blob = await asset.blob();
    if (!String(blob.type || '').startsWith('image/')) throw new Error(`materialized_source_not_image:${blob.type || 'unknown'}`);
    return { url: payload.url, blob, sourceRef };
  }

  async function materializeImageValue(value) {
''')
replace_once(
    'src/asset-client.js',
    "    materializeProducts,\n    isManagedAsset,\n",
    "    materializeProducts,\n    materializeProductSource,\n    isManagedAsset,\n")

fetch_block = r'''  async function sourceDescriptorFromBlob(blob, sourceRef) {
    const ref = String(sourceRef || '').trim();
    if (!blob || typeof blob.arrayBuffer !== 'function') throw new Error('variation_source_blob_invalid');
    if (!String(blob.type || '').startsWith('image/')) throw new Error(`variation_source_not_image:${blob.type || 'unknown'}`);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (!bytes.length) throw new Error('variation_source_empty');
    const hash = await sha256(bytes);
    const extension = mimeExtension(blob.type, ref);
    return {
      mode: 'embedded',
      sourceRef: ref,
      mimeType: blob.type || 'application/octet-stream',
      bytes,
      sha256: hash,
      fingerprint: hash,
      path: `sources/sha256-${hash}.${extension}`
    };
  }

  async function producerMaterializeRemoteSource(productId, sourceRef, materializeFn = NS.AssetClient?.materializeProductSource) {
    if (typeof materializeFn !== 'function') throw new Error('variation_producer_materializer_unavailable');
    const result = await materializeFn(String(productId || ''), String(sourceRef || '').trim());
    const blob = result?.blob || result;
    return sourceDescriptorFromBlob(blob, sourceRef);
  }

  async function fetchSourceAsset(sourceRef, fetchFn = fetch) {
    const ref = String(sourceRef || '').trim();
    if (!ref) throw new Error('variation_source_missing');
    let timer = null;
    let controller = null;
    if (typeof AbortController !== 'undefined') {
      controller = new AbortController();
      timer = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);
    }
    try {
      const managed = NS.AssetClient?.isManagedAsset?.(ref);
      const response = await fetchFn(ref, {
        credentials: managed ? 'same-origin' : 'omit',
        signal: controller?.signal
      });
      if (!response?.ok) throw new Error(`variation_source_fetch:${response?.status || 0}`);
      return sourceDescriptorFromBlob(await response.blob(), ref);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

'''
replace_between('src/variation-bundle.js', '  async function fetchSourceAsset(sourceRef, fetchFn = fetch) {', '  function imageFrameFor', fetch_block)
replace_once(
    'src/variation-bundle.js',
    "    const fetchFn = options.fetchFn || fetch;\n    const sourceCache = new Map();\n",
    "    const fetchFn = options.fetchFn || fetch;\n    const remoteMaterializeFn = options.remoteMaterializeFn || NS.AssetClient?.materializeProductSource;\n    const sourceCache = new Map();\n")
replace_between(
    'src/variation-bundle.js',
    '      if (!sourceCache.has(sourceRef)) {',
    "      if (source.mode === 'embedded' && !archiveAssets.has(source.path)) archiveAssets.set(source.path, source.bytes);",
    r'''      if (!sourceCache.has(sourceRef)) {
        sourceCache.set(sourceRef, (async () => {
          try {
            return await fetchSourceAsset(sourceRef, fetchFn);
          } catch (directError) {
            if (!isRemoteHttpSource(sourceRef) || typeof remoteMaterializeFn !== 'function') return { error: directError };
            try {
              return await producerMaterializeRemoteSource(placement.productId, sourceRef, remoteMaterializeFn);
            } catch (producerError) {
              if (producerError?.code === 'write_session_required') throw producerError;
              return { error: directError, producerError };
            }
          }
        })());
      }
      let source = await sourceCache.get(sourceRef);
      if (source?.error) {
        if (isRemoteHttpSource(sourceRef)) {
          source = await remoteSourceDescriptor(sourceRef);
        } else {
          issues.push({
            placementKey: placement.placementKey,
            productId: placement.productId,
            code: String(product?.code || ''),
            reason: 'source-unavailable',
            detail: String(source.error?.message || source.error)
          });
          continue;
        }
      }
''')
replace_once(
    'src/variation-bundle.js',
    "      'For source.mode=remote-url, source.url is the canonical external locator because browser CORS prevented embedding.',\n",
    "      'For source.mode=remote-url, source.url is the last-resort canonical locator because the producer could not embed the real pixels, including producer-side managed materialization.',\n")
replace_once(
    'src/variation-bundle.js',
    "        externalUrlFallback: true,\n        resultScope: 'catalog-local',\n",
    "        externalUrlFallback: true,\n        producerSideEmbedding: true,\n        resultScope: 'catalog-local',\n")
replace_once(
    'src/variation-bundle.js',
    "    remoteSourceDescriptor,\n    fetchSourceAsset,\n",
    "    remoteSourceDescriptor,\n    sourceDescriptorFromBlob,\n    producerMaterializeRemoteSource,\n    fetchSourceAsset,\n")

replace_once(
    'src/variation-bundle-controls.js',
    "      const result = await NS.VariationBundle.buildRequest(state, {\n        root: preview,\n        documentModel: summary?.document || NS.CatalogDocument?.build?.(state)\n      });\n",
    r'''      const buildOptions = {
        root: preview,
        documentModel: summary?.document || NS.CatalogDocument?.build?.(state)
      };
      let result;
      try {
        result = await NS.VariationBundle.buildRequest(state, buildOptions);
      } catch (error) {
        if (error?.code !== 'write_session_required' || !NS.ProductStore?.unlock) throw error;
        setStatus('A fonte externa precisa ser incorporada ao AssetStore. Liberando escrita…', 'working');
        const unlocked = await NS.ProductStore.unlock();
        if (!unlocked) throw new Error('Exportação cancelada: a fonte externa não pôde ser incorporada sem liberar a escrita.');
        result = await NS.VariationBundle.buildRequest(state, buildOptions);
      }
''')

producer_test = r'''
const producerCalls = [];
const producerEmbedded = await VariationBundle.buildRequest(remoteState, {
  documentModel: remoteDocument,
  measurements: { 'card:remote': { widthPx: 200, heightPx: 150, widthMm: 52.5, heightMm: 39.4, aspectRatio: 1.3333 } },
  fetchFn: failingFetch,
  remoteMaterializeFn: async (productId, sourceRef) => {
    producerCalls.push({ productId, sourceRef });
    return { blob: new Blob(['producer-canonical-pixels'], { type: 'image/png' }) };
  },
  generatedAt: '2026-08-29T12:00:00.000Z'
});
const producerSource = producerEmbedded.manifest.jobs[0]?.source;
if (producerCalls.length !== 1 || producerCalls[0].productId !== remoteProduct.id || producerCalls[0].sourceRef !== remoteProduct.image) fail(`materializador do produtor recebeu autoridade errada: ${JSON.stringify(producerCalls)}`);
if (producerSource?.mode !== 'embedded' || producerSource.originalRef !== remoteProduct.image || producerSource.sha256 !== producerSource.fingerprint) fail(`produtor não converteu URL externa em pixels embedded: ${JSON.stringify(producerSource)}`);
if (!producerEmbedded.archive.entries.some(item => item.path === producerSource.path)) fail('pixels materializados pelo produtor precisam entrar fisicamente no ZIP');
if (!producerEmbedded.manifest.policy.producerSideEmbedding) fail('policy precisa declarar producer-side embedding');

let sessionRequiredPropagated = false;
try {
  await VariationBundle.buildRequest(remoteState, {
    documentModel: remoteDocument,
    measurements: { 'card:remote': { widthPx: 200, heightPx: 150, widthMm: 52.5, heightMm: 39.4, aspectRatio: 1.3333 } },
    fetchFn: failingFetch,
    remoteMaterializeFn: async () => {
      const error = new Error('write_session_required');
      error.code = 'write_session_required';
      throw error;
    }
  });
} catch (error) {
  sessionRequiredPropagated = error?.code === 'write_session_required';
}
if (!sessionRequiredPropagated) fail('write_session_required do produtor não pode degradar silenciosamente para remote-url');
'''
replace_once(
    'scripts/variation-bundle-request-fixture.mjs',
    "if (!remoteRequest.manifest.policy.externalUrlFallback) fail('policy precisa declarar fallback de URL externa');\n",
    "if (!remoteRequest.manifest.policy.externalUrlFallback) fail('policy precisa declarar fallback de URL externa');\n" + producer_test)

replace_once(
    'scripts/variation-bundle-static-fixture.mjs',
    "const [html, controls, bundle, zip, css] = await Promise.all([\n",
    "const [html, controls, bundle, zip, css, assetClient] = await Promise.all([\n")
replace_once(
    'scripts/variation-bundle-static-fixture.mjs',
    "  readFile('image-variants.css', 'utf8')\n]);\n",
    "  readFile('image-variants.css', 'utf8'),\n  readFile('src/asset-client.js', 'utf8')\n]);\n")
replace_once(
    'scripts/variation-bundle-static-fixture.mjs',
    "  ['exportação mede o renderer real e não muta domínio', controls.includes(\"NS.App.switchTab('catalog')\") && controls.includes('root: preview') && controls.includes('buildRequest') && !controls.includes('Core.mutate') && !controls.includes('ProductStore')],\n",
    "  ['exportação mede o renderer real e não publica domínio', controls.includes(\"NS.App.switchTab('catalog')\") && controls.includes('root: preview') && controls.includes('buildRequest') && !controls.includes('Core.mutate') && !controls.includes('publishProducts') && !controls.includes('publishCurrent')],\n  ['produtor tenta incorporar URL autorizada antes do fallback externo', bundle.includes('producerMaterializeRemoteSource') && bundle.includes('remoteMaterializeFn') && bundle.includes('producerSideEmbedding: true') && assetClient.includes('/api/assets/materialize-product-source') && controls.includes(\"error?.code !== 'write_session_required'\") && controls.includes('NS.ProductStore.unlock')],\n")

remote_fixture = r'''import {
  assertPublicRemoteSource,
  fetchRemoteProductSource,
  isPublicAddress,
  parseRemoteSourceUrl,
  sniffPassiveRaster
} from '../netlify/lib/remote-product-source.mts';

const fail = message => { throw new Error(message); };
const expectReject = async (label, work, needle) => {
  try {
    await work();
  } catch (error) {
    if (!needle || String(error?.message || error).includes(needle)) return;
    fail(`${label}: erro inesperado ${error?.message || error}`);
  }
  fail(`${label}: deveria falhar`);
};

if (!isPublicAddress('93.184.216.34') || isPublicAddress('127.0.0.1') || isPublicAddress('10.0.0.8') || isPublicAddress('169.254.1.2') || isPublicAddress('::1') || isPublicAddress('fd00::1')) fail('classificação de endereço público/privado inválida');
if (parseRemoteSourceUrl('https://example.com/image.png').hostname !== 'example.com') fail('URL HTTPS pública válida não foi aceita');
await expectReject('HTTP simples', () => Promise.resolve(parseRemoteSourceUrl('http://example.com/image.png')), 'https-required');
await expectReject('credenciais na URL', () => Promise.resolve(parseRemoteSourceUrl('https://user:pass@example.com/image.png')), 'credentials-forbidden');
await expectReject('porta não padrão', () => Promise.resolve(parseRemoteSourceUrl('https://example.com:8443/image.png')), 'port-forbidden');
await expectReject('localhost', () => Promise.resolve(parseRemoteSourceUrl('https://localhost/image.png')), 'host-forbidden');
await expectReject('DNS privado', () => assertPublicRemoteSource('https://example.com/image.png', async () => [{ address: '10.0.0.5', family: 4 }]), 'address-blocked');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlKZcQAAAAASUVORK5CYII=', 'base64');
if (sniffPassiveRaster(png) !== 'image/png') fail('assinatura PNG não reconhecida');
const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }];
const fetched = await fetchRemoteProductSource('https://example.com/image.png', {
  lookupFn: publicLookup,
  fetchFn: async () => new Response(png, { status: 200, headers: { 'content-type': 'image/png', 'content-length': String(png.length) } }),
  maxBytes: 1024
});
if (fetched.contentType !== 'image/png' || fetched.bytes.length !== png.length || fetched.finalUrl !== 'https://example.com/image.png') fail(`fetch remoto válido não preservado: ${JSON.stringify({ type: fetched.contentType, bytes: fetched.bytes.length, finalUrl: fetched.finalUrl })}`);

let redirectFetches = 0;
await expectReject('redirect para IP privado', () => fetchRemoteProductSource('https://example.com/image.png', {
  lookupFn: publicLookup,
  fetchFn: async () => {
    redirectFetches += 1;
    return new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/private.png' } });
  }
}), 'address-blocked');
if (redirectFetches !== 1) fail(`redirect privado não deveria ser requisitado: fetches=${redirectFetches}`);

await expectReject('MIME divergente', () => fetchRemoteProductSource('https://example.com/image.png', {
  lookupFn: publicLookup,
  fetchFn: async () => new Response(png, { status: 200, headers: { 'content-type': 'image/jpeg' } })
}), 'content-type-mismatch');
await expectReject('limite de bytes', () => fetchRemoteProductSource('https://example.com/image.png', {
  lookupFn: publicLookup,
  fetchFn: async () => new Response(png, { status: 200, headers: { 'content-type': 'image/png', 'content-length': String(png.length) } }),
  maxBytes: 16
}), 'too-large');

console.log('PASS remote product source fixture: HTTPS, authority network guards, redirects, signatures e limites');
'''
write('scripts/remote-product-source-fixture.mjs', remote_fixture)

replace_once(
    'scripts/storage-contract-fixture.mjs',
    "  assets: await readFile('netlify/functions/assets.mts', 'utf8'),\n",
    "  assets: await readFile('netlify/functions/assets.mts', 'utf8'),\n  remoteSource: await readFile('netlify/lib/remote-product-source.mts', 'utf8'),\n")
replace_once(
    'scripts/storage-contract-fixture.mjs',
    "  ['assets exigem sessão só para POST', files.assets.includes(\"request.method === 'GET'\") && files.assets.includes('if (!await hasWriteSession(request))')],\n",
    "  ['assets exigem sessão para qualquer escrita', files.assets.includes(\"request.method === 'GET'\") && files.assets.includes('materialize-product-source') && files.assets.match(/hasWriteSession\(request\)/g)?.length >= 2],\n  ['materialização remota é autorizada pelo ProductStore antes do fetch', files.assets.includes('currentSnapshot') && files.assets.includes('authorizedSource !== sourceRef') && files.assets.indexOf('source_authority_changed') < files.assets.indexOf('fetchRemoteProductSource')],\n  ['materializador remoto restringe rede e bytes', files.remoteSource.includes(\"url.protocol !== 'https:'\") && files.remoteSource.includes('remote-source-address-blocked') && files.remoteSource.includes("redirect: 'manual'") && files.remoteSource.includes('readLimitedBody')],\n")
replace_once(
    'scripts/storage-contract-fixture.mjs',
    "  ['data URLs são materializados antes de persistir', files.assetClient.includes('materializeProducts') && files.assetClient.includes('isDataUrl')],\n",
    "  ['data URLs são materializados antes de persistir', files.assetClient.includes('materializeProducts') && files.assetClient.includes('isDataUrl')],\n  ['fonte remota autorizada pode virar asset gerenciado sem reescrever produto', files.assetClient.includes('materializeProductSource') && files.assetClient.includes('/api/assets/materialize-product-source') && !files.assetClient.includes('product.image = await materializeProductSource')],\n")

replace_once(
    'package.json',
    "node scripts/variation-bundle-request-fixture.mjs && node scripts/variation-result-fixture.mjs",
    "node scripts/variation-bundle-request-fixture.mjs && node scripts/remote-product-source-fixture.mjs && node scripts/variation-result-fixture.mjs")

replace_once(
    'AGENTS.md',
    "- `source.mode=remote-url` é apenas um locator canônico quando CORS impede embedding. O Request Bundle deve carregar um paved path de materialização local dos bytes, incluindo fallback `plan` → downloader da plataforma → `ingest` para runtimes sem rede; preview/web lookup não substitui pixel source, e consumidor sem capacidade de ingerir pixels reais deve falhar explicitamente em vez de aproximar a identidade do produto.\n",
    "- Antes de emitir `source.mode=remote-url`, o produtor deve tentar materializar a URL canônica via AssetStore quando ela corresponder exatamente ao `product.image` da snapshot autoritativa. Essa materialização é uma escrita de asset e continua exigindo write-session; não é proxy genérico e não pode aceitar locator arbitrário.\n- `source.mode=remote-url` é somente o último fallback quando CORS e a materialização producer-side falham. O Request Bundle deve carregar um paved path de materialização local dos bytes, incluindo fallback `plan` → downloader da plataforma → `ingest` para runtimes sem rede; preview/web lookup não substitui pixel source, e consumidor sem capacidade de ingerir pixels reais deve falhar explicitamente em vez de aproximar a identidade do produto.\n")

doc = r'''# v0.11.4.3 — Producer-Side Source Materialization

## Evidência que motivou o recorte

O segundo teste real do Image Variation Request executou corretamente o helper v0.11.4.2, mas os 10 jobs `remote-url` falharam de forma uniforme com `dns-resolution-failed`. O downloader da plataforma também não conseguiu salvar os bytes. O consumidor agiu corretamente ao devolver `capability-blocked`, sem usar preview ou aproximação.

Isso demonstra que `remote-url` continua transferindo ao consumidor uma dependência de rede que não é portátil entre sandboxes. O fallback continua útil como evidência/último recurso, mas não deve ser o paved path quando o próprio CatalogoTop ainda consegue materializar a fonte.

## Decisão

Quando o browser não consegue ler uma imagem HTTP externa por CORS, o exportador tenta uma segunda fronteira no próprio backend do CatalogoTop:

1. envia `productId + sourceRef` para `/api/assets/materialize-product-source`;
2. o servidor lê a snapshot autoritativa do ProductStore e exige correspondência exata com `product.image`;
3. somente depois dessa validação exige write-session, pois haverá escrita no AssetStore;
4. a URL é aceita somente via HTTPS, sem credenciais/porta alternativa, com resolução DNS pública, redirects manuais revalidados, timeout e limite de bytes;
5. somente raster passivo PNG/JPEG/WebP/GIF reconhecido por assinatura é aceito;
6. os bytes entram no AssetStore content-addressed;
7. o browser recupera o asset same-origin e o Request Bundle o inclui como `source.mode=embedded`, preservando `originalRef` como a URL canônica do produto.

O endpoint não aceita URLs arbitrárias e não funciona como proxy genérico. Uma URL que não corresponda ao `product.image` remoto atual recebe `source_authority_changed` antes de qualquer fetch externo.

## Sessão de escrita

Materializar a fonte cria/reutiliza um blob persistente, portanto continua obedecendo ao contrato existente: escrita exige sessão curta. Se o servidor responder `write_session_required`, o exportador solicita a frase pelo fluxo já existente de `ProductStore.unlock()` e repete a construção do Request uma vez. A sessão não publica nem altera a base de produtos.

Se o usuário não liberar a escrita, a exportação falha explicitamente em vez de degradar silenciosamente para um pacote conhecido como não portátil apenas por ausência de sessão.

## Fallback

`remote-url` permanece no Request v2 para fontes que o produtor realmente não consegue materializar (fonte fora da autoridade remota, host indisponível, tipo não suportado etc.). Nesse caso o helper v0.11.4.2 continua sendo o último recurso do consumidor.

## Compatibilidade

- schema do CatalogoTop: 7, inalterado;
- Request manifest: v2, inalterado;
- Result Bundle: v1, inalterado;
- `product.image` não é reescrito;
- ProductStore não é publicado durante exportação;
- `requestId`/`usageSignature` passam naturalmente a usar o SHA-256 dos pixels quando producer-side embedding funciona;
- o AssetStore continua content-addressed e imutável.

## Gates

Além dos gates gerais, o recorte testa deterministicamente:

- rejeição de HTTP, credenciais, porta alternativa, localhost e DNS privado;
- redirect para IP privado antes de realizar a segunda requisição;
- MIME versus assinatura raster;
- limite de bytes;
- CORS/fetch direto falhando seguido de producer-side materialization gerando `embedded`;
- `write_session_required` propagado, nunca convertido silenciosamente em `remote-url`;
- autoridade `productId + product.image` no endpoint.
'''
write('docs/v0.11.4.3-producer-source-materialization.md', doc)

print('v0.11.4.3 patch staged successfully')
