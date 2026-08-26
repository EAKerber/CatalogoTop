# v0.10.1 — coleção visual composta

## Objetivo

Adicionar um segundo primitivo editorial top-level além de `Card`, capaz de representar famílias visuais densas como tomadas, interruptores, acabamentos e acessórios sem reintroduzir coordenadas livres, drag/resize ou containers genéricos.

O vocabulário previsto passa a ser:

```text
Card
Collection
Table (recorte seguinte)
```

`Collection` é o único tipo novo implementado neste recorte.

## Contrato local

Coleções pertencem exclusivamente ao estado local do catálogo:

```text
catalog.presentation.blocks[]
```

Produto remoto e ProductStore continuam factuais e não recebem qualquer informação de agrupamento editorial.

Um bloco contém:

- `id` estável local;
- `type: collection`;
- `memberIds` em ordem factual;
- título e subtítulo opcionais;
- tema `light` ou `dark`;
- grade interna de 2, 3 ou 4 colunas;
- preset interno `visual`, `compact` ou `commercial`;
- overrides locais de `emphasis` e `width` por membro.

Não existe profundidade maior que 1. Coleção não contém coleção, tabela ou outro bloco.

## Ordem e reversibilidade

`selectedIds` continua sendo a fonte factual de seleção e ordem.

Uma coleção só é materializada quando seus membros formam um trecho contíguo da categoria. Ela ocupa a posição do primeiro membro e os demais são consumidos pelo mesmo bloco. `CatalogDocument.orderedIds` continua contendo todos os IDs de produto na mesma ordem anterior ao agrupamento.

Desagrupar remove apenas o bloco. Nenhum produto é reconstruído, removido ou reordenado.

Blocos inválidos ou incompletos falham para cards individuais em vez de ocultar produtos.

## Geometria

A coleção ocupa a linha inteira da micrograde A4 no v0.10.1.

Internamente usa slots locais:

- `simple` = 1 slot;
- `wide` = 2 slots;
- `full` = todas as colunas locais.

O planner interno calcula `localRowCount`. No caso nominal, `rowSpan` corresponde às linhas internas. Se uma combinação legada/estreita ultrapassar a quantidade de linhas do template, o bloco é comprimido para a altura máxima da página e expõe `compressed=true`; o DOM não decide paginação.

Top-level, o planner recebe `Card(rowSpan=1)` e `Collection(rowSpan=N)`. Uma coleção é atômica: se não couber no restante da página, inicia a página seguinte; nunca é dividida entre páginas.

## UX v0.10.1

A ação `Agrupar em coleção` considera produtos selecionados, ativos, ainda não agrupados e de uma única categoria. Quando há múltiplas categorias, o usuário filtra a categoria antes de agrupar.

Limite inicial: 2 a 12 membros.

O editor de coleção oferece:

- título;
- subtítulo;
- tema;
- número de colunas;
- apresentação interna;
- desagrupar.

Nos membros agrupados, os controles globais de card são substituídos por dois overrides locais:

- Ênfase: Normal / Destaque;
- Largura: Simples / Largo / Linha inteira.

A ordem interna continua herdada da seleção; não há reordenação drag-and-drop neste recorte.

## Render e impressão

`CatalogDocument` materializa a coleção antes do renderer. Preview e PDF consomem o mesmo documento.

A coleção renderiza como um bloco full-width com grade interna própria. O renderer não calcula quantas páginas existem.

Temas claro/escuro são presets fechados. Não há seletor de cor arbitrária.

## Guardrails

- uma única categoria por coleção;
- membros contíguos na ordem factual;
- máximo de 12 membros;
- 2–4 colunas internas;
- sem coordenadas absolutas;
- sem nesting;
- sem escrita no ProductStore;
- sem alteração de `selectedIds` por mero agrupamento;
- bloco atômico entre páginas;
- qualquer inconsistência falha para cards, nunca para perda silenciosa de produto.

## Gates

O fixture `scripts/collection-block-fixture.mjs` cobre:

- preservação de `blocks` em `presentation`;
- largura local simples/larga/full;
- `localRowCount` e `rowSpan` determinísticos;
- materialização de `Collection` no `CatalogDocument`;
- preservação exata de `orderedIds`;
- selectedCount factual;
- round-trip lógico agrupar/desagrupar;
- fallback para cards em bloco não contíguo;
- limite inicial de 12 membros.

O Browser Print Gate deve continuar protegendo A4 físico, isolamento do documento print, Fit/zoom e scroll touch. Um fixture visual de coleção será acrescentado antes do merge final deste recorte.

## Fora do recorte

- bloco `Table`;
- receitas editoriais;
- reordenação manual de membros;
- nesting;
- editor livre;
- spans top-level arbitrários da coleção;
- sincronização remota dos blocos.
