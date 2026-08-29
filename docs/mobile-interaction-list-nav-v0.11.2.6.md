# v0.11.2.6 — Mobile interaction & list navigation polish

## Objetivo

Fechar o mobile antes de retomar o redesenho desktop, sem alterar schema, ProductStore, CatalogDocument, A4 físico ou dados comerciais.

## Preview editorial no mobile

O A4 continua aceitando tap, long-press editorial e pan vertical/horizontal conforme os contratos existentes, mas o navegador não deve interromper o fluxo com o callout nativo de imagem/texto.

No breakpoint mobile (`<= 639px`):

- `catalogPreviewViewport` e seus descendentes usam `user-select: none` / `-webkit-user-select: none`;
- `-webkit-touch-callout: none` impede o menu nativo de copiar/Lens/baixar;
- imagens recebem `draggable=false` e `-webkit-user-drag: none`;
- `contextmenu` é cancelado apenas dentro do preview;
- `dragstart` de imagens é cancelado apenas dentro do preview;
- nenhum `pointerdown`/`touchstart` recebe `preventDefault()`, preservando scroll e seleção editorial.

Fora do preview o comportamento nativo do browser permanece disponível.

## Lista de Produtos mobile

A apresentação mobile existente é preservada:

- miniatura de 50 px;
- código + status;
- descrição com até três linhas;
- ações à direita.

O separador passa a pertencer ao `<tr>` inteiro. Células do `tbody` não desenham bordas inferiores próprias, evitando linhas quebradas/desalinhadas entre as colunas da grid mobile.

## Filtro do Catálogo mobile

`selectionCategory` continua sendo a autoridade real do filtro e permanece visível no desktop/tablet.

No mobile:

- o `<select id="selectionCategory">` é ocultado visualmente;
- `MobileWorkspace` cria um rail horizontal a partir das opções do próprio select;
- clicar num chip escreve no select e dispara o mesmo evento `change` já consumido por `App.renderSelection()`;
- não existe estado paralelo de categoria;
- o rail se mantém sincronizado quando categorias/produtos são rerenderizados;
- a categoria ativa é trazida para a área horizontal visível sem deslocar o eixo vertical.

A ordem espacial do painel mobile passa a ser:

1. Configuração / Ordenação do target;
2. ações do catálogo e de agrupamento;
3. busca textual;
4. rail horizontal de categorias;
5. lista de produtos.

Busca e categoria, portanto, ficam imediatamente junto da lista que modificam.

## Gates

`browser-adaptive-workspace-gate.mjs` passa a provar também:

- `contextmenu` cancelado no preview mobile e preservado fora dele;
- imagem do preview não draggable;
- proteção de seleção de texto limitada ao preview mobile;
- separador contínuo no `<tr>` e ausência de bordas concorrentes nas células;
- rail mobile visível com select oculto;
- sincronização rail → `selectionCategory` → lista;
- composição de busca textual + categoria;
- troca de categoria sem salto vertical;
- desktop preserva o select, oculta o rail e não cancela contextmenu do preview.

Os gates anteriores de touch/long-press, reorder, A4 e preview→print continuam obrigatórios.

## Fora de escopo

- redesenho do workspace desktop;
- Image Variation Bundle;
- mudanças de schema;
- nova persistência;
- alteração do conteúdo físico do PDF;
- bloquear seleção/cópia fora do preview editorial.
