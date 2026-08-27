(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};

  function notify() {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('catalogotop:products-updated'));
  }

  function mutatePresentation(mutator) {
    if (!NS.Core || !NS.Composition) return null;
    const result = NS.Core.mutate(draft => {
      const presentation = NS.Composition.normalizePresentation(draft.catalog?.presentation);
      mutator(presentation, draft);
      draft.catalog.presentation = NS.Composition.normalizePresentation(presentation);
    });
    notify();
    return result;
  }

  function setCardStyle(productId, patch) {
    const id = String(productId);
    return mutatePresentation(presentation => {
      presentation.itemStyles[id] = {
        ...NS.Composition.styleFor(presentation, id),
        ...(patch || {})
      };
    });
  }

  function blockIndex(presentation, blockId, type) {
    return presentation.blocks.findIndex(block => String(block?.id || '') === String(blockId) && (!type || block.type === type));
  }

  function updateCollection(blockId, patch) {
    return mutatePresentation(presentation => {
      const index = blockIndex(presentation, blockId, 'collection');
      if (index < 0 || !NS.Collection) return;
      const current = NS.Collection.normalizeBlock(presentation.blocks[index]);
      presentation.blocks[index] = NS.Collection.normalizeBlock({ ...current, ...(patch || {}) });
    });
  }

  function setCollectionMemberStyle(blockId, productId, patch) {
    const id = String(productId);
    return mutatePresentation(presentation => {
      const index = blockIndex(presentation, blockId, 'collection');
      if (index < 0 || !NS.Collection) return;
      const block = NS.Collection.normalizeBlock(presentation.blocks[index]);
      if (!block.memberIds.includes(id)) return;
      block.itemStyles[id] = { ...NS.Collection.memberStyleFor(block, id), ...(patch || {}) };
      presentation.blocks[index] = NS.Collection.normalizeBlock(block);
    });
  }

  function updateTable(blockId, patch) {
    return mutatePresentation(presentation => {
      const index = blockIndex(presentation, blockId, 'table');
      if (index < 0 || !NS.TableBlock) return;
      const current = NS.TableBlock.normalizeBlock(presentation.blocks[index]);
      const next = { ...current, ...(patch || {}) };
      if (patch?.rowSource && patch.rowSource !== current.rowSource && patch.columns == null) {
        next.columns = NS.TableBlock.defaultColumns(patch.rowSource);
      }
      presentation.blocks[index] = NS.TableBlock.normalizeBlock(next);
    });
  }

  function dissolveBlock(blockId, type) {
    return mutatePresentation(presentation => {
      const index = blockIndex(presentation, blockId, type);
      if (index >= 0) presentation.blocks.splice(index, 1);
    });
  }

  function dissolveCollection(blockId) {
    return dissolveBlock(blockId, 'collection');
  }

  function dissolveTable(blockId) {
    return dissolveBlock(blockId, 'table');
  }

  function moveOrderUnit(sourceUnitId, targetUnitId, position = 'before') {
    const current = NS.Core?.getState?.();
    if (!current || !NS.CatalogOrder) return null;
    const nextOrder = NS.CatalogOrder.moveUnit(current, sourceUnitId, targetUnitId, position);
    return mutatePresentation(presentation => { presentation.order = nextOrder; });
  }

  function moveOrderUnitRelative(sourceUnitId, delta) {
    const current = NS.Core?.getState?.();
    if (!current || !NS.CatalogOrder) return null;
    const nextOrder = NS.CatalogOrder.moveUnitRelative(current, sourceUnitId, delta);
    return mutatePresentation(presentation => { presentation.order = nextOrder; });
  }

  function moveBlockMember(blockId, productId, delta) {
    const current = NS.Core?.getState?.();
    if (!current || !NS.CatalogOrder?.moveBlockMember) return null;
    const nextOrder = NS.CatalogOrder.moveBlockMember(current, blockId, productId, delta);
    return mutatePresentation(presentation => { presentation.order = nextOrder; });
  }

  NS.PresentationActions = {
    mutatePresentation,
    setCardStyle,
    updateCollection,
    setCollectionMemberStyle,
    updateTable,
    dissolveCollection,
    dissolveTable,
    moveOrderUnit,
    moveOrderUnitRelative,
    moveBlockMember
  };
})();
