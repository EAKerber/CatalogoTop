# v0.8 — composição editorial determinística

> Estado: consolidado na `main`. A estabilização v0.8.1 separou `CatalogDocument`, preview e documento de impressão; a manutenção v0.8.3 refinou a semântica do Hero e o scroll touch do preview.

## Princípio

O catálogo evolui de uma grade uniforme para uma composição editorial discreta sem reintroduzir editor livre. Produto remoto continua factual; decisões de apresentação permanecem no estado local do catálogo.

## Presets de conteúdo

- `Visual` — padrão atual para cards sem override; prioriza imagem e identificação.
- `Essencial` — imagem, identificação e preço com densidade mínima.
- `Padrão` — contrato anterior do template.
- `Detalhado` — abre espaço adicional para specs, variações e tabela.
- `Técnico` — prioriza especificações e referências.
- `Comercial` — prioriza preço/embalagem/referência.
- `Auto` — resolve deterministicamente pela densidade do conteúdo e tende a `Visual` em cards simples.

## Ênfase

- `Normal` — segue o fluxo estável da seleção.
- `Destaque` — 4/6 da micrograde e tem prioridade sobre cards normais dentro do fluxo da categoria.
- `Hero` — 6/6 da micrograde e funciona como **âncora de página**, não como apenas um Destaque maior.

A partir da v0.8.3, o planner separa explicitamente prioridade de fluxo de âncora editorial. Em uma página com Hero, o planner reserva uma linha inteira para ele, preenche as linhas anteriores com Destaques e Normais, rebalanceia a linha residual quando possível e materializa o Hero como a última linha usada. Assim, a sobra de composição fica **acima do Hero**, nunca abaixo.

Exemplo Técnico 2×4:

```text
[Destaque 4/6][Normal 2/6]
[ Normal ][ Normal ]
[      Normal residual       ]
[             HERO           ]
```

Uma página materializa no máximo um Hero. Quando a categoria possui múltiplos Heroes, cada um ancora uma página separada e a ordem original entre Heroes permanece estável.

## Distribuição e tipografia

Distribuições: `Compacta`, `Balanceada`, `Editorial`.

Tipografias: `Neutra`, `Técnica`, `Editorial`.

O planner usa micrograde de seis colunas, pagina por linhas planejadas e rebalanceia a última linha quando possível para evitar espaços em branco evitáveis.

## Bulk

O compositor oferece aplicação em lote de conteúdo e ênfase aos produtos atualmente selecionados. Isso altera somente `catalog.presentation.itemStyles`.

Na v0.8.1 o bulk foi reorganizado para responder à largura do próprio painel (`container-type: inline-size`). A estrutura base usa duas colunas: campo + ação. O layout não depende mais de um breakpoint de viewport para caber dentro de uma coluna desktop estreita.

## Mobile/header e preview

Em tablet/mobile o header mantém duas linhas lógicas:
1. marca + dois grupos de utilidades com scroll horizontal próprio;
2. `Produtos / Catálogo / Templates` isolados em três colunas iguais.

Em telas muito estreitas, o nome `CatalogoTop` é ocultado e a marca vira o ponto de ancoragem visual da primeira linha.

O preview A4 usa Fit/zoom sem alterar a geometria materializada de `210 × 297 mm`. Na v0.8.3 o container deixa de conter o overscroll nos dois eixos: horizontal continua contido para inspeção com zoom, enquanto vertical volta a encadear com o documento. `touch-action: pan-x pan-y pinch-zoom` preserva scroll touch e pinch do navegador quando o gesto começa sobre a folha.

## Documento e PDF — v0.8.1

O fluxo suportado é:

```text
state → CatalogDocument → preview / print isolado
```

O botão de PDF não chama `window.print()` sobre a aplicação inteira. `src/print.js` gera um iframe temporário contendo somente `.catalog-page`, aguarda styles/fonts/imagens e imprime esse documento.

`print.css` quebra somente antes da segunda página em diante. No documento isolado as folhas são `210 × 297 mm`.

As linhas vermelhas institucionais de header/footer são bordas, não backgrounds, para permanecerem visíveis com `printBackground: false`.

## Gates

Automáticos Node:
- `Visual` é o padrão de cards sem override;
- `Essencial` e `Detalhado` existem como limites explícitos de densidade;
- `Auto` é determinístico;
- planner usa seis colunas;
- Destaque lidera o fluxo, Hero fecha a área usada da página;
- linha residual é rebalanceada imediatamente acima do Hero;
- no máximo um Hero é materializado por página;
- comportamento é coberto nos templates Técnico, Compacto e Showcase;
- `CatalogDocument` não muta `selectedIds` factual;
- print isolado contém apenas folhas A4.

Gate Chromium físico (`CatalogoTop Browser Print Gate`):
- fixture materializa exatamente 2 páginas lógicas/físicas A4;
- Destaque aparece antes do fluxo normal e Hero é o último card da primeira página;
- Hero preserva a composição Visual focal;
- documento de impressão não contém shell, selection panel ou divisores de preview;
- header/footer aparecem em ambas as páginas;
- linhas institucionais existem com `printBackground: false`;
- preview mobile entra em Fit sem overflow horizontal;
- CSS de touch contém overscroll horizontal e libera pan vertical;
- gesto vertical real iniciado sobre a folha move o scroll do documento no Chromium touch.

## Fora do recorte

- sequências/grupos multi-produto;
- receitas editoriais automáticas;
- drag/resize/coordenadas persistidas;
- fonte arbitrária por card;
- sincronização remota do estado de composição.
