# v0.9 — largura de cards por slots

## Problema

Até v0.8.3, `Hero` acumulava quatro responsabilidades: aparência, largura, prioridade e paginação especial. Isso tornou o comportamento difícil de prever e testar. Alterar um card para Hero não era equivalente a apenas torná-lo maior; o planner também o removia do fluxo normal e tentava ancorá-lo em uma posição específica da página.

## Novo modelo

A apresentação por produto passa a ter três eixos independentes:

- `contentPreset`: quanto e qual conteúdo o card prioriza;
- `emphasis`: aparência (`normal` ou `feature` / Destaque visual);
- `width`: geometria (`simple`, `wide`, `full`).

A largura é resolvida em slots do template:

| width | Técnico 2 colunas | Compacto 3 colunas | Showcase 2 colunas |
|---|---:|---:|---:|
| `simple` | 1/2 | 1/3 | 1/2 |
| `wide` | 2/2 | 2/3 | 2/2 |
| `full` | 2/2 | 3/3 | 2/2 |

O planner continua renderizando sobre a micrograde interna de seis colunas, mas essa micrograde deixa de ser o contrato editorial exposto. `slotSpan` é convertido deterministicamente em `span` 6-colunas apenas na materialização.

## Ordem

`selectedIds` é a ordem factual e permanece a ordem de composição dentro de cada categoria. Ênfase visual não reordena produtos. Largura não reordena produtos.

Se um card largo ou full não cabe no restante da linha atual, ele começa na linha seguinte. O conteúdo residual fica naturalmente acima dele; não existe uma regra específica de Hero para produzir esse resultado.

## Migração de Hero

Estados antigos com:

```json
{ "emphasis": "hero" }
```

são normalizados para:

```json
{ "emphasis": "feature", "width": "full" }
```

Assim o resultado visual focal pode ser preservado sem manter uma primitiva estrutural especial. `Destaque visual + Linha inteira + Visual` recebe tratamento focal no CSS, mas o planner enxerga apenas propriedades genéricas.

## UI

Cada produto selecionado oferece:

- Conteúdo;
- Ênfase;
- Largura.

A aplicação em lote também oferece os três eixos. Os nomes de largura são `Simples · 1 slot`, `Largo · 2 slots` e `Linha inteira`.

## Guardrails

- nenhum `if (hero)` na paginação;
- nenhum ranking de ordem baseado em ênfase;
- Destaque não muda span;
- largura não muda importância visual automaticamente;
- preview, `CatalogDocument` e print recebem o mesmo `width`, `slotSpan`, `span`, `row` e `start` materializados;
- o gate Chromium continua validando A4 físico, isolamento do print e scroll touch mobile.
