(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const Render = NS.Render;
  if (!Render || !NS.TableBlock) return;

  function columnClass(columnId, kind) {
    if (columnId === 'price') return kind === 'header' ? ' class="table-column-price"' : ' class="table-cell-price"';
    if (columnId === 'quantityPrice') return kind === 'header'
      ? ' class="table-column-price table-column-quantity-price"'
      : ' class="table-cell-price table-cell-quantity-price"';
    if (columnId === 'minQuantity') return kind === 'header'
      ? ' class="table-column-min-quantity"'
      : ' class="table-cell-min-quantity"';
    return '';
  }

  function cellMarkup(columnId, row) {
    if (columnId === 'image') {
      const src = row.image || Render.PLACEHOLDER;
      return `<td class="table-cell-image"><img src="${Render.esc(src)}" alt="" /></td>`;
    }
    return `<td${columnClass(columnId, 'cell')}>${Render.esc(row[columnId] || '—')}</td>`;
  }

  function colgroupMarkup(columns) {
    const widths = NS.TableBlock.columnWidths(columns);
    return `<colgroup>${widths.map(column => `<col data-table-column-width="${Render.esc(column.id)}" style="width:${column.percent}%" />`).join('')}</colgroup>`;
  }

  function tableMarkup(item, showPrices) {
    const block = item.block;
    const priceColumns = new Set(['price', 'minQuantity', 'quantityPrice']);
    const columns = block.columns.filter(columnId => showPrices || !priceColumns.has(columnId));
    const continuation = item.fragmentStart > 0;
    const placement = `grid-column:1 / span 6;grid-row:${item.row} / span ${item.rowSpan};`;
    const hasPrice = columns.includes('price') || columns.includes('quantityPrice');
    const commercialClass = block.commercialPrices && showPrices && hasPrice ? ' commercial-prices' : '';
    return `<section class="catalog-table-block density-${Render.esc(block.density)}${continuation ? ' is-continuation' : ''}${commercialClass}" data-table-block-id="${Render.esc(block.id)}" data-row-span="${item.rowSpan}" data-fragment-start="${item.fragmentStart}" data-fragment-end="${item.fragmentEnd}" data-fragment-total="${item.fragmentTotal}" data-commercial-prices="${block.commercialPrices ? 'true' : 'false'}" style="${placement}">
      ${!continuation && (block.title || block.subtitle) ? `<header class="catalog-table-heading"><div>${block.title ? `<h3>${Render.esc(block.title)}</h3>` : ''}${block.subtitle ? `<p>${Render.esc(block.subtitle)}</p>` : ''}</div><span>${item.memberIds.length} ${item.memberIds.length === 1 ? 'produto' : 'produtos'}</span></header>` : ''}
      ${continuation ? `<div class="catalog-table-continuation">${Render.esc(block.title || 'Tabela')} · continuação</div>` : ''}
      <div class="catalog-table-wrap"><table>
        ${colgroupMarkup(columns)}
        <thead><tr>${columns.map(columnId => `<th${columnClass(columnId, 'header')}>${Render.esc(NS.TableBlock.columnDefinition(columnId)?.name || columnId)}</th>`).join('')}</tr></thead>
        <tbody>${item.rows.map(row => `<tr data-table-row-id="${Render.esc(row.rowId)}">${columns.map(columnId => cellMarkup(columnId, row)).join('')}</tr>`).join('')}</tbody>
      </table></div>
    </section>`;
  }

  Render.tableCellMarkup = cellMarkup;
  Render.tableColgroupMarkup = colgroupMarkup;
  Render.tableMarkup = tableMarkup;
})();
