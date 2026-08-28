(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const Render = NS.Render;
  if (!Render || !NS.Collection) return;

  function memberMarkup(item, block, showPrices) {
    const product = item.product;
    const preset = block.itemPreset || 'visual';
    const style = item.style || { emphasis: 'normal', width: 'simple', priceStyle: 'standard' };
    const placement = `grid-column:${item.start} / span ${item.slotSpan};grid-row:${item.row};`;
    const price = showPrices && product.price && preset === 'commercial'
      ? `<strong class="catalog-collection-price">${Render.esc(product.price)}</strong>` : '';
    const description = preset === 'compact' ? '' : `<b>${Render.esc(product.description)}</b>`;
    const effectiveOrder = item.effectiveOrder ? ` data-effective-order="${item.effectiveOrder}"` : '';
    return `<article class="catalog-collection-item emphasis-${Render.esc(style.emphasis)} width-${Render.esc(style.width)} price-style-${Render.esc(style.priceStyle || 'standard')} preset-${Render.esc(preset)}" data-product-id="${Render.esc(product.id)}" data-member-width="${Render.esc(style.width)}" data-price-style="${Render.esc(style.priceStyle || 'standard')}"${effectiveOrder} style="${placement}">
      <div class="catalog-collection-image"><img src="${Render.esc(product.image || Render.PLACEHOLDER)}" alt="${Render.esc(product.description)}" /></div>
      <div class="catalog-collection-copy"><span>${Render.esc(product.code)}</span>${description}${price}</div>
    </article>`;
  }

  function collectionMarkup(item, showPrices) {
    const block = item.block;
    const plan = item.collectionLayout;
    const orderById = item.memberEffectiveOrders || {};
    const plannedItems = plan.items.map(memberItem => ({ ...memberItem, effectiveOrder: orderById[memberItem.productId] || null }));
    const placement = `grid-column:1 / span 6;grid-row:${item.row} / span ${item.rowSpan};`;
    return `<section class="catalog-collection theme-${Render.esc(block.theme)} preset-${Render.esc(block.itemPreset)}${plan.compressed ? ' is-compressed' : ''}" data-collection-id="${Render.esc(block.id)}" data-local-rows="${plan.localRowCount}" data-row-span="${item.rowSpan}" style="${placement};--collection-cols:${plan.columns};--collection-rows:${plan.localRowCount};">
      ${(block.title || block.subtitle) ? `<header class="catalog-collection-header"><div>${block.title ? `<h3>${Render.esc(block.title)}</h3>` : ''}${block.subtitle ? `<p>${Render.esc(block.subtitle)}</p>` : ''}</div><span>${item.members.length} itens</span></header>` : ''}
      <div class="catalog-collection-grid">${plannedItems.map(member => memberMarkup(member, block, showPrices)).join('')}</div>
    </section>`;
  }

  Render.collectionMemberMarkup = memberMarkup;
  Render.collectionMarkup = collectionMarkup;
})();