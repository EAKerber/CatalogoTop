# v0.11.2.7 — Desktop Authoring Workspace

## Objetivo

Reorganizar o desktop do Catálogo como uma ferramenta de autoria, reutilizando os padrões que se mostraram mais claros no mobile e removendo o modo intermediário de drawer que comprimía o A4 e escondia o painel.

## Contrato de layout desktop

A partir de 1080 px, a aba Catálogo ocupa a altura útil do shell e não possui scroll vertical próprio da página.

O workspace é dividido em dois territórios persistentes:

- **painel de autoria à esquerda** — largura entre aproximadamente 360 e 420 px;
- **preview A4 à direita** — recebe todo o espaço restante e possui seu próprio scroll vertical/horizontal quando necessário.

O painel esquerdo contém, de cima para baixo:

1. identificação e ações do catálogo;
2. controles gerais (nome, template, preços e data);
3. filtro/contexto/inspector e ações editoriais;
4. lista de produtos, que recebe todo o espaço residual e é o único scroll vertical normal dentro do painel.

O drawer intermediário deixa de fazer parte da UX desktop. Em larguras abaixo de 1080 px o editor retorna ao fluxo vertical/tablet/mobile já validado.

## Ownership de scroll

No desktop autoral:

- `body` e `#catalog.panel.active` não rolam verticalmente;
- `#selectableProducts` é o scroll root da lista esquerda;
- `#catalogPreviewViewport` é o scroll root do A4;
- a toolbar de zoom permanece fora do scroll do A4;
- configuração e lista não disputam dinamicamente a mesma altura.

Esse contrato substitui o modelo anterior em que o A4 participava do scroll vertical da aba e o painel podia virar drawer.

## Filesystem de Produtos

O rail horizontal de categorias passa a ser o padrão também no desktop:

- não existe mais coluna lateral de pastas consumindo largura da tabela;
- `Todos`, categorias, contadores e lixeiras permanecem controles acessíveis;
- o rail pode rolar horizontalmente quando necessário;
- a tabela usa toda a largura restante da biblioteca.

A apresentação mobile da lista (miniatura, código/status e descrição em até três linhas) permanece inalterada.

## Inspector

O contrato `Configuração / Ordenação` permanece:

- **Configuração** contém apresentação e propriedades do target;
- **Ordenação** contém ordem no catálogo e ordem interna de agrupamentos;
- `ComposerSelection` continua efêmera;
- mutações editoriais continuam passando por `PresentationActions`.

## Ajustes mobile

O único ajuste comportamental deliberado deste recorte no mobile é o destino do botão `⚙`:

- primeiro toque leva ao topo do `#contextualInspector`, isto é, ao início da configuração contextual;
- o filtro/rail da lista fica abaixo e não faz parte do anchor de ajustes;
- segundo toque continua voltando ao target selecionado no A4.

O restante do polimento mobile de v0.11.2.6 é preservado.

## Gates

A responsabilidade adaptativa foi separada em dois Browser Gates:

- `browser-desktop-authoring-workspace-gate.mjs` — painel persistente, A4 maximizado, ausência de drawer, ownership de scroll, filesystem rail e anchor contextual;
- `browser-mobile-polish-gate.mjs` — lista mobile, rail, callout nativo, escopo editorial e navegação por `⚙`.

Os gates genéricos do workspace anterior foram aposentados porque codificavam simultaneamente drawer desktop e scroll vertical da aba, contratos que não existem mais.

O `browser-render-fidelity-scroll-gate.mjs` continua responsável por preview→PDF, TextFit, proporções de Table e scroll independente da lista, mas agora também protege o A4 como scroll root próprio no desktop.

## Fora de escopo

Este recorte não altera:

- schema;
- ProductStore;
- `CatalogDocument`;
- geometria física A4;
- dados comerciais;
- Image Variation Bundle;
- contratos de impressão.

## Higiene / dívida residual

O modo drawer está aposentado visual e funcionalmente no desktop, porém helpers de drawer ainda existem em `src/grouping-controls.js` como resíduo compatível e inerte sob o novo CSS. Não são usados pelo caminho desktop normal e podem ser removidos em uma limpeza posterior menor, caso haja benefício suficiente para justificar tocar novamente nessa autoridade.
