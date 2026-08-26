# Table Block v0.10.2

## Objetivo

Adicionar `Table` como terceiro primitivo editorial top-level do CatalogoTop, ao lado de `Card` e `Collection`, sem reintroduzir layout livre.

O caso coberto é informação comercial densa: referências, produtos, variações, embalagem e preço organizados em linhas e colunas, com paginação determinística.

## Vocabulário estrutural

```text
Página
├─ Card       — uma família/produto
├─ Collection — vários produtos em grade visual local, atômica
└─ Table      — vários produtos/linhas em estrutura tabular, fragmentável
```

Nenhum desses blocos pode conter outro bloco. Profundidade máxima continua igual a 1.

## Estado

`Table` vive apenas em `catalog.presentation.blocks` e nunca no ProductStore.

```js
{
  id: 'table-electric',
  type: 'table',
  memberIds: ['p5', 'p6', 'p7'],
  title: 'Tomadas e interruptores',
  subtitle: 'Referências',
  rowSource: 'products',
  density: 'compact',
  columns: ['code', 'description', 'price']
}
```

Regras:

- 2–30 produtos selecionados;
- uma única categoria;
- membros contíguos na ordem factual;
- um produto não pode pertencer simultaneamente a `Collection` e `Table`;
- agrupar/desagrupar não altera `selectedIds`;
- bloco inválido falha para cards, nunca oculta produtos.

## Fontes de linha

### Produtos

Uma linha por produto. Colunas disponíveis:

- imagem;
- código;
- descrição;
- subcategoria;
- preço.

### Linhas comerciais

Achata `product.tableRows`. Colunas disponíveis:

- código/referência;
- descrição do produto;
- cor/variação;
- embalagem;
- preço.

Se um membro não possuir `tableRows`, ele continua representado por uma linha factual do produto, com campos comerciais ausentes vazios. Nenhum dado é inventado.

## Fragmentação

`Collection` permanece atômica. `Table` é deliberadamente fragmentável.

A tabela é convertida em unidades verticais antes da paginação. No preset compacto:

- primeira unidade com título: até 3 linhas;
- unidades seguintes: até 4 linhas.

No preset confortável:

- primeira unidade com título: até 2 linhas;
- unidades seguintes: até 3 linhas.

Cada unidade consome `rowSpan = 1`. Unidades consecutivas que caem na mesma página são materializadas como um único segmento visual com `rowSpan > 1`. Quando a tabela continua em outra página, o cabeçalho de colunas é repetido e o segmento recebe indicação de continuação.

O DOM não decide quantas páginas existem.

## Pipeline

```text
selectedIds
   ↓
Card / Collection / Table flow nodes
   ↓
slots + rowSpan + fragmentos
   ↓
CatalogDocument
   ↓
preview / print isolado
```

A ordem efetiva permanece a ordem factual dos produtos selecionados. Fragmentos de uma tabela não duplicam `orderedIds` nem `selectedCount`.

## Exclusão de produto

A biblioteca passa a oferecer exclusão direta por linha. A operação de domínio é única e deve limpar, antes da publicação remota:

- `products`;
- `selectedIds`;
- `catalog.presentation.itemStyles`;
- `memberIds` e `itemStyles` de blocos.

Se uma `Collection` ou `Table` cair para menos de dois membros, o bloco é dissolvido. Assets content-addressed não são apagados automaticamente.

## Gates

O recorte deve manter os gates anteriores e acrescentar:

- fixture Node para mixed blocks, fragmentação e fonte comercial;
- fixture de exclusão segura;
- Browser Gate com tabela atravessando duas páginas;
- cabeçalho repetido na continuação;
- nenhum membro duplicado como card;
- exclusão direta presente na biblioteca;
- PDF físico com o mesmo número de páginas lógicas e A4 `210 × 297 mm`.
