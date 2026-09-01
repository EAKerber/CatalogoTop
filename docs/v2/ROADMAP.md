# CatalogoTop V2 — Roadmap and dependency order

## Baseline and intent

V2 starts from the stable V1 release:

- `main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9`
- tag `v1.0.0`
- active product-development line: `v2`
- authority before the R5 documentary closeout: `v2@c370708fd8c4a538398e9ae9d2ea85c2ffd01cc6`
- image-generation research remains isolated in `research/semantic-image-variation-v2`

The V2 goal is not to turn CatalogoTop into a free-form page editor. The product remains a constrained catalog-authoring system whose main value is reliable product data, repeatable editorial structures, fast composition, predictable A4 output and low operational friction.

The primary change in V2 is that the app stops treating the current browser session as the center of the product. Products, catalogs, reusable assets and templates are explicit resources that can be found, organized and reopened without collapsing their authorities into one monolithic state object.

## Current milestone status

- **R1 — Product Library Foundation: complete**.
- **R2 — Saved Catalog Documents: complete** after R2a + R2b. See `R2-CLOSEOUT.md`.
- **R3 — Asset Library / reusable media index: complete** after R3a + R3b. See `R3-CLOSEOUT.md`.
- **R4 — Constrained Template System 2.0: complete** after R4a + R4b.
  - **R4a — Template Contract & Versioned Binding: complete**. See `R4A-TEMPLATE-CONTRACT-INTENT.md` and `R4A-CLOSEOUT.md`.
  - **R4b — Template Library & Immutable Versions: complete**. See `R4B-TEMPLATE-LIBRARY-VERSIONS-INTENT.md` and `R4B-CLOSEOUT.md`.
- **R5 — Editorial Vocabulary 2.0: complete** after biopsy-driven R5a + R5b. See `R5-CLOSEOUT.md`.
  - **R5a — Table Row Image Editing Parity: complete**, promoted in `v2@798c8f6d292138e669d7943f65ee8bf99e740761`.
  - **R5b — Collection Technical Detail: complete**, promoted in `v2@a6e461086420733edea162f91da35668c3225a2e`. See `R5B-CLOSEOUT.md`.
  - **No R5c**: the post-R5b biopsy found no additional concrete editorial gap with enough evidence to justify another recut.
- **R6 — Preflight / Publication Quality: next milestone; planning/intent required before functional implementation**.
- R7+ remain directional and are not authorized merely by appearing in this roadmap.

The same closure rule applies across milestones: do not create R4c, R5c, `Callout`, Collection 2.0 or another abstraction for symmetry. A future editorial recut may reopen the vocabulary only when an irreducible observed case exists.

## Architectural direction — one Library UI, multiple authorities

The visible `Biblioteca` is a single navigation surface, while persistence grows by resource provider rather than through one universal `LibraryStore`.

```text
Biblioteca UI
  ├─ Product provider    -> ProductStore / ProductSnapshot
  ├─ Catalog provider    -> CatalogStore / CatalogSnapshot
  ├─ Asset provider      -> AssetIndexStore / AssetIndexSnapshot + immutable AssetStore
  └─ Template provider   -> TemplateStore / TemplateSnapshot

Renderer-facing template projection -> Templates registry / TemplateContract
Built-in templates -> application-owned immutable contracts
```

A shared pure `FolderTree` vocabulary may be reused by providers, but folder namespaces and revision authorities remain provider-scoped unless a later real use case proves a global tree is superior. R4b deliberately keeps template resources flat.

Reason: saving a catalog should not conflict merely because another client renamed a product folder. Likewise asset metadata and template publication should not share ProductStore or CatalogStore revisions.

## Product navigation target

Primary application navigation is:

`Cadastro | Catálogo | Biblioteca`

- `Cadastro` owns creation/editing/duplication of one product at a time and lightweight contextual lookup.
- `Catálogo` owns composition of the current catalog document.
- `Biblioteca` owns finding, organizing and administering resource providers.
- `Templates` is not a top-level application tab; reusable template management lives inside `Biblioteca`, while template selection remains available inside `Catálogo`.

## Dependency roadmap

### V2-R1 — Product Library Foundation — COMPLETE

Purpose: establish stable hierarchical organization for products and split product authoring from product administration without changing the A4 renderer.

Core deliverables:

- provider-scoped `FolderTree` domain;
- `ProductSnapshot v2` with `folders[]` + `products[].folderId`;
- deterministic migration from legacy `category/subcategory`;
- shared recursive `ProductQuery`;
- explicit `cloneAsNewProduct` / `Usar como base`;
- `Cadastro | Catálogo | Biblioteca` shell;
- Product Library UI with move/bulk/destructive operations;
- V1 renderer compatibility through derived legacy mirrors.

The detailed intent contract lives in `R1-PRODUCT-LIBRARY-INTENT.md`.

### V2-R2 — Saved Catalog Documents — COMPLETE

Purpose: make a catalog an explicit reopenable resource instead of only a transient local session/backup.

Delivered through R2a + R2b:

- stable catalog ID/metadata;
- create/open/save/duplicate catalog;
- independent optimistic revision/readback/cache/conflict semantics;
- catalog folders in the Library;
- catalog-local composition state separate from product truth;
- explicit dirty/saved state;
- compatible migration/import from current session/backup shape;
- current A4 materialization remains `state/catalog record -> CatalogOrder -> CatalogDocument -> preview/print`.

See `R2-SAVED-CATALOGS-INTENT.md`, `R2B-CATALOG-LIBRARY-ADMIN-INTENT.md` and `R2-CLOSEOUT.md`.

### V2-R3 — Asset Library / reusable media index — COMPLETE

Purpose: turn the existing content-addressed blob store into a usable resource system without losing immutability/deduplication.

Delivered responsibilities:

- metadata/index separate from immutable blob bytes;
- reusable managed image references;
- provider-scoped foldering/search/usage information;
- authoritative current-reference accounting without conflating `Sem uso` with deletion safety;
- product images and catalog-local variants can reference the same immutable content;
- no automatic deletion of a hash merely because one product/resource stopped referencing it.

This recut reuses AssetStore rather than replacing it.

#### R3a — Asset Inventory & Reuse Foundation — COMPLETE

Delivered first vertical:

- separate `AssetIndexSnapshot` / `AssetIndexStore` authority;
- inventory = indexed assets union managed hashes referenced by persisted ProductSnapshot/CatalogSnapshot;
- derived usage projection rather than persisted usage counters;
- `Imagens` provider inside Biblioteca;
- human label editing;
- reuse of an existing managed asset from Cadastro without re-upload/copy;
- no blob deletion/GC.

Detailed contract: `R3A-ASSET-INVENTORY-REUSE-INTENT.md`.

#### R3b — Asset Organization & Ingest — COMPLETE

Delivered operationalization:

- provider-scoped folder tree using the `folders[]`/`folderId` already reserved in AssetIndexSnapshot v1;
- recursive folder scope plus virtual `Sem pasta`;
- `Todos | Em uso | Sem uso` accounting filter derived from authoritative usages;
- multiselect and batch move;
- adoption into the index of assets previously discovered only by Product/Catalog usage;
- standalone image upload through the existing `AssetClient.prepareImage` + `/api/assets` path;
- physical hash deduplication with metadata registration kept separate;
- local pending metadata projection without inventing local usage;
- mobile `Pastas | Imagens`, preserving `Imagens` as the initial/picker view;
- no physical delete and no garbage collection.

Detailed contract: `R3B-ASSET-ORGANIZATION-INGEST-INTENT.md`.

The post-R3b closure audit found no concrete functional gap requiring a destructive R3c. Garbage collection remains a future retention/cleanup decision, not an unfinished R3 requirement. See `R3-CLOSEOUT.md`.

### V2-R4 — Constrained Template System 2.0 — COMPLETE

Purpose: make templates reusable visual systems rather than hard-coded style choices, without reopening arbitrary HTML/CSS/JS authoring.

R4 closed after two staged recuts. R4a established the bounded language and exact persisted binding; R4b added persistent reusable resources and immutable custom version history. The post-R4b audit found no concrete reason for R4c.

#### R4a — Template Contract & Versioned Binding — COMPLETE

Delivered responsibilities:

- `TemplateContract v1`, strict bounded data-only contract;
- immutable built-ins `technical@1`, `compact@1`, `showcase@1`;
- `perPage` derived from rows × columns;
- persisted exact `templateId + templateVersion` binding;
- Core schema 9 and CatalogSnapshot v2 deterministic migration;
- unknown ID/version combinations fail closed rather than silently changing visual system;
- content budgets/layout behavior driven by contract properties/tokens rather than template-ID runtime branches;
- shared institutional chrome extracted behind application-owned `DocumentChrome`, initial primitive `top-mobili-v1`;
- preview and print driven by the same resolved template contract;
- existing physical A4 behavior preserved.

Detailed contract: `R4A-TEMPLATE-CONTRACT-INTENT.md`. Closure: `R4A-CLOSEOUT.md`.

#### R4b — Template Library & Immutable Versions — COMPLETE

Delivered responsibilities:

- independent `TemplateSnapshot` / `TemplateStore` revision authority;
- backend `/api/templates`, provider-specific optimistic revision/readback/history and independent IndexedDB cache;
- `Biblioteca > Templates`, without a new primary application tab;
- built-ins exposed as immutable sources/presets without copying them into TemplateSnapshot;
- duplicate built-in/custom version into a local custom draft with zero write until publish;
- first publication creates custom v1;
- editing latest appends exactly the next immutable version and preserves historical versions;
- runtime registry resolves built-ins and exact historical custom versions;
- catalog selector binds `templateId + templateVersion` atomically;
- historical catalog binding never silently upgrades to latest;
- bounded editor limited to TemplateContract-supported values;
- no template folders, delete, GC, arbitrary executable templates, free CSS or XY authoring;
- custom preview/print remains on the same A4 materialization pipeline;
- mobile Library behavior remains regression-gated.

Final feature head `662957c3839c17e550354d3242eb056fbf9bf63d` passed Validate #1063 and Browser #874. PR #62 passed Validate #1064 and Browser #875 on the same head and was squash-merged with expected-head protection into `v2@7f6046f7448ff4f1b80082c8aa176d7e75798b24`.

Detailed contract: `R4B-TEMPLATE-LIBRARY-VERSIONS-INTENT.md`. Closure: `R4B-CLOSEOUT.md`.

### V2-R5 — Editorial Vocabulary 2.0 — COMPLETE

Purpose: expand expressive power through observed catalog/editor gaps while preserving the constrained structural vocabulary and explicit TemplateContract established by R4.

R5 did **not** implement a predetermined Collection 2.0, Callout or generic editor. Each delivered recut was selected independently after a concrete case proved a missing capability.

#### R5a — Table Row Image Editing Parity — COMPLETE

Observed gap: a products-source Table could display an image column, but selecting a Table row did not expose the same single-image selection/framing controls already available to Card and Collection members.

Delivered behavior:

- eligible target is `table-row` in a `rowSource:'products'` Table with the `image` column active;
- reuses existing `presentation.imageSelections[productId]` and `presentation.imageFrames[productId]`;
- Table image cells receive the same selected image and non-destructive framing projection;
- inspector reuses existing single-image controls;
- `commercialRows` remains outside the image-editing contract;
- no row-scoped/placement-scoped image authority was introduced;
- no schema, ProductStore, TableBlock, CatalogDocument or pagination redesign.

Promoted through PR #64 into `v2@798c8f6d292138e669d7943f65ee8bf99e740761`.

Detailed contract: `R5A-TABLE-ROW-IMAGE-EDITING-INTENT.md`.

#### R5b — Collection Technical Detail — COMPLETE

Observed gap: grouping products into a visual Collection preserved the family but removed the small factual technical context available in `product.specs`.

Delivered behavior:

- fourth Collection preset `technical` / `Técnico`;
- pure `Collection.technicalDetailFor(product, style)` projection;
- only non-empty factual spec values are eligible;
- spec order remains product order;
- bounded budget derives from existing local width:
  - `simple`: 1;
  - `wide`: 2;
  - `full`: 2;
- no invented placeholder for members without specs;
- no dynamic DOM measurement or page-layout heuristic;
- existing local width/emphasis and image selection/framing remain active;
- Collection remains full-width top-level and atomic;
- no ProductStore/schema/CatalogOrder/CatalogDocument/TemplateContract change.

Final feature head `2476d6edd64e168c4dbdd8ef5f00eeadec0aeaa0` passed Validate #1083 and Browser #894. PR #65 passed Validate #1084 and Browser #895 on the same head and was squash-merged with expected-head protection into `v2@a6e461086420733edea162f91da35668c3225a2e`.

Detailed contract: `R5B-COLLECTION-TECHNICAL-DETAIL-INTENT.md`. Closure: `R5B-CLOSEOUT.md`.

#### R5 closure decision

The post-R5b biopsy did not find another concrete editorial gap with evidence comparable to R5a/R5b:

- Table already has products/commercial row sources, semantic columns, density, elastic widths, commercial price styles, deterministic fragmentation and products-row image framing;
- Collection already has four bounded presets, theme, local width/emphasis/price style and shared product image framing;
- image support for `commercialRows` would require an unresolved product/row/placement authority decision;
- no observed case requires a fourth top-level `Callout` primitive rather than current Card/Collection/Table vocabulary.

Therefore R5 closes after R5a + R5b. Future editorial work can reopen the vocabulary only from new real-case evidence. See `R5-CLOSEOUT.md`.

### CI-H1 — AssetIndex write-settlement gate — NEXT HYGIENE RECUT

This is CI debt, not a product milestone.

Observed race:

- `AssetIndexStore.publishCandidate()` exposes the optimistic candidate snapshot with `pendingWrite=true` before remote persistence completes and revision advances;
- the R3b Browser Asset Library gate historically waits only until the uploaded asset appears in the snapshot, then immediately asserts the new revision;
- the test can therefore observe the correct optimistic asset with the previous revision.

Required fix:

- preserve runtime optimistic semantics;
- update the gate to wait for `AssetIndexStore.hasPendingWrite() === false` before asserting revision after an index-changing upload;
- keep dedup behavior and post counts unchanged;
- rerun canonical Validate + Browser gates on the same head.

### V2-R6 — Preflight / Publication Quality — NEXT PRODUCT MILESTONE

Purpose: make “ready to export/publish” an explicit, inspectable state rather than a visual guess.

The post-R5 biopsy found stronger evidence for publication observability than for additional editorial primitives. Existing runtime behavior already exposes useful signals:

- TextFit can truncate product descriptions and records truncation on the rendered element;
- missing product images render the `SEM IMAGEM` placeholder;
- stale/invalid persisted editorial blocks can fail materialization and fall back to individual Cards;
- obsolete image selections resolve deterministically to the Original;
- template bindings already fail closed;
- physical browser gates already compare logical/physical output and A4 geometry.

R6 must begin with a planning/intent pass and then a bounded first vertical. Do not implement every expected check at once.

Expected eventual checks include:

- required product facts and unresolved placeholders;
- missing/unavailable assets;
- invalid editorial blocks or stale references;
- overflow/truncation/collision/layout anomalies;
- logical page count vs physical print pages;
- template/resource compatibility;
- preview/print parity;
- clear distinction between blocking errors, warnings and editorial suggestions.

The gate should inspect the materialized document and related explicit signals. It must not mutate commercial facts or editorial state to make validation pass.

A likely first vertical is a pure issue model (`code`, `severity`, `scope`, resource reference/message) plus structural checks that do not depend on DOM measurement. DOM/physical checks can follow in a later recut.

## Optional research reintegration — semantic image variation

The image-variation research branch is deliberately not on the critical path above.

A future capability may re-enter V2 only when research provides:

- a placement-aware intent contract;
- fidelity invariants;
- a useful quality benchmark, including “do not generate” cases;
- explicit approval semantics;
- a compatibility seam into `presentation.imageVariants` / `product.imageGallery` without overwriting `product.image`.

Transport success alone is not sufficient.

## Cross-cutting invariants for all V2 recuts

1. `main` remains the stable V1 production line until an explicit V2 release decision.
2. Product truth and presentation truth stay separate.
3. Resource identity is stable; move/rename operations change metadata/path, not identity.
4. Revisions are scoped to their resource authority; avoid one global write-conflict domain.
5. Shared UI does not imply shared persistence.
6. Migration from V1 must be deterministic and testable.
7. Subtractive/unifying solutions are valid; do not preserve obsolete V1 UI merely because code exists.
8. A4 renderer/pagination changes require their own explicit recut and physical browser gates.
9. No free-form editor, generic nesting or arbitrary executable template system without a new product decision.
10. Browser-local session state is not a substitute for saved-resource persistence.
11. Content-addressed asset bytes remain immutable; metadata/index lifecycle must not rewrite or silently garbage-collect blobs.
12. Usage/accounting must derive from authoritative resource snapshots rather than transient Core/session projections.
13. `Sem uso` is an accounting state, not proof that a blob is safe to delete.
14. Saved catalogs bind to an exact template ID/version and must not silently fall back or auto-upgrade to another visual system.
15. Persisted template resources remain bounded data validated by the application-owned TemplateContract.
16. Published custom template versions are immutable and append-only; registry projection is not persistence authority.
17. Card, Collection and Table remain the default top-level structural vocabulary; new primitives require irreducible observed cases.
18. R5 stabilized catalog-local presentation authorities; future validation should observe them rather than replace them with corrective side effects.
19. Preflight/quality checks must distinguish detection from mutation. A failing check is not permission to rewrite product or catalog truth.

## Sequence rationale

R1 came first because every later resource-management workflow benefits from a stable Library/folder vocabulary.

R2 came before major template/editor work because reopenable catalog identity is a prerequisite for meaningful template migration, version compatibility and preflight history.

R3 precedes richer templates because reusable assets should have stable references before templates begin to depend on them.

R4a preceded template-resource persistence because the language and version binding needed to be trustworthy before TemplateStore could save it. R4b then added reusable template resources without inventing a second template model. R4 is closed.

R5 followed R4 so new editorial vocabulary could be constrained by an explicit template contract rather than accumulated as one-off renderer exceptions. R5a and R5b demonstrated the intended pattern: identify one observed asymmetry, reuse an existing authority, gate the bounded change, then return to biopsy. The post-R5b biopsy found no justified R5c, so R5 is closed.

CI-H1 is intentionally separated from product milestones because it hardens an old asynchronous gate assumption without changing runtime semantics.

R6 follows stabilization/closure of the editorial contracts so preflight can validate authoritative structures rather than temporary compatibility shims.

This order is directional, not a promise to implement every item unchanged. A recut may be split when uncertainty is high; large adjacent concerns should not be silently pulled forward merely because implementation touches the same files.
