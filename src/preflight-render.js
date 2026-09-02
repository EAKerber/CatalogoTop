(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};

  function integerDataset(value) {
    const parsed = Number.parseInt(String(value || ''), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  function descriptionIssue(element, placement) {
    if (!element || element.dataset?.descriptionTruncated !== 'true') return null;

    const ownerSelector = placement === 'collection'
      ? '.catalog-collection-item[data-product-id]'
      : '.catalog-card[data-product-id]';
    const owner = element.closest?.(ownerSelector);
    const productId = String(owner?.dataset?.productId || '');
    if (!productId) return null;

    const collection = placement === 'collection'
      ? owner.closest?.('.catalog-collection[data-collection-id]')
      : null;
    const blockId = String(collection?.dataset?.collectionId || '');
    const codeNode = placement === 'collection'
      ? owner.querySelector?.('.catalog-collection-copy > span')
      : owner.querySelector?.('.catalog-card-code');
    const code = String(codeNode?.textContent || productId).trim() || productId;

    return {
      code: 'description_truncated',
      severity: 'warning',
      scope: 'product',
      resourceType: 'product',
      resourceId: productId,
      productId,
      placement,
      blockId,
      fitLines: integerDataset(element.dataset?.fitLines),
      visibleWords: integerDataset(element.dataset?.visibleWords),
      message: `A descrição de ${code} foi reduzida para caber nesta composição.`
    };
  }

  function inspect(root) {
    if (!root?.querySelectorAll) return [];
    const issues = [];

    root.querySelectorAll('.catalog-card[data-product-id] h3[data-description-truncated="true"]')
      .forEach(element => {
        const item = descriptionIssue(element, 'card');
        if (item) issues.push(item);
      });

    root.querySelectorAll('.catalog-collection-item[data-product-id] .catalog-collection-copy b[data-description-truncated="true"]')
      .forEach(element => {
        const item = descriptionIssue(element, 'collection');
        if (item) issues.push(item);
      });

    return issues;
  }

  NS.PreflightRender = Object.freeze({ inspect });
})();
