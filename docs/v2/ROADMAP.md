# CatalogoTop V2 — Roadmap and dependency order

## Baseline and intent

Stable V1 authority:

- `main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9`;
- tag `v1.0.0` at the same SHA.

Active V2 product-development line:

- `v2`;
- authority corrente no início deste housekeeping: `v2@6112cef148db2f294cd73a1ded05e31fb858f74b`.

CatalogoTop remains a constrained catalog-authoring system centered on reliable product data, reusable resources, bounded editorial structures, deterministic A4 composition and explicit publication quality. A roadmap slot is directional, not automatic authorization.

## Current milestone status

- **R1 — Product Library Foundation: COMPLETE**.
- **R2 — Saved Catalog Documents: COMPLETE** after R2a + R2b.
- **R3 — Asset Library: COMPLETE** after R3a + R3b.
- **R4 — Constrained Template System 2.0: COMPLETE** after R4a + R4b.
- **R5 — Editorial Vocabulary 2.0: COMPLETE** after biopsy-driven R5a + R5b; no R5c.
- **CI-H1 — AssetIndex Write Settlement Gate: COMPLETE** as CI/test hygiene.
- **R6 — Preflight / Publication Quality: COMPLETE** after R6a + R6b; no R6c.
  - **R6a — Structural Preflight Foundation: COMPLETE**; functional promotion `4a7dfbda...`, docs closeout `ef07409b...`.
  - **R6b — Rendered Description Truncation: COMPLETE**; functional promotion `f589053d...`, docs closeout `5218e39c...`.
  - post-R6b biopsy found no additional candidate with a sufficiently explicit authority/lifecycle for R6c.
- **CI-H2 — R5a Inspector Image Mode Gate Settlement: COMPLETE** as test hygiene; no runtime change.
- **Post-R6 UX coherence — COMPLETE**: Library controls aligned, product thumbnails added to Product Library/Cadastro, Cadastro row becomes edit target; promoted by PR #77 to `v2@6112cef148db2f294cd73a1ded05e31fb858f74b`.
- **No next functional recut is selected by this roadmap.**
- R7+ remain directional and are not authorized merely by appearing in plans.

Post-R6 maintenance does not reopen R6 and does not imply R7. It is recorded here only when it materially changes the current operational/product surface.

## Architectural direction

```text
Biblioteca UI
  ├─ Product provider    -> ProductStore / ProductSnapshot
  ├─ Catalog provider    -> CatalogStore / CatalogSnapshot
  ├─ Asset provider      -> AssetIndexStore / AssetIndexSnapshot + immutable AssetStore
  └─ Template provider   -> TemplateStore / TemplateSnapshot

state
  -> CatalogOrder
  -> CatalogDocument
  -> preview / print

state + CatalogDocument
  -> Preflight.inspect(state)
  -> structural issues

already-fitted preview
  -> PreflightRender.inspect(root)
  -> explicit rendered issues

all issues
  -> Preflight.withIssues(...)
  -> canonical status/panel
```

Shared UI does not imply shared persistence. Preflight is an observer, not another persistence/materialization authority.

## R1 — Product Library Foundation — COMPLETE

Established provider-scoped folder vocabulary, ProductSnapshot v2, deterministic migration, recursive query, clone-as-new flow and Product Library administration.

Detailed authority: `R1-PRODUCT-LIBRARY-INTENT.md`.

## R2 — Saved Catalog Documents — COMPLETE

Established reopenable catalog identity, independent CatalogStore/CatalogSnapshot revision authority, create/open/save/duplicate, folders, dirty state and deterministic migration compatibility.

See R2 intents/closeout.

## R3 — Asset Library — COMPLETE

Established AssetIndex separate from immutable content-addressed bytes, derived authoritative usage, organization/search/accounting, standalone ingest/deduplication and reuse. No automatic physical delete/GC.

See `R3-CLOSEOUT.md`.

## R4 — Constrained Template System 2.0 — COMPLETE

R4a established bounded TemplateContract and exact version binding. R4b established independent TemplateStore/TemplateSnapshot, immutable append-only custom versions and Library > Templates. No arbitrary executable template system.

See R4 intents/closeouts.

## R5 — Editorial Vocabulary 2.0 — COMPLETE

R5 expanded expressive power only from observed gaps:

- **R5a**: products-source Table image editing parity reusing product-scoped image selection/framing;
- **R5b**: bounded Collection technical detail from factual specs.

Post-R5b biopsy found no justified R5c. Card, Collection and Table remain the stabilized top-level vocabulary; `commercialRows` image semantics and a fourth Callout primitive were deliberately not invented.

See `R5-CLOSEOUT.md`.

## CI-H1 — AssetIndex Write Settlement Gate — COMPLETE

Corrected an old browser-gate race by waiting for provider write settlement before authoritative revision assertions/subsequent writes. Runtime optimistic semantics remain unchanged.

See `CI-H1-ASSET-INDEX-WRITE-SETTLEMENT.md`.

## R6 — Preflight / Publication Quality — COMPLETE

Purpose: make publication readiness explicit and inspectable without turning validation into mutation or a generalized geometry engine.

R6 closes after two recuts because the remaining nearby quality concerns do not share one authority/lifecycle.

### R6a — Structural Preflight Foundation — COMPLETE

Delivered:

- pure ephemeral `Preflight.inspect(state)`;
- deterministic issue/report contract;
- `ready | review | blocked`;
- structural blockers/warnings for template availability, empty/missing/inactive membership, required facts, stale editorial blocks and image-selection/placeholder degradation;
- placement-aware image semantics from CatalogDocument;
- compact existing Catálogo status/panel;
- no Preflight store, auto-fix or PDF enforcement.

Feature head `3018c8fbe89786c17c3d8243e3d209a3c9d4508b` passed push Validate #1101 / Browser #912 and PR Validate #1102 / Browser #913. PR #70 promoted functional R6a to `4a7dfbda...`; PR #71 closed docs at `ef07409b...`.

See `R6A-CLOSEOUT.md`.

### R6b — Rendered Description Truncation — COMPLETE

Post-R6a biopsy selected one render-time signal that already had explicit runtime evidence rather than requiring a new heuristic: TextFit description truncation.

Delivered:

- `description_truncated` warning;
- Card + Collection only;
- new read-only `PreflightRender.inspect(root)` consuming TextFit datasets;
- pure `Preflight.withIssues(...)` canonical merge, dedup, ordering/count/status;
- render-aware refresh tied to the current preview after `catalogotop:catalog-rendered`;
- no second TextFit pass;
- no geometry/style reads in the render projection;
- no Table inference;
- no persistence, auto-fix, observer/timer or export enforcement;
- controlled preview/isolated-print parity regression gate.

Final feature head `678f7be1228a47bfeea5c5b7c7fa78692eb57f19` passed push Validate #1117 / Browser #928 and PR Validate #1118 / Browser #929. PR #73 was squash-merged with expected-head protection into `v2@f589053dcee8aac7b37d417b3036cd92513f24cc`; PR #74 closed R6b documentation into `v2@5218e39c36739b538aaf5198ab1ef5d6f7ed766b` after Validate #1119 / Browser #930.

A gate-design finding is explicit: `full + visual` changes both width and typography, so “more width means less truncation” is not a valid invariant. The stable reactivity proof keeps `standard` preset fixed and varies only width, allowing the issue to follow actual TextFit truth.

See `R6B-RENDERED-DESCRIPTION-TRUNCATION-INTENT.md` and `R6B-CLOSEOUT.md`.

### Post-R6b biopsy — no R6c

Four adjacent candidates were inspected.

#### 1. Image-load failure — parked

`Print.waitForImages()` already observes `complete`, `naturalWidth`, `decode`, `load` and `error`, but the live preview publishes `catalogotop:catalog-rendered` before remote images necessarily settle.

A correct author-facing issue therefore needs an explicit asynchronous settlement/invalidation contract. Reading `naturalWidth` synchronously or using arbitrary delays would create false failures.

#### 2. Table factual visibility — parked

Table has deterministic width planning and CSS clipping, but no explicit per-cell factual-visibility signal. `columnDemand` is a bounded text-length planning heuristic, not rendered truncation truth.

Do not generalize R6b by selector symmetry.

#### 3. Collision / overflow — parked

Browser gates use targeted geometry measurements for known invariants. There is no generic policy that every overlap or overflow is a publication defect.

A runtime scanner would first need bounded participants, tolerances, stability timing and intentional-overlap exclusions.

#### 4. Logical vs physical page parity — keep in Browser/CI authority

`Print.renderPages()` verifies logical page count against rendered `.catalog-page` nodes. The Browser Print Gate additionally generates a Chromium PDF and checks its physical page count with `pdf-lib`.

The browser editor does not possess that same physical-PDF observation capability. DOM page count must not be relabeled as physical PDF parity.

Detailed comparison and re-entry conditions: `R6-POST-R6B-BIOPSY.md`.

### R6 closeout decision

**No R6c.**

R6 delivered a small trustworthy observation system:

```text
state/document truth -> structural Preflight
explicit renderer truth -> bounded render-aware Preflight
```

The remaining candidates require new signal sources or execution environments. Keeping them separate is preferable to turning Preflight into a generic validation framework.

See `R6-CLOSEOUT.md`.

## Post-R6 maintenance — not new milestones

### CI-H2 — inspector image mode settlement

A Browser gate race inherited from R5a asserted framing visibility during the short interval before the inspector stabilized its `general` / `image` mode. CI-H2 changed only the test contract: wait for stable `general`, prove framing is hidden there, click **Imagem**, then require the editor visible. Runtime remained unchanged.

See `CI-H2-R5A-INSPECTOR-MODE-GATE.md`.

### Product list visual coherence

A user-observed UX gap after R6 justified a bounded non-milestone slice:

- Library search/select controls use the shared visual language rather than native-looking pickers;
- Product Library and Cadastro lists show product thumbnails using the existing `product.image -> Render.PLACEHOLDER` authority;
- Cadastro existing rows are the edit target by click/Enter/Space;
- persisted-product actions move from every row to the editing form header;
- mobile remains free of new horizontal overflow.

No Product schema, persistence authority, renderer, TemplateContract or Preflight semantics changed. PR #77 promoted the slice to `v2@6112cef148db2f294cd73a1ded05e31fb858f74b`.

## Cross-cutting invariants

1. `main` remains stable V1 until explicit release decision.
2. Product truth and presentation truth stay separate.
3. Resource identities are stable; revisions remain provider-scoped.
4. Shared UI does not imply shared persistence.
5. A4 remains `state -> CatalogOrder -> CatalogDocument -> preview/print`.
6. Exact template ID/version remains fail-closed; no silent upgrade/fallback.
7. Template resources remain bounded data; custom published versions immutable/append-only.
8. Card, Collection and Table remain default top-level editorial vocabulary.
9. Asset bytes remain content-addressed/immutable; usage derives from persisted snapshots.
10. Preflight observes authorities rather than repairing them.
11. `Preflight.inspect` remains pure and DOM-free.
12. Render-aware Preflight consumes explicit renderer signals before introducing new geometry measurement.
13. A capability proven for Card/Collection is not generalized to Table by symmetry.
14. Preflight results remain ephemeral unless a real persistence use case appears.
15. Severity does not authorize print/export interception; enforcement requires explicit policy.
16. Tests requiring authoritative provider revision wait for write settlement.
17. Browser regression heuristics are evidence, not automatically product-runtime semantics.
18. Physical PDF page parity remains a Browser/CI concern until an actual author-facing physical artifact validator exists.
19. No Netlify operation is implied by Git promotion.
20. Visual validation against a hosted environment requires checking the deployed branch + SHA; Production, branch deploy and Deploy Preview are distinct authorities.

## Sequence rationale

R1 established reusable-resource organization; R2 made catalogs reopenable; R3 stabilized asset identity; R4 established bounded templates; R5 stabilized observed editorial gaps. CI-H1 isolated a known test-race before quality work. R6a then established structural issue vocabulary, and R6b proved one render-aware extension by consuming a stable existing TextFit fact.

R6 closes when the next candidates stop sharing that authority model. Subsequent CI/UX maintenance did not reopen it. The roadmap now returns to fresh evidence rather than continuing numbering automatically.

## Next product decision

No R7 slice is selected here.

The next recut should be chosen from a concrete user/editor/release problem and may belong to a different axis entirely. The external-image-kit experiment remains an isolated exploration until a proven contract creates enough evidence for a dedicated integration biopsy.

If a candidate would require a new persistence authority, asynchronous settlement protocol, generic geometry engine or unavailable physical-PDF runtime capability, make that architectural decision explicitly before implementation.
