(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  if (!NS.ZipReader || !NS.ZipStore || !NS.VariationBundle) return;

  const RESULT_KIND = 'catalogotop.image-variation-result';
  const RESULT_VERSION = 1;
  const MAX_MANIFEST_BYTES = 1024 * 1024;
  const MAX_VARIANTS = 128;
  const RESULT_MIME_TYPES = Object.freeze(['image/png', 'image/jpeg', 'image/webp']);
  const RESULT_MIME_SET = new Set(RESULT_MIME_TYPES);

  function fail(code, detail = '') {
    const error = new Error(detail ? `${code}:${detail}` : code);
    error.code = code;
    throw error;
  }

  function cleanText(value, max = 160) {
    const text = String(value || '').trim();
    if (text.length > max) fail('result_text_too_long');
    return text;
  }

  function hex64(value, code) {
    const text = String(value || '').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(text)) fail(code || 'result_hash_invalid');
    return text;
  }

  function normalizeTransforms(value) {
    const allowed = new Set(NS.VariationBundle.ALLOWED_TRANSFORMS || []);
    const source = Array.isArray(value) ? value : [];
    if (source.length > 16) fail('result_transforms_limit');
    const seen = new Set();
    const result = [];
    source.forEach(item => {
      const transform = cleanText(item, 80);
      if (!transform || !allowed.has(transform)) fail('result_transform_not_allowed', transform || 'empty');
      if (!seen.has(transform)) {
        seen.add(transform);
        result.push(transform);
      }
    });
    return result;
  }

  function normalizeVariant(raw, index) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('result_variant_invalid', String(index));
    const jobId = cleanText(raw.jobId, 80);
    const usageSignature = hex64(raw.usageSignature, 'result_usage_signature_invalid');
    const productId = cleanText(raw.productId, 160);
    const placementKey = cleanText(raw.placementKey, 260);
    if (!jobId || !productId || !placementKey) fail('result_variant_identity_missing', String(index));
    if (!raw.asset || typeof raw.asset !== 'object' || Array.isArray(raw.asset)) fail('result_asset_invalid', jobId);
    const path = NS.ZipStore.normalizePath(raw.asset.path);
    const mimeType = cleanText(raw.asset.mimeType, 80).toLowerCase();
    if (!RESULT_MIME_SET.has(mimeType)) fail('result_mime_not_allowed', mimeType || 'empty');
    const sha256 = hex64(raw.asset.sha256, 'result_asset_hash_invalid');
    const label = cleanText(raw.label || '', 120);
    const generator = cleanText(raw.generator || '', 120);
    const transforms = normalizeTransforms(raw.transforms);
    return {
      index,
      resultId: cleanText(raw.resultId || `result-${index + 1}`, 120),
      jobId,
      usageSignature,
      productId,
      placementKey,
      label,
      generator,
      transforms,
      asset: { path, mimeType, sha256 }
    };
  }

  function normalizeManifest(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('result_manifest_invalid');
    if (raw.kind !== RESULT_KIND || Number(raw.version) !== RESULT_VERSION) fail('result_manifest_version');
    const requestId = hex64(raw.requestId, 'result_request_id_invalid');
    const source = Array.isArray(raw.variants) ? raw.variants : [];
    if (!source.length) fail('result_no_variants');
    if (source.length > MAX_VARIANTS) fail('result_variant_limit');
    const variants = source.map(normalizeVariant);
    const identities = new Set();
    variants.forEach(variant => {
      const key = `${variant.jobId}:${variant.asset.sha256}:${variant.resultId}`;
      if (identities.has(key)) fail('result_variant_duplicate', key);
      identities.add(key);
    });
    return {
      kind: RESULT_KIND,
      version: RESULT_VERSION,
      requestId,
      generatedAt: cleanText(raw.generatedAt || '', 80) || null,
      generator: cleanText(raw.generator || '', 120) || null,
      variants
    };
  }

  function sniffMime(bytes) {
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0);
    if (data.length >= 8
      && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47
      && data[4] === 0x0d && data[5] === 0x0a && data[6] === 0x1a && data[7] === 0x0a) return 'image/png';
    if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
    if (data.length >= 12
      && data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46
      && data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) return 'image/webp';
    return '';
  }

  async function readPackage(input, options = {}) {
    const archive = await NS.ZipReader.open(input, options);
    const manifestBytes = archive.get('manifest.json');
    if (!manifestBytes) fail('result_manifest_missing');
    if (manifestBytes.byteLength > MAX_MANIFEST_BYTES) fail('result_manifest_size_limit');
    let raw;
    try { raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes)); }
    catch { fail('result_manifest_json'); }
    return Object.freeze({ archive, manifest: normalizeManifest(raw) });
  }

  function requestJobs(currentRequest) {
    const jobs = currentRequest?.manifest?.jobs;
    if (!currentRequest?.requestId || !Array.isArray(jobs)) fail('result_current_request_invalid');
    return jobs;
  }

  async function validatePackage(packageData, currentRequest) {
    const manifest = packageData?.manifest;
    const archive = packageData?.archive;
    if (!manifest || !archive) fail('result_package_invalid');
    if (manifest.requestId !== String(currentRequest?.requestId || '').toLowerCase()) fail('result_request_stale');
    const jobs = requestJobs(currentRequest);
    const byJob = new Map(jobs.map(job => [String(job.jobId), job]));
    const matchedJobs = new Set();
    const assets = [];

    for (const variant of manifest.variants) {
      const job = byJob.get(variant.jobId);
      if (!job) fail('result_job_unknown', variant.jobId);
      if (String(job.productId) !== variant.productId
        || String(job.placementKey) !== variant.placementKey
        || String(job.usageSignature).toLowerCase() !== variant.usageSignature) {
        fail('result_job_mismatch', variant.jobId);
      }
      const bytes = archive.get(variant.asset.path);
      if (!bytes) fail('result_asset_missing', variant.asset.path);
      const actualMime = sniffMime(bytes);
      if (!actualMime || actualMime !== variant.asset.mimeType) fail('result_asset_mime_mismatch', variant.asset.path);
      const actualHash = await NS.VariationBundle.sha256(bytes);
      if (actualHash !== variant.asset.sha256) fail('result_asset_hash_mismatch', variant.asset.path);
      matchedJobs.add(variant.jobId);
      assets.push({
        variant,
        bytes,
        job,
        sourceSha256: String(job.source?.sha256 || '').toLowerCase()
      });
    }

    const referenced = new Set(['manifest.json', ...assets.map(item => item.variant.asset.path)]);
    const ignoredFiles = Array.from(archive.files.keys()).filter(path => !referenced.has(path)).sort((a, b) => a.localeCompare(b, 'en'));
    const missingJobs = jobs.filter(job => !matchedJobs.has(String(job.jobId))).map(job => ({
      jobId: String(job.jobId),
      productId: String(job.productId),
      placementKey: String(job.placementKey)
    }));
    return Object.freeze({
      manifest,
      assets,
      ignoredFiles,
      missingJobs,
      matchedJobCount: matchedJobs.size
    });
  }

  async function prepareValidated(validated, prepareImage = NS.AssetClient?.prepareImage) {
    if (typeof prepareImage !== 'function') fail('result_image_preparer_missing');
    const prepared = [];
    for (const item of validated.assets) {
      const source = new Blob([item.bytes], { type: item.variant.asset.mimeType });
      let blob;
      try { blob = await prepareImage(source); }
      catch (error) { fail('result_image_decode_failed', error?.message || item.variant.asset.path); }
      if (!(blob instanceof Blob) || !String(blob.type || '').startsWith('image/')) fail('result_image_prepare_invalid', item.variant.asset.path);
      prepared.push({ ...item, blob });
    }
    return Object.freeze({ ...validated, prepared });
  }

  async function uploadPrepared(preparedData, uploadBlob = NS.AssetClient?.uploadBlob) {
    if (typeof uploadBlob !== 'function') fail('result_uploader_missing');
    const urlsByHash = new Map();
    const uploaded = [];
    for (const item of preparedData.prepared) {
      let url = urlsByHash.get(item.variant.asset.sha256);
      if (!url) {
        url = await uploadBlob(item.blob);
        if (!url) fail('result_upload_empty', item.variant.asset.path);
        urlsByHash.set(item.variant.asset.sha256, String(url));
      }
      uploaded.push({ ...item, image: String(url) });
    }
    return Object.freeze({ ...preparedData, uploaded });
  }

  function importedEntry(item, requestId) {
    const sha = item.variant.asset.sha256;
    const jobPart = item.variant.jobId.replace(/^job-/, '').slice(0, 10);
    return {
      id: `external-${jobPart}-${sha.slice(0, 12)}`,
      label: item.variant.label || 'Variação externa',
      image: item.image,
      provenance: {
        kind: 'external-variation',
        requestId,
        jobId: item.variant.jobId,
        usageSignature: item.variant.usageSignature,
        placementKey: item.variant.placementKey,
        sourceSha256: item.sourceSha256 || null,
        resultSha256: sha,
        mimeType: item.variant.asset.mimeType,
        transforms: item.variant.transforms.slice(),
        generator: item.variant.generator || null
      }
    };
  }

  function sameImportedVariant(entry, candidate) {
    const left = entry?.provenance;
    const right = candidate?.provenance;
    return left?.kind === 'external-variation'
      && left.requestId === right?.requestId
      && left.jobId === right?.jobId
      && left.resultSha256 === right?.resultSha256;
  }

  function commitUploaded(uploadedData) {
    if (!NS.Core?.mutate || !NS.Composition?.normalizePresentation) fail('result_commit_dependencies_missing');
    let imported = 0;
    let duplicates = 0;
    NS.Core.mutate(draft => {
      const presentation = NS.Composition.normalizePresentation(draft.catalog?.presentation);
      presentation.imageVariants = presentation.imageVariants && typeof presentation.imageVariants === 'object'
        ? { ...presentation.imageVariants }
        : {};
      uploadedData.uploaded.forEach(item => {
        const productId = item.variant.productId;
        const list = Array.isArray(presentation.imageVariants[productId]) ? presentation.imageVariants[productId].slice() : [];
        const candidate = importedEntry(item, uploadedData.manifest.requestId);
        if (list.some(entry => sameImportedVariant(entry, candidate))) {
          duplicates += 1;
          return;
        }
        list.push(candidate);
        presentation.imageVariants[productId] = list;
        imported += 1;
      });
      draft.catalog.presentation = NS.Composition.normalizePresentation(presentation);
    });
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
    return {
      imported,
      duplicates,
      missingJobs: uploadedData.missingJobs.length,
      ignoredFiles: uploadedData.ignoredFiles.length,
      requestId: uploadedData.manifest.requestId
    };
  }

  NS.VariationResult = Object.freeze({
    RESULT_KIND,
    RESULT_VERSION,
    MAX_MANIFEST_BYTES,
    MAX_VARIANTS,
    RESULT_MIME_TYPES,
    sniffMime,
    normalizeManifest,
    readPackage,
    validatePackage,
    prepareValidated,
    uploadPrepared,
    commitUploaded
  });
})();
