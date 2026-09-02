# CatalogoTop V2 — Start Here

Branch principal de evolução: **`v2`**  
Baseline estável V1: **`main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9` / tag `v1.0.0`**.

## Estado atual

A linha V2 concluiu R1, R2, R3, **R4 — Constrained Template System 2.0**, **R5 — Editorial Vocabulary 2.0** e o primeiro recorte de R6.

Authority funcional promovida:

- `v2@4a7dfbdaeb5bcf918c29a764d862956b0e120d3b` — **R6a Structural Preflight Foundation**;
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

R6a está completo. **Não existe R6b predefinido.** O próximo passo é biópsia pós-R6a dos sinais render-aware antes de selecionar outro recorte.

## Ordem de leitura

1. `docs/v2/START-HERE.md` — bootstrap e fronteiras atuais;
2. `docs/v2/R6A-CLOSEOUT.md` — authority promovida, gates e estado pós-R6a;
3. `docs/v2/R6A-STRUCTURAL-PREFLIGHT-FOUNDATION-INTENT.md` — contrato final do Preflight estrutural;
4. `docs/v2/ROADMAP.md` — milestones e próximo ponto de decisão;
5. `docs/v2/R5-CLOSEOUT.md` — fechamento do vocabulário editorial;
6. `docs/v2/CI-H1-ASSET-INDEX-WRITE-SETTLEMENT.md` — hardening da race conhecida do AssetIndex gate;
7. closeouts/intents R1–R4 quando precisar de decisões históricas específicas.

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

Preflight
  └─ projeção efêmera de state + CatalogDocument; não é persistence authority
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
  -> PreflightReport
  -> status/painel autor-facing
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
- R6a não desabilita/intercepta PDF por causa da primeira taxonomia de blockers.
- `src/preflight.js` não mede DOM.
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

## Ambiente de teste V2

O ambiente Netlify V2 é autoridade operacional separada do Git. Não inferir deploy state a partir do branch `v2`.

O reseed histórico a partir da V1 foi one-shot; nenhuma scheduled function ou endpoint de migração faz parte do runtime atual.

Nenhuma ação Netlify está implícita por uma promoção Git.

## Backup legado

Backup JSON continua sendo transporte compatível do estado monolítico legado e passa por `Core.migrate`. Não é uma authority V2.

## Próximo ponto de decisão — biópsia pós-R6a

Não nomear R6b por sequência numérica.

O candidato mais forte é uma camada **render-aware** porque já existem sinais concretos fora do domínio estrutural puro:

- TextFit registra truncamento no elemento renderizado;
- browser gates verificam geometria A4 e páginas físicas;
- falhas de carregamento de imagem só são conhecidas depois da resolução/render;
- overflow/collision dependem de geometria real.

Antes de implementar outro recorte, determinar quais desses sinais são estáveis, úteis ao autor e podem ser projetados para o mesmo `PreflightReport` sem:

- criar um segundo CatalogDocument;
- copiar heurísticas frágeis de teste para runtime;
- introduzir um rules engine genérico;
- persistir resultados efêmeros;
- transformar warning observacional em enforcement sem decisão explícita.

Ver `R6A-CLOSEOUT.md` antes da próxima biópsia.
