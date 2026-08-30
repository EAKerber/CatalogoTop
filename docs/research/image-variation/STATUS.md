# R-IMG-1 — Current Research Checkpoint

Date: 2026-08-30  
Branch: `research/semantic-image-variation-v2`  
Stable baseline: `main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9` / tag `v1.0.0`

## Current state

The kickstart biopsy is complete enough to run R-IMG-1 without changing product runtime code.

Verified boundaries:

- `CatalogDocument` remains the structural/materialized-placement authority. Generation intent should wrap a materialized placement instead of being added to the renderer/domain document.
- existing V1 `placementKey`, target measurement and `usageSignature` concepts remain useful transport/identity evidence;
- `product.image` remains canonical factual fallback;
- `product.imageGallery`, `presentation.imageVariants`, `presentation.imageSelections` and `presentation.imageFrames` remain distinct domains;
- image selection and framing already have preview/print parity gates;
- AssetStore/content-addressed source handling is useful plumbing, not evidence that the semantic generation problem is solved;
- V1 retirement is still the product boundary: the external-variation feature must not be reactivated merely because transport works.

No production runtime module, ProductStore/backend contract, `v2`, `main`, deploy or production data was changed by this checkpoint.

## Benchmark v1

Authoritative fixture:

`experiments/image-variation/benchmark.v1.json`

It predeclares 14 cases across 7 previously sourced Top Mobili hardware families **before** any new variant is generated.

Coverage intentionally includes elongated slides/rails, a small Collection-member target, a multi-piece hinge source, illustrative-source cases, a known low-resolution caster, a vertical round-leg negative control and explicit `no-variant-preferred` outcomes.

Expected decisions:

- `variant-expected`: 3
- `conditional`: 6
- `no-variant-preferred`: 5

Acceptance ceilings:

- Class A: 6 cases
- Class B: 8 cases
- Class C: 0 automatically acceptable cases

A source-grounded Class C approach remains comparison-only and always requires human review. It cannot silently become a fallback when Class A/B fails.

## Target profiles

The first benchmark uses three repeatable research profiles:

- `card-standard`: `300 × 220 px`, copied from an existing V1 Variation Bundle fixture;
- `collection-member`: `180 × 140 px`, copied from the same fixture family;
- `card-wide`: `440 × 180 px`, a research stress profile motivated by the observed wide-horizontal slide-card failure.

These are fixtures, not a new production layout contract.

## Current source-authority readback

Fresh web readback on 2026-08-30 added an important distinction between **pixel-source fidelity** and **product truth**:

- H45: the current Ipê Ferragens page confirms the Renna 500 mm / 35 kg product and exposes the same historical image locator used by the prior authoring exercise. This is a stronger product/source match, although exact bytes/hash still need materialization.
- Soft Close: the current GMAD page exposes the same historical `343303-2` image locator but explicitly states that product images are merely illustrative. Therefore preserving those pixels does **not** by itself prove factual product fidelity.
- Soft Extra: a current matching HD Ferragens family page confirms invisible soft-closing, 35 kg and the size family, but exact historical image bytes still need readback.
- Caster: the current MadeiraMadeira page confirms the Renna 35 mm caster with brake and factory code `36503296`; the historical source remains a low-resolution negative control.

These observations are recorded inside the benchmark source entries instead of being kept as chat-only context.

## Baseline validator

Run:

```bash
node scripts/research/image-variation-baseline.mjs
```

It validates closed source/target references, unique case IDs, predeclared outcomes, fidelity invariants, unacceptable changes and Class A/B automatic acceptance ceilings.

It computes `containAreaRatio` only when source-canvas dimensions have evidence. This is deliberately weak: it measures full source-canvas occupancy, **not** product-object utilization.

Current source-pixel status:

- measured from prior explicit evidence: `caster` = `128 × 128 px`;
- pending exact materialization/readback: `soft-extra`, `h45`, `soft-close`, `hinge`, `piston`, `round-leg`.

The benchmark validator passes locally with all 14 cases.

## Deterministic factual-pixel recomposition prototype

Research core:

`scripts/research/image-recomposition-core.mjs`

The prototype is intentionally narrow and removable. It targets elongated hardware photographed on a light neutral background and does four things:

1. removes only light/neutral background pixels connected to the image border via flood fill;
2. estimates the foreground principal axis from factual source pixels;
3. compares preserved, horizontal-axis and vertical-axis placement under a declared safe margin;
4. renders a target raster by copying source foreground colors with nearest-neighbor scaling onto a neutral canvas.

The module does **not** decide whether a product is semantically allowed to rotate. That permission remains an external benchmark/product-class constraint.

Run the self-test:

```bash
node scripts/research/image-recomposition-core.mjs
```

Synthetic self-test result:

- status: `pass`;
- vertical elongated object in a wide holder chose `align-horizontal`;
- foreground bounding-box utilization changed from `0.0433` to `0.2587`;
- the generated raster introduced no color absent from the source/background set;
- an enclosed white detail was preserved, proving that the flood fill is border-connected rather than a global “delete white” operation.

This is evidence of composition gain only. Nearest-neighbor scaling is deliberately **not** presented as quality upscale, and the prototype does not encode/persist production assets.

Known limitations:

- light product pixels connected to the border can still be misclassified;
- principal-axis geometry is evidence, not semantic authority;
- multi-piece products and illustrative sources need stronger review semantics;
- no source decoder/materializer is bundled into this module yet.

## Provisional architecture

```text
CatalogDocument placement
        +
rendered target geometry
        +
canonical source identity/pixels
        +
research-only generation intent
        ↓
Class A/B/C candidate experiment
        ↓
utility evidence + fidelity evidence
```

The missing authority is generation intent/evidence, not another placement model and not a richer ZIP format.

Current subtractive hypothesis:

> A meaningful share of catalog value may come from segmentation + whole-object reorientation + deterministic recomposition + safe canvas/background work, without reconstructing product geometry.

The benchmark must disprove or narrow that hypothesis before a production schema is proposed.

## Next step

1. Materialize/read back the six pending source images and record exact bytes/hash, MIME and pixel dimensions.
2. Run the factual-pixel core first on `h45-wide`; it currently has the strongest source/product readback among the elongated cases.
3. Record Original source-canvas and foreground/silhouette measurements separately.
4. Compare `preserve` vs axis-aligned recomposition on H45, then repeat on Soft Extra if its exact source can be materialized.
5. Keep Soft Close as a **source-authority stress case**, not as unquestioned factual ground truth.
6. Run negative controls (`round-leg-wide`, `caster-lowres`) to verify the system can reject geometrically tempting but semantically or informationally invalid improvements.
7. Only after these results exist, compare a source-grounded generative edit on a small subset. Do not freeze `generationIntent` or result schema yet.

## Escalation boundary

Ask for product direction instead of generalizing if evidence suggests:

- a product class needs incompatible fidelity semantics;
- a visually better result requires uncertain product reconstruction;
- semantic orientation cannot be decided from source + product class without business/product knowledge;
- V2 changes ownership/lifecycle of catalog-local derivatives;
- integration would require ProductStore/backend or main-editor composition changes.

Until one of those conditions occurs, R-IMG-1 can proceed independently on this research branch.
