# v0.11.2.3 — seleção, ordenação e legibilidade do compositor

## Objetivo

Corrigir regressões e lacunas do compositor antes de iniciar o pipeline de variações de imagem. O recorte mantém `selectedIds` como membership e usa `ComposerSelection` como única seleção editorial efêmera.

## Seleção múltipla e target primário

Uma multiseleção pode conter vários `productIds` e ainda possuir um único target primário para o inspector.

- Ctrl/Cmd, Shift e long-press continuam compondo a seleção editorial.
- clicar normalmente em um item que já pertence a uma multiseleção troca apenas o target primário; o conjunto permanece;
- clicar num item fora do conjunto inicia uma seleção nova;
- quando o target atual é o bloco inteiro (`collection` ou `table`), clicar em um membro volta a selecionar especificamente aquele membro, evitando bulk acidental.

Membership nunca é alterado por essas operações.

## Alterações bulk compatíveis

`PresentationActions` é a autoridade da mutação editorial e passa a ser selection-aware quando a operação parte de um produto pertencente a uma multiseleção.

Compatibilidade:

- Card: `contentPreset`, `emphasis`, `width`, `priceStyle`;
- membro de Collection: `emphasis`, `width`, `priceStyle`;
- `imageFrame`: pode ser aplicado/resetado aos produtos selecionados;
- propriedades sem equivalente no target selecionado são ignoradas para esse target;
- configurações do bloco inteiro (título, colunas, densidade etc.) permanecem exclusivas do bloco.

Quando valores compatíveis diferem entre os selecionados, o inspector mostra `Misto`; escolher um valor o aplica aos targets compatíveis.

## Agrupamento de itens não contíguos

Contiguidade deixa de ser pré-requisito de seleção para criar Collection/Table.

Os candidatos ainda precisam:

- estar incluídos no catálogo;
- pertencer à mesma categoria;
- estar fora de outro bloco;
- respeitar o limite de membros do bloco.

Antes da criação, `GroupingControls.prepareGrouping()` calcula `consolidatedOrder()`:

1. preserva a ordem relativa dos selecionados;
2. remove os selecionados de suas posições atuais;
3. reinsere o conjunto no ponto do primeiro selecionado;
4. persiste a nova `presentation.order` pela autoridade `PresentationActions`;
5. o bloco é então criado sobre o trecho já contíguo.

Exemplo:

`A B C D E F`, seleção `B D F` → `A [B D F] C E`.

## Reorder unificado

`EditorOrder.moveSelectionRelative(delta)` resolve uma única intenção de subir/descer:

- Card único → move o Card;
- múltiplas unidades selecionadas → move todas uma posição, preservando ordem relativa;
- Collection/Table selecionada como bloco → move o bloco inteiro;
- único membro de Collection/Table → move internamente no bloco;
- seleção parcial de um bloco misturada com outras unidades não é movida como conjunto;
- reorder continua restrito à categoria atual.

A mesma operação alimenta:

- controles ↑/↓ no inspector;
- ArrowUp/ArrowDown no desktop quando o foco está numa superfície editorial;
- duas setas flutuantes no mobile.

Setas de teclado não são capturadas quando o foco está em input, textarea, select, button, link ou contenteditable.

## Formatação relativa na Collection

A persistência histórica de `Collection.itemStyles` continua indexada por `productId`, sem mudança de schema.

Ao trocar dois membros internamente, `PresentationActions.moveBlockMember()` troca também os estilos locais desses dois IDs. O efeito editorial é que a apresentação permanece na posição:

- posição `full` continua `full`;
- posição `simple` continua `simple`;
- `emphasis` e `priceStyle` também permanecem relativos ao slot.

## Inspector e mobile

O inspector expandido possui altura máxima e scroll próprio. Filtro, ações de membership, ações contextuais e a lista permanecem regiões separadas do painel.

No mobile:

- o inspector usa limite menor de altura;
- as duas setas flutuantes permanecem fora do container do inspector;
- elas aparecem somente quando existe seleção editorial;
- gesto vertical do A4 continua pertencendo ao scroll, sem pointer capture adicional.

## TextFit independente do zoom

`TextFit.fitCatalog()` mede sempre a geometria canônica com `--preview-scale: 1` e restaura a escala de preview depois da medição.

A escolha de palavras visíveis não pode depender de:

- preview desktop em 100%;
- preview desktop reduzido;
- Fit mobile;
- iframe de impressão.

O gate usa explicitamente a descrição `CORREDIÇA TELESCÓPICA REFORÇADA C/ AMORTECIMENTO 300 MM` em Collection de quatro colunas e exige o mesmo texto/metadata de fitting em todas essas superfícies.

## Legibilidade de Table

A tipografia documental da Table foi aumentada, inclusive no preset compacto. Preços recebem prioridade adicional, e `Preço qtd.` permanece ligeiramente maior/mais forte que o preço unitário.

Como as regras ficam em `table-block.css`, preview e iframe de impressão compartilham os mesmos valores.

## Não objetivos

O recorte não:

- altera ProductStore ou dados factuais dos produtos;
- altera schema;
- cria novo tipo estrutural;
- permite agrupamento entre categorias;
- permite nesting de blocos;
- cria drag livre sobre A4;
- inicia o Image Variation Bundle planejado para o próximo incremento.

## Gates

Além da suíte existente, `scripts/browser-composer-order-legibility-gate.mjs` cobre:

- preservação da multiseleção ao trocar target primário;
- bulk de largura/preço;
- estado misto;
- consolidação de seleção não contígua;
- reorder interno com estilo relativo à posição;
- reorder do bloco inteiro;
- ArrowUp/ArrowDown e proteção de controles de formulário;
- duas setas flutuantes mobile e reorder de bloco no mobile;
- containment/scroll do inspector mobile;
- TextFit idêntico em 100%, zoom reduzido, mobile e print;
- legibilidade e paridade tipográfica da Table entre preview e print.
