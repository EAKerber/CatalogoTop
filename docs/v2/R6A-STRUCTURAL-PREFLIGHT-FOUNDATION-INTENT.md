# V2 R6a — Structural Preflight Foundation — Intent

## Status

**Planned; not implemented.**

Base authority selected for planning:

- `v2@05a699896881a08acf503648efab69a9b51669a8`;
- R5 is closed;
- CI-H1 is complete;
- `main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9` remains the stable V1 line.

R6a is the first bounded recut of **R6 — Preflight / Publication Quality**.

## Why R6a exists

The post-R5 biopsy found that CatalogoTop already preserves renderability in several degraded or stale situations, but the author does not receive one explicit publication assessment.

Examples already encoded in current runtime contracts:

- `CatalogOrder.selectedIds()` silently ignores catalog-selected IDs that no longer exist in the product set;
- `CatalogDocument.getRenderableProducts(..., { activeOnly:true })` excludes selected inactive products from the materialized document;
- `CatalogDocument.resolveBlocks()` silently excludes persisted Collection/Table blocks that are invalid, stale, overlapping or otherwise not materializable, allowing their members to fall back to Cards;
- `ImageVariants.resolveImage()` exposes `isFallback:true` when a persisted image selection no longer resolves and the Original is used instead;
- missing main image can lead eligible single-image usages to render the application placeholder;
- `Templates.resolveCatalog()` already fails closed with explicit template error codes when exact ID/version is unavailable.

R6a should surface these existing structural facts without changing the data or inventing a broad publication policy.

## Goal

Create a deterministic, non-mutating Preflight domain plus a minimal author-facing report that answers:

> “Given the catalog state that would be materialized now, is there a structural reason this document is not ready, or something important the author should review?”

R6a deliberately stops before DOM geometry, physical PDF validation and export enforcement.

## Core principle — detection is not correction

Preflight is an observer.

It must not:

- mutate ProductStore/ProductSnapshot;
- mutate CatalogStore/CatalogSnapshot or Core presentation;
- repair stale block membership;
- remove stale selected IDs;
- activate products;
- rewrite an image selection to Original;
- add a missing image;
- substitute a different template/version;
- change pagination/layout to make a check pass.

A report may explain a problem and point to its resource, but fixing it remains an explicit author action through existing editing surfaces.

## R6a architecture

```text
Core state
   │
   ├─ persisted catalog membership / presentation
   │
   ├─ Product facts
   │
   └─ exact template binding
   │
   ▼
Preflight.inspect(state)
   │
   ├─ structural state checks
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
minimal Preflight UI
```

`Preflight` is a pure/ephemeral projection, not a persistence authority.

No Preflight result is saved into product, catalog, template or asset snapshots in R6a.

## Issue contract

R6a introduces a small stable issue vocabulary.

Conceptual shape:

```js
{
  id: 'editorial_block_not_materialized:block:collection-1',
  code: 'editorial_block_not_materialized',
  severity: 'warning',
  scope: 'block',
  resourceType: 'collection',
  resourceId: 'collection-1',
  message: 'A coleção “collection-1” não pôde ser materializada e seus produtos serão publicados fora do bloco.'
}
```

### Required fields

- `id` — deterministic identity derived from code/scope/resource reference; no random UUID;
- `code` — machine-stable issue code;
- `severity` — one of `blocker | warning | info`;
- `scope` — one of `catalog | product | block | image | template`;
- `resourceType` — bounded type when applicable;
- `resourceId` — stable product/block/template reference when applicable;
- `message` — concise author-facing Portuguese explanation.

Optional bounded metadata may be added only when it helps tests/navigation, for example `productId`, `blockId`, `templateId`, `templateVersion` or `selectedImageId`. Do not persist arbitrary diagnostic blobs.

## Report contract

Conceptual result:

```js
{
  status: 'blocked' | 'review' | 'ready',
  counts: { blockers: 0, warnings: 2, info: 0 },
  issues: [...]
}
```

Rules:

- any blocker -> `blocked`;
- otherwise any warning -> `review`;
- otherwise -> `ready`;
- issue ordering is deterministic: severity, code, resource type/id;
- identical state produces identical issue IDs/order;
- inspecting must not mutate input state.

`info` is reserved by the contract but R6a does not need to generate informational advice merely to populate the category.

## R6a structural checks

### 1. `template_unavailable` — blocker

If exact `catalog.templateId + catalog.templateVersion` cannot be resolved/materialized, convert the existing fail-closed template error into a Preflight blocker instead of throwing the report away.

Preserve the original exact binding in metadata.

Preflight must not fall back to latest or another built-in.

When this blocker prevents `CatalogDocument.build()`, other checks that require a document are skipped; state-only checks may still run.

### 2. `catalog_empty` — blocker

If there is no active, existing product that would be materialized for publication, report the catalog as structurally empty.

This is publication readiness, not an editing restriction: an empty working catalog may still exist.

### 3. `selected_product_missing` — blocker

For every ID present in raw `state.selectedIds` but absent from `state.products`, emit a blocker.

Current `CatalogOrder.selectedIds()` correctly filters these IDs to preserve runtime operation; R6a makes the semantic loss visible.

Do not clean `selectedIds` automatically.

### 4. `selected_product_inactive` — warning

For every existing selected product whose status is `Inativo`, emit a warning explaining that it is selected in the catalog but excluded from publication.

Do not activate or deselect it automatically.

### 5. `required_product_fact_missing` — blocker

For a product that would otherwise be published, emit a blocker when either canonical required fact is empty:

- `code`;
- `description`.

This does not invent a new business rule: the existing authoring/import contract already treats Código and Descrição as required.

R6a does not require price, specs, notes, variants or commercial rows; those are not universally mandatory facts.

### 6. `editorial_block_not_materialized` — warning

Compare persisted normalized `catalog.presentation.blocks` against `CatalogDocument.blocks` after successful materialization.

For each persisted Collection/Table block that does not survive into the materialized document, emit one warning for the block.

R6a intentionally uses a generic first code rather than reverse-engineering a potentially wrong reason such as “non-contiguous”, “different category”, “missing member” or “overlap”. More specific reason codes may be added later only if the domain exposes them explicitly.

The warning should state that members may publish as another existing unit (typically Cards) rather than implying data loss.

### 7. `image_selection_fallback` — warning

When a product has an explicit persisted `imageSelections[productId]` entry and `ImageVariants.resolveImage(product, presentation).isFallback === true`, emit a warning when the current materialized usage can consume the single-image selection contract.

Relevant usages in R6a:

- Card without a variant-image grid;
- Collection member;
- products-source Table row when the image column is active.

Do not warn for a stale selection that has no effect on the current materialized usage, for example a Card rendered as a multi-image variant grid.

Do not rewrite selection to Original.

### 8. `visible_image_missing` — warning

For a current materialized usage that requires a single image, emit a warning when its resolved image is empty and the renderer would therefore rely on the application placeholder.

Use the same usage eligibility as the image-selection check:

- Card that relies on a single/main image;
- Collection member;
- products-source Table row with image column active.

A Card with actual variant images does not receive this warning merely because its canonical main image is empty, because its current visual usage does not require that main image.

R6a checks the materialized usage, not a generic “every product must have product.image” policy.

## Why these severities

### Blockers

R6a reserves blocker for cases where current publication would be absent, cannot materialize, or lacks a minimum canonical identity:

- unavailable exact template;
- no publishable products;
- selected product reference no longer exists;
- publishable product has no code/description.

### Warnings

Warnings cover cases where a truthful output can still be produced but differs from persisted/editorial intent or uses a degraded fallback:

- selected inactive product omitted;
- persisted editorial block not materialized;
- explicit image selection fell back;
- visible single-image usage relies on placeholder.

R6a does not introduce subjective “quality suggestions” such as insufficient specs, weak composition, missing price or preferred density.

## Placement-aware image usage

R6a should not infer image requirements only from Product facts.

Derive visible image usage from `CatalogDocument.pages[].items`:

- `card`:
  - if the product has variant images currently driving the Card visual grid, main single-image usage is not required;
  - otherwise use `ImageVariants.resolveImage()`;
- `collection`:
  - each member is a single-image usage;
- `table`:
  - only `rowSource:'products'` plus active `image` column creates single-image usages;
  - `commercialRows` remains outside the image contract established by R5.

This avoids false warnings for images that are absent in Product facts but irrelevant to the actual current document.

## Materialization failure handling

`Preflight.inspect(state)` should be safe for author-facing use.

Suggested sequence:

1. run state-only membership/fact checks;
2. attempt exact `CatalogDocument.build(state)`;
3. if build fails with a known template binding/registry error, add `template_unavailable` blocker and return a report containing the state-only issues;
4. rethrow only unexpected programmer/runtime errors rather than silently converting every exception into a publication issue;
5. if build succeeds, run document-comparison and placement-aware image checks.

This preserves fail-closed template semantics without hiding unrelated bugs.

## Minimal R6a UI

R6a should make the report inspectable inside `Catálogo` without redesigning the workspace.

### Status control

Add one compact control in the existing catalog heading actions, near Save / Generate PDF:

- `Pronto` when report is ready;
- `Revisar · N` when only warnings exist;
- `Bloqueios · N` when blockers exist.

The control opens/closes a lightweight Preflight panel.

### Panel

A small panel below the existing catalog controls is sufficient for R6a:

- summary counts;
- blockers first, then warnings;
- issue message and compact resource label/reference;
- no auto-fix buttons;
- no new Library provider;
- no modal workflow;
- no persisted acknowledgement/dismiss state.

The panel recomputes from current state after relevant catalog/product/render update events rather than storing a second truth.

### Print behavior in R6a

**Do not disable or intercept `Gerar PDF / Imprimir` in R6a.**

The report may say `blocked` / “Bloqueios”, but R6a is the observability foundation. Export-enforcement policy should be a later explicit decision after the issue vocabulary has been exercised.

Exact-template errors remain naturally fail-closed because print/materialization already cannot resolve that document.

Preflight chrome must never appear in print output.

## Expected implementation surface

Primary files:

```text
src/preflight.js                         new pure domain
src/preflight-controls.js                new minimal UI projection
preflight.css                            new bounded UI styles
index.html                               load/style + status/panel mount points
package.json                             add pure fixture to test sequence
scripts/preflight-fixture.mjs            new deterministic domain fixture
scripts/browser-r6a-preflight-gate.mjs   new browser/UI gate
.github/workflows/browser-print.yml      add browser gate
```

Potentially small wiring in an existing app/render event surface is acceptable if needed to recompute the report, but R6a should not modify CatalogDocument, CatalogOrder, ProductStore, AssetIndexStore, TemplateStore or renderer semantics simply to make Preflight easier.

## Pure fixture requirements

`preflight-fixture.mjs` should prove at minimum:

1. clean state -> `ready`, zero issues;
2. exact template unavailable -> blocker report, no silent fallback and no report crash;
3. raw selected ID missing from products -> `selected_product_missing`;
4. selected inactive product -> warning and absence from publishable materialization;
5. active publishable product missing code/description -> blocker;
6. stale persisted block omitted by `CatalogDocument` -> one `editorial_block_not_materialized` warning;
7. stale explicit image selection on an eligible single-image usage -> fallback warning;
8. missing resolved image on an eligible usage -> image warning;
9. Card with real variant-image grid and no main image does not receive a false `visible_image_missing` warning;
10. products-source Table without active image column does not receive an image warning;
11. `commercialRows` does not gain image semantics;
12. issue ordering/IDs are deterministic;
13. input state is byte/deep-equal before and after inspection.

## Browser gate requirements

`browser-r6a-preflight-gate.mjs` should prove:

1. status control exists and clean fixture reports `Pronto`;
2. warning fixture reports `Revisar · N` and panel lists the correct issue;
3. blocker fixture reports `Bloqueios · N`;
4. opening/closing panel does not mutate Core state;
5. relevant state changes recompute the status without reload;
6. Preflight panel/status does not appear in isolated print output;
7. `btnPrint` remains enabled/available in R6a even when blockers exist, except existing materialization failure behavior;
8. existing Catalog preview geometry/page count is unchanged by opening the panel;
9. mobile Catalog workspace has no new horizontal overflow.

Canonical Validate + Browser Print gates must pass on the same head before promotion.

## Explicitly out of scope — later R6 work

R6a does **not** include:

- TextFit/DOM truncation issues;
- image load/network failure detection after URL resolution;
- overlap/collision/overflow measurement;
- physical PDF page-count comparison;
- print-preview parity checks exposed in product UI;
- persisted preflight reports/history;
- acknowledgement/waiver workflows;
- automatic fix actions;
- export-button enforcement;
- business-specific required-price/spec policies;
- arbitrary “AI quality review” or subjective layout scoring;
- modification of TemplateContract;
- reopening R5 editorial vocabulary.

Those concerns require separate evidence and can be split into a render-aware R6b and, if useful, later publication-policy recuts.

## Stop conditions

Stop/re-plan R6a rather than expanding the architecture if implementation appears to require:

- a Preflight persistence store/revision;
- CatalogDocument mutation or alternative materialization pipeline;
- Product/Template/Asset schema changes;
- DOM measurement inside `src/preflight.js`;
- placement-scoped image state;
- automatic repair of stale references;
- disabling print merely to satisfy the first report taxonomy;
- introducing a generic validation rules engine/plugin system.

A single bounded issue projection is preferable to a generalized policy engine until real checks prove the need.

## Expected sequence after R6a

After R6a is implemented and exercised, biopsy again before naming R6b.

The most likely next candidate is **render-aware publication checks** because TextFit already exposes truncation and browser gates already inspect physical output. But R6b should be selected only after R6a reveals whether the issue contract/severities are useful in practice.
