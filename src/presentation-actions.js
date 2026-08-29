(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};

  const IMAGE_FRAME_FITS = Object.freeze([
    { id: 'contain', name: 'Conter' },
    { id: 'cover', name: 'Preencher' }
  ]);
  const DEFAULT_IMAGE_FRAME = Object.freeze({ fit: 'contain', zoom: 1, x: 50, y: 50 });

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

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function normalizeImageFrame(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const fit = IMAGE_FRAME_FITS.some(item => item.id === source.fit) ? source.fit : DEFAULT_IMAGE_FRAME.fit;
    return {
      fit,
      zoom: Math.round(clampNumber(source.zoom, 1, 2.4, DEFAULT_IMAGE_FRAME.zoom) * 100) / 100,
      x: Math.round(clampNumber(source.x, 0, 100, DEFAULT_IMAGE_FRAME.x)),
      y: Math.round(clampNumber(source.y, 0, 100, DEFAULT_IMAGE_FRAME.y))
    };
  }

  function imageFrameFor(presentation, productId) {
    const id = String(productId || '');
    const frames = presentation?.imageFrames && typeof presentation.imageFrames === 'object' ? presentation.imageFrames : {};
    return normalizeImageFrame(frames[id]);
  }

  function isDefaultImageFrame(frame) {
    const normalized = normalizeImageFrame(frame);
    return normalized.fit === DEFAULT_IMAGE_FRAME.fit
      && normalized.zoom === DEFAULT_IMAGE_FRAME.zoom
      && normalized.x === DEFAULT_IMAGE_FRAME.x
      && normalized.y === DEFAULT_IMAGE_FRAME.y;
  }

  function uniqueIds(values) {
    const seen = new Set();
    return (Array.isArray(values) ? values : []).map(String).filter(id => {
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function editorialSelectionFor(originProductId) {
    const origin = String(originProductId || '');
    const selected = uniqueIds(NS.ComposerSelection?.ids?.());
    return selected.length > 1 && selected.includes(origin) ? selected : [origin].filter(Boolean);
  }

  function blockIndex(presentation, blockId, type) {
    return presentation.blocks.findIndex(block => String(block?.id || '') === String(blockId) && (!type || block.type === type));
  }

  function blockIndexForProduct(presentation, productId) {
    const id = String(productId);
    return presentation.blocks.findIndex(block => (Array.isArray(block?.memberIds) ? block.memberIds : []).map(String).includes(id));
  }

  function collectionCompatiblePatch(patch) {
    const allowed = new Set(['emphasis', 'width', 'priceStyle']);
    return Object.fromEntries(Object.entries(patch || {}).filter(([key]) => allowed.has(key)));
  }

  function applyStylePatchToProduct(presentation, productId, patch) {
    const id = String(productId);
    const index = blockIndexForProduct(presentation, id);
    const block = index >= 0 ? presentation.blocks[index] : null;
    if (block?.type === 'collection' && NS.Collection) {
      const compatible = collectionCompatiblePatch(patch);
      if (!Object.keys(compatible).length) return false;
      const normalized = NS.Collection.normalizeBlock(block);
      normalized.itemStyles[id] = { ...NS.Collection.memberStyleFor(normalized, id), ...compatible };
      presentation.blocks[index] = NS.Collection.normalizeBlock(normalized);
      return true;
    }
    if (block) return false;
    presentation.itemStyles[id] = { ...NS.Composition.styleFor(presentation, id), ...(patch || {}) };
    return true;
  }

  function setCardStyle(productId, patch) {
    const ids = editorialSelectionFor(productId);
    return mutatePresentation(presentation => {
      ids.forEach(id => applyStylePatchToProduct(presentation, id, patch));
    });
  }

  function setImageFrame(productId, patch) {
    const ids = editorialSelectionFor(productId);
    if (!ids.length) return null;
    return mutatePresentation(presentation => {
      presentation.imageFrames = presentation.imageFrames && typeof presentation.imageFrames === 'object'
        ? { ...presentation.imageFrames }
        : {};
      ids.forEach(id => {
        const next = normalizeImageFrame({ ...imageFrameFor(presentation, id), ...(patch || {}) });
        if (isDefaultImageFrame(next)) delete presentation.imageFrames[id];
        else presentation.imageFrames[id] = next;
      });
    });
  }

  function resetImageFrame(productId) {
    const ids = editorialSelectionFor(productId);
    if (!ids.length) return null;
    return mutatePresentation(presentation => {
      if (!presentation.imageFrames || typeof presentation.imageFrames !== 'object') return;
      ids.forEach(id => { delete presentation.imageFrames[id]; });
    });
  }

  function primaryImageForEditorTarget(node) {
    if (node.matches('.catalog-card[data-product-id]')) return node.querySelector('.catalog-card-visuals.single > img');
    if (node.matches('.catalog-collection-item[data-product-id]')) return node.querySelector('.catalog-collection-image > img');
    return null;
  }

  function applyImageFrames(root, state) {
    if (!root?.querySelectorAll || !state) return;
    const presentation = NS.Composition?.normalizePresentation(state.catalog?.presentation) || { imageFrames: {} };
    root.querySelectorAll('.catalog-card[data-product-id],.catalog-collection-item[data-product-id]').forEach(node => {
      const image = primaryImageForEditorTarget(node);
      if (!image) return;
      const frame = imageFrameFor(presentation, node.dataset.productId);
      const holder = image.parentElement;
      if (holder) holder.style.overflow = 'hidden';
      image.dataset.imageFrameTarget = 'primary';
      image.dataset.imageFrameFit = frame.fit;
      image.dataset.imageFrameZoom = String(frame.zoom);
      image.dataset.imageFrameX = String(frame.x);
      image.dataset.imageFrameY = String(frame.y);
      image.style.objectFit = frame.fit;
      image.style.objectPosition = `${frame.x}% ${frame.y}%`;
      image.style.transform = `scale(${frame.zoom})`;
      image.style.transformOrigin = `${frame.x}% ${frame.y}%`;
    });
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
    const ids = editorialSelectionFor(productId);
    return mutatePresentation(presentation => {
      if (ids.length > 1) {
        ids.forEach(id => applyStylePatchToProduct(presentation, id, patch));
        return;
      }
      const id = String(productId);
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
      if (patch?.rowSource && patch.rowSource !== current.rowSource && patch.columns == null) next.columns = NS.TableBlock.defaultColumns(patch.rowSource);
      presentation.blocks[index] = NS.TableBlock.normalizeBlock(next);
    });
  }

  function dissolveBlock(blockId, type) {
    return mutatePresentation(presentation => {
      const index = blockIndex(presentation, blockId, type);
      if (index >= 0) presentation.blocks.splice(index, 1);
    });
  }

  function dissolveCollection(blockId) { return dissolveBlock(blockId, 'collection'); }
  function dissolveTable(blockId) { return dissolveBlock(blockId, 'table'); }

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
    const unit = NS.CatalogOrder.allUnits?.(current)?.find(item => ['collection', 'table'].includes(item.type)
      && String(item.blockId) === String(blockId)
      && item.memberIds.includes(String(productId)));
    if (!unit) return null;
    const sourceIndex = unit.memberIds.indexOf(String(productId));
    const targetIndex = sourceIndex + (Number(delta) < 0 ? -1 : 1);
    if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= unit.memberIds.length) return current;
    const targetProductId = String(unit.memberIds[targetIndex]);
    const nextOrder = NS.CatalogOrder.moveBlockMember(current, blockId, productId, delta);
    return mutatePresentation(presentation => {
      presentation.order = nextOrder;
      const index = blockIndex(presentation, blockId, 'collection');
      if (index < 0 || !NS.Collection) return;
      const block = NS.Collection.normalizeBlock(presentation.blocks[index]);
      const sourceStyle = NS.Collection.memberStyleFor(block, productId);
      const targetStyle = NS.Collection.memberStyleFor(block, targetProductId);
      block.itemStyles[String(productId)] = targetStyle;
      block.itemStyles[targetProductId] = sourceStyle;
      presentation.blocks[index] = NS.Collection.normalizeBlock(block);
    });
  }

  NS.ImageFraming = {
    IMAGE_FRAME_FITS,
    DEFAULT_IMAGE_FRAME,
    normalizeImageFrame,
    imageFrameFor,
    isDefaultImageFrame,
    applyImageFrames
  };

  NS.PresentationActions = {
    mutatePresentation,
    setCardStyle,
    setImageFrame,
    resetImageFrame,
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
