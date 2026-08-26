# Shell responsivo e workspace — recorte v0.5

Este recorte reduz o chrome do aplicativo sem transformar o CatalogoTop em um editor complexo. A prioridade é reservar a maior parte da viewport para biblioteca, cadastro e preview.

## Header único

A marca, as abas **Produtos / Catálogo / Templates** e as ações de **Exportar backup / Importar backup** passam a compartilhar uma única barra sticky. Isso substitui o cabeçalho alto + barra de abas separados.

A importação de produtos continua contextual à aba Produtos, porque ela depende de modo de merge/substituição e de relatório de leitura. Ela foi compactada, mas não foi escondida dentro de menu ou modal.

## Produtos sem scroll externo no desktop

Em viewports a partir de 1200 px de largura e 720 px de altura, a página Produtos ocupa a altura útil inteira da viewport. O documento não rola; o espaço é dividido entre:

- identificação e ação de novo produto;
- faixa compacta de importação;
- cadastro à esquerda;
- biblioteca de produtos à direita.

A rolagem necessária fica dentro da árvore de categorias e da tabela de produtos. Em alturas menores que 720 px o comportamento volta a scroll normal para não comprimir campos a ponto de prejudicar uso.

## Cadastro em três etapas

O formulário mantém os mesmos dados e IDs, mas a apresentação é dividida em três passos:

1. **Identificação** — código, status, descrição, categoria e subcategoria;
2. **Apresentação** — preço, imagem e especificações;
3. **Variações** — cores/acabamentos, tabela comercial e observações.

Não existe wizard persistente nem estado novo no schema. A etapa atual é apenas estado de interface. `Enter` nas etapas 1 e 2 avança; o produto só é submetido na etapa 3.

## Breakpoints

### Desktop amplo — `>= 1200 px` e altura `>= 720 px`

- shell em uma linha;
- Produtos sem scroll externo;
- cadastro + biblioteca em duas colunas;
- categorias e tabela têm scroll interno independente.

### Notebook / desktop estreito — `960–1199 px`

- shell permanece em uma linha mais compacta;
- subtítulo da marca é removido;
- cadastro + biblioteca ainda podem permanecer lado a lado;
- scroll normal do documento volta a ser permitido.

### Tablet — `640–959 px`

- shell vira duas linhas: marca/utilidades acima e abas abaixo;
- cadastro e biblioteca ficam empilhados;
- importação compacta vira uma coluna;
- preview A4 pode usar overflow horizontal em vez de reescalar o documento editorial.

### Mobile — `< 640 px`

- controles de duas colunas passam a uma coluna;
- pastas de categoria viram uma faixa horizontal rolável;
- tabela de produtos reduz colunas de baixa prioridade e mantém código, produto e ação de edição;
- ações do formulário podem quebrar em duas linhas;
- abas continuam acessíveis horizontalmente sem menu hambúrguer neste recorte.

## Guardrails

- não criar sidebar global, drawer, command palette ou navegação duplicada;
- não introduzir estado persistente para a etapa do formulário;
- não escalar ou reconstruir o A4 para mobile: o documento continua com geometria física e pode rolar horizontalmente;
- priorizar scroll interno apenas quando há viewport suficiente; em telas pequenas, preferir fluxo vertical natural;
- manter backup e importação como ações explícitas, sem automação invisível.

## Próximo passo relacionado

Depois deste recorte, a estruturação do catálogo por categoria pode ser implementada sem competir por espaço com um shell alto. A categoria deverá organizar páginas e headers, mantendo um único contador global de páginas e a família de cores como um único card/produto.
