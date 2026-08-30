(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const REQUEST_KIND = 'catalogotop.image-variation-request';
  const REQUEST_VERSION = 2;
  const SOURCE_TIMEOUT_MS = 10000;
  const ALLOWED_TRANSFORMS = Object.freeze([
    'upscale',
    'small-rotation',
    'focus-reframe',
    'clean-or-expand-background',
    'white-background',
    'contrast-brightness-color-correction',
    'artifact-cleanup',
    'identity-and-geometry-preserving-edit'
  ]);
  const FORBIDDEN_TRANSFORMS = Object.freeze([
    'reimagine-product-shape',
    'invent-or-remove-pieces',
    'add-foreign-objects',
    'replace-model-or-identity-with-approximation'
  ]);

  function canonicalize(value) {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (!value || typeof value !== 'object') return value;
    const output = {};
    Object.keys(value).sort().forEach(key => {
      if (value[key] !== undefined) output[key] = canonicalize(value[key]);
    });
    return output;
  }

  function canonicalStringify(value) {
    return JSON.stringify(canonicalize(value));
  }

  function bytesToHex(bytes) {
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async function sha256(value) {
    const bytes = value instanceof Uint8Array
      ? value
      : value instanceof ArrayBuffer
        ? new Uint8Array(value)
        : new TextEncoder().encode(typeof value === 'string' ? value : canonicalStringify(value));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return bytesToHex(new Uint8Array(digest));
  }

  function cardPlacementKey(productId) {
    return `card:${String(productId)}`;
  }

  function collectionPlacementKey(blockId, productId) {
    return `collection:${String(blockId)}:member:${String(productId)}`;
  }

  function hasCommercialImageGrid(product) {
    return Array.isArray(product?.variants) && product.variants.some(entry => entry?.image);
  }

  function placementStyleForCollection(item, productId) {
    const member = NS.Collection?.memberStyleFor?.(item.block, productId) || {};
    return {
      contentPreset: String(item.block?.itemPreset || 'visual'),
      emphasis: String(member.emphasis || 'normal'),
      width: String(member.width || 'simple')
    };
  }

  function placementsForDocument(documentModel) {
    const placements = [];
    const seen = new Set();
    (documentModel?.pages || []).forEach(page => {
      (page.items || []).forEach(item => {
        if (item.type === 'card' && item.product) {
          const productId = String(item.productId || item.product.id || '');
          const placementKey = cardPlacementKey(productId);
          if (seen.has(placementKey)) throw new Error(`variation_placement_duplicate:${placementKey}`);
          seen.add(placementKey);
          placements.push({
            placementKey,
            type: 'card',
            productId,
            product: item.product,
            pageIndex: Number(page.index) || 0,
            category: String(page.category || ''),
            blockId: null,
            style: {
              contentPreset: String(item.contentPreset || 'visual'),
              emphasis: String(item.emphasis || 'normal'),
              width: String(item.width || 'simple')
            }
          });
          return;
        }
        if (item.type === 'collection') {
          (item.members || []).forEach(product => {
            const productId = String(product?.id || '');
            if (!productId) return;
            const placementKey = collectionPlacementKey(item.blockId, productId);
            if (seen.has(placementKey)) throw new Error(`variation_placement_duplicate:${placementKey}`);
            seen.add(placementKey);
            placements.push({
              placementKey,
              type: 'collection-member',
              productId,
              product,
              pageIndex: Number(page.index) || 0,
              category: String(page.category || ''),
              blockId: String(item.blockId || ''),
              style: placementStyleForCollection(item, productId),
              collection: {
                theme: String(item.block?.theme || 'light'),
                columns: Number(item.block?.columns) || 2,
                itemPreset: String(item.block?.itemPreset || 'visual')
              }
            });
          });
        }
      });
    });
    return placements;
  }

  function nodeForPlacement(root, placement) {
    if (!root?.querySelectorAll) return null;
    if (placement.type === 'card') {
      return Array.from(root.querySelectorAll('.catalog-card[data-product-id]'))
        .find(node => String(node.dataset.productId || '') === placement.productId) || null;
    }
    if (placement.type === 'collection-member') {
      return Array.from(root.querySelectorAll('.catalog-collection[data-collection-id] .catalog-collection-item[data-product-id]'))
        .find(node => String(node.dataset.productId || '') === placement.productId
          && String(node.closest('.catalog-collection')?.dataset.collectionId || '') === placement.blockId) || null;
    }
    return null;
  }

  function positiveDimension(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  function measureRenderedPlacements(root, placements) {
    const result = {};
    (placements || []).forEach(placement => {
      const node = nodeForPlacement(root, placement);
      if (!node) return;
      const holder = placement.type === 'card'
        ? node.querySelector('.catalog-card-visuals.single')
        : node.querySelector('.catalog-collection-image');
      if (!holder) return;
      const page = node.closest('.catalog-page');
      const holderRect = holder.getBoundingClientRect?.() || {};
      const pageRect = page?.getBoundingClientRect?.() || {};
      const widthPx = positiveDimension(holder.offsetWidth, positiveDimension(holderRect.width));
      const heightPx = positiveDimension(holder.offsetHeight, positiveDimension(holderRect.height));
      const pageWidthPx = positiveDimension(page?.offsetWidth, positiveDimension(pageRect.width));
      const pageHeightPx = positiveDimension(page?.offsetHeight, positiveDimension(pageRect.height));
      if (!widthPx || !heightPx) return;
      result[placement.placementKey] = {
        widthPx: Math.round(widthPx * 100) / 100,
        heightPx: Math.round(heightPx * 100) / 100,
        widthMm: pageWidthPx ? Math.round((widthPx / pageWidthPx) * 21000) / 100 : null,
        heightMm: pageHeightPx ? Math.round((heightPx / pageHeightPx) * 29700) / 100 : null,
        aspectRatio: Math.round((widthPx / heightPx) * 10000) / 10000
      };
    });
    return result;
  }

  function mimeExtension(mimeType, sourceRef = '') {
    const mime = String(mimeType || '').toLowerCase().split(';')[0];
    if (mime === 'image/png') return 'png';
    if (mime === 'image/jpeg') return 'jpg';
    if (mime === 'image/webp') return 'webp';
    if (mime === 'image/gif') return 'gif';
    if (mime === 'image/svg+xml') return 'svg';
    const match = String(sourceRef).match(/\.([a-z0-9]{2,5})(?:[?#]|$)/i);
    return match ? match[1].toLowerCase() : 'bin';
  }

  function isRemoteHttpSource(value) {
    return /^https?:\/\/[^\s]+$/i.test(String(value || '').trim());
  }

  async function remoteSourceDescriptor(sourceRef) {
    const ref = String(sourceRef || '').trim();
    if (!isRemoteHttpSource(ref)) throw new Error('variation_remote_source_invalid');
    return {
      mode: 'remote-url',
      sourceRef: ref,
      url: ref,
      fingerprint: await sha256(`remote-url:${ref}`)
    };
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
      const blob = await response.blob();
      if (!String(blob.type || '').startsWith('image/')) throw new Error(`variation_source_not_image:${blob.type || 'unknown'}`);
      const bytes = new Uint8Array(await blob.arrayBuffer());
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
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function imageFrameFor(presentation, productId) {
    if (NS.ImageFraming?.imageFrameFor) return NS.ImageFraming.imageFrameFor(presentation, productId);
    const frame = presentation?.imageFrames?.[String(productId)] || {};
    return {
      fit: frame.fit === 'cover' ? 'cover' : 'contain',
      zoom: Number(frame.zoom) || 1,
      x: Number.isFinite(Number(frame.x)) ? Number(frame.x) : 50,
      y: Number.isFinite(Number(frame.y)) ? Number(frame.y) : 50
    };
  }

  function currentSelectionFor(product, presentation) {
    const resolved = NS.ImageVariants?.resolveImage?.(product, presentation);
    if (!resolved) return { source: 'original', id: 'original' };
    return { source: String(resolved.source || 'original'), id: String(resolved.id || 'original') };
  }

  function layoutContext(documentModel) {
    return {
      schemaVersion: 1,
      documentSchemaVersion: documentModel?.schemaVersion || null,
      templateId: documentModel?.template?.id || '',
      pages: (documentModel?.pages || []).map(page => ({
        index: page.index,
        category: page.category,
        items: (page.items || []).map(item => {
          if (item.type === 'card') return {
            type: 'card', productId: String(item.productId), row: item.row, start: item.start, span: item.span,
            contentPreset: item.contentPreset, emphasis: item.emphasis, width: item.width
          };
          if (item.type === 'collection') return {
            type: 'collection', blockId: String(item.blockId), memberIds: item.memberIds.map(String), row: item.row, rowSpan: item.rowSpan,
            start: item.start, span: item.span, theme: item.block?.theme, columns: item.block?.columns, itemPreset: item.block?.itemPreset
          };
          if (item.type === 'table') return {
            type: 'table', blockId: String(item.blockId), memberIds: item.memberIds.map(String), row: item.row, rowSpan: item.rowSpan,
            start: item.start, span: item.span
          };
          return { type: String(item.type || 'unknown') };
        })
      }))
    };
  }

  function sourceMaterializerScript() {
  return String.raw`#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import ipaddress
import json
import socket
import sys
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urljoin, urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

REQUEST_KIND = "catalogotop.image-variation-request"
REQUEST_VERSION = 2
INDEX_KIND = "catalogotop.materialized-sources"
INDEX_VERSION = 1
MAX_SOURCE_BYTES = 25 * 1024 * 1024
MAX_TOTAL_BYTES = 200 * 1024 * 1024
MAX_REDIRECTS = 5
TIMEOUT_SECONDS = 20
CHUNK_BYTES = 64 * 1024


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def fail(message: str) -> None:
    raise RuntimeError(message)


def validate_public_url(value: str) -> str:
    try:
        parsed = urlparse(value)
        port = parsed.port
    except ValueError as exc:
        fail(f"invalid-url:{exc}")
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        fail("url-must-be-http-or-https")
    if parsed.username or parsed.password:
        fail("url-credentials-not-allowed")
    if port not in {None, 80, 443}:
        fail(f"url-port-not-allowed:{port}")
    host = parsed.hostname.rstrip(".").lower()
    if host == "localhost" or host.endswith(".local"):
        fail("local-hostname-not-allowed")
    resolved_port = port or (443 if parsed.scheme == "https" else 80)
    try:
        addresses = {
            info[4][0].split("%", 1)[0]
            for info in socket.getaddrinfo(host, resolved_port, type=socket.SOCK_STREAM)
        }
    except OSError as exc:
        fail(f"dns-resolution-failed:{exc}")
    if not addresses:
        fail("dns-resolution-empty")
    for address in addresses:
        try:
            ip = ipaddress.ip_address(address)
        except ValueError:
            fail(f"dns-address-invalid:{address}")
        if not ip.is_global:
            fail(f"non-public-address-blocked:{address}")
    return value


def fetch_source(url: str) -> tuple[bytes, str, str]:
    opener = build_opener(NoRedirect())
    current = url
    for redirect_count in range(MAX_REDIRECTS + 1):
        validate_public_url(current)
        request = Request(
            current,
            headers={
                "User-Agent": "CatalogoTop-Source-Materializer/1.0",
                "Accept": "image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml;q=0.9,*/*;q=0.1",
            },
        )
        try:
            response = opener.open(request, timeout=TIMEOUT_SECONDS)
        except HTTPError as exc:
            if exc.code in {301, 302, 303, 307, 308}:
                location = exc.headers.get("Location")
                if not location:
                    fail(f"redirect-without-location:{exc.code}")
                if redirect_count >= MAX_REDIRECTS:
                    fail("redirect-limit-exceeded")
                current = urljoin(current, location)
                continue
            fail(f"http-error:{exc.code}")

        with response:
            final_url = response.geturl()
            validate_public_url(final_url)
            declared = str(response.headers.get("Content-Type") or "").split(";", 1)[0].strip().lower()
            length = response.headers.get("Content-Length")
            if length:
                try:
                    if int(length) > MAX_SOURCE_BYTES:
                        fail(f"source-size-limit:{length}")
                except ValueError:
                    pass
            chunks = []
            total = 0
            while True:
                chunk = response.read(CHUNK_BYTES)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_SOURCE_BYTES:
                    fail(f"source-size-limit:{total}")
                chunks.append(chunk)
            if not total:
                fail("source-empty")
            return b"".join(chunks), final_url, declared
    fail("redirect-limit-exceeded")


def sniff_image(data: bytes, declared: str) -> tuple[str, str]:
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", "png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", "jpg"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp", "webp"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif", "gif"
    if len(data) >= 12 and data[4:8] == b"ftyp" and data[8:12] in {b"avif", b"avis"}:
        return "image/avif", "avif"
    head = data[:4096].lstrip(b"\xef\xbb\xbf \t\r\n")
    if declared == "image/svg+xml" and b"<svg" in head.lower():
        return "image/svg+xml", "svg"
    fail(f"unsupported-or-unrecognized-image:{declared or 'unknown'}")


def source_fingerprint(url: str) -> str:
    return hashlib.sha256(f"remote-url:{url}".encode("utf-8")).hexdigest()


def load_manifest(root: Path) -> dict:
    path = root / "manifest.json"
    if not path.is_file():
        fail("manifest.json-not-found")
    manifest = json.loads(path.read_text(encoding="utf-8"))
    if manifest.get("kind") != REQUEST_KIND or int(manifest.get("version") or 0) != REQUEST_VERSION:
        fail("unsupported-request-kind-or-version")
    request_id = str(manifest.get("requestId") or "").lower()
    if len(request_id) != 64 or any(ch not in "0123456789abcdef" for ch in request_id):
        fail("requestId-invalid")
    if not isinstance(manifest.get("jobs"), list):
        fail("jobs-invalid")
    return manifest


def remote_sources(manifest: dict) -> list[dict]:
    by_fingerprint: dict[str, dict] = {}
    for job in manifest["jobs"]:
        source = job.get("source") if isinstance(job, dict) else None
        if not isinstance(source, dict) or source.get("mode") != "remote-url":
            continue
        url = str(source.get("url") or "").strip()
        fingerprint = str(source.get("fingerprint") or "").strip().lower()
        expected = source_fingerprint(url)
        if fingerprint != expected:
            fail(f"source-fingerprint-mismatch:{job.get('jobId', '')}")
        current = by_fingerprint.get(fingerprint)
        if current and current["url"] != url:
            fail(f"source-fingerprint-collision:{fingerprint}")
        if not current:
            current = {"fingerprint": fingerprint, "url": url, "jobIds": []}
            by_fingerprint[fingerprint] = current
        job_id = str(job.get("jobId") or "")
        if job_id and job_id not in current["jobIds"]:
            current["jobIds"].append(job_id)
    return [by_fingerprint[key] for key in sorted(by_fingerprint)]


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").expanduser().resolve()
    manifest = load_manifest(root)
    output_dir = root / "sources" / "materialized"
    context_dir = root / "context"
    output_dir.mkdir(parents=True, exist_ok=True)
    context_dir.mkdir(parents=True, exist_ok=True)

    materialized = []
    failures = []
    total_bytes = 0
    for source in remote_sources(manifest):
        try:
            data, final_url, declared = fetch_source(source["url"])
            mime_type, extension = sniff_image(data, declared)
            total_bytes += len(data)
            if total_bytes > MAX_TOTAL_BYTES:
                fail(f"total-size-limit:{total_bytes}")
            digest = hashlib.sha256(data).hexdigest()
            relative_path = Path("sources") / "materialized" / f"{source['fingerprint']}.{extension}"
            destination = root / relative_path
            destination.write_bytes(data)
            materialized.append({
                "fingerprint": source["fingerprint"],
                "url": source["url"],
                "finalUrl": final_url,
                "path": relative_path.as_posix(),
                "mimeType": mime_type,
                "sha256": digest,
                "byteLength": len(data),
                "jobIds": sorted(source["jobIds"]),
            })
        except Exception as exc:
            failures.append({
                "fingerprint": source["fingerprint"],
                "url": source["url"],
                "jobIds": sorted(source["jobIds"]),
                "error": str(exc),
            })

    index = {
        "kind": INDEX_KIND,
        "version": INDEX_VERSION,
        "requestId": manifest["requestId"],
        "manifestAuthority": "manifest.json",
        "sources": materialized,
        "failures": failures,
    }
    index_path = context_dir / "materialized-sources.json"
    index_path.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Materialized {len(materialized)} remote source(s); failures={len(failures)}")
    print(f"Index: {index_path}")
    return 2 if failures else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(2)
`;
}

  function requestReadme() {
    return [
      'CatalogoTop — Image Variation Request v2',
      '',
      'Use manifest.json as the authoritative contract.',
      'For source.mode=embedded, source.path points to the canonical original included in this ZIP.',
      'For source.mode=remote-url, source.url is the canonical external locator because browser CORS prevented embedding.',
      'If any job uses source.mode=remote-url, first materialize its bytes locally with: python3 tools/materialize-sources.py .',
      'The helper writes sources/materialized/... plus context/materialized-sources.json; this index is evidence only and never replaces manifest.json or changes requestId.',
      'A browser/web preview is not a source asset. Use the embedded or materialized local file as the pixel source; never recreate the product from a visual approximation.',
      'Prefer file-native deterministic image tooling for faithful transforms it can perform. Use generative editing only when the editor can ingest the actual source pixels.',
      'If the environment cannot materialize bytes or cannot apply a required edit to local pixels, report that job as capability-blocked rather than approximating it.',
      'Generate only faithful derivatives that preserve the product identity and geometry.',
      `Allowed transformations: ${ALLOWED_TRANSFORMS.join(', ')}.`,
      `Forbidden transformations: ${FORBIDDEN_TRANSFORMS.join(', ')}.`,
      '',
      'Do not modify commercial facts. Return generated images through the matching result-bundle contract using jobId and usageSignature.'
    ].join('\n');
  }

  async function buildRequest(state, options = {}) {
    if (!NS.CatalogDocument?.build || !NS.Composition || !NS.ZipStore) throw new Error('variation_bundle_dependencies_missing');
    const documentModel = options.documentModel || NS.CatalogDocument.build(state);
    const presentation = NS.Composition.normalizePresentation(state?.catalog?.presentation);
    const placements = placementsForDocument(documentModel);
    const measurements = options.measurements || measureRenderedPlacements(options.root, placements);
    const fetchFn = options.fetchFn || fetch;
    const sourceCache = new Map();
    const archiveAssets = new Map();
    const jobs = [];
    const issues = [];

    for (const placement of placements) {
      const product = placement.product;
      const sourceRef = String(product?.image || '').trim();
      if (placement.type === 'card' && hasCommercialImageGrid(product)) {
        issues.push({ placementKey: placement.placementKey, productId: placement.productId, code: String(product?.code || ''), reason: 'commercial-image-grid' });
        continue;
      }
      if (!sourceRef) {
        issues.push({ placementKey: placement.placementKey, productId: placement.productId, code: String(product?.code || ''), reason: 'missing-source' });
        continue;
      }
      if (!measurements[placement.placementKey]) {
        issues.push({ placementKey: placement.placementKey, productId: placement.productId, code: String(product?.code || ''), reason: 'target-not-measured' });
        continue;
      }

      if (!sourceCache.has(sourceRef)) {
        sourceCache.set(sourceRef, fetchSourceAsset(sourceRef, fetchFn).catch(error => ({ error })));
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
      if (source.mode === 'embedded' && !archiveAssets.has(source.path)) archiveAssets.set(source.path, source.bytes);

      const usage = {
        type: placement.type,
        pageIndex: placement.pageIndex,
        category: placement.category,
        blockId: placement.blockId,
        contentPreset: placement.style.contentPreset,
        emphasis: placement.style.emphasis,
        width: placement.style.width,
        collection: placement.collection || null
      };
      const target = {
        ...measurements[placement.placementKey],
        imageFrame: imageFrameFor(presentation, placement.productId)
      };
      const signaturePayload = {
        productId: placement.productId,
        placementKey: placement.placementKey,
        usage,
        target,
        sourceFingerprint: source.fingerprint
      };
      const usageSignature = await sha256(signaturePayload);
      jobs.push({
        jobId: `job-${usageSignature.slice(0, 20)}`,
        usageSignature,
        productId: placement.productId,
        placementKey: placement.placementKey,
        product: {
          code: String(product?.code || ''),
          description: String(product?.description || ''),
          category: String(product?.category || ''),
          subcategory: String(product?.subcategory || ''),
          specs: Array.isArray(product?.specs) ? product.specs.map(item => ({ label: String(item?.label || ''), value: String(item?.value || '') })) : []
        },
        usage,
        target,
        currentSelection: currentSelectionFor(product, presentation),
        source: source.mode === 'remote-url'
          ? {
              mode: 'remote-url',
              url: source.url,
              fingerprint: source.fingerprint,
              originalRef: source.sourceRef
            }
          : {
              mode: 'embedded',
              path: source.path,
              mimeType: source.mimeType,
              sha256: source.sha256,
              fingerprint: source.fingerprint,
              originalRef: source.sourceRef
            }
      });
    }

    jobs.sort((left, right) => left.placementKey.localeCompare(right.placementKey, 'en'));
    issues.sort((left, right) => left.placementKey.localeCompare(right.placementKey, 'en'));
    const requestIdentity = {
      kind: REQUEST_KIND,
      version: REQUEST_VERSION,
      catalog: {
        title: String(state?.catalog?.title || ''),
        templateId: String(documentModel?.template?.id || state?.catalog?.templateId || ''),
        orderedIds: (documentModel?.orderedIds || []).map(String)
      },
      jobSignatures: jobs.map(job => job.usageSignature),
      issues: issues.map(issue => ({ placementKey: issue.placementKey, reason: issue.reason }))
    };
    const requestId = await sha256(requestIdentity);
    const generatedAt = options.generatedAt || new Date().toISOString();
    const manifest = {
      kind: REQUEST_KIND,
      version: REQUEST_VERSION,
      requestId,
      generatedAt,
      catalog: {
        title: String(state?.catalog?.title || ''),
        createdAt: state?.catalog?.createdAt || null,
        stateSchemaVersion: Number(state?.schemaVersion) || null,
        documentSchemaVersion: documentModel?.schemaVersion || null,
        templateId: String(documentModel?.template?.id || state?.catalog?.templateId || ''),
        selectedCount: Number(documentModel?.selectedCount) || 0,
        pageCount: Number(documentModel?.pageCount) || 0,
        orderedIds: (documentModel?.orderedIds || []).map(String)
      },
      policy: {
        sourceAuthority: 'product.image',
        externalUrlFallback: true,
        resultScope: 'catalog-local',
        identityAndGeometryMustBePreserved: true,
        allowedTransforms: Array.from(ALLOWED_TRANSFORMS),
        forbiddenTransforms: Array.from(FORBIDDEN_TRANSFORMS)
      },
      jobs,
      issues
    };

    const entries = [
      { path: 'manifest.json', data: `${JSON.stringify(manifest, null, 2)}\n` },
      { path: 'context/layout.json', data: `${JSON.stringify(layoutContext(documentModel), null, 2)}\n` },
      { path: 'README.txt', data: `${requestReadme()}\n` },
      { path: 'tools/materialize-sources.py', data: `${sourceMaterializerScript()}\n` }
    ];
    Array.from(archiveAssets.entries()).sort(([left], [right]) => left.localeCompare(right, 'en')).forEach(([path, data]) => entries.push({ path, data }));
    const archive = await NS.ZipStore.create(entries);
    return {
      requestId,
      fileName: `catalogotop-image-request-${requestId.slice(0, 12)}.zip`,
      manifest,
      layout: layoutContext(documentModel),
      archive
    };
  }

  NS.VariationBundle = Object.freeze({
    REQUEST_KIND,
    REQUEST_VERSION,
    SOURCE_TIMEOUT_MS,
    ALLOWED_TRANSFORMS,
    FORBIDDEN_TRANSFORMS,
    sourceMaterializerScript,
    canonicalize,
    canonicalStringify,
    sha256,
    cardPlacementKey,
    collectionPlacementKey,
    hasCommercialImageGrid,
    placementsForDocument,
    measureRenderedPlacements,
    mimeExtension,
    isRemoteHttpSource,
    remoteSourceDescriptor,
    fetchSourceAsset,
    layoutContext,
    buildRequest
  });
})();