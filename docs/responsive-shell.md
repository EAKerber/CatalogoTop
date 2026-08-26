# Shell responsivo e workspace — recorte v0.5

Este recorte reduz o chrome do aplicativo sem transformar o CatalogoTop em um editor complexo. A prioridade é reservar a maior parte da viewport para biblioteca, cadastro e preview.

## Header único

A marca, as abas **Produtos / Catálogo / Templates**, a importação de produtos e as ações de **Exportar backup / Importar backup** compartilham uma única barra sticky.

A importação de produtos fica imediatamente ao lado das abas, porque é uma ação primária da biblioteca e não precisa ocupar uma faixa permanente dentro da página. O conjunto contém apenas:

- **Importar produtos** — abre CSV/XLS/XLSX/XLSM;
- modo **Mesclar por código / Substituir base**;
- link pequeno para **CSV modelo**.

O relatório de leitura continua contextual à aba Produtos, mas é materializado apenas quando existe uma importação em andamento ou aguardando confirmação. Portanto ele não reserva altura quando está oculto.

Backup continua separado à direita por ser uma ação global do acervo local, não uma operação exclusiva da aba Produtos.

## Área inicial da aba Produtos

O antigo título promocional alto foi reduzido a um heading utilitário curto: **Biblioteca de produtos**. O botão **Novo produto** também deixa esse cabeçalho; ele fica junto do próprio formulário de edição, onde sua função de limpar/iniciar um cadastro tem contexto.

No mobile esse heading é ocultado completamente: a interface passa diretamente do shell para o seletor **Cadastro / Produtos**.

## Produtos sem scroll externo no desktop

Em viewports a partir de 1200 px de largura e 720 px de altura, a página Produtos ocupa a altura útil inteira da viewport. O documento não rola; o espaço é dividido entre:

- heading curto da biblioteca;
- relatório de importação somente quando necessário;
- cadastro à esquerda;
- biblioteca de produtos à direita.

A rolagem necessária fica dentro da árvore de categorias e da tabela de produtos. Em alturas menores que 720 px o comportamento volta a scroll normal para não comprimir campos a ponto de prejudicar uso.

## Cadastro em três etapas

O formulário mantém os mesmos dados e IDs, mas a apresentação é dividida em três passos:

1. **Identificação** — código, status, descrição, categoria e subcategoria;
2. **Apresentação** — preço, imagem e especificações;
3. **Variações** — cores/acabamentos, tabela comercial e observações.

Não existe wizard persistente nem estado novo no schema. A etapa atual é apenas estado de interface. `Enter` nas etapas 1 e 2 avança; o produto só é submetido na etapa 3.

## Workspace mobile: Cadastro / Produtos

Abaixo de 640 px, cadastro e filesystem não ficam mais empilhados em uma página longa. Eles passam a ser dois estados irmãos:

- **Cadastro** — formulário em três etapas;
- **Produtos** — busca, categorias e tabela da biblioteca.

A troca pode ser feita de duas formas equivalentes:

- toque nas tabs **Cadastro / Produtos**;
- swipe horizontal no espaço não interativo do workspace: esquerda abre Produtos, direita volta ao Cadastro.

O swipe é apenas um atalho. Campos, selects, botões e links não iniciam o gesto, evitando conflito com edição e seleção. Ao tocar para editar um item da biblioteca, a interface volta automaticamente para Cadastro.

Não foi criado carousel genérico, router interno ou estado persistente. O controlador mobile possui somente dois estados de apresentação.

## Breakpoints

### Desktop amplo — `>= 1200 px` e altura `>= 720 px`

- shell em uma linha;
- abas e importação de produtos permanecem lado a lado;
- Produtos sem scroll externo;
- cadastro + biblioteca em duas colunas;
- categorias e tabela têm scroll interno independente.

### Notebook / desktop estreito — `960–1199 px`

- shell permanece em uma linha compacta;
- subtítulo da marca e link para CSV modelo podem desaparecer para preservar espaço;
- importação continua ao lado das abas;
- cadastro + biblioteca ainda podem permanecer lado a lado;
- scroll normal do documento volta a ser permitido.

### Tablet — `640–959 px`

- shell vira duas linhas: marca/backup acima e **abas + importação** juntas abaixo;
- essa segunda linha pode rolar horizontalmente em vez de criar menu ou drawer;
- cadastro e biblioteca ficam empilhados;
- preview A4 pode usar overflow horizontal em vez de reescalar o documento editorial.

### Mobile — `< 640 px`

- shell é forçado a exatamente duas linhas lógicas: **marca + backups** acima; **abas + importação** abaixo;
- a segunda linha pode rolar horizontalmente se não houver largura suficiente;
- Produtos possui tabs locais **Cadastro / Produtos** com swipe horizontal opcional;
- controles de duas colunas passam a uma coluna;
- pastas de categoria viram uma faixa horizontal rolável dentro da biblioteca;
- tabela reduz colunas de baixa prioridade e mantém código, produto e ação de edição;
- ações do formulário podem quebrar em duas linhas;
- o botão local **+ Novo** pode ser ocultado porque o `×` já limpa o formulário em telas muito estreitas.

## Guardrails

- não criar sidebar global, drawer, command palette ou navegação duplicada;
- não reintroduzir faixa permanente de importação dentro da aba Produtos;
- não introduzir estado persistente para a etapa do formulário ou para o seletor Cadastro/Produtos;
- swipe não deve interceptar interação iniciada em input, textarea, select, button ou link;
- não escalar ou reconstruir o A4 para mobile: o documento continua com geometria física e pode rolar horizontalmente;
- priorizar scroll interno apenas quando há viewport suficiente; em telas pequenas, preferir fluxo vertical natural;
- manter backup e importação como ações explícitas, sem automação invisível.

## Estado após feedback visual

Após as inspeções do preview, o shell foi comprimido em duas rodadas: a importação saiu da faixa branca da aba Produtos e foi colocada junto de **Produtos / Catálogo / Templates**; depois o mobile passou a usar duas linhas estáveis e o workspace de Produtos foi dividido em **Cadastro / Produtos**. Essas revisões continuam pertencendo ao mesmo recorte v0.5.

## Próximo passo relacionado

Depois deste recorte, a estruturação do catálogo por categoria pode ser implementada sem competir por espaço com um shell alto. A categoria deverá organizar páginas e headers, mantendo um único contador global de páginas e a família de cores como um único card/produto.
