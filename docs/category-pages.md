# Paginação por categoria — v0.6

Este recorte conecta o filesystem de produtos ao documento final sem introduzir um editor de páginas.

## Regra principal

A seleção continua sendo uma lista ordenada de produtos. No momento de materializar o catálogo, essa lista é agrupada por `product.category` preservando a ordem da primeira aparição de cada categoria e a ordem relativa dos produtos dentro dela.

Exemplo de seleção:

1. Dobradiça A
2. Corrediça A
3. Dobradiça B
4. Pistão A

Resultado editorial:

- Dobradiças: A, B
- Corrediças: A
- Pistões: A

## Paginação

Cada categoria é paginada independentemente usando `template.perPage`. Uma categoria nunca compartilha uma página A4 com outra, mesmo quando sobra espaço na última página da categoria anterior.

A concatenação das páginas é feita somente depois da paginação de cada categoria. Por isso o contador do rodapé continua global (`01 / NN`, `02 / NN`, ...), enquanto o header de cada página usa a categoria daquela página.

Produtos inativos e IDs de seleção que já não existem são ignorados antes do agrupamento.

## Header e rodapé

- `header`: nome da categoria + quantidade total de produtos daquela categoria;
- `footer`: página global e data única de criação do catálogo;
- a família de cores continua sendo um único produto/card, independentemente da quantidade de variações ou SKUs internos.

## Preview

No preview da aplicação, um separador discreto aparece antes da primeira página de cada categoria com nome, quantidade de produtos e quantidade de páginas. Esse separador é UI de inspeção e é removido em impressão.

## Ordem

Não existe drag-and-drop de categorias neste recorte. A ordem é derivada de forma determinística da seleção:

1. a primeira categoria encontrada abre a primeira seção;
2. aparições posteriores da mesma categoria são reunidas à seção já criada;
3. dentro da categoria, produtos mantêm sua ordem de seleção.

Isso cria um contrato simples que poderá receber uma ordenação explícita no futuro sem alterar o modelo de produto.

## Gate

`scripts/category-pages-fixture.mjs` executa o algoritmo real de `src/render.js` com três categorias, uma delas atravessando múltiplas páginas. O teste verifica:

- filtragem de inativos;
- ordem por primeira aparição;
- estabilidade da ordem interna;
- paginação independente por categoria;
- ausência de mistura de categorias na mesma página;
- reinício do índice local quando uma nova categoria começa.
