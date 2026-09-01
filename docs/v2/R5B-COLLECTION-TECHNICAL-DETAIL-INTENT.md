# V2 R5b — Collection Technical Detail

## Objetivo

Fechar uma assimetria concreta do vocabulário editorial: ao agrupar produtos em `Collection`, o catálogo preserva a família visual, mas perde o pequeno resumo técnico factual que já existe em `product.specs` e pode ser exibido por Card.

R5b adiciona um único preset bounded de Collection, `technical`, sem transformar Collection em um Card arbitrariamente configurável e sem criar novo primitivo editorial.

## Autoridade

R5b não cria estado factual nem nova authority.

Continuam autoritativos:

- `product.specs[]` para especificações factuais do produto;
- `catalog.presentation.blocks[]` para a decisão local de agrupar e escolher `itemPreset`;
- `Collection.itemStyles[productId]` para os overrides locais já existentes de largura, ênfase e preço;
- `CatalogOrder -> CatalogDocument -> preview / print` para ordem, materialização e documento físico.

O preset técnico é somente uma projeção editorial de dados existentes. Ele não escreve no ProductStore, não cria `specOverrides` e não altera `product.specs`.

## Contrato

`Collection.COLLECTION_PRESETS` passa a aceitar:

```text
visual | compact | commercial | technical
```

`technical` é uma decisão do bloco inteiro. R5b deliberadamente não adiciona `contentPreset` por membro.

Cada membro técnico mantém a estrutura visual existente e acrescenta um resumo pequeno de especificações na área textual inferior:

```text
[ imagem ]

CÓDIGO
Descrição
Especificação A · valor
Especificação B · valor
```

A quantidade máxima é determinística e deriva somente da largura local já existente:

- `simple`: até 1 especificação;
- `wide`: até 2 especificações;
- `full`: até 2 especificações.

Somente especificações factuais com `value` não vazio são elegíveis. A ordem é a ordem factual de `product.specs`.

Especificações excedentes são simplesmente omitidas nesse resumo; R5b não expande a célula, não mede pixels em JavaScript e não inventa indicador comercial.

## Geometria

Collection continua:

- full-width top-level;
- atômica entre páginas;
- 2–4 colunas internas;
- no máximo 12 membros;
- sem nesting;
- sem coordenadas livres;
- com `localRowCount` e `rowSpan` definidos pelo planner antes do DOM.

O preset técnico somente redistribui a região interna já bounded do membro entre imagem e copy. Ele não participa do cálculo estrutural de página e não altera `CatalogDocument` ou `CatalogOrder`.

Se a implementação exigir mudança no planner, fragmentação de Collection ou nova geometria top-level para caber o conteúdo técnico, o recorte deve ser reduzido em vez de ampliar a arquitetura.

## Superfície

O inspector de Collection reutiliza o select existente `Apresentação`, que deriva suas opções de `Collection.COLLECTION_PRESETS`. A nova opção aparece como `Técnico`.

R5b não adiciona controles para:

- escolher quais specs mostrar;
- reordenar specs localmente;
- definir quantidade de specs;
- editar labels/valores dentro da Collection;
- configurar layout por membro.

Dados continuam sendo editados na superfície factual do produto.

## Renderer

`Collection.technicalDetailFor(product, style)` é uma projeção pura e testável que resolve o orçamento técnico do membro sem DOM.

`collection-render.js` consome essa projeção somente quando `block.itemPreset === 'technical'` e materializa uma lista compacta dentro de `.catalog-collection-copy`.

Não há mudança em:

- `Composition.CONTENT_PRESETS`;
- TemplateContract;
- CatalogOrder;
- CatalogDocument;
- ProductSnapshot/ProductStore;
- TableBlock;
- image selection/framing.

## Não objetivos

R5b não inclui:

- Collection 2.0 ampla;
- `Callout`;
- novo primitivo top-level;
- nesting/container genérico;
- Collection fragmentável;
- `tableRows` dentro de Collection;
- presets de Card por membro;
- overrides locais de especificação;
- nova capability do TemplateContract;
- redesign do pipeline A4.

## Gates

O recorte deve preservar toda a regressão existente e provar:

1. `technical` normaliza como preset válido;
2. presets antigos mantêm a semântica anterior;
3. `simple` projeta no máximo 1 spec;
4. `wide` e `full` projetam no máximo 2 specs;
5. specs vazias não são materializadas;
6. a ordem das specs segue `product.specs`;
7. a projeção não muta o produto;
8. inspector oferece `Técnico` pelo contrato existente de presets;
9. o renderer materializa somente o orçamento técnico permitido;
10. membros sem specs não recebem placeholders inventados;
11. largura e ênfase locais continuam funcionando;
12. image selection/framing continuam funcionando no membro;
13. Collection continua atômica e sem cards duplicados;
14. preview e print mostram o mesmo resumo;
15. página física permanece A4 `210 × 297 mm`;
16. Validate e Browser passam no mesmo SHA antes de promoção para `v2`.
