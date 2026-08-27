# v0.11.1 — Inspector contextual e ordem editorial

## Objetivo

Transformar o preview A4 em superfície de seleção editorial e a lista em superfície de membership/navegação/ordenação, sem introduzir canvas livre, coordenadas ou drag sobre a folha.

A divisão final de responsabilidades é:

```text
Preview A4
→ selecionar o objeto a editar

Inspector
→ editar propriedades editoriais do target

Lista
→ incluir/remover produtos
→ navegar até um target
→ reordenar o catálogo
→ criar Collection/Table
```

## Estado persistido

O schema local passa a v5.

`selectedIds` continua representando somente membership:

```text
quais produtos pertencem ao catálogo
```

A ordem editorial é persistida separadamente:

```js
catalog.presentation.order = ['p1', 'p4', 'p2', 'p3']
```

Estados anteriores sem `presentation.order` migram deterministicamente usando a ordem de `selectedIds` como baseline. IDs duplicados/inexistentes/não selecionados são ignorados; selecionados ausentes na ordem são anexados ao fim de sua categoria.

O ProductStore remoto não recebe nenhum desses dados editoriais.

## CatalogOrder

`src/catalog-order.js` é a autoridade pura de ordem antes do documento:

```text
selectedIds
+
presentation.order
+
products
+
blocks
        ↓
CatalogOrder
        ↓
CatalogDocument
```

Ele:

- preserva a sequência atual das categorias;
- ordena produtos dentro de cada categoria;
- rejeita reorder entre categorias;
- trata Card como unidade de um produto;
- trata Collection/Table como unidades atômicas;
- nunca chama `CatalogDocument`;
- nunca muta `selectedIds`.

Collection/Table continuam válidas somente quando seus membros formam um trecho contíguo da ordem editorial efetiva.

## Reorder

A reordenação existe somente na lista.

Cada unidade editável expõe um handle `⋮⋮`. Membros internos de Collection/Table não recebem um handle independente. O reorder pode ser acionado por drag no handle ou, para teclado, `Alt+↑` / `Alt+↓`.

Busca textual ativa desabilita os handles para evitar reordenar uma projeção parcial ambígua. Filtro de categoria continua compatível porque não altera a semântica da ordem dentro da categoria.

Agrupar/desagrupar preserva a ordem editorial; mover um bloco move todos os seus membros juntos.

## ComposerSelection

`src/composer-selection.js` guarda apenas estado efêmero da UI:

```js
{ kind: 'card', productId }
{ kind: 'collection', blockId }
{ kind: 'collection-member', blockId, productId }
{ kind: 'table', blockId }
```

A seleção não entra em:

- backup;
- ProductStore;
- `CatalogDocument`;
- HTML/PDF de impressão.

`reconcile()` limpa targets que deixam de existir depois de uma mutação.

## Preview selecionável

O listener é delegado no `#catalogPreview`, então rerenders não reinstalam listeners individuais.

Prioridade de resolução:

```text
Collection member
→ Collection
→ Table
→ Card
```

O chrome editorial usa `outline`, sem alterar geometria A4. Os atributos/classes auxiliares são aplicados somente no DOM do preview; o documento print é renderizado separadamente.

Nenhum `pointerdown` ou `touchstart` é capturado sobre a folha. Tap seleciona por `click`; pan vertical permanece nativo.

## Inspector contextual

O inspector ocupa o topo do painel da lista.

### Card

- Conteúdo;
- Ênfase;
- Largura;
- atalho para editar os dados factuais do produto.

### Collection

- Título;
- Subtítulo;
- Tema;
- Colunas;
- Preset dos itens;
- Desagrupar.

### Collection member

- Ênfase local;
- Largura local;
- acesso ao bloco;
- acesso ao produto.

### Table

- Título;
- Subtítulo;
- Fonte das linhas;
- Densidade;
- Colunas conhecidas;
- Desagrupar.

Os managers editoriais paralelos de Collection/Table foram removidos da lista. Os módulos `collection-controls.js` e `table-controls.js` ficaram responsáveis apenas pela criação dos respectivos blocos.

## PresentationActions

`src/presentation-actions.js` centraliza mutações editoriais:

```js
setCardStyle()
updateCollection()
setCollectionMemberStyle()
updateTable()
dissolveCollection()
dissolveTable()
moveOrderUnit()
moveOrderUnitRelative()
```

Isso evita implementar a mesma mutação separadamente no inspector, lista e controles de bloco.

## Membership

Checkbox continua sendo a única ação de inclusão/remoção na lista.

Ao desmarcar um produto:

- ele sai de `selectedIds`;
- sai de `presentation.order`;
- sai de Collection/Table;
- bloco com menos de dois membros é dissolvido.

Ao selecionar um produto novo, ele é anexado ao fim da sua categoria na ordem editorial.

Excluir produto também limpa `presentation.order`, overrides e memberships através da mesma operação de domínio já usada pela aplicação.

## Divisão de responsabilidades dos gates

### Browser Print Gate

É autoridade para:

- materialização lógica do `CatalogDocument`;
- geometria por slots;
- paginação;
- isolamento do documento print;
- A4 físico;
- Fit/zoom;
- scroll vertical touch no preview.

Ele não exige seletores de controles editoriais da aplicação.

### Browser Inspector Gate

É autoridade para:

- clique em Card/Collection/member/Table no preview;
- inspector correto para cada target;
- alteração de largura de Card chegando ao `CatalogDocument`/preview;
- overrides locais de Collection;
- edição de Collection/Table;
- lista ↔ preview sincronizados;
- reorder pela lista;
- Collection movida atomicamente;
- `selectedIds` estável durante reorder/edição;
- busca textual desabilitando reorder;
- print sem inspector/handles/highlight;
- tap para seleção sem bloquear scroll vertical touch.

## Regra de sanitização

Quando uma responsabilidade de UX migra entre superfícies, atualizar o gate proprietário da interação em vez de conservar atributos/controles obsoletos apenas para satisfazer um teste anterior.

A asserção antiga do Browser Print Gate que exigia `data-card-width` na lista foi removida. A cobertura equivalente agora é o fluxo real:

```text
preview
→ Card
→ inspector
→ alterar largura
→ CatalogDocument/preview
```

## Fora de escopo

- drag/resize no A4;
- reorder de categorias;
- coordenadas;
- nesting;
- quarto primitivo estrutural;
- enquadramento de imagem (`presentation.imageFrames` permanece reservado para v0.11.2);
- receitas editoriais.
