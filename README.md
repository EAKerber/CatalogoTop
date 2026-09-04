# CatalogoTop

Gerador simplificado e determinístico de catálogos A4 para a Top Mobili.

## Linhas do produto

- **V1 estável:** `main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9`, tag `v1.0.0`.
- **Linha atual de evolução e validação:** `v2`.
- **Authority V2 no início deste housekeeping:** `v2@6112cef148db2f294cd73a1ded05e31fb858f74b`.

A V1 permanece preservada em `main`; o desenvolvimento V2 não deve ser inferido a partir do README ou deploy de `main`.

Para arquitetura, decisões atuais, milestones e guardrails V2, comece por **[`docs/v2/START-HERE.md`](docs/v2/START-HERE.md)** e depois consulte **[`docs/v2/ROADMAP.md`](docs/v2/ROADMAP.md)**.

## Estado V2

R1–R6 estão completos. Não existe R6c e nenhum R7 está pré-selecionado.

A linha V2 consolidou:

- **Product Library Foundation** — ProductSnapshot/ProductStore provider-scoped, folders, busca, Cadastro contextual e administração da Biblioteca;
- **Saved Catalog Documents** — CatalogSnapshot/CatalogStore independentes, save/open/duplicate, folders e dirty-state;
- **Asset Library** — AssetIndex separado dos bytes imutáveis content-addressed, ingest/dedup, organização, accounting e reuso;
- **Template System 2.0** — TemplateContract bounded, binding exato e TemplateStore com versões custom imutáveis/append-only;
- **Editorial Vocabulary 2.0** — Card, Collection e Table como vocabulário top-level estabilizado;
- **Preflight / Publication Quality** — checks estruturais + warning render-aware de truncamento explícito para Card/Collection;
- hardening de CI para settlement assíncrono e lifecycle do inspector;
- coerência recente das listas de produto: controles alinhados, miniaturas em Biblioteca/Cadastro e linha do Cadastro como alvo de edição.

O próximo recorte funcional deve nascer de evidência real de uso/editor/publicação/release. Não criar milestone, primitivo, persistence authority ou scanner genérico apenas para continuar a sequência do roadmap.

## Modelo editorial

O princípio central continua menor que um editor livre:

```text
state
  -> CatalogOrder
  -> CatalogDocument
  -> preview / print
```

- `selectedIds` representa membership do catálogo;
- `catalog.presentation.order` representa ordem editorial;
- `Card`, `Collection` e `Table` são as primitivas top-level atuais;
- produto e apresentação permanecem separados;
- preview e print partem da mesma materialização;
- o documento de impressão permanece A4 físico `210 × 297 mm`.

## Resources e authorities V2

```text
Biblioteca UI
  ├─ Produtos   -> ProductStore / ProductSnapshot
  ├─ Catálogos  -> CatalogStore / CatalogSnapshot
  ├─ Imagens    -> AssetIndexStore / AssetIndexSnapshot
  └─ Templates  -> TemplateStore / TemplateSnapshot

Bytes de imagem -> AssetStore content-addressed, imutável
Templates runtime -> Templates registry / TemplateContract versionado
```

Shared UI não implica shared persistence. Revisions e identities permanecem provider-scoped.

## Imagens

- `product.image` é o Original canônico;
- `product.imageGallery` contém alternativas fiéis reutilizáveis do produto;
- `presentation.imageSelections` e `presentation.imageFrames` são apresentação local por `productId`;
- derivados locais do catálogo não são promovidos automaticamente ao ProductStore;
- ZIPs externos são entrada não confiável e devem permanecer fail-closed/transacionais conforme os contratos existentes.

O experimento antigo de variações externas foi retirado da V1 estável. Qualquer nova integração externa de imagem na V2 exige decisão explícita de produto e contrato próprio; trabalho exploratório deve permanecer isolado até existir evidência suficiente.

## Preflight

R6 estabilizou um observador pequeno, não um framework genérico de validação:

```text
state + CatalogDocument
  -> Preflight.inspect(state)

preview já finalizado por TextFit
  -> PreflightRender.inspect(root)

issues
  -> Preflight.withIssues(...)
  -> ready | review | blocked
```

Preflight não corrige state, não cria segunda materialização e não transforma heurísticas de Browser/CI em semântica runtime por simetria.

## Netlify e deploy

Git e deploy são authorities operacionais separadas.

- promoção para `v2` **não prova** que o endereço publicado está servindo o mesmo SHA;
- para revisão corrente da linha V2, o alvo de produção pretendido é a branch `v2`;
- antes de validar visualmente uma mudança, confirme branch + SHA do deploy no Netlify;
- Deploy Preview/branch deploy não deve escrever no store global de produção.

A política e o histórico observado estão em [`docs/netlify.md`](docs/netlify.md).

## Execução local

Não há build obrigatório para o frontend. Sirva a pasta por HTTP e abra `index.html`.

```bash
python -m http.server 8000
```

A importação Excel usa SheetJS via CDN; CSV e o restante da aplicação continuam funcionais sem essa dependência externa.

## Validação e promoção V2

```bash
npm test
```

Mudanças funcionais devem usar branch dedicada e PR contra `v2`. O caminho normal exige Validate + Browser Print Gate verdes no mesmo head, readback de base/head/mergeability e promoção protegida. `main` continua fora do fluxo rotineiro da V2 até decisão explícita de release.

## Entry points

- [`docs/v2/START-HERE.md`](docs/v2/START-HERE.md) — authority e fronteiras atuais;
- [`docs/v2/ROADMAP.md`](docs/v2/ROADMAP.md) — milestones e próximo ponto de decisão;
- [`docs/v2/R6-CLOSEOUT.md`](docs/v2/R6-CLOSEOUT.md) — último milestone funcional fechado;
- [`docs/v2/R6-POST-R6B-BIOPSY.md`](docs/v2/R6-POST-R6B-BIOPSY.md) — candidatos parked e condições de reentrada;
- [`AGENTS.md`](AGENTS.md) — guardrails operacionais e arquiteturais;
- [`docs/netlify.md`](docs/netlify.md) — publicação e storage Netlify;
- [`docs/v1-stable.md`](docs/v1-stable.md) — fronteira da V1 estável.
