import { hashFromManagedRef, validateAssetIndexSnapshot } from '../netlify/lib/asset-index-snapshot.mts';
import { collectAssetUsages } from '../netlify/lib/asset-usage.mts';

const fail = message => { throw new Error(message); };
const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const record = { id: `sha256/${A}`, sha256: A, folderId: null, label: '', contentType: 'image/webp', bytes: 10, createdAt: '', updatedAt: '' };

if (hashFromManagedRef(`/api/assets/sha256/${A}`) !== A) fail('server managed URL não resolveu hash');
if (hashFromManagedRef('https://example.com/a.webp')) fail('server não pode aceitar URL remota como managed');
if (validateAssetIndexSnapshot([], [record])) fail('snapshot válido foi rejeitado');
if (!validateAssetIndexSnapshot([], [record, record]).includes('duplicado')) fail('server precisa rejeitar hash duplicado');
if (!validateAssetIndexSnapshot([], [{ ...record, id: `sha256/${B}` }]).includes('incompatível')) fail('server precisa rejeitar id/hash divergente');
if (!validateAssetIndexSnapshot([], [{ ...record, folderId: 'missing' }]).includes('folderId')) fail('server precisa rejeitar folderId inexistente');

const products = [
  { id: 'p1', code: 'P1', description: 'Um', image: `/api/assets/sha256/${A}`, imageGallery: [], variants: [] },
  { id: 'p2', code: 'P2', description: 'Dois', image: '', imageGallery: [{ id: 'g', image: `/api/assets/sha256/${A}` }], variants: [] }
];
const catalogs = [{ id: 'c1', catalog: { title: 'Catálogo', presentation: { imageVariants: { p1: [{ id: 'v', image: `/api/assets/sha256/${A}` }] } } } }];
const usages = collectAssetUsages(products, catalogs);
if (usages.length !== 3 || usages.some(usage => usage.sha256 !== A)) fail(`usage server incorreto: ${JSON.stringify(usages)}`);
if (new Set(usages.map(usage => `${usage.ownerType}:${usage.ownerId}:${usage.field}`)).size !== 3) fail('usage lógico foi deduplicado incorretamente');

console.log('PASS server asset index fixture: validation parity and authoritative usage projection');
