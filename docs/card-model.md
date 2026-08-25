# Cards, variações e tabelas — recorte 0.2

Este recorte mantém o paradigma do CatalogoTop propositalmente pequeno: o produto continua sendo a unidade de conteúdo e o template continua decidindo a disposição. Não existe edição livre dentro do card.

## Variações visuais

Cada produto pode ter uma lista ordenada de variações:

```js
variants: [
  { id: 'variant-1', label: 'Branco', image: 'https://...' },
  { id: 'variant-2', label: 'Preto', image: 'https://...' }
]
```

No formulário a entrada é textual, uma variação por linha:

```text
Branco | https://...
Preto | https://...
```

O renderer mostra as imagens lado a lado dentro da área visual do card. Se a variação não tiver imagem, o nome aparece como legenda junto à imagem principal. Cada template limita quantas variações aparecem para preservar a geometria A4.

## Tabela comercial

A tabela é deliberadamente fixa e pequena. Cada linha contém até quatro valores:

```js
tableRows: [
  { variant: 'Branco', code: '1268-BR', package: 'CX 10', price: 'R$ 17,64' }
]
```

Entrada textual:

```text
Branco | 1268-BR | CX 10 | R$ 17,64
Preto | 1268-PT | CX 10 | R$ 18,20
```

O renderer omite colunas totalmente vazias. A coluna de preço também respeita a opção global **Mostrar preços**. Quando existe tabela, o preço-base do card não é repetido.

## Limites por template

Os limites são uma decisão de renderização, não dados do produto:

- Compacto: até 3 variações e 3 linhas comerciais por card;
- Técnico: até 4 variações e 4 linhas comerciais por card;
- Destaque: até 5 variações e 6 linhas comerciais por card.

Se houver mais dados, o card informa quantos itens foram omitidos. Isso evita auto-layout complexo e mantém paginação previsível.

## Persistência e compatibilidade

O schema local sobe para a versão 2. Backups e estados antigos continuam migrando; produtos antigos simplesmente recebem `variants: []` e `tableRows: []`.

Importações CSV/Excel continuam simples neste recorte. Colunas extras ainda viram especificações. Agrupamento automático de várias linhas da planilha em um único produto/variante fica fora deste recorte até existir um formato real de planilha para validar a regra.
