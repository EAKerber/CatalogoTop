import {
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
