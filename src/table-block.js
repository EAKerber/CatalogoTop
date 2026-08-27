(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};

  const TABLE_SOURCES = Object.freeze([
    { id: 'products', name: 'Produtos' },
    { id: 'commercialRows', name: 'Linhas comerciais' }
  ]);
  const TABLE_DENSITIES = Object.freeze([
    { id: 'comfortable', name: 'Confortável' },
    { id: 'compact', name: 'Compacta' }
  ]);
  const TABLE_COLUMNS = Object.freeze([
    { id: 'image', name: 'Imagem', sources: ['products'] },
    { id: 'code', name: 'Código', sources: ['products', 'commercialRows'] },
    { id: 'description', name: 'Produto', sources: ['products', 'commercialRows'] },
    { id: 'subcategory', name: 'Subcategoria', sources: ['products'] },
    { id: 'variant', name: 'Cor / variação', sources: ['commercialRows'] },
    { id: 'package', name: 'Embalagem', sources: ['commercialRows'] },
    { id: 'price', name: 'Preço', sources: ['products', 'commercialRows'] }
  ]);
  const MAX_MEMBERS = 30;

  function uniqueIds(values) {
    const seen = new Set();
    return (Array.isArray(values) ? values : []).map(String).filter(id => id && !seen.has(id) && seen.add(id));
  }

  function choice(value, allowed, fallback) {
    const text = String(value || '');
    return allowed.some(item => item.id === text) ? text : fallback;
  }

  function columnsForSource(source) {
    return TABLE_COLUMNS.filter(column => column.sources.includes(source));
  }

  function defaultColumns(source) {
    return source === 'commercialRows'
      ? ['variant', 'code', 'package', 'price']
      : ['code', 'description', 'price'];
  }

  function normalizeColumns(values, source) {
    const allowed = new Set(columnsForSource(source).map(column => column.id));
    const normalized = uniqueIds(values).filter(id => allowed.has(id));
    return normalized.length ? normalized : defaultColumns(source);
  }

  function normalizeBlock(block, index = 0) {
    const source = block && typeof block === 'object' ? block : {};
    const rowSource = choice(source.rowSource || source.source, TABLE_SOURCES, 'products');
    return {
      id: String(source.id || `table-${index + 1}`),
      type: 'table',
      memberIds: uniqueIds(source.memberIds || source.members).slice(0, MAX_MEMBERS),
      title: String(source.title || '').trim(),
      subtitle: String(source.subtitle || '').trim(),
      rowSource,
      density: choice(source.density, TABLE_DENSITIES, 'compact'),
      columns: normalizeColumns(source.columns, rowSource),
      commercialPrices: source.commercialPrices === true
    };
  }

  function normalizeBlocks(raw) {
    return (Array.isArray(raw) ? raw : [])
      .filter(block => block?.type === 'table')
      .map(normalizeBlock)
      .filter(block => block.memberIds.length >= 2);
  }

  function contiguousMemberRun(block, products) {
    const indexById = new Map((Array.isArray(products) ? products : []).map((product, index) => [String(product.id), index]));
    const positions = block.memberIds.map(id => indexById.get(String(id)));
    if (positions.some(value => value == null)) return false;
    const sorted = positions.slice().sort((a, b) => a - b);
    return sorted.every((value, index) => index === 0 || value === sorted[index - 1] + 1);
  }

  function validBlocksForProducts(blocks, products) {
    const list = Array.isArray(products) ? products : [];
    const byId = new Map(list.map(product => [String(product.id), product]));
    const category = String(list[0]?.category || '').trim();
    return normalizeBlocks(blocks).filter(block => {
      const members = block.memberIds.map(id => byId.get(String(id))).filter(Boolean);
      return members.length === block.memberIds.length
        && members.length >= 2
        && members.every(product => String(product.category || '').trim() === category)
        && contiguousMemberRun(block, list);
    });
  }

  function rowsForBlock(block, members) {
    const normalized = normalizeBlock(block);
    const list = Array.isArray(members) ? members : [];
    if (normalized.rowSource === 'commercialRows') {
      const rows = [];
      list.forEach(product => {
        const commercial = Array.isArray(product.tableRows) ? product.tableRows.filter(Boolean) : [];
        if (!commercial.length) {
          rows.push({
            rowId: `${product.id}:fallback`, productId: String(product.id), code: String(product.code || ''),
            description: String(product.description || ''), variant: '', package: '', price: String(product.price || '')
          });
          return;
        }
        commercial.forEach((row, index) => rows.push({
          rowId: `${product.id}:${row.id || index}`, productId: String(product.id),
          code: String(row.code || product.code || ''), description: String(product.description || ''),
          variant: String(row.variant || ''), package: String(row.package || ''), price: String(row.price || product.price || '')
        }));
      });
      return rows;
    }
    return list.map(product => ({
      rowId: String(product.id), productId: String(product.id), image: String(product.image || ''),
      code: String(product.code || ''), description: String(product.description || ''),
      subcategory: String(product.subcategory || ''), price: String(product.price || '')
    }));
  }

  function capacityForUnit(block, unitIndex) {
    const normalized = normalizeBlock(block);
    const hasHeading = Boolean(normalized.title || normalized.subtitle);
    if (normalized.density === 'comfortable') return unitIndex === 0 && hasHeading ? 2 : 3;
    return unitIndex === 0 && hasHeading ? 3 : 4;
  }

  function fragmentTable(block, members) {
    const normalized = normalizeBlock(block);
    const rows = rowsForBlock(normalized, members);
    const fragments = [];
    let cursor = 0;
    let unitIndex = 0;
    while (cursor < rows.length) {
      const capacity = Math.max(1, capacityForUnit(normalized, unitIndex));
      const slice = rows.slice(cursor, cursor + capacity);
      fragments.push({ fragmentIndex: unitIndex, rows: slice, rowSpan: 1 });
      cursor += slice.length;
      unitIndex += 1;
    }
    if (!fragments.length) fragments.push({ fragmentIndex: 0, rows: [], rowSpan: 1 });
    fragments.forEach(fragment => { fragment.fragmentTotal = fragments.length; });
    return { block: normalized, rows, fragments };
  }

  function columnDefinition(id) {
    return TABLE_COLUMNS.find(column => column.id === id) || null;
  }

  function blockForMember(blocks, productId) {
    const id = String(productId);
    return normalizeBlocks(blocks).find(block => block.memberIds.includes(id)) || null;
  }

  NS.TableBlock = {
    TABLE_SOURCES,
    TABLE_DENSITIES,
    TABLE_COLUMNS,
    MAX_MEMBERS,
    normalizeBlock,
    normalizeBlocks,
    normalizeColumns,
    defaultColumns,
    columnsForSource,
    columnDefinition,
    contiguousMemberRun,
    validBlocksForProducts,
    rowsForBlock,
    capacityForUnit,
    fragmentTable,
    blockForMember
  };
})();
