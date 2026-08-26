# Cards, variações e tabelas — recorte 0.4

O CatalogoTop mantém o paradigma propositalmente pequeno: o produto continua sendo a unidade de conteúdo e o template continua decidindo a disposição. Não existe edição livre dentro do card.

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

O renderer mostra as imagens na área visual do card. Variações sem imagem aparecem como etiquetas compactas junto à imagem principal; se o produto mistura variações com e sem imagem, os slots restantes podem ser usados pelas etiquetas. Cada template limita quantas variações aparecem para preservar a geometria A4.

Quando o número de variações excede o limite, o card mostra `+N`. Não existe expansão automática do card.

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

As larguras das colunas são calculadas por pesos fixos e simples — código recebe mais espaço, embalagem menos, preço e cor ficam intermediários. Isso evita um editor de tabela configurável e melhora a leitura de referências longas.

## Política de espaço do card

O card não tenta caber em qualquer quantidade de conteúdo. Em vez disso, escolhe entre três comportamentos previsíveis:

- **produto visual sem tabela**: preserva mais área de imagem;
- **produto com tabela e sem imagens de variação**: reduz a área visual para abrir largura às referências;
- **produto com tabela e imagens de variação**: mantém uma divisão mais equilibrada para que as cores continuem identificáveis.

O template continua sendo soberano. O Compacto usa mais altura para a tabela quando ela existe; o Destaque mantém a maior área visual; o Técnico fica no meio.

## Limites por template

Os limites são uma decisão de renderização, não dados do produto:

- Compacto: até 3 variações e 3 linhas comerciais por card; quando há tabela, especificações são omitidas;
- Técnico: até 4 variações, 6 linhas comerciais e 1 especificação quando há tabela;
- Destaque: até 5 variações, 8 linhas comerciais e 2 especificações quando há tabela.

Se houver mais dados, o card informa quantos itens foram omitidos. Isso evita auto-layout complexo e mantém paginação previsível.

## Harness visual

`examples/card-cases.html` cobre quatro situações sintéticas e usa o renderer real:

1. produto simples;
2. família com várias cores;
3. uma imagem com várias referências;
4. card denso com especificações, acabamentos e tabela.

O harness extrai o card da página renderizada e amplia somente sua geometria. Ele existe para comparar densidade e proporções sem transformar o aplicativo em um editor visual.

## Persistência e compatibilidade

O schema local permanece na versão 2. Backups e estados antigos continuam migrando; produtos antigos simplesmente recebem `variants: []` e `tableRows: []`.

Importações CSV/Excel continuam simples. Colunas extras ainda viram especificações. Agrupamento automático de várias linhas da planilha em um único produto/variante fica fora deste recorte até existir um formato real de planilha para validar a regra.
