# v0.11.1.7 — modo de agrupamento e inspector compacto

## Objetivo

Reduzir o chrome permanente do compositor sem alterar o modelo estrutural, o schema local ou as autoridades editoriais.

O recorte mantém três estados semanticamente distintos:

- `selectedIds`: membership persistido do catálogo;
- `ComposerSelection`: target editorial efêmero do inspector;
- `BlockSelection`: seleção estrutural efêmera usada somente durante o modo `Agrupar`.

Nenhum estado efêmero entra em backup, ProductStore, `CatalogDocument` ou print.

## Lista no modo normal

A lista volta a priorizar membership, navegação e reorder top-level.

A barra normal contém apenas:

- `Incluir visíveis no catálogo`;
- `Esvaziar catálogo`;
- `Agrupar`.

Checkbox continua sendo exclusivamente membership. O handle `⋮⋮` continua sendo exclusivamente reorder top-level. Collection/Table continuam unidades atômicas nesse reorder.

Os antigos botões `Marcar` por produto e as setas de reorder interno por linha foram removidos.

## Modo Agrupar

`Agrupar` entra em um modo temporário e explícito da lista.

Enquanto ativo:

- `ComposerSelection` é limpa e o inspector vazio não ocupa altura;
- checkboxes de membership e handles de reorder ficam desabilitados;
- a própria linha elegível é a superfície de marcação estrutural;
- o estado marcado recebe chrome próprio, sem alterar `selectedIds`;
- só é possível expandir uma seleção para produtos contíguos, da mesma categoria e fora de outro bloco;
- a barra mostra quantidade marcada, `Criar coleção`, `Criar tabela` e `Cancelar`;
- busca/filtro limpam a marcação estrutural sem apagar membership;
- criar um bloco ou cancelar volta automaticamente ao modo normal.

Os limites existentes permanecem inalterados: Collection até 12 membros; Table até 30.

## Inspector compacto

Sem `ComposerSelection`, o inspector é reduzido a uma faixa curta de orientação. Durante o modo Agrupar, essa faixa recolhida é ocultada para devolver ainda mais área à lista.

Selecionar Card, Collection, membro ou Table no A4/lista continua abrindo os mesmos controles contextuais. `×` e `Esc` limpam o target e recolhem novamente o inspector.

## Ordem interna de blocos

A operação de reorder interno não mudou de domínio:

```text
Inspector
→ PresentationActions.moveBlockMember()
→ CatalogOrder.moveBlockMember()
→ presentation.order
→ CatalogDocument
```

O que mudou foi somente a superfície de UX.

Collection e Table agora exibem uma seção `Ordem interna` no inspector com seus membros e controles discretos ↑/↓. A sequência mostrada deriva da ordem efetiva de `CatalogOrder`, não da ordem bruta de `block.memberIds`.

Isso preserva:

- membership;
- categoria;
- contiguidade;
- atomicidade top-level;
- paridade preview/print.

## Limpeza

O antigo painel de apresentação em lote já não existia no DOM. As regras CSS residuais de `bulk-presentation-controls` foram removidas neste recorte para que essa superfície não permaneça como contrato fantasma.

## Gates

`browser-grouping-ux-gate.mjs` passa a cobrir o fluxo real:

1. modo normal sem `Marcar`/setas internas;
2. entrada explícita em `Agrupar`;
3. membership/reorder top-level bloqueados durante agrupamento;
4. marcação contígua e `selectedIds` invariável;
5. busca limpando somente `BlockSelection`;
6. criação de Collection e retorno ao modo normal;
7. reorder interno da Collection pelo inspector chegando ao `CatalogDocument`;
8. criação de Table e reorder interno equivalente;
9. cancelamento restaurando o modo normal.

Os Browser Print/Inspector gates continuam responsáveis por A4 físico, print limpo, seleção no preview e scroll vertical touch.

## Fora de escopo

- schema novo;
- mudança em ProductStore;
- mudança em `quantityPrice`;
- drag/reorder sobre o A4;
- seleção estrutural persistida;
- múltiplos níveis de bloco;
- `presentation.imageFrames` / v0.11.2;
- novos gestos mobile de seleção múltipla.
