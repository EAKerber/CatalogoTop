# CatalogoTop V2 — Roadmap and dependency order

## Baseline and intent

V2 starts from the stable V1 release:

- `main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9`
- tag `v1.0.0`
- active product-development line: `v2`
- image-generation research remains isolated in `research/semantic-image-variation-v2`

The V2 goal is not to turn CatalogoTop into a free-form page editor. The product remains a constrained catalog-authoring system whose main value is reliable product data, repeatable editorial structures, fast composition, predictable A4 output and low operational friction.

The primary change in V2 is that the app stops treating the current browser session as the center of the product. Products, catalogs, reusable assets and templates become explicit resources that can be found, organized and reopened without collapsing their authorities into one monolithic state object.

## Current milestone status

- **R1 — Product Library Foundation: complete**.
- **R2 — Saved Catalog Documents: complete** after R2a + R2b. See `R2-CLOSEOUT.md`.
- **R3 — Asset Library / reusable media index: complete** after R3a + R3b. See `R3-CLOSEOUT.md`.
- **R4 — Constrained Template System 2.0: next directional planning target, not active/authorized yet**.
- R5+ remain directional and are not authorized merely by appearing in this roadmap.

## Architectural direction — one Library UI, multiple authorities

The visible `Biblioteca` is a single navigation surface, while persistence grows by resource provider rather than through one universal `LibraryStore`.

```text
Biblioteca UI
  ├─ Product provider    -> ProductStore / ProductSnapshot
  ├─ Catalog provider    -> CatalogStore / CatalogSnapshot
  ├─ Asset provider      -> AssetIndexStore / AssetIndexSnapshot + immutable AssetStore
  └─ Template provider   -> future TemplateStore / constrained visual contracts
```

A shared pure `FolderTree` vocabulary may be reused by providers, but folder namespaces and revision authorities remain provider-scoped unless a later real use case proves a global tree is superior.

Reason: saving a catalog should not conflict merely because another client renamed a product folder. Likewise asset metadata should not share the ProductStore or CatalogStore revision.

## Product navigation target

Primary application navigation is:

`Cadastro | Catálogo | Biblioteca`

- `Cadastro` owns creation/editing/duplication of one product at a time and lightweight contextual lookup.
- `Catálogo` owns composition of the current catalog document.
- `Biblioteca` owns finding, organizing, moving, bulk-selecting and destructive resource management.
- `Templates` is not a permanent top-level application tab. Template selection remains available inside `Catálogo`; reusable template management can later appear as a Library provider.

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

### V2-R4 — Constrained Template System 2.0 — NEXT DIRECTIONAL TARGET

Purpose: make templates reusable visual systems rather than hard-coded style choices, without reopening arbitrary HTML/CSS/JS authoring.

Expected responsibilities:

- versioned declarative template contract;
- shared institutional header/footer primitives;
- layout/tokens/allowed structural treatments declared by schema;
- preview and print driven by the same contract;
- template resources become a Library provider;
- validation/migration rules for template revisions.

Before implementation, R4 requires explicit review/planning of the current template/renderer boundary and migration path. Its presence here is not authorization to implement it.

Explicitly out of scope unless separately decided: arbitrary executable templates, arbitrary XY layout, free CSS injection or a generic webpage builder.

### V2-R5 — Editorial Vocabulary 2.0

Purpose: expand expressive power only after the template contract can represent it coherently.

Likely work:

- Collection 2.0 informed by real reference catalogs;
- `Callout` as a fourth primitive only for cases that cannot be modeled cleanly by Card/Collection/Table;
- Table refinements where real cases justify them;
- reusable editorial presets that remain catalog-local or template-defined, never product facts.

No generic container/nesting system by default.

### V2-R6 — Preflight / publication quality gate

Purpose: make “ready to export/publish” an explicit state rather than a visual guess.

Expected checks:

- required product facts and unresolved placeholders;
- missing/unavailable assets;
- invalid editorial blocks or stale references;
- overflow/collision/layout anomalies;
- logical page count vs physical print pages;
- template/resource compatibility;
- preview/print parity;
- clear distinction between blocking errors, warnings and editorial suggestions.

The gate should validate the materialized document; it must not mutate commercial data to make validation pass.

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

## Sequence rationale

R1 came first because every later resource-management workflow benefits from a stable Library/folder vocabulary.

R2 came before major template/editor work because reopenable catalog identity is a prerequisite for meaningful template migration, version compatibility and preflight history.

R3 precedes richer templates because reusable assets should have stable references before templates begin to depend on them.

R4 precedes major new editorial primitives because layout capabilities should be constrained by an explicit template contract rather than accumulated as one-off renderer exceptions.

R6 follows the stabilization of those contracts so preflight can validate authoritative structures rather than temporary V1 compatibility shims.

This order is directional, not a promise to implement every item unchanged. A recut may be split when uncertainty is high; large adjacent concerns should not be silently pulled forward merely because implementation touches the same files.
