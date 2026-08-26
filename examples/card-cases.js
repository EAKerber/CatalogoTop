(function () {
  'use strict';

  const NS = window.CatalogoTop;
  const root = document.getElementById('cardCases');
  if (!NS?.Render || !NS?.Core || !NS?.Templates || !root) return;

  function art(label, background = '#f3f4f5', ink = '#2d3137') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="520" viewBox="0 0 720 520">
      <rect width="720" height="520" fill="${background}"/>
      <rect x="170" y="150" width="380" height="220" rx="28" fill="#fff" stroke="#c8ccd1" stroke-width="8"/>
      <path d="M230 260h260M360 195v130" stroke="${ink}" stroke-width="20" stroke-linecap="round"/>
      <text x="360" y="425" text-anchor="middle" font-family="Arial" font-size="34" font-weight="700" fill="${ink}">${label}</text>
    </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  const cases = [
    {
      name: 'Produto simples',
      note: 'Uma imagem, título, poucas especificações e preço-base.',
      templateId: 'technical',
      product: {
        id: 'case-simple', code: 'TEST-01', description: 'Produto simples', category: 'Teste visual', subcategory: 'Card básico', status: 'Ativo', image: art('Principal'),
        specs: [{ label: 'Medida', value: '000 mm' }, { label: 'Aplicação', value: 'Exemplo' }], variants: [], tableRows: [], notes: '', price: 'R$ 00,00'
      }
    },
    {
      name: 'Família de cores',
      note: 'Seis acabamentos: o card mostra o limite visual e sinaliza o restante sem crescer.',
      templateId: 'showcase',
      product: {
        id: 'case-colors', code: 'TEST-02', description: 'Família com múltiplas cores', category: 'Teste visual', subcategory: 'Variações', status: 'Ativo', image: art('Principal'),
        specs: [{ label: 'Material', value: 'Exemplo' }, { label: 'Linha', value: 'Sintética' }],
        variants: [
          { id: 'v1', label: 'Branco', image: art('Branco', '#f8f8f8') },
          { id: 'v2', label: 'Preto', image: art('Preto', '#dedfe1', '#15171a') },
          { id: 'v3', label: 'Cinza', image: art('Cinza', '#e7e8ea', '#5b6067') },
          { id: 'v4', label: 'Natural', image: art('Natural', '#f1eadf', '#725f45') },
          { id: 'v5', label: 'Grafite', image: art('Grafite', '#d6d8db', '#373b40') },
          { id: 'v6', label: 'Champagne', image: art('Champagne', '#efe7d7', '#8a7047') }
        ],
        tableRows: [
          { variant: 'Branco', code: 'TEST-02-BR', package: 'CX 00', price: 'R$ 00,00' },
          { variant: 'Preto', code: 'TEST-02-PT', package: 'CX 00', price: 'R$ 00,00' },
          { variant: 'Cinza', code: 'TEST-02-CZ', package: 'CX 00', price: 'R$ 00,00' },
          { variant: 'Natural', code: 'TEST-02-NT', package: 'CX 00', price: 'R$ 00,00' },
          { variant: 'Grafite', code: 'TEST-02-GF', package: 'CX 00', price: 'R$ 00,00' },
          { variant: 'Champagne', code: 'TEST-02-CH', package: 'CX 00', price: 'R$ 00,00' }
        ],
        notes: '', price: ''
      }
    },
    {
      name: 'Várias referências',
      note: 'Uma imagem principal com seis referências comerciais; o card abre largura para a tabela.',
      templateId: 'technical',
      product: {
        id: 'case-table', code: 'TEST-03', description: 'Produto com tabela de referências', category: 'Teste visual', subcategory: 'Tabela', status: 'Ativo', image: art('Principal'),
        specs: [{ label: 'Capacidade', value: 'Exemplo' }], variants: [],
        tableRows: Array.from({ length: 6 }, (_, index) => ({ variant: '', code: `TEST-03-${index + 1}`, package: `CX 0${index + 1}`, price: `R$ 0${index + 1},00` })),
        notes: '', price: ''
      }
    },
    {
      name: 'Card denso',
      note: 'Combina especificações, acabamentos sem foto e tabela para observar o limite sem auto-layout.',
      templateId: 'showcase',
      product: {
        id: 'case-dense', code: 'TEST-04', description: 'Produto denso para teste de limite', category: 'Teste visual', subcategory: 'Denso', status: 'Ativo', image: art('Principal'),
        specs: [
          { label: 'Especificação A', value: 'Valor A' },
          { label: 'Especificação B', value: 'Valor B' },
          { label: 'Especificação C', value: 'Valor C' },
          { label: 'Especificação D', value: 'Valor D' }
        ],
        variants: [{ label: 'Acabamento A' }, { label: 'Acabamento B' }, { label: 'Acabamento C' }],
        tableRows: [
          { variant: 'A', code: 'TEST-04-A', package: 'CX 00', price: 'R$ 00,00' },
          { variant: 'B', code: 'TEST-04-B', package: 'CX 00', price: 'R$ 00,00' },
          { variant: 'C', code: 'TEST-04-C', package: 'CX 00', price: 'R$ 00,00' },
          { variant: 'D', code: 'TEST-04-D', package: 'CX 00', price: 'R$ 00,00' }
        ],
        notes: '', price: ''
      }
    }
  ];

  cases.forEach((entry, index) => {
    const product = NS.Core.normalizeProduct(entry.product);
    const template = NS.Templates.getTemplate(entry.templateId);
    const state = {
      schemaVersion: NS.Core.SCHEMA_VERSION,
      products: [product],
      selectedIds: [product.id],
      catalog: { title: entry.name, templateId: entry.templateId, showPrices: true, createdAt: '2026-08-25T00:00:00.000Z' }
    };

    const scratch = document.createElement('div');
    NS.Render.renderCatalog(scratch, state);
    const renderedCard = scratch.querySelector('.catalog-card');

    const article = document.createElement('article');
    article.className = 'case';
    article.innerHTML = `<div class="case-copy"><span>Caso ${index + 1}</span><h2>${NS.Render.esc(entry.name)}</h2><p>${NS.Render.esc(entry.note)}</p></div><div class="case-stage"><div class="case-focus ${template.className}"></div></div>`;
    root.append(article);
    if (renderedCard) article.querySelector('.case-focus').append(renderedCard);
  });
})();
