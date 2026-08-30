# CatalogoTop V2 — Roadmap and dependency order

## Baseline and intent

V2 starts from the stable V1 release:

- `main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9`
- tag `v1.0.0`
- active product-development line: `v2`
- image-generation research remains isolated in `research/semantic-image-variation-v2`

The V2 goal is not to turn CatalogoTop into a free-form page editor. The product remains a constrained catalog-authoring system whose main value is reliable product data, repeatable editorial structures, fast composition, predictable A4 output and low operational friction.

The primary change in V2 is that the app stops treating the current browser session as the center of the product. Products, catalogs, reusable assets and templates become explicit resources that can be found, organized and reopened without collapsing their authorities into one monolithic state object.

## Architectural direction — one Library UI, multiple authorities

The visible `Biblioteca` can become a single navigation surface, but persistence should grow by resource provider rather than through one universal `LibraryStore`.

```text
Biblioteca UI
  ├─ Product provider    -> ProductStore / ProductSnapshot
  ├─ Catalog provider    -> future CatalogStore / CatalogDocument records
  ├─ Asset provider      -> future AssetIndex over content-addressed AssetStore
  └─ Template provider   -> future TemplateStore / constrained visual contracts
```

A shared pure `FolderTree` vocabulary may be reused by providers, but folder namespaces and revision authorities remain provider-scoped unless a later real use case proves a global tree is superior.

Reason: saving a catalog should not conflict merely because another client renamed a product folder. Likewise template lifecycle should not become coupled to product revision numbers.

## Product navigation target

Primary application navigation evolves toward:

`Cadastro | Catálogo | Biblioteca`

- `Cadastro` owns creation/editing/duplication of one product at a time and lightweight contextual lookup.
- `Catálogo` owns composition of the current catalog document.
- `Biblioteca` owns finding, organizing, moving, bulk-selecting and destructive resource management.
- `Templates` is not a permanent top-level application tab. Template selection remains available inside `Catálogo`; reusable template management can later appear as a Library provider.

## Dependency roadmap

### V2-R1 — Product Library Foundation

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

### V2-R2 — Saved Catalog Documents

Purpose: make a catalog an explicit reopenable resource instead of only a transient local session/backup.

Expected responsibilities:

- stable catalog ID and metadata;
- create/open/save/duplicate catalog;
- optimistic revision/readback semantics analogous to the proven ProductStore pattern, but in a separate authority;
- catalog folders in the Library using the shared folder vocabulary;
- catalog-local composition state remains separate from product truth;
- explicit dirty/saved state;
- migration/import from the current session/backup shape;
- current A4 materialization remains `state/catalog record -> CatalogOrder -> CatalogDocument -> preview/print`.

Do not make ProductStore revision the revision of a catalog.

### V2-R3 — Asset Library / reusable media index

Purpose: turn the existing content-addressed blob store into a usable resource system without losing immutability/deduplication.

Expected responsibilities:

- metadata/index separate from immutable blob bytes;
- reusable image/logo/media references;
- foldering/search/usage information;
- safe orphan/reference accounting before any garbage collection;
- product images and future catalog assets can reference the same immutable content;
- no automatic deletion of a hash merely because one product/resource stopped referencing it.

This recut should reuse AssetStore rather than replace it.

### V2-R4 — Constrained Template System 2.0

Purpose: make templates reusable visual systems rather than hard-coded style choices, without reopening arbitrary HTML/CSS/JS authoring.

Expected responsibilities:

- versioned declarative template contract;
- shared institutional header/footer primitives;
- layout/tokens/allowed structural treatments declared by schema;
- preview and print driven by the same contract;
- template resources become a Library provider;
- validation/migration rules for template revisions.

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

## Sequence rationale

R1 comes first because every later resource-management workflow benefits from a stable Library/folder vocabulary.

R2 comes before major template/editor work because reopenable catalog identity is a prerequisite for meaningful template migration, version compatibility and preflight history.

R3 precedes richer templates because reusable assets should have stable references before templates begin to depend on them.

R4 precedes major new editorial primitives because layout capabilities should be constrained by an explicit template contract rather than accumulated as one-off renderer exceptions.

R6 follows the stabilization of those contracts so preflight can validate authoritative structures rather than temporary V1 compatibility shims.

This order is directional, not a promise to implement every item unchanged. A recut may be split when uncertainty is high; large adjacent concerns should not be silently pulled forward merely because implementation touches the same files.
