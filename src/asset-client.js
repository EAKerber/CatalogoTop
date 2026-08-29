(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const MAX_EDGE = 1800;
  const JPEG_WEBP_QUALITY = 0.86;

  function isManagedAsset(value) {
    return /^\/api\/assets\/sha256\/[a-f0-9]{64}$/i.test(String(value || ''));
  }

  function isDataUrl(value) {
    return /^data:image\//i.test(String(value || ''));
  }

  async function dataUrlToBlob(dataUrl) {
    const response = await fetch(dataUrl);
    return response.blob();
  }

  async function decodeImage(blob) {
    if ('createImageBitmap' in window) return createImageBitmap(blob);
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(blob);
      image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler a imagem.')); };
      image.src = url;
    });
  }

  async function prepareImage(file) {
    const source = file instanceof Blob ? file : new Blob([file]);
    if (!String(source.type || '').startsWith('image/')) throw new Error('Arquivo selecionado não é uma imagem.');
    if (source.type === 'image/svg+xml' || source.type === 'image/gif') return source;

    const image = await decodeImage(source);
    const width = image.width || image.naturalWidth || 0;
    const height = image.height || image.naturalHeight || 0;
    if (!width || !height) throw new Error('Dimensões da imagem inválidas.');

    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d', { alpha: true });
    context.drawImage(image, 0, 0, targetWidth, targetHeight);
    if (typeof image.close === 'function') image.close();

    const outputType = source.type === 'image/png' ? 'image/webp' : 'image/webp';
    const blob = await new Promise(resolve => canvas.toBlob(resolve, outputType, JPEG_WEBP_QUALITY));
    return blob || source;
  }

  async function uploadBlob(blob) {
    const response = await fetch('/api/assets', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': blob.type || 'application/octet-stream' },
      body: blob
    });
    if (response.status === 401) {
      const error = new Error('write_session_required');
      error.code = 'write_session_required';
      throw error;
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || payload.error || `Falha no upload (${response.status}).`);
    return payload.url;
  }

  async function materializeImageValue(value) {
    const current = String(value || '');
    if (!isDataUrl(current)) return current;
    return uploadBlob(await dataUrlToBlob(current));
  }

  async function materializeProducts(products) {
    const clone = typeof structuredClone === 'function' ? structuredClone(products) : JSON.parse(JSON.stringify(products));
    for (const product of clone) {
      product.image = await materializeImageValue(product.image);
      if (Array.isArray(product.imageGallery)) {
        for (const entry of product.imageGallery) entry.image = await materializeImageValue(entry.image);
      }
      if (Array.isArray(product.variants)) {
        for (const variant of product.variants) variant.image = await materializeImageValue(variant.image);
      }
    }
    return clone;
  }

  NS.AssetClient = {
    MAX_EDGE,
    prepareImage,
    uploadBlob,
    materializeProducts,
    isManagedAsset,
    isDataUrl
  };
})();