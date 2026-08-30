(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};

  function issue(code, message, detail = {}) {
    const error = new Error(message || code);
    error.code = code;
    Object.assign(error, detail);
    return error;
  }

  function codeKey(value) {
    return String(value ?? '').trim().toLowerCase();
  }

  function findCodeConflict(products, code, { exceptId = null } = {}) {
    const key = codeKey(code);
    if (!key) return null;
    const excluded = exceptId == null ? null : String(exceptId);
    return (Array.isArray(products) ? products : []).find(product => {
      if (!product || typeof product !== 'object') return false;
      if (excluded !== null && String(product.id) === excluded) return false;
      return codeKey(product.code) === key;
    }) || null;
  }

  function assertCodeAvailable(products, code, options = {}) {
    const conflict = findCodeConflict(products, code, options);
    if (!conflict) return true;
    throw issue('product_code_duplicate', `Código de produto já utilizado: ${String(code || '').trim()}.`, {
      code: String(code || '').trim(),
      conflictId: String(conflict.id || ''),
      conflictCode: String(conflict.code || '')
    });
  }

  function duplicateCodes(products) {
    const firstByKey = new Map();
    const duplicates = [];
    (Array.isArray(products) ? products : []).forEach((product, index) => {
      const key = codeKey(product?.code);
      if (!key) return;
      if (!firstByKey.has(key)) {
        firstByKey.set(key, { product, index });
        return;
      }
      const first = firstByKey.get(key);
      duplicates.push({
        key,
        code: String(product?.code || '').trim(),
        firstIndex: first.index,
        index,
        firstId: String(first.product?.id || ''),
        id: String(product?.id || '')
      });
    });
    return duplicates;
  }

  function assertUniqueCodes(products) {
    const conflict = duplicateCodes(products)[0];
    if (!conflict) return true;
    throw issue('product_code_duplicate', `Código de produto duplicado: ${conflict.code}.`, conflict);
  }

  function cloneValue(value) {
    if (Array.isArray(value)) return value.map(cloneValue);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)]));
    }
    return value;
  }

  function cloneAsNewProduct(sourceProduct, { idFactory, now } = {}) {
    const source = sourceProduct && typeof sourceProduct === 'object' ? sourceProduct : null;
    if (!source) throw issue('product_clone_source_invalid', 'Produto de origem inválido.');
    if (typeof idFactory !== 'function') throw issue('product_clone_id_factory_required', 'Clone de produto exige idFactory explícito.');
    const id = String(idFactory() || '').trim();
    if (!id) throw issue('product_clone_id_invalid', 'Clone de produto recebeu um id vazio.');
    const updatedAt = typeof now === 'function'
      ? String(now() || '')
      : String(now || new Date().toISOString());

    return {
      id,
      folderId: String(source.folderId || '').trim(),
      code: '',
      description: String(source.description || ''),
      category: String(source.category || ''),
      subcategory: String(source.subcategory || ''),
      price: String(source.price || ''),
      quantityPrice: cloneValue(source.quantityPrice ?? null),
      status: source.status === 'Inativo' ? 'Inativo' : 'Ativo',
      notes: String(source.notes || ''),
      image: String(source.image || ''),
      imageGallery: cloneValue(Array.isArray(source.imageGallery) ? source.imageGallery : []),
      specs: cloneValue(Array.isArray(source.specs) ? source.specs : []),
      variants: cloneValue(Array.isArray(source.variants) ? source.variants : []),
      tableRows: cloneValue(Array.isArray(source.tableRows) ? source.tableRows : []),
      updatedAt
    };
  }

  NS.ProductDomain = Object.freeze({
    codeKey,
    findCodeConflict,
    assertCodeAvailable,
    duplicateCodes,
    assertUniqueCodes,
    cloneAsNewProduct
  });
})();
