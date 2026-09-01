# V2 R5a — Table Row Image Editing Parity

## Objetivo

Fechar a assimetria de edição de imagem entre Card, membro de Collection e linha de Table sem criar uma nova autoridade visual, novo schema ou novo modelo de placement.

O recorte cobre somente Table com `rowSource: 'products'` e coluna `image` ativa. Nesse caso cada linha já corresponde a exatamente um produto e pode reutilizar o estado editorial por `productId` existente.

## Autoridade

R5a não cria estado novo.

Continuam autoritativos:

- `catalog.presentation.imageSelections[productId]` para escolher Original / `Product.imageGallery` / variante local do catálogo;
- `catalog.presentation.imageFrames[productId]` para `fit`, `zoom`, `x` e `y`;
- `product.image` permanece a imagem factual/canônica do produto e não é alterada por edição editorial.

A mesma seleção e o mesmo enquadramento sobrevivem se o produto mudar entre Card, Collection e Table porque o contrato atual é deliberadamente `productId`-scoped.

## Eligibility

Uma linha de Table recebe edição de imagem somente quando:

1. o target é `table-row`;
2. a Table usa `rowSource: 'products'`;
3. a coluna `image` está ativa;
4. existe uma imagem principal para os controles de enquadramento.

Quando `rowSource: 'products'` está ativo mas a coluna Imagem está oculta, o inspector informa que a coluna deve ser ativada e não expõe controles com efeito invisível.

`commercialRows` permanece fora do recorte: um produto pode produzir várias linhas comerciais e isso exigiria uma decisão explícita futura sobre autoridade por produto, linha ou placement.

## Superfície

Ao selecionar uma linha elegível no A4, o inspector reutiliza o mesmo vocabulário de imagem já disponível para usos de imagem única:

- navegação entre Original e alternativas reutilizáveis/locais quando existirem;
- Conter / Preencher;
- Zoom;
- Horizontal;
- Vertical;
- Redefinir enquadramento.

Uma Table continua exibindo uma única imagem por linha. `product.variants` não transforma a célula em grade comercial e não bloqueia o editor da linha.

## Renderer

O pipeline permanece:

`CatalogDocument -> Table markup -> image selection -> image framing -> text fit -> preview / print`

A extensão atua somente sobre:

`.catalog-table-block[data-table-block-id] tr[data-table-row-id][data-product-id] .table-cell-image > img`

Ela não altera:

- `TableBlock.rowsForBlock()`;
- fragmentação;
- `CatalogOrder`;
- `CatalogDocument`;
- largura de colunas;
- altura de linhas;
- paginação;
- TemplateContract.

A célula mantém `overflow: hidden`; `object-fit`, `object-position`, `transform` e `transform-origin` não participam da geometria estrutural.

## Não objetivos

R5a não inclui:

- edição de imagem para `commercialRows`;
- framing/seleção por placement ou por rowId;
- crop destrutivo;
- alteração ou promoção automática de assets no ProductStore;
- geração de imagem;
- Variation Bundle para Table;
- redesign da Table;
- novo primitivo editorial;
- Collection 2.0 ou Callout;
- qualquer decisão sobre o restante de R5.

## Gates

O recorte deve preservar toda a regressão existente e acrescentar `scripts/browser-r5a-table-row-image-gate.mjs`, cobrindo:

1. imagem Original inicial na linha;
2. target `table-row` abrindo controles de imagem;
3. troca explícita para alternativa sem alterar `product.image`;
4. persistência de `imageSelections[productId]`;
5. edição de fit/zoom/x/y em `imageFrames[productId]`;
6. aplicação visual na célula de Table;
7. `overflow: hidden` e nenhuma mudança relevante de altura da linha após zoom;
8. paridade preview/print;
9. ausência de chrome do inspector no print;
10. coluna Imagem desativada não expondo um editor com efeito invisível.

Validate e Browser devem passar no mesmo SHA antes de qualquer promoção para `v2`.
