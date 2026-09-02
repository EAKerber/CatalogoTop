# CatalogoTop V2 — Start Here

Branch principal de evolução: **`v2`**  
Baseline estável V1: **`main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9` / tag `v1.0.0`**.

## Estado atual

A linha V2 concluiu R1, R2, R3, **R4 — Constrained Template System 2.0**, **R5 — Editorial Vocabulary 2.0** e **R6 — Preflight / Publication Quality**.

Authority atual após o closeout documental de R6b:

- `v2@5218e39c36739b538aaf5198ab1ef5d6f7ed766b`;
- R6b funcional foi promovido em `v2@f589053dcee8aac7b37d417b3036cd92513f24cc` por PR #73;
- `main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9` permanece V1 estável e não é destino rotineiro do desenvolvimento V2.

Entregas consolidadas:

- **R1 — Product Library Foundation**: ProductSnapshot v2, folders provider-scoped, Cadastro contextual e Biblioteca de produtos;
- **R2 — Saved Catalog Documents**: CatalogSnapshot/CatalogStore independentes, save/open/duplicate, dirty-state e administração por pastas;
- **R3 — Asset Library**: AssetIndex independente, inventory/usage autoritativos, organização, ingest deduplicado e reuso no Cadastro;
- **R4a/R4b — Template System 2.0**: TemplateContract bounded, binding exato e TemplateStore com versões custom append-only;
- **R5a/R5b — Editorial Vocabulary 2.0**: Table image parity e Collection technical detail, com R5 fechado após biópsia;
- **CI-H1 — AssetIndex Write Settlement Gate**: gate assíncrono distingue projeção otimista de settlement autoritativo sem mudar runtime;
- **R6a — Structural Preflight Foundation**: relatório efêmero `ready | review | blocked`, oito checks estruturais e status/painel no Catálogo;
- **R6b — Rendered Description Truncation**: warning `description_truncated` para Card/Collection a partir do sinal explícito já produzido por TextFit, sem segunda medição.

R5 permanece fechado. Não criar `Callout`, Collection 2.0, imagem em `commercialRows`, nesting ou outro primitivo por simetria.

R6 também está fechado após **R6a + R6b**. **Não existe R6c.** A biópsia pós-R6b concluiu que os candidatos restantes exigem authorities/lifecycles diferentes e não devem ser agrupados apenas por proximidade com Preflight.

## Ordem de leitura

1. `docs/v2/START-HERE.md` — bootstrap e fronteiras atuais;
2. `docs/v2/R6-CLOSEOUT.md` — fechamento do milestone, arquitetura final e razão para não existir R6c;
3. `docs/v2/R6-POST-R6B-BIOPSY.md` — comparação dos candidatos restantes e condições de reentrada;
4. `docs/v2/R6B-CLOSEOUT.md` e `R6B-RENDERED-DESCRIPTION-TRUNCATION-INTENT.md` — recorte render-aware final;
5. `docs/v2/R6A-CLOSEOUT.md` e `R6A-STRUCTURAL-PREFLIGHT-FOUNDATION-INTENT.md` — fundação estrutural do Preflight;
6. `docs/v2/ROADMAP.md` — milestones e próximo ponto de decisão;
7. `docs/v2/R5-CLOSEOUT.md` e `CI-H1-ASSET-INDEX-WRITE-SETTLEMENT.md` — fechamento editorial e hardening de CI;
8. closeouts/intents R1–R4 quando precisar de decisões históricas específicas.

## Authorities V2

```text
Biblioteca UI
  ├─ Produtos   -> ProductStore / ProductSnapshot
  ├─ Catálogos  -> CatalogStore / CatalogSnapshot
  ├─ Imagens    -> AssetIndexStore / AssetIndexSnapshot
  └─ Templates  -> TemplateStore / TemplateSnapshot

Bytes de imagem -> AssetStore content-addressed, imutável
Templates runtime -> Templates registry / TemplateContract versionado

Apresentação catalog-local
  ├─ Card       -> catalog.presentation.itemStyles
  ├─ Collection -> catalog.presentation.blocks + itemStyles locais
  ├─ Table      -> catalog.presentation.blocks
  ├─ image selection/framing -> presentation por productId
  └─ ordem editorial -> CatalogOrder

Preflight estrutural
  -> state + CatalogDocument
  -> Preflight.inspect(state)

Preflight render-aware comprovado
  -> preview já finalizado por TextFit
  -> PreflightRender.inspect(root)
  -> merge puro no mesmo PreflightReport
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
  -> structural issues

preview já finalizado por TextFit
  -> PreflightRender.inspect(#catalogPreview)
  -> explicit rendered issues

structural + rendered issues
  -> Preflight.withIssues(...)
  -> canonical ready | review | blocked
  -> existing status/panel
```

Preflight observa authorities existentes. Ele não corrige state, não substitui CatalogDocument e não cria uma segunda materialização.

## Invariantes

- Produto e apresentação permanecem separados.
- Resource identity é estável através de move/rename organizacional.
- Revisions são provider-scoped.
- O Core é sessão materializada de edição, não banco autoritativo de recursos.
- O pipeline A4 continua `state -> CatalogOrder -> CatalogDocument -> preview/print`.
- Catálogos persistem referência exata `templateId + templateVersion`; versão desconhecida falha fechado.
- Versões publicadas de templates custom são imutáveis e append-only.
- TemplateContract continua bounded data: sem HTML/CSS/JS, selectors, stylesheet URLs ou XY arbitrário.
- Preview e print consomem o mesmo CatalogDocument/template resolvido.
- Card, Collection e Table permanecem o vocabulário estrutural top-level estabilizado.
- Collection continua atômica/full-width top-level e sem nesting.
- Table continua fragmentável; capacidades não são inferidas por simetria.
- Image selection/framing continua apresentação por `productId`.
- Assets gerenciados são content-addressed e imutáveis.
- Uso de assets deriva de snapshots persistidos, nunca do Core local.
- `Sem uso` é accounting, não autorização para exclusão física.
- Preflight é efêmero e não possui store/revision.
- Preflight detecta; não muta dados para fazer um issue desaparecer.
- `src/preflight.js` permanece DOM-free.
- `PreflightRender` consome sinais explícitos já materializados; R6b não mede geometria nem executa TextFit novamente.
- Render-aware issue é confiado ao lifecycle do preview atual, após `catalogotop:catalog-rendered`.
- Table não recebe truncation semantics enquanto não houver sinal explícito equivalente.
- Severity não autoriza enforcement de PDF; export policy exige decisão própria.
- Browser geometry gates são evidência específica, não um generic runtime validation engine.
- Physical PDF page parity permanece autoridade do Browser Print Gate, não do DOM vivo.
- Preflight chrome nunca entra no documento print.
- `main` continua somente leitura para a missão V2 atual até decisão explícita de release.

## Preflight estabilizado

### R6a — estrutural

- `template_unavailable` — blocker;
- `catalog_empty` — blocker;
- `selected_product_missing` — blocker;
- `selected_product_inactive` — warning;
- `required_product_fact_missing` — blocker;
- `editorial_block_not_materialized` — warning;
- `image_selection_fallback` — warning;
- `visible_image_missing` — warning.

### R6b — render-aware explícito

- `description_truncated` — warning para Card/Collection quando `data-description-truncated="true"` já foi materializado por TextFit.

R6b preserva `data-full-description`, não injeta reticências e não altera Product truth. Repeated refresh não duplica issues; R6a blockers continuam dominando o status quando coexistem com warnings renderizados.

## Aprendizado relevante de R6b

Não assumir que “mais largura” implica menos truncamento.

No preset `visual`, o Card full também aumenta tipografia; portanto largura e tamanho de texto mudam juntos. O gate final prova reatividade com `contentPreset:'standard'` fixo e varia apenas `simple -> full`, deixando o warning seguir a verdade já produzida pelo TextFit.

Esse achado corrige a premissa do teste, não o design do Card.

## Fechamento de R6

A biópsia pós-R6b avaliou quatro candidatos:

- imagem realmente quebrada após load;
- Table factual visibility/truncation;
- collision/overflow;
- logical vs physical page parity autor-facing.

Nenhum possui hoje a mesma combinação que justificou R6b: sinal explícito já materializado + lifecycle confiável + observação sem segunda authority.

Resumo:

- **imagem quebrada** precisa de settlement/invalidation assíncrono próprio;
- **Table** precisa primeiro de um sinal explícito de factual visibility ou de uma decisão consciente de medir geometria;
- **collision/overflow** precisa de uma classe de defeito bounded, participantes/tolerâncias e timing estável;
- **physical parity** depende do Browser/Chromium/PDF gate e não pode ser fingida pelo editor a partir de DOM page count.

Ver `R6-POST-R6B-BIOPSY.md` e `R6-CLOSEOUT.md`.

## Ambiente de teste V2

O ambiente Netlify V2 é authority operacional separada do Git. Não inferir deploy state a partir de `v2`.

Nenhuma ação Netlify está implícita por uma promoção Git.

## Próximo ponto de decisão

Não existe recorte funcional pré-selecionado após R6.

O próximo slice deve nascer de evidência nova e pode pertencer a publicação, editor, release ou outro eixo. Não usar proximidade no roadmap como autorização.

Se um candidato exigir scanner genérico, nova persistence authority, segunda materialização ou uma capacidade de PDF inexistente no browser runtime, parar e replanejar antes de implementar.