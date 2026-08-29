# v0.11.2.8 — Desktop Panel Compaction & Authoring Ergonomics

## Objetivo

Fechar a ergonomia do painel autoral desktop sem alterar o documento físico A4, ProductStore, schema ou CatalogDocument.

O preview do v0.11.2.7 continua sendo o território principal à direita. O ganho vem de usar a largura do desktop para reduzir altura no painel esquerdo e preservar simultaneamente configuração completa e uma lista útil de produtos.

## Contratos

### Preview

- o antigo `80%` visual passa a ser o teto desktop mostrado como `100%`;
- o desktop não pode ampliar além desse teto;
- `Ajustar` continua podendo reduzir a escala;
- o uso normal em `100%` não requer scroll horizontal;
- PDF/print continuam em A4 físico 210 × 297 mm e não conhecem essa normalização de UI.

### Painel autoral

No desktop (>= 1180 px):

- largura autoral alvo: `clamp(480px, 36vw, 580px)`;
- sem target editorial, a configuração mostrada é a do catálogo: nome, template, preços e data;
- com Card/Collection/Table/membro/linha selecionado, os metadados gerais saem e o inspector contextual ocupa o mesmo território;
- a configuração usa duas ou três colunas quando semanticamente possível;
- a lista recebe todo o espaço residual e deve preservar aproximadamente 4–5 itens visíveis em 1440×900.

### Ações

As quatro ações grandes não formam mais duas linhas permanentes.

Toolbar desktop compacta:

- `Incluir visíveis`;
- `Coleção`;
- `Tabela`;
- `…` → `Esvaziar catálogo`.

A ação destrutiva permanece acessível, mas não recebe o mesmo peso espacial das operações frequentes.

### Inspector

Modos efêmeros:

1. `Configuração`;
2. `Ordenação`;
3. `Imagem`, apenas quando existe enquadramento editável para o target.

`Imagem` isola fit, zoom e posição do asset e usa sliders vermelhos, coerentes com a linguagem visual mobile.

Nenhum modo é persistido no catálogo.

### Filtro e categorias do Catálogo

No desktop:

- busca em largura total;
- rail horizontal de categorias imediatamente abaixo;
- lista de produtos em seguida;
- `selectionCategory` continua sendo a autoridade de valor, mas o rail é a superfície visual.

### Produtos

A navegação por categoria já é o filesystem horizontal. O `filterCategory` visual foi removido para evitar duas superfícies concorrentes com a mesma intenção.

### Toolbar do preview

`Novo catálogo` e `Gerar PDF / Imprimir` compartilham a mesma faixa vertical de badges e zoom no desktop. O onboarding textual não ocupa a área recorrente de autoria.

### Breakpoint

- `>= 1180px`: workspace desktop compacto em duas colunas;
- `< 1180px`: retorna diretamente ao fluxo vertical já validado;
- não existe drawer intermediário.

## Guardrails

- sem alteração de schema;
- sem alteração de ProductStore;
- sem alteração de CatalogDocument;
- sem alteração da geometria A4;
- `ComposerSelection` continua efêmera;
- `PresentationActions` continua fronteira de mutação;
- comportamento mobile validado deve permanecer funcional.

## Gates

O Browser Gate dedicado exige:

- metadados gerais somente sem target;
- painel desktop entre 470 e 600 px em 1440×900;
- preview com território vertical próprio e sem scroll horizontal no novo `100%`;
- escala desktop máxima física próxima a `0.8`, exibida como `100%`;
- ações principais e overflow na mesma linha;
- ao menos quatro itens de lista visíveis;
- tab `Imagem` somente quando aplicável;
- controles de Card distribuídos horizontalmente;
- `filterCategory` oculto na aba Produtos;
- filesystem horizontal preservado;
- abaixo de 1180 px, retorno ao fluxo vertical sem drawer;
- no mobile, `⚙` continua ancorando no topo da configuração contextual, antes do filtro.
