# CatalogoTop v0.11.1.5 — apresentação comercial + fitting editorial

## Escopo

Este recorte adiciona hierarquia comercial de preços e melhora o aproveitamento da descrição em Cards sem alterar os dados factuais de produto.

## Contratos

- `Product.price` continua sendo o valor factual monetário canônico em BRL definido pelo v0.11.1.4.
- `Product.description` permanece integral. Nenhuma descrição curta é persistida.
- `catalog.presentation.itemStyles[productId].priceStyle` é estado editorial local com quatro valores: `standard`, `red`, `label`, `block`.
- estados antigos sem `priceStyle` normalizam para `standard`.
- `TableBlock.commercialPrices` é booleano editorial. Estados antigos normalizam para `false`.
- `showPrices=false` continua soberano sobre qualquer estilo comercial.

## Card

O inspector contextual apresenta quatro opções diretas de preço em seletor segmentado 2×2:

- Padrão;
- Vermelho;
- Etiqueta;
- Bloco.

O estilo afeta o preço principal. Quando o Card usa `tableRows`, a mesma intenção visual é aplicada à coluna de preço da tabela interna.

## Table

O inspector da Table recebe o toggle `Destacar preços`.

A coluna de preço passa a ser identificada semanticamente por `table-column-price` / `table-cell-price`; a apresentação não depende mais de preço ser a última coluna. O modo comercial usa cor da marca, peso tipográfico maior e separação visual própria.

## Fitting da descrição

A descrição é ajustada somente no DOM renderizado, depois da geometria A4 estar materializada.

Orçamento editorial:

- Card `simple`: até 3 linhas;
- Card `wide`: até 4 linhas;
- Card `full`: até 5 linhas;
- Showcase nunca usa menos de 4 linhas.

Quando o texto excede o orçamento, o renderer preserva o maior prefixo que cabe removendo palavras completas a partir do final. Não adiciona reticências. Uma palavra excepcionalmente longa pode quebrar internamente como fallback para não romper o Card.

O texto integral permanece no `Product`, no `CatalogDocument` e em `data-full-description`/`title` do heading renderizado para rastreabilidade editorial.

## Compatibilidade

O recorte não altera schema de Product, ProductStore, membership, ordem factual, Collection ou framing de imagem. Não inclui preço por quantidade nem simplificação de seleção/inspector.

## Gates

- `commercial-presentation-fixture.mjs`: normalização de `priceStyle` e `commercialPrices`;
- `browser-commercial-presentation-gate.mjs`: quatro estilos de Card, Table comercial com preço fora da última coluna, inspector, fitting por palavras, preservação factual, paridade preview/print e `showPrices=false`.
