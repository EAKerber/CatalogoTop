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
      if (presentation.itemStyles && typeof presentation.itemStyles === 'object') delete presentation.itemStyles[id];
      if (Array.isArray(presentation.blocks)) {
        presentation.blocks = presentation.blocks.map(block => cleanupBlock(block, id)).filter(Boolean);
      }
    }
    return draft;
  }

  async function deleteProduct(productId, { confirmDelete = true } = {}) {
    const Core = NS.Core;
    if (!Core) throw new Error('Base de produtos indisponível.');
    const current = Core.getState();
    const id = String(productId);
    const product = current.products.find(item => String(item.id) === id);
    if (!product) return false;

    if (confirmDelete) {
      const ok = window.confirm?.(`Excluir ${product.code} · ${product.description}?\n\nA exclusão também remove o item da seleção e de blocos editoriais. Essa ação altera a base compartilhada.`);
      if (!ok) return false;
    }

    Core.mutate(draft => cleanupDraftForDeletedProduct(draft, id));
    window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
    if (NS.ProductStore?.publishCurrent) await NS.ProductStore.publishCurrent();
    return true;
  }

  NS.ProductActions = {
    cleanupBlock,
    cleanupDraftForDeletedProduct,
    deleteProduct
  };
})();