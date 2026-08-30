(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const FolderTree = NS.FolderTree;
  const ProductDomain = NS.ProductDomain;
  if (!FolderTree || !ProductDomain) return;

  function normalizeText(value) {
    return String(value ?? '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  }

  function scopedFolderIds(folders, folderId, { recursive = true } = {}) {
    if (folderId == null || String(folderId).trim() === '') return null;
    const id = String(folderId).trim();
    FolderTree.pathOf(folders, id);
    const ids = new Set([id]);
    if (recursive) FolderTree.descendantsOf(folders, id).forEach(folder => ids.add(folder.id));
    return ids;
  }

  function pathText(folders, folderId) {
    if (!folderId) return '';
    return FolderTree.pathOf(folders, folderId).map(folder => folder.name).join(' / ');
  }

  function productText(product) {
    const specs = Array.isArray(product?.specs)
      ? product.specs.flatMap(spec => [spec?.label, spec?.value])
      : [];
    return normalizeText([
      product?.notes,
      ...specs
    ].filter(Boolean).join(' '));
  }

  function matchScore(product, folders, text) {
    const needle = normalizeText(text);
    if (!needle) return 0;

    const rawCode = String(product?.code || '');
    const code = normalizeText(rawCode);
    const description = normalizeText(product?.description);
    const path = normalizeText(pathText(folders, product?.folderId));
    const compatibility = normalizeText([product?.category, product?.subcategory].filter(Boolean).join(' / '));
    const extras = productText(product);

    if (ProductDomain.codeKey(rawCode) === ProductDomain.codeKey(text)) return 0;
    if (code.startsWith(needle)) return 1;
    if (description.includes(needle)) return 2;
    if (path.includes(needle) || compatibility.includes(needle)) return 3;
    if (code.includes(needle) || extras.includes(needle)) return 4;
    return null;
  }

  function query({ products = [], folders = [], folderId = null, recursive = true, text = '' } = {}) {
    const source = Array.isArray(products) ? products : [];
    const scope = scopedFolderIds(folders, folderId, { recursive });
    const needle = normalizeText(text);

    return source
      .map((product, index) => ({
        product,
        index,
        score: scope && !scope.has(String(product?.folderId || '')) ? null : matchScore(product, folders, needle)
      }))
      .filter(entry => entry.score !== null)
      .sort((left, right) => left.score - right.score || left.index - right.index)
      .map(entry => entry.product);
  }

  NS.ProductQuery = Object.freeze({
    normalizeText,
    scopedFolderIds,
    matchScore,
    query
  });
})();
