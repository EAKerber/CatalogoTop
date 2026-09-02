# CatalogoTop V2 — Start Here

Branch principal de evolução: **`v2`**  
Baseline estável V1: **`main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9` / tag `v1.0.0`**.

## Estado atual

A linha V2 concluiu R1, R2, R3, **R4 — Constrained Template System 2.0** e **R5 — Editorial Vocabulary 2.0**. CI-H1 também foi fechado como hardening de teste antes de R6.

Authority promovida após CI-H1:

- `v2@05a699896881a08acf503648efab69a9b51669a8` — R5 fechado, gate AssetIndex endurecido e R6 como próximo milestone de produto;
- `main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9` permanece linha V1 estável e não é destino rotineiro de desenvolvimento V2.

Entregas consolidadas:

- **R1 — Product Library Foundation**: ProductSnapshot v2, árvore provider-scoped, Cadastro contextual e Biblioteca de produtos;
- **R2 — Saved Catalog Documents**: CatalogSnapshot/CatalogStore independentes, save/open/duplicate, dirty-state e administração por pastas;
- **R3 — Asset Library**: AssetIndex independente, inventory/usage autoritativos, provider `Imagens`, labels, pastas, busca/filtros, upload standalone deduplicado e reuso no Cadastro;
- **R4a — Template Contract & Versioned Binding**: TemplateContract v1 bounded, built-ins versionados, binding persistido `templateId + templateVersion`, resolução fail-closed, budgets declarativos e chrome institucional app-owned;
- **R4b — Template Library & Immutable Versions**: TemplateStore/TemplateSnapshot independentes, versões custom append-only e imutáveis, `Biblioteca > Templates`, editor bounded e seleção histórica/exact binding sem auto-upgrade;
- **R5a — Table Row Image Editing Parity**: linhas `products` com coluna Imagem reutilizam `imageSelections`/`imageFrames` por `productId`, preservando TableBlock, fragmentação e paginação;
- **R5b — Collection Technical Detail**: preset `technical` projeta `product.specs` factual de forma bounded, com orçamento `simple=1`, `wide=2`, `full=2`, sem alterar produto, schema ou pipeline A4;
- **CI-H1 — AssetIndex Write Settlement Gate**: gate R3b distingue projeção otimista de write settlement e não lê revisão/encadeia nova escrita enquanto `pendingWrite=true`.

A biópsia pós-R5b não encontrou outro gap editorial concreto que justificasse R5c. R5 fecha após R5a + R5b. Não implementar `Callout`, Collection 2.0, imagem em `commercialRows`, nesting ou outro primitivo por simetria.

**R6a — Structural Preflight Foundation está selecionado e planejado, mas ainda não implementado.** O contrato está em `R6A-STRUCTURAL-PREFLIGHT-FOUNDATION-INTENT.md`.

## Ordem de leitura

1. `docs/v2/START-HERE.md` — bootstrap e fronteiras atuais;
2. `docs/v2/R6A-STRUCTURAL-PREFLIGHT-FOUNDATION-INTENT.md` — próximo recorte selecionado, checks, issue contract, UI e stop conditions;
3. `docs/v2/ROADMAP.md` — dependências e milestones;
4. `docs/v2/R5-CLOSEOUT.md` — decisão de fechamento de R5 e transição para R6;
5. `docs/v2/CI-H1-ASSET-INDEX-WRITE-SETTLEMENT.md` — hardening do gate assíncrono antes de R6;
6. `docs/v2/R5B-CLOSEOUT.md` — autoridade/gates do último recorte funcional de R5;
7. `docs/v2/R5B-COLLECTION-TECHNICAL-DETAIL-INTENT.md` e `docs/v2/R5A-TABLE-ROW-IMAGE-EDITING-INTENT.md` — contratos bounded estabilizados;
8. `docs/v2/R4B-CLOSEOUT.md` e `docs/v2/R4A-CLOSEOUT.md` — fronteiras do Template System 2.0;
9. `docs/v2/R3-CLOSEOUT.md` e `docs/v2/R2-CLOSEOUT.md` — authorities já estabilizadas;
10. intents R1/R2/R3 quando precisar entender decisões históricas específicas.

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

Preflight futuro
  └─ projeção efêmera de state + CatalogDocument; não é persistence authority
```

`Templates` é a projection/registry síncrona consultada pelo renderer; `TemplateStore` é a authority persistente revisionada. Shared UI não implica shared store.

`FolderTree` é vocabulário puro reutilizável, não uma authority global. Cada provider mantém namespace e revisão próprios. R4b deliberadamente não introduz folders para templates.

R5a/R5b reutilizaram authorities existentes. Nem edição de imagem em Table nem detalhe técnico em Collection criaram estado factual ou uma nova persistence authority.

R6a deve manter esse padrão: Preflight observa authorities/materialização existentes; não cria um PreflightStore e não reescreve dados para fazer issues desaparecerem.

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
- Card, Collection e Table são o vocabulário estrutural top-level estabilizado ao fechar R5; não adicionar quarto primitivo sem caso irreduzível concreto.
- Collection continua atômica, full-width top-level, sem nesting e com geometria discreta; R5b acrescenta somente projeção técnica bounded dentro do membro.
- Table continua fragmentável e suas linhas comerciais não ganharam semântica de imagem por inferência.
- Image selection/framing continua apresentação por `productId`; produto original não é reescrito por ajustes editoriais.
- Assets gerenciados são content-addressed e imutáveis. Metadata/organização não altera bytes nem hash.
- Uso de assets deriva de ProductSnapshot/CatalogSnapshot persistidos, nunca do Core local.
- `Sem uso` é accounting, não autorização para exclusão física.
- AssetIndex pode projetar mutação local antes do write remoto; testes e consumidores que precisam de revisão autoritativa devem distinguir snapshot otimista de settlement.
- Deploy Preview/branch nunca grava no store global de produção.
- `main` continua somente leitura para a missão V2 atual até decisão explícita de release.
- Preflight observa/materializa problemas; não pode mutar dados factuais ou editoriais para fazê-los desaparecer.
- R6a não deve usar DOM measurement, desabilitar print nem criar um motor genérico de regras para antecipar recuts futuros.

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

## CI-H1 — AssetIndex Write Settlement Gate

CI-H1 está concluído e preserva a semântica otimista do runtime, corrigindo a premissa assíncrona do Browser Asset Library gate.

Após uma mutação, o fixture pode observar primeiro a projeção local esperada. Antes de ler revisão autoritativa ou iniciar outra escrita do AssetIndex, ele espera explicitamente:

- `AssetIndexStore.hasPendingWrite() === false`;
- `AssetIndexStore.hasConflict() === false`.

O fixture adiciona atraso determinístico pequeno aos PUTs de AssetIndex para que a janela otimista seja exercitada de forma reproduzível. O atraso não é a condição de correção; settlement explícito é.

Ver `CI-H1-ASSET-INDEX-WRITE-SETTLEMENT.md`.

## Próximo recorte — R6a Structural Preflight Foundation

R6a é o próximo recorte selecionado, ainda sem implementação funcional nesta authority.

O recorte cria uma projeção efêmera `Preflight.inspect(state)` com issue contract determinístico e UI mínima de status/painel. A primeira taxonomia cobre somente sinais estruturais que podem ser derivados de state + CatalogDocument sem medir o DOM:

- template exato indisponível;
- catálogo sem produto publicável;
- selected product inexistente;
- selected product inativo e portanto omitido;
- código/descrição obrigatórios ausentes em produto publicável;
- Collection/Table persistida que não sobrevive à materialização;
- image selection explícita que caiu para Original em uso elegível;
- uso visual single-image que cairia no placeholder.

R6a separa `blocker | warning | info`, mas **não desabilita/intercepta o botão de PDF** e não executa auto-fix. O objetivo é validar a utilidade da observabilidade antes de decidir enforcement.

Truncamento TextFit, falha real de carregamento de imagem, colisão/overflow e comparação física do PDF ficam fora de R6a e exigem uma futura biópsia render-aware.

Ver `R6A-STRUCTURAL-PREFLIGHT-FOUNDATION-INTENT.md` antes de escrever código.
