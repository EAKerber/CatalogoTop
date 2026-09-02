# CatalogoTop V2 — Roadmap and dependency order

## Baseline and intent

Stable V1 authority:

- `main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9`;
- tag `v1.0.0` at the same SHA.

Active V2 product-development line:

- `v2`;
- current functional authority after R6a: `v2@4a7dfbdaeb5bcf918c29a764d862956b0e120d3b`.

The V2 goal is not to turn CatalogoTop into a free-form page editor. The product remains a constrained catalog-authoring system centered on reliable product data, reusable resources, bounded editorial structures, deterministic A4 composition and explicit publication quality.

A roadmap slot is directional, not automatic authorization. Recut names do not justify abstractions by symmetry.

## Current milestone status

- **R1 — Product Library Foundation: COMPLETE**.
- **R2 — Saved Catalog Documents: COMPLETE** after R2a + R2b.
- **R3 — Asset Library / reusable media index: COMPLETE** after R3a + R3b.
- **R4 — Constrained Template System 2.0: COMPLETE** after R4a + R4b.
- **R5 — Editorial Vocabulary 2.0: COMPLETE** after biopsy-driven R5a + R5b; no R5c.
- **CI-H1 — AssetIndex Write Settlement Gate: COMPLETE** as CI/test hygiene.
- **R6 — Preflight / Publication Quality: ACTIVE**.
  - **R6a — Structural Preflight Foundation: COMPLETE**, promoted in `v2@4a7dfbdaeb5bcf918c29a764d862956b0e120d3b`.
  - no R6b selected yet; next step is post-R6a biopsy.
- R7+ remain directional and are not authorized merely by appearing in historical plans or future discussions.

## Architectural direction — one Library UI, multiple authorities

```text
Biblioteca UI
  ├─ Product provider    -> ProductStore / ProductSnapshot
  ├─ Catalog provider    -> CatalogStore / CatalogSnapshot
  ├─ Asset provider      -> AssetIndexStore / AssetIndexSnapshot + immutable AssetStore
  └─ Template provider   -> TemplateStore / TemplateSnapshot

Renderer-facing template projection -> Templates registry / TemplateContract
Built-in templates -> application-owned immutable contracts
```

Shared UI does not imply shared persistence. A shared pure `FolderTree` vocabulary may be reused, but namespaces/revisions stay provider-scoped until a real case proves otherwise.

Primary application navigation remains:

`Cadastro | Catálogo | Biblioteca`

- Cadastro owns creation/editing of one product at a time.
- Catálogo owns composition of the current document and Preflight presentation.
- Biblioteca owns finding/organizing/administering reusable resources.

## Authoritative document pipeline

```text
state
  -> CatalogOrder
  -> CatalogDocument
  -> preview / print

state + CatalogDocument
  -> Preflight.inspect(state)
  -> PreflightReport
  -> author-facing status / issues
```

Preflight observes the document authority; it does not replace it or repair it.

## V2-R1 — Product Library Foundation — COMPLETE

Purpose: establish stable hierarchical organization for products and split product authoring from product administration without changing the A4 renderer.

Delivered:

- provider-scoped folder vocabulary;
- `ProductSnapshot v2` with folders and stable product identity;
- deterministic legacy migration;
- recursive product query;
- explicit clone-as-new-product flow;
- Cadastro / Catálogo / Biblioteca shell;
- Product Library administration;
- V1 renderer compatibility through derived legacy mirrors.

Detailed authority: `R1-PRODUCT-LIBRARY-INTENT.md`.

## V2-R2 — Saved Catalog Documents — COMPLETE

Purpose: make catalogs reopenable resources rather than transient browser sessions/backups.

Delivered:

- stable catalog identity/metadata;
- independent `CatalogStore`/`CatalogSnapshot` revision authority;
- create/open/save/duplicate;
- catalog folders and Library administration;
- dirty/saved state;
- catalog-local composition separate from product truth;
- deterministic migration/import compatibility;
- unchanged `CatalogOrder -> CatalogDocument` A4 path.

See `R2-SAVED-CATALOGS-INTENT.md`, `R2B-CATALOG-LIBRARY-ADMIN-INTENT.md` and `R2-CLOSEOUT.md`.

## V2-R3 — Asset Library / reusable media index — COMPLETE

Purpose: make content-addressed image blobs discoverable/reusable without losing immutability/deduplication.

Delivered:

- AssetIndex authority separate from immutable AssetStore bytes;
- indexed/discovered inventory union;
- usage derived from authoritative Product/Catalog snapshots;
- image folders/search/accounting;
- standalone ingest and physical deduplication;
- reuse from Cadastro;
- mobile Library flow;
- no automatic physical delete/GC.

`Sem uso` remains accounting, not proof a blob is safe to delete.

The post-R3b audit found no concrete need for a destructive R3c. See `R3-CLOSEOUT.md`.

## V2-R4 — Constrained Template System 2.0 — COMPLETE

Purpose: make templates reusable visual systems without arbitrary HTML/CSS/JS or XY authoring.

### R4a — Template Contract & Versioned Binding — COMPLETE

Delivered:

- bounded `TemplateContract v1`;
- immutable built-ins;
- exact persisted `templateId + templateVersion`;
- fail-closed unknown bindings;
- declarative layout/content budgets;
- app-owned document chrome;
- same resolved template for preview and print.

### R4b — Template Library & Immutable Versions — COMPLETE

Delivered:

- independent `TemplateStore` / `TemplateSnapshot` revision authority;
- Library > Templates;
- custom versions immutable and append-only;
- exact historical resolution;
- bounded custom editor;
- built-ins remain app-owned, not copied into custom persistence.

Post-R4b biopsy found no R4c. See R4 closeout/intent documents.

## V2-R5 — Editorial Vocabulary 2.0 — COMPLETE

Purpose: expand expressive power only where real catalog/editor gaps justify it.

R5 did not implement a predetermined Collection 2.0, Callout or generic editor.

### R5a — Table Row Image Editing Parity — COMPLETE

Observed gap: products-source Table displayed image cells but lacked the existing single-image selection/framing editing parity.

Delivered:

- eligible `table-row` with products source + active image column;
- reuse of `presentation.imageSelections[productId]` and `imageFrames[productId]`;
- same selected image/framing applied to Table image cell;
- no placement/row-scoped image authority;
- `commercialRows` excluded.

Promoted through PR #64 to `v2@798c8f6d292138e669d7943f65ee8bf99e740761`.

### R5b — Collection Technical Detail — COMPLETE

Observed gap: Collection could hide small factual technical context already available in `product.specs`.

Delivered:

- bounded `technical` Collection preset;
- factual spec projection;
- width-derived budgets `simple=1`, `wide=2`, `full=2`;
- no placeholders or dynamic measurement;
- no ProductStore/schema/CatalogDocument/TemplateContract change.

Promoted through PR #65 to `v2@a6e461086420733edea162f91da35668c3225a2e`.

### R5 closure

Post-R5b biopsy found no comparable evidence for another editorial recut:

- Table already had mature structural/commercial behavior plus R5a image parity;
- Collection already had bounded presets/overrides plus R5b technical detail;
- image semantics for `commercialRows` remained unresolved and therefore were not invented;
- no real case proved a fourth top-level Callout primitive irreducible.

R5 closes after R5a + R5b. See `R5-CLOSEOUT.md`.

## CI-H1 — AssetIndex Write Settlement Gate — COMPLETE

CI-H1 is test hygiene, not a product milestone.

Observed race: AssetIndex exposes a correct optimistic local candidate before remote persistence advances its authoritative revision. The old browser gate could observe optimistic content and immediately assert the previous revision/start another write.

Delivered hardening:

- runtime optimistic semantics unchanged;
- gate waits for `hasPendingWrite() === false` and no conflict before authoritative revision assertions/subsequent writes;
- fixture delay makes the optimistic window reproducible;
- upload/dedup behavior remains gated.

See `CI-H1-ASSET-INDEX-WRITE-SETTLEMENT.md`.

## V2-R6 — Preflight / Publication Quality — ACTIVE

Purpose: make publication readiness explicit and inspectable without making validation a mutation mechanism.

### R6a — Structural Preflight Foundation — COMPLETE

Observed need: CatalogoTop could truthfully render degraded/stale states but did not surface one author-facing publication assessment.

Delivered:

- pure ephemeral `Preflight.inspect(state)`;
- deterministic issue/report contract;
- `ready | review | blocked` status;
- bounded severities `blocker | warning | info`;
- eight structural checks:
  - exact template unavailable;
  - no publishable products;
  - selected product missing;
  - selected product inactive;
  - required code/description missing;
  - persisted Collection/Table not materialized;
  - explicit image selection fallback;
  - visible single-image usage missing its resolved image;
- placement-aware image semantics from `CatalogDocument.pages[].items`;
- compact Catálogo status/panel;
- no auto-fix;
- no Preflight persistence authority;
- no DOM measurement in the pure domain;
- no print-button enforcement;
- no Preflight chrome in isolated print.

Feature head `3018c8fbe89786c17c3d8243e3d209a3c9d4508b` passed push Validate #1101 / Browser #912 and PR Validate #1102 / Browser #913. PR #70 was squash-merged with expected-head protection into `v2@4a7dfbdaeb5bcf918c29a764d862956b0e120d3b`.

See `R6A-STRUCTURAL-PREFLIGHT-FOUNDATION-INTENT.md` and `R6A-CLOSEOUT.md`.

### Next R6 decision — post-R6a biopsy

**No R6b is selected yet.**

The strongest directional evidence is render-aware publication quality, because several meaningful facts only exist after render/materialization:

- TextFit already records truncation on rendered elements;
- actual image-load failure occurs after URL resolution;
- collision/overflow depends on real geometry;
- physical browser gates already know A4/page-count facts.

Before naming/implementing another recut, answer:

1. Which render-time signals are stable enough to become author-facing issues rather than test-only heuristics?
2. Can they be projected into the existing `PreflightReport` without creating another CatalogDocument/materialization authority?
3. Which checks are blockers versus warnings based on actual publication consequence, not preference?
4. Does author-facing physical-page validation need runtime measurement, an isolated render, or remain a release/test gate?
5. Is any export enforcement now justified, or should Preflight remain observational longer?

Do not copy every Browser gate assertion into runtime. Test instrumentation and product-quality semantics are related but not identical authorities.

## Optional research reintegration — semantic image variation

Image-variation research remains outside the critical path. A future capability may re-enter only with:

- placement-aware intent;
- fidelity invariants;
- useful quality benchmark including do-not-generate cases;
- explicit approval semantics;
- compatibility with `presentation.imageVariants` / `product.imageGallery` without overwriting `product.image`.

Transport success alone is insufficient.

## Cross-cutting invariants

1. `main` remains stable V1 until explicit V2 release decision.
2. Product truth and presentation truth stay separate.
3. Resource identity is stable through move/rename.
4. Revisions remain scoped to their resource authority.
5. Shared UI does not imply shared persistence.
6. Migration from V1 is deterministic/testable.
7. Subtractive/unifying solutions are valid; do not preserve obsolete UI for symmetry.
8. A4 renderer/pagination changes require explicit recut and physical gates.
9. No free-form editor, generic nesting or arbitrary executable template system without a new product decision.
10. Browser-local session state is not saved-resource persistence.
11. Asset bytes stay content-addressed and immutable.
12. Usage/accounting derives from authoritative persisted snapshots.
13. `Sem uso` is accounting, not physical-delete authorization.
14. Catalogs bind exact template ID/version; no silent fallback/upgrade.
15. Persisted template resources remain bounded data.
16. Published custom template versions are immutable/append-only.
17. Card, Collection and Table remain default top-level vocabulary.
18. Validation observes catalog/product/presentation authorities rather than replacing them with corrective effects.
19. Preflight detection is not permission to mutate truth.
20. Tests requiring provider revisions synchronize on write settlement rather than optimistic projection.
21. `Preflight.inspect` remains pure/ephemeral unless a future real use case justifies persistence.
22. Render-aware checks must not create a second materialization authority.
23. Export enforcement requires an explicit policy decision; severity labels alone are not authorization to intercept print.

## Sequence rationale

R1 established resource organization before later Library workflows.

R2 created reopenable catalog identity before richer editor/template/preflight work.

R3 stabilized reusable asset identity before templates and publication checks depended on images.

R4 established bounded template language/versioning before later editorial vocabulary.

R5 expanded editorial expressiveness only through observed gaps and then closed when evidence ran out.

CI-H1 separated a known asynchronous gate race from new product regressions.

R6a now establishes the issue/report vocabulary and structural observer before any render-aware/enforcement layer. This lets later quality checks reuse a proven contract instead of accumulating one-off UI warnings.

The roadmap remains directional. Split/re-plan when uncertainty is high; do not pull adjacent concerns forward merely because they touch nearby files.
