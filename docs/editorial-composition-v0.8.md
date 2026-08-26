# v0.8 — composição editorial determinística

> Estado: consolidado historicamente na `main`. A estabilização v0.8.1 separou `CatalogDocument`, preview e documento de impressão; a manutenção v0.8.3 refinou a semântica do Hero e o scroll touch do preview. **A semântica estrutural de Hero descrita abaixo é histórica e foi substituída no recorte v0.9 por largura explícita em slots; ver `docs/card-span-model-v0.9.md`.**

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

## Ênfase — contrato histórico v0.8.3

- `Normal` — segue o fluxo estável da seleção.
- `Destaque` — 4/6 da micrograde e tem prioridade sobre cards normais dentro do fluxo da categoria.
- `Hero` — 6/6 da micrograde e funciona como **âncora de página**, não como apenas um Destaque maior.

Na v0.8.3, o planner separava explicitamente prioridade de fluxo de âncora editorial. Em uma página com Hero, o planner reservava uma linha inteira para ele, preenchia as linhas anteriores com Destaques e Normais, rebalanceava a linha residual quando possível e materializava o Hero como a última linha usada. Assim, a sobra de composição ficava **acima do Hero**, nunca abaixo.

Exemplo Técnico 2×4 histórico:

```text
[Destaque 4/6][Normal 2/6]
[ Normal ][ Normal ]
[      Normal residual       ]
[             HERO           ]
```

Uma página materializava no máximo um Hero. Quando a categoria possuía múltiplos Heroes, cada um ancorava uma página separada e a ordem original entre Heroes permanecia estável.

> No v0.9 essas regras deixam de ser invariantes. `Destaque` passa a ser somente aparência e `simple / wide / full` passa a controlar geometria; estado legado `Hero` migra para `Destaque visual + Linha inteira` sem paginação especial.

## Distribuição e tipografia

Distribuições: `Compacta`, `Balanceada`, `Editorial`.

Tipografias: `Neutra`, `Técnica`, `Editorial`.

O planner usa micrograde de seis colunas como detalhe interno de materialização.

## Bulk

O compositor oferece aplicação em lote de decisões locais de apresentação. Na v0.8 eram conteúdo e ênfase; o v0.9 acrescenta largura explicitamente. Isso altera somente `catalog.presentation.itemStyles`.

Na v0.8.1 o bulk foi reorganizado para responder à largura do próprio painel (`container-type: inline-size`). A estrutura base usa duas colunas: campo + ação. O layout não depende de um breakpoint de viewport para caber dentro de uma coluna desktop estreita.

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

## Gates históricos v0.8.3

Os gates deste recorte validavam o contrato então vigente de Destaque/hero. O v0.9 substitui esses asserts por largura em slots, preservando os gates de A4 físico, isolamento do print, Fit mobile e gesto touch vertical.

## Fora do recorte histórico

- sequências/grupos multi-produto;
- receitas editoriais automáticas;
- drag/resize/coordenadas persistidas;
- fonte arbitrária por card;
- sincronização remota do estado de composição.
