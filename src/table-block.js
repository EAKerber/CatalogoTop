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
  const TABLE_PRICE_STYLES = Object.freeze([
    { id: 'standard', name: 'Padrão' },
    { id: 'red', name: 'Vermelho' },
    { id: 'label', name: 'Etiqueta' },
    { id: 'block', name: 'Bloco' }
  ]);
  const TABLE_COLUMNS = Object.freeze([
    { id: 'image', name: 'Imagem', sources: ['products'], weight: 14, min: 11, max: 17, reference: 0, factor: 0, flex: .2 },
    { id: 'code', name: 'Código', sources: ['products', 'commercialRows'], weight: 12, min: 10, max: 20, reference: 6, factor: 1.2, flex: .8 },
    { id: 'description', name: 'Produto', sources: ['products', 'commercialRows'], weight: 44, min: 30, max: 58, reference: 28, factor: .7, flex: 3 },
    { id: 'subcategory', name: 'Subcategoria', sources: ['products'], weight: 18, min: 12, max: 28, reference: 14, factor: .65, flex: 1.4 },
    { id: 'variant', name: 'Cor / variação', sources: ['commercialRows'], weight: 20, min: 14, max: 32, reference: 16, factor: .7, flex: 1.8 },
    { id: 'package', name: 'Embalagem', sources: ['commercialRows'], weight: 15, min: 11, max: 24, reference: 10, factor: .65, flex: 1.1 },
    { id: 'price', name: 'Preço', sources: ['products', 'commercialRows'], weight: 18, min: 14, max: 23, reference: 10, factor: .7, flex: .8 },
    { id: 'minQuantity', name: 'Qtd. mín.', sources: ['products', 'commercialRows'], weight: 10, min: 8, max: 12, reference: 8, factor: .25, flex: .25 },
    { id: 'quantityPrice', name: 'Preço qtd.', sources: ['products', 'commercialRows'], weight: 18, min: 14, max: 23, reference: 11, factor: .7, flex: .8 }
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
    const legacyPriceStyle = source.commercialPrices === true ? 'label' : 'standard';
    const priceStyle = choice(source.priceStyle, TABLE_PRICE_STYLES, legacyPriceStyle);
    return {
      id: String(source.id || `table-${index + 1}`),
      type: 'table',
      memberIds: uniqueIds(source.memberIds || source.members).slice(0, MAX_MEMBERS),
      title: String(source.title || '').trim(),
      subtitle: String(source.subtitle || '').trim(),
      rowSource,
      density: choice(source.density, TABLE_DENSITIES, 'compact'),
      columns: normalizeColumns(source.columns, rowSource),
      priceStyle,
      commercialPrices: priceStyle !== 'standard'
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

  function quantityFields(source) {
    const quantityPrice = NS.Core?.normalizeQuantityPrice?.(source?.quantityPrice) || null;
    return {
      minQuantity: quantityPrice ? String(quantityPrice.minQuantity) : '',
      quantityPrice: quantityPrice?.price || ''
    };
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
            description: String(product.description || ''), variant: '', package: '', price: String(product.price || ''),
            ...quantityFields(product)
          });
          return;
        }
        commercial.forEach((row, index) => rows.push({
          rowId: `${product.id}:${row.id || index}`, productId: String(product.id),
          code: String(row.code || product.code || ''), description: String(product.description || ''),
          variant: String(row.variant || ''), package: String(row.package || ''), price: String(row.price || product.price || ''),
          ...quantityFields(row)
        }));
      });
      return rows;
    }
    return list.map(product => ({
      rowId: String(product.id), productId: String(product.id), image: String(product.image || ''),
      code: String(product.code || ''), description: String(product.description || ''),
      subcategory: String(product.subcategory || ''), price: String(product.price || ''),
      ...quantityFields(product)
    }));
  }

  function columnDefinition(id) {
    return TABLE_COLUMNS.find(column => column.id === id) || null;
  }

  function percentile(values, ratio = .75) {
    const ordered = (Array.isArray(values) ? values : []).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    if (!ordered.length) return 0;
    const index = Math.min(ordered.length - 1, Math.max(0, Math.ceil(ordered.length * ratio) - 1));
    return ordered[index];
  }

  function columnDemand(rows, columnIds) {
    const list = Array.isArray(rows) ? rows : [];
    const ids = (Array.isArray(columnIds) ? columnIds : []).map(String);
    return Object.fromEntries(ids.map(id => {
      const definition = columnDefinition(id);
      if (id === 'image') return [id, 0];
      const lengths = [String(definition?.name || id).length];
      list.forEach(row => {
        const text = String(row?.[id] ?? '').trim();
        if (text) lengths.push(Math.min(96, text.length));
      });
      return [id, percentile(lengths, .75)];
    }));
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function preferredWidth(definition, demand) {
    const base = Number(definition?.weight) || 16;
    if (!definition || definition.id === 'image') return base;
    const adjustment = (Number(demand) - Number(definition.reference || 0)) * Number(definition.factor || 0);
    return clamp(base + adjustment, Number(definition.min || 1), Number(definition.max || 100));
  }

  function distributeToHundred(items) {
    const values = items.map(item => clamp(item.preferred, item.min, item.max));
    for (let pass = 0; pass < 24; pass += 1) {
      const total = values.reduce((sum, value) => sum + value, 0);
      const delta = 100 - total;
      if (Math.abs(delta) < .0001) break;
      const growing = delta > 0;
      const capacities = values.map((value, index) => {
        const item = items[index];
        const room = growing ? item.max - value : value - item.min;
        return Math.max(0, room) * Math.max(.05, Number(item.flex) || 1);
      });
      const capacityTotal = capacities.reduce((sum, value) => sum + value, 0);
      if (capacityTotal <= .0001) break;
      values.forEach((value, index) => {
        if (!capacities[index]) return;
        const share = delta * capacities[index] / capacityTotal;
        values[index] = clamp(value + share, items[index].min, items[index].max);
      });
    }
    const rounded = values.map(value => Math.round(value * 100) / 100);
    let residual = Math.round((100 - rounded.reduce((sum, value) => sum + value, 0)) * 100) / 100;
    if (Math.abs(residual) >= .01) {
      const direction = residual > 0 ? 1 : -1;
      const candidate = rounded
        .map((value, index) => ({ index, room: direction > 0 ? items[index].max - value : value - items[index].min, flex: items[index].flex }))
        .filter(item => item.room > .001)
        .sort((a, b) => (b.room * b.flex) - (a.room * a.flex))[0];
      if (candidate) {
        const applied = direction * Math.min(Math.abs(residual), candidate.room);
        rounded[candidate.index] = Math.round((rounded[candidate.index] + applied) * 100) / 100;
        residual = Math.round((residual - applied) * 100) / 100;
      }
    }
    return rounded;
  }

  function planColumnWidths(columnIds, demand = {}) {
    const ids = (Array.isArray(columnIds) ? columnIds : []).map(String);
    const items = ids.map(id => {
      const definition = columnDefinition(id) || { id, weight: 16, min: 8, max: 48, reference: 12, factor: .5, flex: 1 };
      return {
        id,
        min: Number(definition.min || 1),
        max: Number(definition.max || 100),
        flex: Number(definition.flex || 1),
        demand: Number(demand?.[id] || 0),
        preferred: preferredWidth(definition, demand?.[id])
      };
    });
    const percentages = distributeToHundred(items);
    return items.map((item, index) => ({ id: item.id, demand: item.demand, weight: item.preferred, percent: percentages[index] }));
  }

  function columnWidths(columnIds, demand = {}) {
    return planColumnWidths(columnIds, demand);
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
    const demand = columnDemand(rows, normalized.columns);
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
    return { block: normalized, rows, fragments, columnDemand: demand };
  }

  function blockForMember(blocks, productId) {
    const id = String(productId);
    return normalizeBlocks(blocks).find(block => block.memberIds.includes(id)) || null;
  }

  NS.TableBlock = {
    TABLE_SOURCES,
    TABLE_DENSITIES,
    TABLE_PRICE_STYLES,
    TABLE_COLUMNS,
    MAX_MEMBERS,
    normalizeBlock,
    normalizeBlocks,
    normalizeColumns,
    defaultColumns,
    columnsForSource,
    columnDefinition,
    columnDemand,
    planColumnWidths,
    columnWidths,
    contiguousMemberRun,
    validBlocksForProducts,
    rowsForBlock,
    capacityForUnit,
    fragmentTable,
    blockForMember
  };
})();