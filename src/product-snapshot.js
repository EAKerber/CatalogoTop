(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const FolderTree = NS.FolderTree;
  const Migration = NS.ProductFolderMigration;
  const ProductDomain = NS.ProductDomain;
  if (!FolderTree || !Migration || !ProductDomain) return;

  const SCHEMA_VERSION = 2;
  const MAX_PRODUCTS = 5000;

  function issue(code, message, detail = {}) {
    const error = new Error(message || code);
    error.code = code;
    Object.assign(error, detail);
    return error;
  }

  function metadata(raw) {
    const revision = Number(raw?.revision);
    return {
      revision: Number.isInteger(revision) && revision >= 0 ? revision : 0,
      updatedAt: String(raw?.updatedAt || ''),
      writeId: String(raw?.writeId || '')
    };
  }

  function productObjects(value) {
    if (!Array.isArray(value)) throw issue('product_snapshot_products_invalid', 'products deve ser um array.');
    if (value.length > MAX_PRODUCTS) throw issue('product_snapshot_too_large', `Limite de ${MAX_PRODUCTS} produtos excedido.`);
    return value.map((product, index) => {
      if (!product || typeof product !== 'object' || Array.isArray(product)) {
        throw issue('product_snapshot_product_invalid', `Produto inválido no índice ${index}.`, { index });
      }
      return { ...product };
    });
  }

  function normalizeV2(raw) {
    const folders = FolderTree.normalize(raw?.folders || []);
    const folderIds = new Set(folders.map(folder => folder.id));
    const products = productObjects(raw?.products || []).map((product, index) => {
      const folderId = String(product.folderId || '').trim();
      if (!folderId || !folderIds.has(folderId)) {
        throw issue('product_folder_invalid', `Produto no índice ${index} referencia uma pasta inexistente.`, {
          index,
          productId: String(product.id || ''),
          folderId
        });
      }
      return Migration.applyLegacyProjection({ ...product, folderId }, folders);
    });
    ProductDomain.assertUniqueCodes(products);
    return {
      schemaVersion: SCHEMA_VERSION,
      ...metadata(raw),
      folders,
      products
    };
  }

  function migrateV1(raw) {
    const products = productObjects(raw?.products || []);
    const migrated = Migration.migrateLegacyProducts(products);
    return {
      snapshot: {
        schemaVersion: SCHEMA_VERSION,
        ...metadata(raw),
        folders: migrated.folders,
        products: migrated.products
      },
      migratedFromVersion: Number(raw?.schemaVersion) || 1
    };
  }

  function read(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw issue('product_snapshot_invalid', 'Snapshot de produtos inválido.');
    }
    const version = Number(raw.schemaVersion || 1);
    if (version === 1) return migrateV1(raw);
    if (version === SCHEMA_VERSION) return { snapshot: normalizeV2(raw), migratedFromVersion: null };
    throw issue('product_snapshot_version', `Versão de ProductSnapshot não suportada: ${version}.`, { version });
  }

  function newFolderId(existingIds, idFactory) {
    if (typeof idFactory !== 'function') throw issue('folder_id_factory_required', 'Criação de pasta exige um idFactory explícito.');
    for (let attempt = 0; attempt < 32; attempt += 1) {
      const id = String(idFactory()).trim();
      if (id && id.length <= FolderTree.MAX_ID_LENGTH && !existingIds.has(id)) return id;
    }
    throw issue('folder_id_factory_failed', 'Não foi possível obter um folderId novo e válido.');
  }

  function legacySegments(product) {
    return Migration.legacyPathFromProduct(product);
  }

  function resolveLegacyPath(folders, product, { idFactory } = {}) {
    let next = FolderTree.normalize(folders || []).map(folder => ({ ...folder }));
    const existingIds = new Set(next.map(folder => folder.id));
    let parentId = null;

    for (const rawName of legacySegments(product)) {
      const name = FolderTree.displayName(rawName);
      const key = FolderTree.nameKey(name);
      const existing = next.find(folder => folder.parentId === parentId && FolderTree.nameKey(folder.name) === key);
      if (existing) {
        parentId = existing.id;
        continue;
      }
      const folder = {
        id: newFolderId(existingIds, idFactory),
        parentId,
        name
      };
      existingIds.add(id);
      next = FolderTree.createFolder(next, folder);
      parentId = folder.id;
    }

    if (!parentId) throw issue('product_folder_resolution_failed', 'Não foi possível resolver a pasta do produto.');
    return { folders: next, folderId: parentId };
  }

  function assignLegacyProduct(folders, product, { idFactory } = {}) {
    const resolved = resolveLegacyPath(folders, product, { idFactory });
    return {
      folders: resolved.folders,
      product: Migration.applyLegacyProjection({ ...product, folderId: resolved.folderId }, resolved.folders)
    };
  }

  function forWrite({ revision = 0, updatedAt = '', writeId = '', folders = [], products = [] } = {}) {
    return normalizeV2({
      schemaVersion: SCHEMA_VERSION,
      revision,
      updatedAt,
      writeId,
      folders,
      products
    });
  }

  NS.ProductSnapshot = Object.freeze({
    SCHEMA_VERSION,
    MAX_PRODUCTS,
    read,
    normalizeV2,
    resolveLegacyPath,
    assignLegacyProduct,
    forWrite
  });
})();
