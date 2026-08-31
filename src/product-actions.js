(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};

  function cleanupBlock(block, productId) {
    if (!block || typeof block !== 'object') return block;
    const id = String(productId);
    const memberIds = Array.isArray(block.memberIds) ? block.memberIds.map(String).filter(memberId => memberId !== id) : null;
    const itemStyles = block.itemStyles && typeof block.itemStyles === 'object' ? { ...block.itemStyles } : null;
    if (itemStyles) delete itemStyles[id];

    const next = {
      ...block,
      ...(memberIds ? { memberIds } : {}),
      ...(itemStyles ? { itemStyles } : {})
    };

    if ((block.type === 'collection' || block.type === 'table') && memberIds && memberIds.length < 2) return null;
    return next;
  }

  function cleanupDraftForDeletedProduct(draft, productId) {
    if (!draft || typeof draft !== 'object') return draft;
    const id = String(productId);
    draft.products = Array.isArray(draft.products) ? draft.products.filter(product => String(product.id) !== id) : [];
    draft.selectedIds = Array.isArray(draft.selectedIds) ? draft.selectedIds.map(String).filter(selectedId => selectedId !== id) : [];

    const presentation = draft.catalog?.presentation;
    if (presentation && typeof presentation === 'object') {
      presentation.order = NS.CatalogOrder?.removeFromOrder
        ? NS.CatalogOrder.removeFromOrder(presentation.order, id)
        : (Array.isArray(presentation.order) ? presentation.order.map(String).filter(item => item !== id) : []);
      if (presentation.itemStyles && typeof presentation.itemStyles === 'object') delete presentation.itemStyles[id];
      if (presentation.imageFrames && typeof presentation.imageFrames === 'object') delete presentation.imageFrames[id];
      if (presentation.imageSelections && typeof presentation.imageSelections === 'object') delete presentation.imageSelections[id];
      if (presentation.imageVariants && typeof presentation.imageVariants === 'object') delete presentation.imageVariants[id];
      if (Array.isArray(presentation.blocks)) {
        presentation.blocks = presentation.blocks.map(block => cleanupBlock(block, id)).filter(Boolean);
      }
    }
    return draft;
  }

  async function publishCurrent() {
    if (NS.ProductStore?.publishCurrent) await NS.ProductStore.publishCurrent();
  }

  async function deleteProducts(productIds, { confirmDelete = true } = {}) {
    const Core = NS.Core;
    if (!Core) throw new Error('Base de produtos indisponível.');
    const requested = Array.isArray(productIds) ? productIds : [productIds];
    const ids = Array.from(new Set(requested.map(value => String(value || '').trim()).filter(Boolean)));
    if (!ids.length) return false;

    const current = Core.getState();
    const byId = new Map(current.products.map(product => [String(product.id), product]));
    const products = ids.map(id => byId.get(id)).filter(Boolean);
    if (!products.length) return false;
    const effectiveIds = products.map(product => String(product.id));

    if (confirmDelete) {
      const message = products.length === 1
        ? `Excluir ${products[0].code} · ${products[0].description}?\n\nA exclusão também remove o item da seleção, da ordem editorial e de blocos. Essa ação altera a base compartilhada.`
        : `Excluir ${products.length} produtos selecionados?\n\nA exclusão também remove esses itens da seleção, da ordem editorial e de blocos. Essa ação altera a base compartilhada.`;
      if (!window.confirm?.(message)) return false;
    }

    Core.mutate(draft => {
      effectiveIds.forEach(id => cleanupDraftForDeletedProduct(draft, id));
    });
    window.dispatchEvent(new CustomEvent('catalogotop:products-updated', {
      detail: { type: 'products-deleted', deletedProductIds: effectiveIds.slice() }
    }));
    await publishCurrent();
    return true;
  }

  function deleteProduct(productId, options = {}) {
    return deleteProducts([productId], options);
  }

  async function deleteCategory(categoryName, { confirmDelete = true } = {}) {
    const Core = NS.Core;
    if (!Core) throw new Error('Base de produtos indisponível.');
    const category = String(categoryName || '').trim();
    if (!category) return false;

    const current = Core.getState();
    const products = current.products.filter(product => String(product.category || '').trim() === category);
    if (!products.length) return false;

    if (confirmDelete) {
      const count = products.length;
      const ok = window.confirm?.(
        `Excluir a categoria “${category}” e ${count} ${count === 1 ? 'produto' : 'produtos'}?\n\n`
        + 'As categorias são derivadas dos produtos. Portanto, excluir esta categoria remove todos os produtos dela da base compartilhada, do catálogo atual, da ordem editorial e de Collection/Table.'
      );
      if (!ok) return false;
    }

    const ids = products.map(product => String(product.id));
    Core.mutate(draft => {
      ids.forEach(id => cleanupDraftForDeletedProduct(draft, id));
    });
    window.dispatchEvent(new CustomEvent('catalogotop:products-updated', {
      detail: { type: 'category-deleted', category, deletedProductIds: ids.slice() }
    }));
    await publishCurrent();
    return true;
  }

  NS.ProductActions = {
    cleanupBlock,
    cleanupDraftForDeletedProduct,
    deleteProducts,
    deleteProduct,
    deleteCategory
  };
})();
