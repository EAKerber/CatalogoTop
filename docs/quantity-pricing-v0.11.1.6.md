# CatalogoTop v0.11.1.6 — preço por quantidade

## Escopo

Este recorte adiciona uma única condição factual de preço por quantidade a produtos e linhas comerciais e a projeta em Card e Table sem introduzir múltiplas faixas, cálculo de desconto ou um segundo modelo monetário.

## Contrato factual

O schema local passa a `6`.

`Product.quantityPrice` e `tableRows[].quantityPrice` são opcionais e usam a mesma forma:

```js
null
```

ou:

```js
{
  minQuantity: 10,
  price: "R$ 49,90"
}
```

Regras:

- `minQuantity` deve ser inteiro seguro e >= 2;
- `price` passa pela autoridade `Money` e fica canônico em BRL;
- o toggle do formulário não é persistido: ligado significa que o objeto existe; desligado significa `null`;
- o sistema não exige que o preço em quantidade seja menor que o preço unitário, pois isso seria uma regra comercial não informada;
- estados anteriores migram para schema 6 com `quantityPrice: null` quando o campo não existe.

## Cadastro

Na etapa **Apresentação**, o preço atual continua sendo o preço unitário e há o toggle **Preço por quantidade**.

Ligado, ele expõe:

- `Qtd. mín.`;
- `Preço em quantidade`.

O formulário bloqueia quantidade fracionária/menor que 2 e preço monetário inválido. Ao editar um produto, o estado é carregado novamente; desligar o toggle e salvar remove explicitamente a condição.

## Linhas comerciais

O formato anterior continua válido:

```text
cor | código | embalagem | preço
```

O formato estendido aceita:

```text
cor | código | embalagem | preço | qtd. mín. | preço qtd.
```

Exemplo:

```text
Preto | 1268-PT | CX 10 | R$ 18,20 | 10 | R$ 16,90
```

Os dois últimos campos são pareados: ambos vazios ou ambos válidos.

## Importação CSV/Excel

Aliases opcionais de quantidade mínima:

- `quantidade minima`;
- `qtd minima`;
- `qtd desconto`;
- `quantidade para desconto`;
- `minimo quantidade`.

Aliases opcionais de preço em quantidade:

- `preco quantidade`;
- `preco em quantidade`;
- `preco qtd`;
- `valor quantidade`;
- `valor em quantidade`.

Política:

- ambos vazios: sem informação explícita de preço por quantidade;
- ambos válidos: cria/atualiza `quantityPrice`;
- apenas um preenchido: linha inválida;
- quantidade inválida ou preço inválido: linha inválida;
- no modo `merge`, ausência/par vazio não apaga um `quantityPrice` já existente;
- atualização/remoção explícita continua possível pelo domínio/editor; `replace` materializa exatamente a importação.

## Card

Quando `showPrices=true` e o produto não tem `tableRows`, Card apresenta o preço unitário e, quando existir, uma segunda condição estática:

```text
R$ 54,90
A partir de 10 un.  R$ 49,90
```

Os quatro estilos editoriais de preço (`standard`, `red`, `label`, `block`) continuam sendo apresentação local. No estilo `block`, o preço por quantidade recebe a maior hierarquia e o unitário permanece como referência.

Quando o Card possui `tableRows`:

- linhas que possuírem `quantityPrice` recebem `Qtd. mín.` e `Preço qtd.`;
- uma linha real sem `quantityPrice` não herda a condição geral do Product;
- se nenhuma linha visível possuir condição e o Product possuir uma condição geral, ela é apresentada como faixa geral abaixo da tabela.

## Table estrutural

Novas colunas semânticas:

- `minQuantity` → **Qtd. mín.**;
- `quantityPrice` → **Preço qtd.**.

`rowSource=products` usa a condição factual do Product.

`rowSource=commercialRows` usa a condição factual de cada linha. Somente o fallback de um produto sem nenhuma linha comercial pode usar a condição do Product.

Novas Tables criadas a partir de Products incluem as duas colunas automaticamente quando pelo menos um membro possui preço por quantidade. Tables antigas não são modificadas automaticamente.

`commercialPrices=true` estiliza tanto preço unitário quanto preço em quantidade; o preço em quantidade recebe hierarquia ligeiramente maior.

## Autoridade global `showPrices`

`showPrices=false` remove em conjunto:

- preço unitário;
- preço em quantidade;
- texto `A partir de X un.`;
- coluna `Qtd. mín.`;
- coluna `Preço qtd.`.

Não permanece uma quantidade mínima órfã quando preços estão ocultos.

## ProductStore e assets

Não há novo protocolo de persistência. `ProductStore` publica o objeto completo, `/api/products` preserva campos do Product e `AssetClient.materializeProducts()` clona o objeto inteiro antes de materializar imagens. Assim `quantityPrice` atravessa o mesmo caminho de sincronização dos demais fatos do Product.

## Fora do escopo

- múltiplos tiers de preço;
- percentual de desconto;
- cálculo automático de economia;
- estoque;
- preço por caixa como conceito separado;
- simplificação de seleção com Shift/Ctrl/long press;
- remoção do painel de aplicação em lote e inspector recolhível;
- novos layouts laterais/empilhados;
- framing de imagem.

## Gates

- `quantity-pricing-fixture.mjs`: schema/migração, normalização, linhas 4/6 campos, merge conservador, importação e Table sem herança indevida;
- `browser-quantity-pricing-gate.mjs`: Card, tabela interna, Table `products`, Table `commercialRows`, editor, validação, `showPrices=false`, paridade preview/print e overflow;
- os gates existentes de dinheiro e apresentação comercial permanecem como regressão obrigatória.
