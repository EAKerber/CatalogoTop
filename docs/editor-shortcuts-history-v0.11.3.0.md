# v0.11.3.0 — Editor Commands, Shortcuts & History

## Objetivo

Compactar a faixa de intenção da lista no compositor e introduzir um histórico editorial local, sem alterar schema, ProductStore, CatalogDocument ou geometria A4.

## Chrome do painel desktop

A primeira linha da área de lista contém:

- filtro textual;
- `Incluir visíveis`;
- ícone de `Coleção`;
- ícone de `Tabela`;
- overflow `…`, mantendo `Esvaziar catálogo` como ação destrutiva de menor frequência.

Coleção e Tabela:

- possuem badge vermelho com a quantidade da seleção editorial;
- ficam desabilitadas quando a seleção não satisfaz as regras do bloco;
- usam `title`/`aria-label` como legenda contextual;
- não executam ação quando desabilitadas.

O rail de categorias ocupa a linha seguinte, tem overflow horizontal próprio e folga final para não colidir visualmente com o chrome de comandos.

## Densidade do inspector

Em desktop:

- Collection: `Tema`, `Colunas` e `Apresentação` compartilham uma linha;
- Table: `Linhas`, `Densidade` e `Preço` compartilham uma linha;
- a largura autoral passa a `clamp(520px, 38vw, 640px)` para comprar altura sem reduzir o A4 abaixo do teto visual já definido.

Mobile mantém o layout validado anteriormente.

## Histórico editorial

Undo/redo é um histórico efêmero da sessão de edição do catálogo.

Snapshot:

- `catalog`;
- `selectedIds`.

Fora do snapshot:

- `products`;
- assets;
- estado de UI do inspector;
- `ComposerSelection` efêmera.

A exclusão deliberada de `products` evita que um undo local ressuscite produto já alterado/sincronizado pela biblioteca.

O histórico:

- tem limite de 80 snapshots;
- coalesce alterações consecutivas do mesmo controle em uma janela curta;
- limpa a pilha de redo após nova mutação;
- limpa o histórico quando um estado externo completo é materializado via `Core.setState`;
- fica inerte e oculto fora da aba Catálogo.

Controles:

- `↶` Desfazer — `Ctrl/Cmd+Z`;
- `↷` Refazer — `Ctrl/Cmd+Shift+Z` ou `Ctrl/Cmd+Y`.

Desktop: junto de `Novo catálogo`.

Mobile: segunda linha do header, reduzindo a largura das tabs apenas enquanto Catálogo está ativo.

## Atalhos de agrupamento

- `Ctrl/Cmd+G` → Coleção;
- `Ctrl/Cmd+T` → Tabela.

O comando somente executa quando:

- Catálogo é a aba ativa;
- o foco não está em input/textarea/select/contenteditable;
- o botão correspondente está habilitado.

### Limitação do navegador

Alguns navegadores reservam `Ctrl+T` (nova aba) e `Ctrl+G` (buscar próximo) antes de entregar o evento à página. JavaScript não pode sobrescrever um atalho que o browser decide não despachar.

Por isso os handlers também aceitam as mesmas combinações com `Alt` (`Ctrl+Alt+T/G`) quando o evento é entregue; os tooltips indicam esse fallback. Os botões visuais continuam sendo a autoridade confiável.

## Gates

`browser-editor-shortcuts-history-gate.mjs` prova:

- filtro e ações rápidas na mesma linha;
- rail horizontal em linha própria e com margem final;
- ícones compactos + badges vermelhos;
- ações inválidas desabilitadas;
- execução de Collection/Table por evento de atalho quando entregue à página;
- undo → redo de criação de bloco;
- histórico inerte/oculto fora do Catálogo;
- `Tema / Colunas / Apresentação` na mesma linha;
- `Linhas / Densidade / Preço` na mesma linha;
- undo/redo no header mobile sem criar uma terceira linha.
