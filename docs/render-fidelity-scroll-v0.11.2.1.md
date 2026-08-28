# v0.11.2.1 — fidelidade preview→PDF, scroll e proporção de Table

## Objetivo

Corrigir divergências observadas entre o preview do catálogo e o PDF/iframe de impressão, restaurar o scroll independente do compositor e dar proporções editoriais às colunas da Table sem alterar schema, ProductStore, CatalogDocument, CatalogOrder ou as primitivas Card/Collection/Table.

## Causas encontradas

1. `src/print.js` mantinha uma lista manual de CSS diferente da página principal e não carregava `commercial-presentation.css`. Isso removia no PDF tratamentos de preço que existiam no preview.
2. O fitting de texto era medido somente no DOM do preview. O iframe de impressão podia usar métricas diferentes depois de carregar seus próprios estilos/fontes.
3. `TextFit.fitCatalog()` só tratava `Card h3`; descrições de Collection permaneciam sob um `-webkit-line-clamp: 2` legado.
4. Table usava `table-layout: fixed`, mas sem `colgroup` ou pesos semânticos. Colunas como Código e Produto recebiam proporções inadequadas.
5. O painel esquerdo passou a ter cinco filhos de layout — toolbar, inspector, ações normais, ações de agrupamento e lista — enquanto a grade continuava declarando quatro tracks. A lista caía numa linha implícita `auto`, crescia com o conteúdo e perdia o scroll independente.
6. O preview desktop não tinha uma altura útil delimitada para funcionar como viewport vertical de múltiplas páginas.

## Contrato do documento imprimível

`NS.Print.DOCUMENT_STYLE_SHEETS` é a autoridade única para os stylesheets que constituem a folha renderizada no iframe de impressão. O conjunto inclui:

- `styles.css`
- `cards.css`
- `catalog-page.css`
- `editorial-composition.css`
- `collection-block.css`
- `table-block.css`
- `commercial-presentation.css`
- `print.css` (`media=print`)

`Print.buildPrintableHtml()` deriva seus `<link>` desse conjunto. `Print.missingDocumentStyles(doc)` permite gates de integridade.

Depois de CSS, fontes e imagens carregarem no iframe, `Print.waitForDocumentReady()` executa novamente `TextFit.fitCatalog(doc)` no documento que será efetivamente impresso. O fitting nunca altera dados factuais.

## Fitting editorial

O fitting canônico agora cobre:

- Card simples: 3 linhas;
- Card largo: 4 linhas;
- Card linha inteira: 5 linhas;
- Showcase: no mínimo 4 linhas;
- membro de Collection simples: 3 linhas;
- membro de Collection largo: 4 linhas;
- membro de Collection linha inteira: 5 linhas.

O algoritmo preserva `data-full-description` e remove apenas palavras completas do fim quando necessário. Não usa reticências e não grava descrição curta em Product ou CatalogDocument.

Presets CSS antigos ainda podem declarar `-webkit-line-clamp`; o fitting canônico neutraliza esse clamp apenas no elemento materializado antes de medir a caixa real.

## Table: largura semântica

As definições de coluna agora carregam pesos editoriais. O conjunto ativo é normalizado para 100% e materializado como `<colgroup>`:

- Imagem: 14
- Código: 12
- Produto: 44
- Subcategoria: 18
- Cor / variação: 20
- Embalagem: 15
- Preço: 18
- Qtd. mín.: 10
- Preço qtd.: 18

`table-layout: fixed` permanece. A mudança é fornecer proporções explícitas em vez de deixar o navegador distribuir o espaço sem intenção editorial.

## Scroll do compositor

### Painel esquerdo

O painel declara cinco tracks explícitos e recebe altura útil de viewport no desktop. `#selectableProducts` ocupa o último `minmax(0, 1fr)`, usa `overflow-y:auto` e `min-height:0`.

Consequência esperada: abrir um inspector grande reduz a área disponível da lista, mas não faz a lista crescer para fora do painel.

### Preview desktop

A coluna de preview usa a mesma altura útil e a área de páginas é um viewport vertical próprio. No meio do curso, wheel deve alterar `scrollTop` da superfície interna sem mover a página externa.

No limite, `overscroll-behavior-y:auto` deixa o chaining nativo do browser desbloqueado. O gate headless verifica a condição de borda e o contrato CSS; não exige que `page.mouse.wheel()` sintetize propagação para `window`, porque Playwright não reproduz de forma confiável essa etapa quando o nested scroller já começa no `scrollTop=max`.

### Mobile/touch

Abaixo de 960 px o preview volta a participar do fluxo da página (`overflow-y:visible`). Gesto vertical iniciado sobre o A4 continua rolando a página, conforme o contrato móvel já coberto pelo Browser Print Gate.

## Distribuição e Tipografia

Os controles `Distribuição` e `Tipografia` foram aposentados da interface neste recorte. Seus valores continuam presentes e normalizáveis no estado para compatibilidade com backups antigos. Não houve migração destrutiva nem remoção de schema.

## Gates

- `scripts/render-fidelity-fixture.mjs`
  - normalização de pesos para 100%;
  - Produto dominante;
  - Código e Qtd. mín. estreitos;
  - fallback seguro para colunas desconhecidas.
- `scripts/browser-render-fidelity-scroll-gate.mjs`
  - conjunto de CSS do preview/iframe;
  - presença de `commercial-presentation.css` no print;
  - computed styles do preço equivalentes preview→iframe;
  - proporção física de Table equivalente preview→iframe;
  - Collection em 3 linhas com corte por palavras;
  - lista e preview com scroll interno no desktop;
  - chaining nativo não bloqueado por CSS;
  - Distribuição/Tipografia fora da UI.
- Browser gates anteriores continuam obrigatórios, incluindo A4 físico, print, mobile touch, Collection, Table, inspector, preço e image framing.

Os workflows `Validate` e `Browser Print Gate` passam a executar também em branches `fix/**`, permitindo validar correções antes de abrir PR.

## Fora deste recorte

Permanecem para o próximo recorte de interação:

- separar visualmente membership de seleção editorial;
- seleção múltipla Ctrl/Cmd/Shift e long press;
- target `table-row`;
- recolher inspector mantendo seleção;
- substituir o toggle único de destaque de Table por opções comerciais equivalentes às de Card;
- revisão do modo Agrupar com base na nova seleção.
