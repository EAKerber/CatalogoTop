# V2 R5 — Editorial Vocabulary 2.0 — Closeout

## Status

**R5 — Editorial Vocabulary 2.0 is complete after R5a + R5b.**

Authority before this documentary closeout:

- `v2@c370708fd8c4a538398e9ae9d2ea85c2ffd01cc6`;
- R5a functional promotion: `v2@798c8f6d292138e669d7943f65ee8bf99e740761`;
- R5b functional promotion: `v2@a6e461086420733edea162f91da35668c3225a2e`;
- `main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9` remains the stable V1 line.

R5 closes without an R5c. This is an explicit product/architecture decision, not an unimplemented roadmap slot.

## What R5 was for

R5 existed to expand editorial expressiveness only where real CatalogoTop cases exposed a concrete asymmetry, while preserving the constrained top-level vocabulary and authorities established through R1–R4.

It was deliberately biopsy-driven. The milestone did not authorize a predetermined Collection 2.0, Callout primitive, generic container system, free placement or a parallel template language.

## Delivered recuts

### R5a — Table Row Image Editing Parity

Closed the observed asymmetry where a products-source Table could display an image column but selecting that row did not expose the same single-image selection/framing controls already available to Card and Collection members.

R5a reused:

- `presentation.imageSelections[productId]`;
- `presentation.imageFrames[productId]`;
- the existing single-image inspector vocabulary.

It did not introduce row-scoped or placement-scoped image authority, did not expand `commercialRows`, and did not redesign TableBlock or pagination.

Detailed contract: `R5A-TABLE-ROW-IMAGE-EDITING-INTENT.md`.

### R5b — Collection Technical Detail

Closed the observed asymmetry where grouping products into a Collection preserved the visual family but removed the small factual technical context already present in `product.specs`.

R5b added the bounded Collection preset `technical`, with factual order preserved and deterministic spec budget from existing member width:

- `simple`: 1;
- `wide`: 2;
- `full`: 2.

It did not create ProductStore facts, per-member content schemas, new top-level geometry, fragmentation, nesting or a new primitive.

Detailed contract: `R5B-COLLECTION-TECHNICAL-DETAIL-INTENT.md`. Recap/gates: `R5B-CLOSEOUT.md`.

## Post-R5b biopsy decision

The post-R5b biopsy did not find another editorial gap with evidence comparable to R5a or R5b.

### Table

Table already has:

- `products` and `commercialRows` row sources;
- known semantic columns;
- density;
- elastic column planning;
- commercial price presentation;
- deterministic model-side fragmentation;
- image selection/framing for eligible products-source rows.

Adding image semantics to `commercialRows` would require a new decision about whether authority belongs to product, commercial row or placement. No observed case currently justifies inventing that authority.

### Collection

Collection now has:

- `visual`, `compact`, `commercial` and `technical` presets;
- light/dark theme;
- 2–4 columns;
- local `simple/wide/full` width;
- local emphasis and price style;
- shared image selection/framing by product.

No additional concrete loss of information or layout capability was demonstrated after R5b. A broad Collection 2.0 would therefore be speculative.

### Callout / fourth primitive

No irreducible observed case currently requires a fourth top-level primitive. Card `full + feature`, Card content presets, Collection headings and Table headings cover the concrete cases inspected so far.

A future non-product editorial block may still be valid, but it requires a real case and its own explicit contract. R5 does not reserve or pre-authorize `Callout`.

## Why R5 closes now

The remaining high-value gaps found by the biopsy are publication-observability gaps rather than missing editorial vocabulary.

Examples already present in runtime behavior include:

- text fitting can truncate a product description and record that truncation;
- missing product images resolve to the `SEM IMAGEM` placeholder;
- stale/invalid editorial blocks can fail back to individual Cards during materialization;
- obsolete image selections can resolve deterministically to the Original.

These behaviors preserve renderability, but the author does not yet receive a consolidated publication/preflight assessment. That belongs to R6, not to another editorial primitive.

## Boundaries stabilized by R5

At R5 closeout:

- Card, Collection and Table remain the preferred top-level structural vocabulary;
- depth remains 1; no generic container/nesting system;
- product facts and catalog-local presentation remain separate;
- image selection/framing remains product-scoped presentation unless a future observed case proves placement authority necessary;
- `commercialRows` remains factual commercial expansion and does not infer image semantics;
- TemplateContract remains bounded and does not absorb catalog-local editorial state merely for flexibility;
- preview/print continue to consume the same materialized document decisions.

## CI debt discovered during R5

A known Browser Asset Library gate race is tracked separately from R5/R6 product scope.

`AssetIndexStore.publishCandidate()` exposes the optimistic local snapshot with `pendingWrite=true` before the remote write returns and revision advances. The R3b browser gate historically waited only for the new asset to appear, then immediately asserted the incremented revision. That can observe the optimistic snapshot at the old revision.

The correct CI hardening is to wait for AssetIndex write settlement (`hasPendingWrite() === false`) before asserting revision. This is **CI-H1**, not a runtime semantic change and not R5c.

## Next milestone

The next product milestone is **R6 — Preflight / Publication Quality**.

Do not implement all expected R6 checks at once. Start with an explicit planning/intent pass, then select the smallest bounded vertical that makes publication issues inspectable without mutating product or catalog data to make checks pass.

Initial evidence to consider in R6 planning:

- stale/invalid persisted blocks versus materialized blocks;
- missing product images/placeholders;
- image-selection fallback to Original;
- description truncation already detected by TextFit;
- template binding failures;
- logical versus physical page agreement.

CI-H1 should be closed before or alongside the first R6 feature branch so pre-existing gate flakiness is not confused with a new publication feature.

## Bootstrap after R5

Read in this order:

1. `docs/v2/START-HERE.md`;
2. `docs/v2/ROADMAP.md`;
3. this closeout;
4. `docs/v2/R5B-CLOSEOUT.md` and the R5a/R5b intent contracts for stabilized editorial boundaries;
5. R4 closeouts when deciding whether a proposed R6/template compatibility check belongs to TemplateContract or catalog-local validation.
