# CatalogoTop V2 — Roadmap and dependency order

## Baseline and intent

Stable V1 authority:

- `main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9`;
- tag `v1.0.0` at the same SHA.

Active V2 product-development line:

- `v2`;
- current functional authority after R6b: `v2@f589053dcee8aac7b37d417b3036cd92513f24cc`.

CatalogoTop remains a constrained catalog-authoring system centered on reliable product data, reusable resources, bounded editorial structures, deterministic A4 composition and explicit publication quality. A roadmap slot is directional, not automatic authorization.

## Current milestone status

- **R1 — Product Library Foundation: COMPLETE**.
- **R2 — Saved Catalog Documents: COMPLETE** after R2a + R2b.
- **R3 — Asset Library: COMPLETE** after R3a + R3b.
- **R4 — Constrained Template System 2.0: COMPLETE** after R4a + R4b.
- **R5 — Editorial Vocabulary 2.0: COMPLETE** after biopsy-driven R5a + R5b; no R5c.
- **CI-H1 — AssetIndex Write Settlement Gate: COMPLETE** as CI/test hygiene.
- **R6 — Preflight / Publication Quality: ACTIVE**.
  - **R6a — Structural Preflight Foundation: COMPLETE**; functional promotion `4a7dfbda...`, docs closeout `ef07409b...`.
  - **R6b — Rendered Description Truncation: COMPLETE**; functional promotion `f589053dcee8aac7b37d417b3036cd92513f24cc`.
  - **No R6c selected**; next action is biopsy of remaining publication signals.
- R7+ remain directional and are not authorized merely by appearing in plans.

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

## R6 — Preflight / Publication Quality — ACTIVE

Purpose: make publication readiness explicit and inspectable without turning validation into mutation or a generalized geometry engine.

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

Final feature head `678f7be1228a47bfeea5c5b7c7fa78692eb57f19` passed push Validate #1117 / Browser #928 and PR Validate #1118 / Browser #929. PR #73 was squash-merged with expected-head protection into `v2@f589053dcee8aac7b37d417b3036cd92513f24cc`.

A gate-design finding is now explicit: `full + visual` changes both width and typography, so “more width means less truncation” is not a valid invariant. The stable reactivity proof keeps `standard` preset fixed and varies only width, allowing the issue to follow actual TextFit truth.

See `R6B-RENDERED-DESCRIPTION-TRUNCATION-INTENT.md` and `R6B-CLOSEOUT.md`.

### Next R6 decision — post-R6b biopsy

**No R6c is selected.**

Remaining candidates require different evidence and should not be bundled simply because R6b introduced a render-aware projection:

1. **Image load failure** — asynchronous lifecycle; distinguish missing/placeholder-intended image from a resolved URL/blob that actually failed to decode/load.
2. **Collision / overflow** — geometry-dependent; requires stable semantic definition before browser-test geometry can become product runtime policy.
3. **Logical vs physical page validation** — isolated-print concern; determine whether it benefits authors live or remains a regression/release gate.
4. **Table factual visibility** — Table currently lacks the explicit TextFit contract that justified Card/Collection truncation warnings.

Selection criteria for another recut:

- real author-facing consequence;
- explicit/stable signal or a narrowly justified new signal;
- one clear lifecycle authority;
- no second CatalogDocument/materialization path;
- no generic rules/geometry engine unless repeated cases prove it necessary;
- no enforcement policy inferred merely from severity.

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
18. No Netlify operation is implied by Git promotion.

## Sequence rationale

R1 established reusable-resource organization; R2 made catalogs reopenable; R3 stabilized asset identity; R4 established bounded templates; R5 stabilized observed editorial gaps. CI-H1 isolated a known test-race before quality work. R6a then established structural issue vocabulary, and R6b proved one render-aware extension by consuming a stable existing TextFit fact.

The roadmap remains directional. Stop and biopsy again when a candidate would require a materially different authority, lifecycle or policy.
