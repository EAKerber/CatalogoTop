# CatalogoTop V2 — Start Here

Branch principal de evolução: **`v2`**  
Baseline estável V1: **`main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9` / tag `v1.0.0`**.

## Estado atual

A linha V2 concluiu R1, R2, R3, **R4 — Constrained Template System 2.0**, **R5 — Editorial Vocabulary 2.0** e **R6a — Structural Preflight Foundation**.

Authority atual após o closeout de R6a:

- `v2@ef07409b233a79f2e3bf6ed6680e86c3c9bbdccb`;
- R6a funcional foi promovido em `v2@4a7dfbdaeb5bcf918c29a764d862956b0e120d3b`;
- `main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9` permanece V1 estável e não é destino rotineiro do desenvolvimento V2.

Entregas consolidadas:

- **R1 — Product Library Foundation**: ProductSnapshot v2, folders provider-scoped, Cadastro contextual e Biblioteca de produtos;
- **R2 — Saved Catalog Documents**: CatalogSnapshot/CatalogStore independentes, save/open/duplicate, dirty-state e administração por pastas;
- **R3 — Asset Library**: AssetIndex independente, inventory/usage autoritativos, organização, ingest deduplicado e reuso no Cadastro;
- **R4a — Template Contract & Versioned Binding**: TemplateContract v1 bounded e binding exato `templateId + templateVersion`;
- **R4b — Template Library & Immutable Versions**: TemplateStore/TemplateSnapshot independentes e versões custom append-only;
- **R5a — Table Row Image Editing Parity**: produtos em Table reutilizam `imageSelections`/`imageFrames` por `productId`;
- **R5b — Collection Technical Detail**: preset `technical` projeta `product.specs` factual de forma bounded;
- **CI-H1 — AssetIndex Write Settlement Gate**: gate assíncrono distingue projeção otimista de settlement autoritativo sem mudar runtime;
- **R6a — Structural Preflight Foundation**: relatório efêmero `ready | review | blocked`, oito checks estruturais e status/painel no Catálogo, sem auto-fix ou enforcement de PDF.

R5 está fechado após R5a + R5b. Não criar `Callout`, Collection 2.0, imagem em `commercialRows`, nesting ou outro primitivo por simetria.

A biópsia pós-R6a selecionou um próximo recorte pequeno: **R6b — Rendered Description Truncation**. R6b está **planejado, não implementado**. Ele promove somente o sinal explícito já produzido por TextFit para descrições truncadas de Card/Collection; imagem quebrada, colisão, Table truncation e página física permanecem fora do recorte.

## Ordem de leitura

1. `docs/v2/START-HERE.md` — bootstrap e fronteiras atuais;
2. `docs/v2/R6B-RENDERED-DESCRIPTION-TRUNCATION-INTENT.md` — próximo recorte selecionado, ainda não implementado;
3. `docs/v2/R6A-CLOSEOUT.md` — authority promovida, gates e estado pós-R6a;
4. `docs/v2/R6A-STRUCTURAL-PREFLIGHT-FOUNDATION-INTENT.md` — contrato final do Preflight estrutural;
5. `docs/v2/ROADMAP.md` — milestones e dependências;
6. `docs/v2/R5-CLOSEOUT.md` — fechamento do vocabulário editorial;
7. `docs/v2/CI-H1-ASSET-INDEX-WRITE-SETTLEMENT.md` — hardening da race conhecida do AssetIndex gate;
8. closeouts/intents R1–R4 quando precisar de decisões históricas específicas.

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
Built-ins -> app-owned, imutáveis

Apresentação catalog-local
  ├─ Card       -> catalog.presentation.itemStyles
  ├─ Collection -> catalog.presentation.blocks + itemStyles locais
  ├─ Table      -> catalog.presentation.blocks
  ├─ image selection/framing -> presentation por productId
  └─ ordem editorial -> CatalogOrder

Preflight estrutural
  └─ projeção efêmera de state + CatalogDocument; não é persistence authority

Render-aware planejado em R6b
  └─ leitura dos datasets já materializados por TextFit; não é nova authority
```

Shared UI não implica shared store. `FolderTree` é vocabulário puro reutilizável; namespaces e revisions permanecem provider-scoped.

## Pipeline autoritativo

```text
state
  -> CatalogOrder
  -> CatalogDocument
  -> preview / print

state + CatalogDocument
  -> Preflight.inspect(state)
  -> structural PreflightReport

preview já finalizado por TextFit                [R6b planejado]
  -> PreflightRender.inspect(root)
  -> render issues
  -> merge puro no mesmo PreflightReport
```

Preflight observa a mesma autoridade que gera o documento. Ele não corrige state, não substitui CatalogDocument e não cria uma segunda materialização.

## Invariantes

- Produto e apresentação permanecem separados.
- Resource identity é estável através de move/rename organizacional.
- Revisions são provider-scoped; não criar um conflito global de Biblioteca.
- O Core é sessão materializada de edição, não banco autoritativo de recursos.
- O pipeline A4 continua `state -> CatalogOrder -> CatalogDocument -> preview/print`.
- Catálogos persistem referência exata `templateId + templateVersion`; versão desconhecida falha fechado.
- Versões publicadas de templates custom são imutáveis e append-only.
- TemplateContract continua bounded data: sem HTML/CSS/JS, selectors, stylesheet URLs ou XY arbitrário.
- Header/footer institucional são app-owned.
- Preview e print consomem o mesmo CatalogDocument/template resolvido.
- Card, Collection e Table são o vocabulário estrutural top-level estabilizado.
- Collection continua atômica/full-width top-level e sem nesting.
- Table continua fragmentável; `commercialRows` não ganhou semântica de imagem por inferência.
- Image selection/framing continua apresentação por `productId`; ajustes editoriais não reescrevem `product.image`.
- Assets gerenciados são content-addressed e imutáveis.
- Uso de assets deriva de snapshots persistidos, nunca do Core local.
- `Sem uso` é accounting, não autorização para exclusão física.
- AssetIndex pode projetar mutação local antes do write remoto; consumers de revisão autoritativa devem esperar settlement.
- Preflight é efêmero e não possui store/revision.
- Preflight detecta; não muta dados para fazer um issue desaparecer.
- R6a não desabilita/intercepta PDF por causa da taxonomia de blockers.
- `src/preflight.js` permanece sem DOM/geometry.
- R6b, se implementado conforme intent, consome somente sinais explícitos já produzidos pelo render; não mede layout de novo.
- Table não recebe truncation semantics apenas por simetria enquanto TextFit não expuser esse contrato.
- Preflight chrome nunca entra no documento print.
- `main` continua somente leitura para a missão V2 atual até decisão explícita de release.

## Preflight R6a estabilizado

R6a implementa:

- `template_unavailable` — blocker;
- `catalog_empty` — blocker;
- `selected_product_missing` — blocker;
- `selected_product_inactive` — warning;
- `required_product_fact_missing` — blocker para código/descrição;
- `editorial_block_not_materialized` — warning;
- `image_selection_fallback` — warning;
- `visible_image_missing` — warning.

Imagem é avaliada pelo uso materializado:

- Card com grade real de variantes não exige a imagem principal naquele uso;
- Collection member é single-image;
- Table só é single-image para `rowSource:'products'` com coluna `image` ativa;
- `commercialRows` permanece fora desse contrato.

## Próximo recorte selecionado — R6b

**R6b — Rendered Description Truncation** nasce de um sinal já existente, não de uma heurística nova.

`TextFit.fitCatalog()` já materializa em Card/Collection:

- `data-full-description`;
- `data-description-truncated`;
- `data-fit-lines`;
- `data-visible-words`.

O renderer termina esse fitting antes de publicar `catalogotop:catalog-rendered`. R6b deve apenas projetar `data-description-truncated="true"` como `description_truncated` warning no relatório existente.

Fronteiras:

- Card e Collection apenas;
- Table fora do recorte;
- `src/preflight.js` continua DOM-free;
- render-aware projection lê dataset, não executa fitting nem mede geometria;
- sem timers/MutationObserver;
- sem persistência de issues;
- sem auto-fix ou enforcement de PDF;
- preview/print parity é gate, não segunda runtime authority.

Ver `R6B-RENDERED-DESCRIPTION-TRUNCATION-INTENT.md` antes de implementar.

## Ambiente de teste V2

O ambiente Netlify V2 é autoridade operacional separada do Git. Não inferir deploy state a partir do branch `v2`.

O reseed histórico a partir da V1 foi one-shot; nenhuma scheduled function ou endpoint de migração faz parte do runtime atual.

Nenhuma ação Netlify está implícita por uma promoção Git.

## Backup legado

Backup JSON continua sendo transporte compatível do estado monolítico legado e passa por `Core.migrate`. Não é uma authority V2.

## Depois de R6b

Não agrupar automaticamente os demais sinais render-aware.

Ainda requerem biópsias próprias:

- falha real de carregamento de imagem — lifecycle assíncrono diferente;
- collision/overflow — exige geometria real e política de estabilidade;
- página física/logical parity autor-facing — pode pertencer mais ao isolated print/release gate do que ao runtime;
- Table truncation — não possui hoje o sinal explícito de TextFit usado por R6b.

Cada candidato deve provar sua authority antes de entrar no `PreflightReport`.
