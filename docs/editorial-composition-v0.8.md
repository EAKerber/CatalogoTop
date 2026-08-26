# v0.8 — composição editorial determinística

> Estado: em desenvolvimento no PR #6. A estabilização v0.8.1 separa `CatalogDocument`, preview e documento de impressão; detalhes em `docs/document-pipeline-v0.8.1.md`.

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

- `Normal`
- `Destaque` — 4/6 da micrograde.
- `Hero` — 6/6 da micrograde.

Dentro de cada categoria, `Hero` e `Destaque` sobem ao topo de forma estável antes dos cards normais. A v0.8.1 materializa essa ordem em `CatalogDocument` e usa a mesma ordem no painel, preview e documento print.

## Distribuição e tipografia

Distribuições: `Compacta`, `Balanceada`, `Editorial`.

Tipografias: `Neutra`, `Técnica`, `Editorial`.

O planner usa micrograde de seis colunas, pagina por linhas planejadas e rebalanceia a última linha quando possível para evitar espaços em branco evitáveis.

## Bulk

O compositor oferece aplicação em lote de conteúdo e ênfase aos produtos atualmente selecionados. Isso altera somente `catalog.presentation.itemStyles`.

Na v0.8.1 o bulk foi reorganizado para responder à largura do próprio painel (`container-type: inline-size`). A estrutura base usa duas colunas: campo + ação. O layout não depende mais de um breakpoint de viewport para caber dentro de uma coluna desktop estreita.

## Mobile/header

Em tablet/mobile o header mantém duas linhas lógicas:
1. marca + dois grupos de utilidades com scroll horizontal próprio;
2. `Produtos / Catálogo / Templates` isolados em três colunas iguais.

Em telas muito estreitas, o nome `CatalogoTop` é ocultado e a marca vira o ponto de ancoragem visual da primeira linha.

`mobile-header.css` voltou a tratar somente o header. Regras de compositor e impressão foram removidas desse arquivo.

## Documento e PDF — v0.8.1

O fluxo suportado agora é:

```text
state → CatalogDocument → preview / print isolado
```

O botão de PDF não chama mais `window.print()` sobre a aplicação inteira. `src/print.js` gera um iframe temporário contendo somente `.catalog-page`, aguarda styles/fonts/imagens e imprime esse documento.

`print.css` neutraliza os `break-after` legados e quebra somente antes da segunda página em diante. No documento isolado as folhas voltam a `210 × 297 mm`.

As linhas vermelhas institucionais de header/footer são bordas, não backgrounds, para permanecerem visíveis com `printBackground: false`.

## Gates

Automáticos Node:
- `Visual` é o padrão de cards sem override;
- `Essencial` e `Detalhado` existem como limites explícitos de densidade;
- `Auto` é determinístico;
- aplicação em lote altera apenas `catalog.presentation`;
- planner usa seis colunas e ordem Hero/Destaque estável;
- `CatalogDocument` não muta `selectedIds` factual;
- CSS mobile não contém regras de compositor/PDF;
- compositor usa container e bulk de duas colunas;
- print isolado contém apenas folhas A4.

Gate Chromium físico (`CatalogoTop Browser Print Gate`):
- fixture materializa 2 páginas lógicas;
- Hero é primeiro no documento e no DOM do preview;
- documento de impressão não contém shell, selection panel ou divisores de preview;
- header/footer aparecem em ambas as páginas;
- linhas institucionais existem com `printBackground: false`;
- PDF gerado pelo Chromium possui exatamente 2 páginas físicas.

Gate manual restante antes do merge:
- repetir o catálogo real no Deploy Preview;
- confirmar que o PDF real não cria terceira página vazia;
- conferir painel do compositor em desktop real e a ordem visual Hero/Destaque;
- confirmar ausência de regressão no mobile já aprovado.

## Fora do recorte

- sequências/grupos multi-produto;
- receitas editoriais automáticas;
- drag/resize/coordenadas persistidas;
- fonte arbitrária por card;
- sincronização remota do estado de composição.
