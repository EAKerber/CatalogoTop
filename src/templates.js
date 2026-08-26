(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};

  const templates = Object.freeze([
    {
      id: 'technical',
      name: 'Técnico 2×4',
      description: 'Oito cards por página. Equilíbrio entre foto, descrição e especificações.',
      columns: 2,
      rows: 4,
      perPage: 8,
      className: 'template-technical'
    },
    {
      id: 'compact',
      name: 'Compacto 3×4',
      description: 'Doze cards por página. Prioriza densidade para famílias com muitos itens.',
      columns: 3,
      rows: 4,
      perPage: 12,
      className: 'template-compact'
    },
    {
      id: 'showcase',
      name: 'Destaque 2×3',
      description: 'Seis cards maiores por página. Melhor para produto visual ou lançamento.',
      columns: 2,
      rows: 3,
      perPage: 6,
      className: 'template-showcase'
    }
  ]);

  function getTemplate(id) {
    return templates.find(template => template.id === id) || templates[0];
  }

  NS.Templates = { templates, getTemplate };
})();
