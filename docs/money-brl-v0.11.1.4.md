# CatalogoTop v0.11.1.4 — Fundação monetária BRL

## Objetivo

Estabelecer um contrato monetário único antes dos recortes de destaque comercial e preço por quantidade.

O recorte não altera o schema estrutural do produto e não introduz ainda estilos comerciais de preço. Ele faz valores monetários reconhecidos convergirem para uma representação canônica em reais.

## Contrato

`CatalogoTop.Money` é a autoridade para parsing e apresentação monetária.

Entradas reconhecidas incluem, entre outras:

- `54,9` → `R$ 54,90`
- `54.90` → `R$ 54,90`
- `R$54,90` → `R$ 54,90`
- `1.234,56` → `R$ 1.234,56`
- `1234.56` → `R$ 1.234,56`
- `1,234.56` → `R$ 1.234,56`
- `1234` → `R$ 1.234,00`

O parser trabalha com centavos inteiros e não usa ponto flutuante como representação factual de dinheiro.

Valores vazios permanecem vazios. Valores textuais antigos que não podem ser interpretados deterministicamente, como `consultar`, são preservados durante migração/leitura em vez de serem inventados ou apagados.

## Persistência

O schema permanece em sua versão atual. Os campos continuam sendo:

- `product.price`
- `product.tableRows[].price`

Valores reconhecidos são normalizados para a string canônica `R$ …` durante `Core.normalizeProduct()` / `Core.normalizeTableRows()`.

Isso significa que cadastro manual, merge, backup restaurado, base remota materializada e importação convergem pelo mesmo caminho de normalização.

## Novas escritas

### Cadastro manual

O campo de preço:

- aceita entrada flexível enquanto o usuário digita;
- normaliza no `blur` quando o valor é válido;
- bloqueia submit quando um preço não vazio é inválido.

As linhas comerciais recebem o mesmo tratamento. Um preço inválido em uma linha impede o submit e identifica a linha problemática.

### CSV / Excel

Preço vazio continua válido.

Uma linha de importação com preço não vazio e não reconhecido é ignorada individualmente e registrada no relatório de linhas inválidas. As outras linhas da planilha continuam disponíveis para importação.

## Renderização

Não foi criado um formatter paralelo no renderer. O estado factual já chega canônico às superfícies de apresentação, portanto:

- Card;
- tabela interna de Card;
- Collection comercial;
- Table estrutural;
- biblioteca;
- preview;
- print/PDF

usam o mesmo texto monetário normalizado.

`showPrices=false` continua removendo as superfícies de preço.

## Compatibilidade

- nenhuma nova entidade de preço;
- nenhum `priceCents` persistido neste recorte;
- nenhuma alteração de ProductStore;
- nenhum estilo comercial novo;
- valores legados não reconhecíveis são preservados na leitura, mas não são aceitos como nova edição manual/importação.

## Gates

`money-fixture.mjs` cobre:

- parsing BRL;
- centavos inteiros;
- milhares;
- round-trip idempotente;
- entradas inválidas;
- migração legada;
- `product.price`;
- `tableRows[].price`;
- importação fail-closed por linha.

`browser-money-gate.mjs` cobre:

- Card;
- tabela interna do Card;
- Collection;
- Table;
- normalização do formulário;
- rejeição de entrada manual inválida;
- `showPrices=false`.

## Fora do recorte

O próximo recorte visual permanece responsável por:

- estilos de destaque de preço;
- modo de tabela comercial;
- descrição do card padrão em grade de quatro colunas com baseline de até três linhas e truncamento editorial por palavras, sem alterar `Product.description`.

Preço por quantidade permanece um recorte posterior, apoiado nesta fundação monetária.
