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

- Desktop largo: seleção à esquerda e A4 à direita; o preview não possui scroll vertical interno normal. A rolagem vertical pertence ao painel/página.
- Desktop médio (960–1239 px): o painel vira drawer sobreposto antes de comprimir o A4.
- Mobile/tablet (<960 px): painel e preview voltam ao fluxo; a configuração cresce naturalmente e a lista de produtos possui uma janela rolável própria.

### Biblioteca de Produtos

Antes de a tabela ficar estreita demais, as pastas deixam a sidebar e viram rail horizontal superior.

- até 1180 px: rail horizontal de categorias acima da tabela;
- mobile: mesma navegação em rail e linhas da tabela assumem apresentação visual compacta com miniatura, código/status, descrição de até 3 linhas e ações.

Pasta, contador e lixeira formam uma única superfície visual, mantendo os botões semanticamente irmãos.

Listas curtas ficam sempre alinhadas ao topo; espaço excedente fica abaixo.

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

O gate anterior de estabilidade/scroll foi migrado para o novo ownership vertical e continua protegendo rail, estabilidade e ausência de scroll interno em `Ordem interna`.
