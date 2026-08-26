# v0.8.1 — pipeline de documento, preview e impressão

## Motivação

A implementação anterior usava o DOM da própria aplicação como superfície de impressão. `window.print()` era chamado sobre a aba Catálogo e o `@media print` tentava esconder shell, controles e elementos auxiliares. Isso permitia duas classes de regressão observadas manualmente:

- elementos da aplicação aparecendo como página física do PDF;
- número de páginas físicas divergindo do número de páginas lógicas por interação entre breakpoints, `break-after` e arredondamento do Chromium.

O compositor desktop também usava breakpoints do viewport para um problema que depende da largura real do painel lateral. Em telas grandes o painel continuava estreito, mas recebia uma grade bulk de cinco colunas.

## Boundary novo

O fluxo passa a ser:

```text
Core state
   ↓
CatalogDocument
   ↓
┌─────────────────────┬─────────────────────────┐
│ preview da aplicação│ documento de impressão │
│ divisores/chrome OK │ somente .catalog-page  │
└─────────────────────┴─────────────────────────┘
```

`src/catalog-document.js` materializa:

- template e apresentação normalizados;
- categorias na ordem da primeira aparição;
- páginas lógicas;
- ordem efetiva de cada produto;
- `Hero → Destaque → Normal` estável dentro de cada categoria;
- placement calculado pelo planner existente.

O state original não é mutado para produzir essa ordem. `selectedIds` continua representando a seleção factual/local.

## Preview

`src/render-document-adapter.js` mantém compatibilidade com o renderer atual, mas deriva a ordem de renderização do `CatalogDocument` e anota cards/páginas com ordem efetiva. Isso cria um gate de integração entre o planner e o DOM final sem reescrever todo `render.js` de uma vez.

`src/catalog-selection-order.js` reorganiza apenas a apresentação do painel de seleção para mostrar primeiro os produtos selecionados na ordem efetiva do catálogo e atualiza os badges numéricos. Produtos não selecionados continuam na ordem normal da biblioteca.

## Impressão isolada

`src/print.js` intercepta o botão `Gerar PDF / Imprimir` antes do handler legado e constrói um iframe temporário. O HTML do iframe contém apenas as folhas `.catalog-page` produzidas pelo mesmo renderer do preview.

O iframe carrega somente estilos necessários ao documento:

- `styles.css` (base ainda compartilhada por compatibilidade);
- `cards.css`;
- `catalog-page.css`;
- `editorial-composition.css`;
- `print.css`.

Não carrega `shell-responsive.css`, `mobile-header.css` ou `composer-layout.css`.

Antes de abrir o diálogo de impressão, o pipeline aguarda stylesheets, `document.fonts.ready` e `img.decode()` quando disponível.

## Fragmentação física

`print.css` neutraliza os `break-after` legados e usa quebra somente antes das páginas subsequentes:

```css
.catalog-page + .catalog-page {
  break-before: page;
}
```

No documento isolado as folhas voltam a medir `210 × 297 mm`. O workaround global de `296 mm` deixa de ser autoridade para o PDF gerado pelo botão; ele permanece temporariamente no CSS legado até o gate físico comprovar que pode ser removido sem regressão para impressão manual via navegador.

## Elementos print-safe

`catalog-page.css` converte as linhas institucionais do header e footer para `border-top`, evitando dependência de `background graphics`. Decorações puramente cosméticas podem continuar baseadas em background, mas nenhuma informação essencial pode depender delas.

## Compositor desktop

`composer-layout.css` torna a coluna do compositor adaptativa (`clamp`) e o painel lateral um container CSS. O bulk deixa de tentar usar cinco colunas dentro de ~360 px e passa a duas colunas estruturais:

```text
Aplicar a todos os selecionados

CONTEÚDO   [Aplicar]
[select]

ÊNFASE     [Aplicar]
[select]
```

A adaptação excepcional usa `@container`, não breakpoint de viewport.

`mobile-header.css` volta a tratar somente o header móvel; regras de bulk e impressão foram removidas desse arquivo.

## Gates

### Node

- `catalog-document-fixture.mjs`: duas categorias, Hero, Destaque, ordem efetiva e ausência de mutação do state.
- `document-boundary-fixture.mjs`: arquivos/ordem de carregamento, isolamento de responsabilidades, CSS de compositor e contrato de print.

### Chromium

`.github/workflows/browser-print.yml` instala Playwright/Chromium somente no job de CI e executa `scripts/browser-print-gate.mjs`.

O fixture valida:

- 2 páginas lógicas no `CatalogDocument`;
- Hero como primeiro item materializado;
- 2 páginas no preview e Hero como primeiro card;
- documento print sem shell, painel de seleção ou divisor de categoria;
- header/footer presentes em todas as páginas;
- linhas institucionais presentes com `printBackground: false`;
- PDF físico com exatamente 2 páginas.

## Limites deliberados deste recorte

- `render.js` ainda contém o renderer base e parte da paginação histórica. O adapter cria a fronteira sem uma reescrita de risco alto; uma extração completa de `catalog-page.css` e remoção do caminho legado pode ocorrer depois que o gate físico estabilizar.
- Ctrl+P direto sobre a aplicação continua sendo fallback; o caminho suportado é o botão do CatalogoTop, que usa documento isolado.
- Sequências, receitas de página e novos componentes editoriais continuam fora do v0.8.1.
