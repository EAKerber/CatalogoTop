# v0.11.2.5 — Adaptive workspace & inspector modes

## Objetivo

Reduzir competição por espaço no Catálogo e evitar overflow lateral prematuro na biblioteca de Produtos, preservando o A4 físico, ProductStore e estado persistido.

## Contratos

### Escopo de aba

`ComposerSelection` continua efêmera e pode sobreviver à troca de aba, mas comandos editoriais pertencem exclusivamente a `Catálogo`.

Fora de `Catálogo`:

- o floater `↑ / ⚙ / ↓` fica oculto;
- `moveSelectionRelative()` falha fechado;
- o comando de ajustes não executa;
- `Escape` não limpa a seleção editorial preservada;
- nenhuma ação contextual pode alterar `presentation.order` ou outro estado editorial.

Ao retornar a `Catálogo`, o target anterior é reconciliado e o chrome reaparece.

### Inspector

O inspector possui dois modos efêmeros:

- `Configuração`: propriedades visuais/estruturais do target. Não possui scroll vertical próprio.
- `Ordenação`: ordem no catálogo e, para Collection/Table, ordem interna. Pode possuir scroll próprio quando a lista cresce.

Trocar target volta para `Configuração`. O modo não entra em backup, ProductStore, `CatalogDocument` ou print.

### Navegação móvel por ⚙

O botão central alterna:

1. `Ajustes`: expande o inspector, força `Configuração` e posiciona `Filtrar produtos` abaixo do header sticky.
2. `Voltar ao selecionado`: resolve novamente o target no A4 e o traz para a viewport.

Nenhuma coordenada persistida é usada.

### Workspace Catálogo

- Desktop largo: seleção à esquerda e A4 à direita; o preview não possui range de scroll vertical próprio. O shell mantém `body`/`.app-main` fixos e `#catalog.panel.active` é o page-scroll da aba.
- Desktop médio (960–1239 px): o painel vira drawer sobreposto antes de comprimir o A4.
- Mobile/tablet (<960 px): painel e preview voltam ao fluxo do documento; a configuração cresce naturalmente e a lista de produtos possui uma janela rolável própria.

`preview-viewport.css` é a única autoridade de overflow/touch do viewport do A4. `composer-layout.css` cuida apenas da geometria do workspace e não redefine os eixos de scroll do preview.

### Biblioteca de Produtos

Antes de a tabela ficar estreita demais, as pastas deixam a sidebar e viram rail horizontal superior.

- até 1180 px: rail horizontal de categorias acima da tabela;
- mobile: mesma navegação em rail e linhas da tabela assumem apresentação visual compacta com miniatura, código/status, descrição de até 3 linhas e ações.

Pasta, contador e lixeira formam uma única superfície visual, mantendo os botões semanticamente irmãos.

Listas curtas ficam sempre alinhadas ao topo; espaço excedente fica abaixo.

`category-browser.css` é a autoridade do rail de categorias. `shell-responsive.css` mantém apenas o layout tabular mobile; a primeira coluna reserva 64 px para materializar uma miniatura de 50 px após o padding da célula.

## Fora de escopo

- nenhuma mudança de schema;
- nenhum estado remoto novo;
- nenhuma alteração de geometria A4;
- Image Variation Bundle permanece para recorte posterior.

## Gates

`browser-adaptive-workspace-gate.mjs` cobre:

- escopo de comandos por aba;
- persistência efêmera da seleção ao sair/voltar;
- Configuração/Ordenação;
- drawer em desktop médio;
- rail de categorias antes do overflow lateral;
- linha mobile com miniatura e 3 linhas;
- toggle ⚙ Ajustes ↔ target.

`browser-scroll-stability-nav-gate.mjs` prova que, no shell desktop largo, `#catalog` possui o range vertical da página enquanto `catalogPreviewViewport` permanece sem range vertical próprio; também protege o único scroll da aba Ordenação, rail horizontal e atalho Ajustes.

`browser-render-fidelity-scroll-gate.mjs` preserva as provas de preview→PDF, TextFit, proporções de Table e wheel nativo da lista de produtos, e agora valida o mesmo ownership vertical do shell em vez do antigo scroll interno do preview.

## Higiene observada

Correções feitas no próprio recorte:

- removida a autoridade concorrente de overflow do preview em `composer-layout.css`;
- o click handler de modos do inspector foi restrito aos botões reais `Configuração / Ordenação`, evitando cancelar labels/radios internos;
- gates antigos deixaram de codificar a viewport vertical rígida aposentada;
- assertions de scroll usam o owner real do shell em desktop largo (`#catalog`) e não `window`;
- `touch-action: pan-x pan-y pinch-zoom` pode ser serializado pelo Chromium como `manipulation`; os gates tratam as duas formas como semanticamente equivalentes;
- removidas as declarações mobile duplicadas do rail em `shell-responsive.css`; `category-browser.css` passou a ser a autoridade única dessa navegação;
- a geometria da primeira coluna mobile foi alinhada ao tamanho declarado da miniatura, evitando uma regra de 50 px que só conseguia materializar 44 px.

Pendência de higiene não bloqueante identificada:

- `grouping-controls.js` preserva a seleção fora de Catálogo interceptando `Escape` com `stopImmediatePropagation()`; o comportamento está coberto, mas o mecanismo é mais amplo do que o ideal e deve ser substituído por escopo explícito no listener de `contextual-inspector.js` quando esse módulo for tocado.

Esse item não altera dados, print ou resultado visual do recorte e não justifica reescrever um módulo grande no fechamento de v0.11.2.5.
