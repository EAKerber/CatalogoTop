# v0.11.1.3 — gestão de produtos e categorias

Este patch fecha três necessidades operacionais da biblioteca antes do próximo recorte estrutural.

## Exclusão de produto

A operação de domínio continua sendo `ProductActions.deleteProduct()`.

Ela remove o produto de:

- base de produtos;
- `selectedIds`;
- `presentation.order`;
- `itemStyles`;
- `imageFrames` reservados;
- Collection/Table.

Blocos que ficam com menos de dois membros são dissolvidos.

Na tabela da biblioteca, a ação deixa de ser representada visualmente apenas por `×` e passa a exibir `Excluir`, mantendo confirmação antes de alterar a base compartilhada.

## Exclusão de categoria

Categoria continua sendo uma propriedade dos produtos, não uma entidade persistida separadamente. Não há CRUD de pastas vazias.

Consequentemente:

```text
Excluir categoria
=
Excluir todos os produtos cujo product.category corresponde à categoria
```

`ProductActions.deleteCategory()`:

1. resolve os produtos pertencentes à categoria;
2. mostra confirmação com a quantidade de produtos que será removida;
3. reaproveita a mesma limpeza de domínio de exclusão individual para cada produto;
4. publica a base compartilhada uma única vez ao final.

A confirmação deixa explícito que a exclusão também remove referências do catálogo atual e de Collection/Table.

Cada pasta real na navegação lateral possui uma ação de exclusão própria. `Todos os produtos` não possui exclusão.

## Seletor de categoria no cadastro

O campo de categoria continua sobrescrevível: um valor inexistente cria uma nova categoria ao salvar.

O `datalist` nativo é substituído na UI por um combobox controlado, sem alterar o valor persistido em `product.category`.

### Ao abrir sem texto

São recomendadas até 3 categorias priorizadas pela frequência de uso na base atual.

### Enquanto o usuário digita

São recomendadas até 3 categorias pela seguinte prioridade:

1. correspondência exata;
2. início do nome;
3. início de uma palavra;
4. ocorrência no restante do nome.

Frequência de uso e ordem alfabética resolvem empates.

### Acesso completo

As recomendações não filtram destrutivamente o seletor. A mesma superfície mantém uma seção `Todas as categorias`, com scroll interno e acesso a todas as opções existentes.

Quando o texto não corresponde a uma categoria existente, aparece explicitamente:

```text
Criar “<nome digitado>”
```

O campo suporta mouse, toque e teclado (`↑`, `↓`, `Enter`, `Esc`).

## Contratos preservados

- categoria continua sendo string factual do produto;
- não existem pastas vazias persistidas;
- exclusão de categoria é uma operação em lote sobre produtos existentes;
- ProductStore remoto continua sendo a autoridade da base compartilhada;
- seleção/template/estado editorial continuam locais;
- exclusão não deixa IDs órfãos no catálogo.

## Gates

Cobertura adicionada:

- fixture pura verificando exclusão em lote, limpeza de `selectedIds`, ordem, estilos, image frames e blocos, com uma única publicação;
- Browser Product/Category Gate verificando:
  - 3 recomendações iniciais;
  - priorização enquanto digita;
  - lista completa rolável;
  - escolha de categoria existente;
  - criação explícita de categoria nova;
  - exclusão visualmente explícita de produto;
  - exclusão de categoria removendo seus produtos e a pasta correspondente.

## Fora de escopo

- renomear categoria em lote;
- mover produtos em lote entre categorias;
- manter categorias vazias;
- hierarquia de subpastas;
- permissões diferentes por categoria.
