(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const Core = () => NS.Core;

  const ALIASES = {
    code: ['codigo', 'cod', 'sku', 'referencia', 'ref', 'idproduto', 'id'],
    description: ['descricao', 'produto', 'nome', 'nomeproduto', 'item'],
    category: ['categoria', 'familia', 'grupo'],
    subcategory: ['subcategoria', 'subfamilia', 'subgrupo'],
    price: ['preco', 'valor', 'precodevenda', 'preco unitario', 'precounitario'],
    status: ['status', 'situacao', 'ativo'],
    image: ['imagem', 'foto', 'image', 'imageurl', 'urlimagem', 'urlfoto'],
    notes: ['observacoes', 'observacao', 'notas', 'nota']
  };

  function normalizeHeader(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  const aliasLookup = Object.entries(ALIASES).reduce((map, [field, aliases]) => {
    aliases.forEach(alias => map.set(normalizeHeader(alias), field));
    return map;
  }, new Map());

  function detectDelimiter(text) {
    const firstLine = String(text || '').split(/\r?\n/, 1)[0] || '';
    const candidates = [';', ',', '\t'];
    return candidates.sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  }

  function parseDelimited(text, delimiter = detectDelimiter(text)) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    const source = String(text || '').replace(/^\uFEFF/, '');

    for (let i = 0; i < source.length; i += 1) {
      const char = source[i];
      const next = source[i + 1];
      if (quoted) {
        if (char === '"' && next === '"') {
          cell += '"';
          i += 1;
        } else if (char === '"') {
          quoted = false;
        } else {
          cell += char;
        }
      } else if (char === '"') {
        quoted = true;
      } else if (char === delimiter) {
        row.push(cell);
        cell = '';
      } else if (char === '\n') {
        row.push(cell.replace(/\r$/, ''));
        rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += char;
      }
    }
    row.push(cell.replace(/\r$/, ''));
    if (row.some(value => String(value).trim())) rows.push(row);
    return rows;
  }

  function sheetRowsFromMatrix(matrix) {
    if (!Array.isArray(matrix) || matrix.length < 1) return { products: [], report: { headers: [], mapped: [], extras: [], invalid: [], totalRows: 0 } };
    const rawHeaders = matrix[0].map(value => String(value || '').trim());
    const fields = rawHeaders.map(header => aliasLookup.get(normalizeHeader(header)) || null);
    const mapped = rawHeaders.filter((_, index) => fields[index]);
    const extras = rawHeaders.filter((header, index) => header && !fields[index]);
    const invalid = [];
    const products = [];

    matrix.slice(1).forEach((values, rowIndex) => {
      if (!values || !values.some(value => String(value ?? '').trim())) return;
      const product = { specs: [] };
      rawHeaders.forEach((header, columnIndex) => {
        const value = values[columnIndex] ?? '';
        const field = fields[columnIndex];
        if (field) product[field] = String(value).trim();
        else if (header && String(value).trim()) product.specs.push({ label: header, value: String(value).trim() });
      });

      if (typeof product.status === 'string') {
        const status = normalizeHeader(product.status);
        product.status = ['inativo', 'nao', 'false', '0'].includes(status) ? 'Inativo' : 'Ativo';
      }
      if (!String(product.code || '').trim() || !String(product.description || '').trim()) {
        invalid.push({ row: rowIndex + 2, reason: 'Código e descrição são obrigatórios.' });
        return;
      }
      products.push(Core().normalizeProduct(product));
    });

    return {
      products,
      report: {
        headers: rawHeaders,
        mapped,
        extras,
        invalid,
        totalRows: Math.max(0, matrix.length - 1),
        validRows: products.length
      }
    };
  }

  async function parseCsv(file) {
    const text = await file.text();
    return sheetRowsFromMatrix(parseDelimited(text));
  }

  async function parseExcel(file) {
    if (!window.XLSX) throw new Error('Leitor de Excel não carregado. Verifique sua conexão e tente novamente, ou use CSV.');
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) throw new Error('A planilha não possui abas legíveis.');
    const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1, defval: '', raw: false });
    const result = sheetRowsFromMatrix(matrix);
    result.report.sheetName = firstSheet;
    return result;
  }

  async function parseFile(file) {
    const extension = String(file.name || '').split('.').pop().toLowerCase();
    if (extension === 'csv' || file.type === 'text/csv') return parseCsv(file);
    if (['xlsx', 'xls', 'xlsm'].includes(extension)) return parseExcel(file);
    throw new Error('Formato não suportado. Use CSV, XLSX, XLS ou XLSM.');
  }

  NS.Importer = { parseFile, parseDelimited, sheetRowsFromMatrix, normalizeHeader };
})();
