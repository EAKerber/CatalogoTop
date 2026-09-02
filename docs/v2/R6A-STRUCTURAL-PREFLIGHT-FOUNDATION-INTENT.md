# V2 R6a — Structural Preflight Foundation — Intent

## Status

**Complete and promoted.**

Functional authority:

- `v2@4a7dfbdaeb5bcf918c29a764d862956b0e120d3b`;
- feature head `3018c8fbe89786c17c3d8243e3d209a3c9d4508b`;
- PR #70;
- `main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9` remains the stable V1 line.

Implementation evidence and gate IDs are recorded in `R6A-CLOSEOUT.md`.

R6a is the first bounded recut of **R6 — Preflight / Publication Quality**.

## Why R6a exists

CatalogoTop already preserved renderability in several degraded or stale situations, but the author had no explicit publication assessment. Existing authorities already exposed enough structural truth to report those situations without creating corrective state:

- selected IDs can stop resolving to products;
- selected inactive products are omitted from publication;
- invalid/stale Collection/Table blocks can fail materialization and fall back to existing units;
- obsolete image selections can resolve to the Original;
- visible single-image usages can fall to the application placeholder;
- exact template binding already fails closed.

R6a surfaces those facts without changing data or inventing a broad publication policy.

## Goal

Provide a deterministic, non-mutating Preflight domain plus a minimal author-facing report answering:

> Given the catalog state that would be materialized now, is there a structural reason this document is not ready, or something important the author should review?

R6a stops before DOM geometry, physical PDF validation and export enforcement.

## Core principle — detection is not correction

Preflight is an observer. It must not:

- mutate ProductStore/ProductSnapshot;
- mutate CatalogStore/CatalogSnapshot or Core presentation;
- repair stale block membership;
- remove stale selected IDs;
- activate products;
- rewrite an image selection to Original;
- add a missing image;
- substitute a different template/version;
- change pagination/layout to make a check pass.

Fixes remain explicit author actions through existing editing surfaces.

## Architecture

```text
Core state
   │
   ├─ persisted membership / presentation
   ├─ Product facts
   └─ exact template binding
   │
   ▼
Preflight.inspect(state)
   │
   ├─ state-only structural checks
   ├─ safe CatalogDocument materialization
   └─ state ↔ materialized-document comparison
   │
   ▼
PreflightReport
   ├─ status
   ├─ counts
   └─ issues[]
        │
        ▼
minimal author-facing Preflight UI
```

`Preflight` is a pure/ephemeral projection, not a persistence authority. No report is written into product, catalog, template or asset snapshots.

## Issue contract

```js
{
  id,
  code,
  severity: 'blocker' | 'warning' | 'info',
  scope: 'catalog' | 'product' | 'block' | 'image' | 'template',
  resourceType,
  resourceId,
  message,
  // optional bounded metadata
}
```

Rules:

- `id` is deterministic; no random UUID;
- `code` is machine-stable;
- resource references use existing stable IDs/bindings;
- optional metadata is bounded and only supports inspection/navigation;
- arbitrary diagnostic blobs are not persisted.

## Report contract

```js
{
  status: 'blocked' | 'review' | 'ready',
  counts: { blockers: 0, warnings: 0, info: 0 },
  issues: [...]
}
```

Rules:

- any blocker -> `blocked`;
- otherwise any warning -> `review`;
- otherwise -> `ready`;
- ordering is deterministic by severity/code/resource;
- identical state produces identical issue IDs/order;
- inspection does not mutate input state.

`info` is reserved but R6a does not generate advice merely to populate that category.

## Structural checks

### `template_unavailable` — blocker

Exact `catalog.templateId + catalog.templateVersion` cannot resolve/materialize. Preserve the exact binding; do not fall back to latest or another template. Known template failures become a report issue; unexpected programmer/runtime errors still surface.

### `catalog_empty` — blocker

No active, existing product would be materialized for publication. This is readiness, not an editing restriction.

### `selected_product_missing` — blocker

Raw `state.selectedIds` contains an ID absent from `state.products`. Do not clean membership automatically.

### `selected_product_inactive` — warning

An existing selected product is `Inativo` and therefore omitted from publication. Do not activate or deselect automatically.

### `required_product_fact_missing` — blocker

A publishable product lacks canonical required identity:

- code;
- description.

Price, specs, notes, variants and commercial rows are not universal R6a requirements.

### `editorial_block_not_materialized` — warning

A persisted Collection/Table does not survive into `CatalogDocument.blocks`. Use one generic code rather than guessing whether the reason was contiguity, category, member loss, overlap or another constraint.

### `image_selection_fallback` — warning

An explicit persisted image selection no longer resolves and an eligible materialized single-image usage falls back to Original. Do not rewrite the selection.

### `visible_image_missing` — warning

An eligible current single-image usage has no resolved image and therefore uses the application placeholder.

## Placement-aware image usage

Image readiness derives from the materialized usage, not a blanket product rule.

- Card with real variant images driving its visual grid does not require the main single image for that usage.
- Otherwise a Card uses `ImageVariants.resolveImage()`.
- Every Collection member is a single-image usage.
- Table creates single-image usages only when `rowSource:'products'` and the `image` column is active.
- `commercialRows` remains outside image semantics.

This preserves R5 boundaries and avoids placement-scoped image state.

## Materialization handling

`Preflight.inspect(state)`:

1. runs state-only membership/fact checks;
2. attempts exact `CatalogDocument.build(state)`;
3. translates known exact-template/registry failures to `template_unavailable`;
4. rethrows unexpected implementation failures;
5. after successful build, compares persisted/materialized blocks and evaluates placement-aware image usages.

Preflight does not create an alternative materialization path.

## Minimal UI

Catálogo exposes one compact control near the existing heading actions:

- `Pronto`;
- `Revisar · N`;
- `Bloqueios · N`.

The control opens a lightweight panel with summary counts and issues ordered by severity. The panel stores no second truth and recomputes from existing lifecycle events.

There are no auto-fix buttons, modal workflow, Library provider or persisted acknowledgement state.

## Print policy in R6a

R6a does **not** disable or intercept `Gerar PDF / Imprimir` merely because the report is `blocked`.

The first recut establishes observability. Export enforcement remains a later explicit product decision. Exact-template failures remain naturally fail-closed because the document itself cannot materialize.

Preflight chrome never enters isolated print output.

## Implementation surface

```text
src/preflight.js
src/preflight-controls.js
preflight.css
index.html
package.json
scripts/preflight-fixture.mjs
scripts/browser-r6a-preflight-gate.mjs
.github/workflows/browser-print.yml
```

R6a did not need to modify CatalogDocument, CatalogOrder, ProductStore, AssetIndexStore, TemplateStore, TemplateContract, Core schema or renderer semantics.

## Gate contract

The pure fixture proves:

- ready state;
- exact-template failure;
- missing selected ID;
- inactive selected product;
- missing code/description;
- stale/non-materialized block;
- stale image selection;
- missing image;
- no false main-image warning for a real Card variant grid;
- no Table image warning when image column is inactive;
- no `commercialRows` image semantics;
- deterministic order/IDs;
- non-mutation.

The browser gate proves:

- `Pronto → Revisar → Bloqueios` UI states;
- reactive recomputation;
- opening/closing panel does not mutate Core;
- A4 preview geometry/page count does not change;
- print remains available under R6a blockers;
- Preflight chrome is absent from isolated print;
- mobile Catalog gets no new horizontal overflow.

Canonical Validate + Browser gates must remain green for changes affecting this contract.

## Explicitly out of scope

R6a does not include:

- TextFit/DOM truncation issues;
- image load/network failure detection after URL resolution;
- overlap/collision/overflow measurement;
- physical PDF page-count comparison surfaced in product UI;
- persisted preflight reports/history;
- acknowledgement/waiver workflows;
- automatic fix actions;
- export-button enforcement;
- business-specific required-price/spec policies;
- arbitrary subjective/AI quality scoring;
- TemplateContract modification;
- reopening R5 editorial vocabulary.

## Stop conditions preserved

Future work should stop/re-plan rather than mutate R6a into a generalized engine if it appears to require:

- a Preflight persistence store/revision;
- alternative CatalogDocument materialization;
- Product/Template/Asset schema changes merely for validation;
- DOM measurement inside `src/preflight.js`;
- placement-scoped image state;
- automatic repair of stale references;
- print enforcement without an explicit policy decision;
- a generic validation plugin/rules engine without observed need.

## Next decision

Do not assume a predetermined R6b.

The strongest directional candidate is render-aware publication checking because TextFit already exposes truncation and browser gates already inspect physical output. A post-R6a biopsy must first decide which rendered signals are stable enough to promote without creating a second materialization authority or runtime heuristics copied blindly from tests.

See `R6A-CLOSEOUT.md` for the promoted SHA and exact gate evidence.
