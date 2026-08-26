# v0.11.0 — Fronteiras explícitas do runtime editorial

## Objetivo

Consolidar a arquitetura do compositor antes dos recortes de inspector, seleção pelo preview e enquadramento de imagem. Este recorte não adiciona uma nova primitiva editorial e não deve alterar intencionalmente a paginação ou o PDF produzido pelos estados v0.10.2 válidos.

## Autoridades

O runtime passa a ter três fronteiras explícitas:

1. `Composition.normalizePresentation` preserva estado editorial local (`itemStyles`, `blocks`, espaço futuro `imageFrames`).
2. `CatalogDocument.build` resolve `Card`, `Collection` e `Table`, conflitos de membership, ordem factual, slots, `rowSpan`, fragmentação e páginas.
3. `src/catalog-renderer.js` consome somente o `CatalogDocument` materializado e faz dispatch por `item.type` para os helpers de Card/Collection/Table.

`Collection` e `Table` continuam com normalizadores e markups próprios, mas não substituem mais funções globais em tempo de execução.

## Bootstrap

Os módulos editoriais e seus estilos são declarados diretamente em `index.html`. `catalog-selection-order.js` deixa de carregar scripts/CSS e passa a ser somente uma função pura de ordem efetiva derivada do `CatalogDocument`.

## Lista de seleção

`src/app.js::renderSelection()` é a autoridade de render da lista. Ela recebe estado, membership e effective order e produz diretamente:

- ordem efetiva;
- badge Collection/Table;
- controles de Card;
- overrides locais de membro Collection;
- ação direta de exclusão na biblioteca de produtos.

Os módulos `collection-controls.js` e `table-controls.js` continuam responsáveis por comandos de domínio/manager, mas não observam ou redecoram a lista.

## MutationObserver

O recorte elimina `MutationObserver` da fronteira compartilhada de `#selectableProducts`, incluindo:

- `catalog-selection-order.js`;
- `collection-controls.js`;
- `table-controls.js`;
- compatibilidade de exclusão direta;
- guard legado de overlap.

A UI passa a convergir por render explícito e pelo evento `catalogotop:selection-rendered`, evitando ciclos em que uma extensão detecta a mutação produzida por outra extensão.

## Compatibilidade

`collection-document.js`, `table-document.js` e `render-document-adapter.js` permanecem como aliases de compatibilidade para não quebrar referências internas/documentais, mas não monkey-patcham `CatalogDocument.build` ou `Render.renderCatalog`.

## Fora de escopo

- inspector contextual;
- seleção pelo preview;
- enquadramento/focal point de imagem;
- receitas editoriais;
- mudança de schema remoto/ProductStore;
- quarto primitivo estrutural.

O campo local `presentation.imageFrames` é apenas reservado pela fronteira de normalização para o recorte futuro; v0.11.0 não o interpreta nem o publica remotamente.

## Gates

O recorte deve preservar integralmente os gates físicos existentes de Card, Collection, Table, print A4 e touch. Também adiciona `runtime-boundaries-fixture.mjs`, que falha caso monkey patches ou observers da lista sejam reintroduzidos silenciosamente.
