# V2 R6 — Preflight / Publication Quality — Closeout

## Status

**COMPLETE after R6a + R6b. No R6c.**

Closeout base:

- `v2@5218e39c36739b538aaf5198ab1ef5d6f7ed766b`;
- R6a functional promotion: `v2@4a7dfbdaeb5bcf918c29a764d862956b0e120d3b`;
- R6a closeout authority: `v2@ef07409b233a79f2e3bf6ed6680e86c3c9bbdccb`;
- R6b functional promotion: `v2@f589053dcee8aac7b37d417b3036cd92513f24cc`;
- R6b closeout authority: `v2@5218e39c36739b538aaf5198ab1ef5d6f7ed766b`;
- stable V1 remains `main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9`.

No Netlify operation was performed by R6.

## R6 purpose

R6 made publication readiness explicit and inspectable without turning validation into a mutation mechanism or a second renderer.

The milestone deliberately separated what can be known from state/document materialization from what is only known after an existing render authority has produced an explicit signal.

## Delivered recuts

### R6a — Structural Preflight Foundation

R6a introduced one ephemeral deterministic report:

```text
PreflightReport
  status: ready | review | blocked
  counts
  issues[]
```

It observes state + `CatalogDocument` and reports eight bounded conditions:

- `template_unavailable` — blocker;
- `catalog_empty` — blocker;
- `selected_product_missing` — blocker;
- `selected_product_inactive` — warning;
- `required_product_fact_missing` — blocker;
- `editorial_block_not_materialized` — warning;
- `image_selection_fallback` — warning;
- `visible_image_missing` — warning.

R6a also added the compact Catálogo status/panel while preserving:

- no Preflight persistence;
- no auto-fix;
- no alternate materialization;
- no DOM geometry inside the pure domain;
- no automatic print/PDF enforcement.

See `R6A-STRUCTURAL-PREFLIGHT-FOUNDATION-INTENT.md` and `R6A-CLOSEOUT.md`.

### R6b — Rendered Description Truncation

R6b added one render-aware warning:

```text
description_truncated — warning
```

It is emitted only when the existing TextFit authority has already materialized `data-description-truncated="true"` for:

- Card description;
- Collection member description.

R6b added `PreflightRender.inspect(root)` as a DOM-read-only projection and `Preflight.withIssues(...)` as the canonical report merge path.

It did not run TextFit again, measure geometry, infer Table truncation, persist render issues or add a second UI surface.

See `R6B-RENDERED-DESCRIPTION-TRUNCATION-INTENT.md` and `R6B-CLOSEOUT.md`.

## Final architecture

```text
Product/Catalog state
  + exact template binding
  + CatalogDocument
        |
        v
Preflight.inspect(state)
  -> structural issues

preview rendered by normal renderer
  -> TextFit existing measurement
  -> explicit datasets
        |
        v
PreflightRender.inspect(root)
  -> bounded rendered issues

structural + rendered issues
  -> Preflight.withIssues(...)
  -> canonical dedup/sort/count/status
  -> existing Catálogo Preflight UI
```

The important boundary is not “structural vs DOM”. It is **authority before observation**:

- R6a observes established state/document facts;
- R6b observes an established renderer fact;
- neither invents a fact merely because it would be useful to validate.

## Invariants preserved

R6 did not change the foundational authorities:

- ProductStore/ProductSnapshot;
- CatalogStore/CatalogSnapshot;
- AssetIndexStore/AssetIndexSnapshot;
- TemplateStore/TemplateSnapshot;
- `CatalogOrder`;
- `CatalogDocument`;
- exact `templateId + templateVersion` binding;
- `TemplateContract`;
- Card/Collection/Table structural vocabulary;
- Product vs presentation separation;
- image selection/framing semantics;
- isolated print pipeline.

Preflight remains ephemeral and observational.

Severity does not authorize mutation or export interception.

## Why there is no R6c

The post-R6b biopsy evaluated the four obvious adjacent candidates:

1. actual image-load failure;
2. Table factual visibility/truncation;
3. collision/overflow geometry;
4. logical-vs-physical page parity exposed to authors.

None currently has the same bounded authority/lifecycle that justified R6b.

### Image-load failure

Print already observes `complete/naturalWidth/decode/load/error`, but preview `catalog-rendered` does not wait for asynchronous image settlement. A correct author-facing issue needs a new settlement/invalidation lifecycle.

### Table visibility

Table has deterministic width planning and CSS clipping, but no explicit per-cell factual-visibility signal. Character demand is not rendered truncation truth.

### Collision/overflow

Browser gates contain targeted geometry checks, not a generic collision policy. A runtime scanner would need participants, tolerances, stabilization timing and intentional-overlap exclusions first.

### Physical page parity

The strongest authority is the Browser Print Gate, which generates a Chromium PDF and checks it with `pdf-lib`. The browser editor cannot claim equivalent physical-PDF knowledge merely from DOM page count.

Detailed evidence and re-entry conditions are recorded in `R6-POST-R6B-BIOPSY.md`.

## Positive closeout decision

“No R6c” is intentional.

Continuing the milestone only because the remaining concerns are publication-related would push R6 from a bounded observation system toward a generic validation framework.

The architecture gains more by preserving the distinctions:

- synchronous structural truth;
- explicit rendered truth;
- asynchronous resource truth;
- physical export truth;
- targeted browser regression geometry.

Those are not interchangeable signal sources.

## Gates inherited by the completed milestone

R6a and R6b were each promoted only after canonical Validate + Browser gates on the exact feature head and again on the PR head.

R6b additionally proves:

- no second fitting pass;
- no geometry/style reads in `PreflightRender`;
- deterministic merge with R6a blockers;
- preview/isolated-print parity for the controlled truncation case;
- Table negative control;
- no mobile horizontal overflow.

The broader Browser Print Gate remains the authority for physical A4/PDF parity.

## Post-R6 direction

There is **no preselected R7 slice** from this closeout.

The next product slice should come from fresh evidence and may belong to a different axis entirely.

Good reasons to reopen one of the parked publication candidates include:

- repeated real catalogs exposing an image-load defect that authors cannot diagnose;
- a concrete Table value whose invisibility causes a publication error;
- a reproducible collision class with a bounded participant set;
- a requirement to validate an actual generated PDF before release.

Until then, keep the current Preflight small and trustworthy.