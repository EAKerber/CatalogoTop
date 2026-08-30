import { lookup as dnsLookup } from 'node:dns/promises';
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
        if (controller.signal.aborted || error?.name === 'AbortError') throw new Error('remote-source-timeout');
        throw new Error(`remote-source-fetch-failed:${error?.message || error}`);
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
      let bytes;
      try {
        bytes = await readLimitedBody(response, maxBytes);
      } catch (error) {
        if (controller.signal.aborted || error?.name === 'AbortError') throw new Error('remote-source-timeout');
        throw error;
      }
      const detected = sniffPassiveRaster(bytes);
      if (declared && declared !== 'application/octet-stream' && declared !== detected) {
        throw new Error(`remote-source-content-type-mismatch:${declared}:${detected}`);
      }
      return { bytes, contentType: detected, finalUrl: validated.toString() };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('remote-source-redirect-limit');
}
