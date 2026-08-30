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

  function requestReadme() {
    return [
      'CatalogoTop — Image Variation Request v2',
      '',
      'Use manifest.json as the authoritative contract.',
      'For source.mode=embedded, source.path points to the canonical original included in this ZIP.',
      'For source.mode=remote-url, source.url is the canonical external locator because browser CORS prevented embedding; retrieve it subject to your own network/security policy.',
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
      { path: 'README.txt', data: `${requestReadme()}\n` }
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