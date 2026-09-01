# CatalogoTop V2 — Start Here

Branch principal de evolução: **`v2`**  
Baseline estável V1: **`main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9` / tag `v1.0.0`**.

## Estado atual

A linha V2 concluiu R1, R2, R3 e **R4 — Constrained Template System 2.0**. **R5 — Editorial Vocabulary 2.0** está ativo e já concluiu dois recortes pequenos selecionados por biópsia de gaps reais: R5a e R5b.

Authority funcional promovida após R5b:

- `v2@a6e461086420733edea162f91da35668c3225a2e` — R5b Collection Technical Detail;
- `main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9` permanece linha V1 estável e não é destino rotineiro de desenvolvimento V2.

Entregas consolidadas:

- **R1 — Product Library Foundation**: ProductSnapshot v2, árvore provider-scoped, Cadastro contextual e Biblioteca de produtos;
- **R2 — Saved Catalog Documents**: CatalogSnapshot/CatalogStore independentes, save/open/duplicate, dirty-state e administração por pastas;
- **R3 — Asset Library**: AssetIndex independente, inventory/usage autoritativos, provider `Imagens`, labels, pastas, busca/filtros, upload standalone deduplicado e reuso no Cadastro;
- **R4a — Template Contract & Versioned Binding**: TemplateContract v1 bounded, built-ins versionados, binding persistido `templateId + templateVersion`, resolução fail-closed, budgets declarativos e chrome institucional app-owned;
- **R4b — Template Library & Immutable Versions**: TemplateStore/TemplateSnapshot independentes, versões custom append-only e imutáveis, `Biblioteca > Templates`, editor bounded e seleção histórica/exact binding sem auto-upgrade;
- **R5a — Table Row Image Editing Parity**: linhas `products` com coluna Imagem reutilizam `imageSelections`/`imageFrames` por `productId`, preservando TableBlock, fragmentação e paginação;
- **R5b — Collection Technical Detail**: preset `technical` projeta `product.specs` factual de forma bounded, com orçamento `simple=1`, `wide=2`, `full=2`, sem alterar produto, schema ou pipeline A4.

A auditoria pós-R4b não encontrou lacuna funcional concreta que justificasse R4c. R4 está fechado após R4a + R4b. R5 não deve ser expandido por simetria: cada recorte nasce de um gap observado.

## Ordem de leitura

1. `docs/v2/START-HERE.md` — bootstrap e fronteiras atuais;
2. `docs/v2/ROADMAP.md` — dependências, milestones e estado de R5;
3. `docs/v2/R5B-CLOSEOUT.md` — autoridade promovida, gates e estado pós-R5b;
4. `docs/v2/R5B-COLLECTION-TECHNICAL-DETAIL-INTENT.md` — contrato bounded do recorte atual;
5. `docs/v2/R5A-TABLE-ROW-IMAGE-EDITING-INTENT.md` — primeiro gap concreto fechado em R5;
6. `docs/v2/R4B-CLOSEOUT.md` e `docs/v2/R4A-CLOSEOUT.md` — fronteiras do Template System 2.0;
7. `docs/v2/R3-CLOSEOUT.md` e `docs/v2/R2-CLOSEOUT.md` — authorities já estabilizadas;
8. intents R1/R2/R3 quando precisar entender decisões históricas específicas.

## Authorities V2

```text
Biblioteca UI
  ├─ Produtos   -> ProductStore / ProductSnapshot
  ├─ Catálogos  -> CatalogStore / CatalogSnapshot
  ├─ Imagens    -> AssetIndexStore / AssetIndexSnapshot
  └─ Templates  -> TemplateStore / TemplateSnapshot

Bytes de imagem -> AssetStore content-addressed (sha256), imutável
Usage de imagem -> projeção de ProductSnapshot + CatalogSnapshot persistidos
Templates runtime -> Templates registry / TemplateContract versionado
Built-ins -> app-owned, imutáveis, não copiados para TemplateSnapshot

Apresentação catalog-local
  ├─ Card       -> catalog.presentation.itemStyles
  ├─ Collection -> catalog.presentation.blocks + itemStyles locais
  ├─ Table      -> catalog.presentation.blocks
  ├─ image selection/framing -> presentation por productId
  └─ ordem editorial -> CatalogOrder
```

`Templates` é a projection/registry síncrona consultada pelo renderer; `TemplateStore` é a authority persistente revisionada. Shared UI não implica shared store.

`FolderTree` é vocabulário puro reutilizável, não uma authority global. Cada provider mantém namespace e revisão próprios. R4b deliberadamente não introduz folders para templates.

R5a/R5b reutilizam authorities existentes. Nem edição de imagem em Table nem detalhe técnico em Collection criaram estado factual ou uma nova persistence authority.

## Invariantes

- Produto e apresentação permanecem separados.
- Resource identity permanece estável através de move/rename organizacional.
- Revisions são provider-scoped; não criar um conflito global de Biblioteca.
- O Core é sessão materializada de edição, não banco autoritativo de recursos.
- O pipeline A4 continua `state -> CatalogOrder -> CatalogDocument -> preview/print`.
- Catálogos persistem referência exata `templateId + templateVersion`; versão desconhecida falha fechado.
- Catálogos antigos não são silenciosamente atualizados para a latest template version.
- Versões publicadas de templates custom são imutáveis; edição acrescenta apenas a próxima versão.
- Built-ins continuam app-owned e não são persistidos como custom resources.
- TemplateContract é data bounded: sem HTML/CSS/JS, selectors, stylesheet URLs ou XY arbitrário.
- Header/footer institucional são primitives app-owned; templates apenas referenciam IDs suportados.
- Preview e print consomem o mesmo CatalogDocument/template resolvido.
- Card, Collection e Table continuam o vocabulário estrutural top-level provado; não adicionar quarto primitivo sem caso irreduzível concreto.
- Collection continua atômica, full-width top-level, sem nesting e com geometria discreta; R5b acrescenta somente projeção técnica bounded dentro do membro.
- Table continua fragmentável e suas linhas comerciais não ganharam semântica de imagem por inferência.
- Image selection/framing continua apresentação por `productId`; produto original não é reescrito por ajustes editoriais.
- Assets gerenciados são content-addressed e imutáveis. Metadata/organização não altera bytes nem hash.
- Uso de assets deriva de ProductSnapshot/CatalogSnapshot persistidos, nunca do Core local.
- `Sem uso` é accounting, não autorização para exclusão física.
- Deploy Preview/branch nunca grava no store global de produção.
- `main` continua somente leitura para a missão V2 atual até decisão explícita de release.

## Ambiente de teste V2

O projeto Netlify `catalogotop-v2-test` foi re-semeado operacionalmente a partir do ProductSnapshot V1 depois de o acervo V2 de teste ser limpo. A migração foi one-shot e não faz parte do runtime final.

Verificação ao vivo do reseed:

- V1 revision 187 / 25 produtos;
- V2 ProductSnapshot schema 2 / 25 produtos / 3 pastas;
- payload de produto preservado, acrescentando apenas `folderId` derivado pela migração determinística R1;
- 23 referências de imagem não vazias verificadas como disponíveis;
- 0 referências `picsum.photos` remanescentes.

Nenhuma scheduled function ou endpoint de migração permanece ativo após o reseed.

O ambiente de teste é autoridade operacional separada do Git. Antes de smoke manual, confirmar qual branch está selecionada para deploy; não inferir deploy state a partir de `v2`.

## Backup legado

O backup JSON continua sendo transporte compatível do estado monolítico legado e passa por `Core.migrate`. Importá-lo limpa a identidade de catálogo salvo, portanto a composição restaurada volta como sessão não salva e pode ser persistida pelo CatalogStore.

O backup não é uma authority V2.

## Próximo ponto de decisão — biópsia pós-R5b

R5 está ativo, mas **não existe R5c predefinido**.

R5a fechou a ausência de edição de imagem em linhas `products` de Table usando semântica existente por `productId`. R5b fechou a perda de pequeno contexto técnico factual ao agrupar produtos em Collection. Ambos foram resolvidos sem novo primitivo, nova persistence authority ou exceção de renderer ampla.

O próximo trabalho deve começar por nova biópsia de casos reais e perguntar:

- após R5a, resta algum gap concreto de Table que não exija inventar semântica de placement ou `commercialRows`?
- após R5b, resta algum gap concreto de Collection que não possa ser resolvido por presets/overrides bounded já existentes?
- existe finalmente um caso irreduzível que justifique `Callout`, ou Card `full + feature`, cabeçalhos e blocos atuais ainda cobrem os casos observados?
- alguma capacidade nova pertence ao TemplateContract, ou deve continuar catalog-local?
- R5 já está suficientemente completo para ser fechado e abrir a biópsia de R6?

Preservar as fronteiras já provadas: nenhuma linguagem de template paralela, nenhum editor XY genérico, nenhum nesting/container genérico e nenhuma exceção de renderer introduzida apenas para aumentar flexibilidade abstrata.
