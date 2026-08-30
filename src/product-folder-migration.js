(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const FolderTree = NS.FolderTree;
  if (!FolderTree) return;

  const MIGRATION_NAMESPACE = 'product-folders-v1';
  const ID_PREFIX = 'pf1-';
  const PATH_SEPARATOR = '\u001f';
  const FNV_OFFSET = 0xcbf29ce484222325n;
  const FNV_PRIME = 0x100000001b3n;
  const MASK_64 = 0xffffffffffffffffn;

  function issue(code, message, detail = {}) {
    const error = new Error(message || code);
    error.code = code;
    Object.assign(error, detail);
    return error;
  }

  function utf8Bytes(text) {
    if (typeof TextEncoder !== 'function') throw issue('text_encoder_unavailable', 'TextEncoder indisponível para migração determinística.');
    return new TextEncoder().encode(String(text));
  }

  function fnv1a64(text) {
    let hash = FNV_OFFSET;
    for (const byte of utf8Bytes(text)) {
      hash ^= BigInt(byte);
      hash = (hash * FNV_PRIME) & MASK_64;
    }
    return hash.toString(16).padStart(16, '0');
  }

  function deterministicFolderId(segmentKeys) {
    const keys = Array.isArray(segmentKeys) ? segmentKeys.map(String) : [];
    if (!keys.length || keys.some(key => !key)) throw issue('folder_path_invalid', 'Caminho canônico inválido para gerar folderId.');
    const canonical = `${MIGRATION_NAMESPACE}\u0000${keys.join(PATH_SEPARATOR)}`;
    const left = fnv1a64(`a\u0000${canonical}`);
    const right = fnv1a64(`b\u0000${canonical}`);
    return `${ID_PREFIX}${left}${right}`;
  }

  function normalizeLegacyCategory(value) {
    return FolderTree.displayName(value) || 'Sem categoria';
  }

  function legacyPathFromProduct(product) {
    const category = normalizeLegacyCategory(product?.category);
    const subcategory = FolderTree.displayName(product?.subcategory);
    return subcategory ? [category, subcategory] : [category];
  }

  function pathKeys(path) {
    return path.map(segment => FolderTree.nameKey(segment));
  }

  function canonicalPathKey(keys) {
    return keys.join(PATH_SEPARATOR);
  }

  function compareCanonical(a, b) {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }

  function prefixRecords(path) {
    const records = [];
    for (let depth = 1; depth <= path.length; depth += 1) {
      const segments = path.slice(0, depth);
      const keys = pathKeys(segments);
      records.push({ segments, keys, key: canonicalPathKey(keys) });
    }
    return records;
  }

  function migrateLegacyProducts(products) {
    const input = Array.isArray(products) ? products : [];
    const records = new Map();
    const productPaths = [];

    for (const product of input) {
      const path = legacyPathFromProduct(product);
      productPaths.push(path);
      for (const record of prefixRecords(path)) {
        if (!records.has(record.key)) records.set(record.key, record);
      }
    }

    const usedIds = new Map();
    const sorted = Array.from(records.values()).sort((a, b) => a.keys.length - b.keys.length || compareCanonical(a.key, b.key));
    const folders = sorted.map(record => {
      const id = deterministicFolderId(record.keys);
      const prior = usedIds.get(id);
      if (prior && prior !== record.key) {
        throw issue('folder_id_collision', 'Colisão de folderId entre caminhos canônicos distintos.', { id, firstPathKey: prior, secondPathKey: record.key });
      }
      usedIds.set(id, record.key);
      const parentKeys = record.keys.slice(0, -1);
      return {
        id,
        parentId: parentKeys.length ? deterministicFolderId(parentKeys) : null,
        name: record.segments[record.segments.length - 1]
      };
    });

    const normalizedFolders = FolderTree.normalize(folders);
    const folderIdByPath = new Map(sorted.map(record => [record.key, deterministicFolderId(record.keys)]));

    const migratedProducts = input.map((product, index) => {
      const path = productPaths[index];
      const folderId = folderIdByPath.get(canonicalPathKey(pathKeys(path)));
      const projection = projectLegacyForFolder(normalizedFolders, folderId);
      return {
        ...product,
        folderId,
        category: projection.category,
        subcategory: projection.subcategory
      };
    });

    return {
      migrationNamespace: MIGRATION_NAMESPACE,
      folders: normalizedFolders,
      products: migratedProducts
    };
  }

  function projectLegacyPath(path) {
    const names = (Array.isArray(path) ? path : [])
      .map(item => typeof item === 'string' ? FolderTree.displayName(item) : FolderTree.displayName(item?.name))
      .filter(Boolean);
    if (!names.length) return { category: 'Sem categoria', subcategory: '' };
    return {
      category: names[0],
      subcategory: names.slice(1).join(' / ')
    };
  }

  function projectLegacyForFolder(folders, folderId) {
    return projectLegacyPath(FolderTree.pathOf(folders, folderId));
  }

  function applyLegacyProjection(product, folders) {
    const folderId = String(product?.folderId || '').trim();
    if (!folderId) throw issue('product_folder_missing', 'Produto sem folderId para projeção legada.');
    const projection = projectLegacyForFolder(folders, folderId);
    return { ...product, category: projection.category, subcategory: projection.subcategory };
  }

  NS.ProductFolderMigration = Object.freeze({
    MIGRATION_NAMESPACE,
    ID_PREFIX,
    deterministicFolderId,
    legacyPathFromProduct,
    migrateLegacyProducts,
    projectLegacyPath,
    projectLegacyForFolder,
    applyLegacyProjection
  });
})();
