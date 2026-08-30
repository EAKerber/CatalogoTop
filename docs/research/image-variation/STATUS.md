# R-IMG-1 — Current Research Checkpoint

Date: 2026-08-30  
Branch: `research/semantic-image-variation-v2`  
Stable baseline: `main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9` / tag `v1.0.0`

## Current state

The read-only biopsy required by the kickstart is complete enough to begin R-IMG-1 without changing product runtime code.

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

Authoritative research fixture:

`experiments/image-variation/benchmark.v1.json`

It predeclares 14 cases across 7 previously sourced Top Mobili hardware families before any new variant is generated.

Coverage intentionally includes:

- elongated slides/rails in standard and wide targets;
- a small Collection-member target;
- a multi-piece/multi-variant hinge source;
- an illustrative-source piston case;
- a known low-resolution caster case;
- a vertical round-leg case where target aspect must **not** force a semantically wrong 90° rotation;
- explicit `no-variant-preferred` outcomes.

Expected decisions in v1:

- `variant-expected`: 3
- `conditional`: 6
- `no-variant-preferred`: 5

Acceptance ceilings:

- Class A: 6 cases
- Class B: 8 cases
- Class C: 0 automatically acceptable cases

A source-grounded Class C approach remains in the benchmark only as a **comparison-only** research arm and always requires human review. It cannot silently become a fallback when Class A/B fails.

## Target profiles

The first benchmark uses three repeatable research profiles:

- `card-standard`: `300 × 220 px`, copied from an existing V1 Variation Bundle fixture;
- `collection-member`: `180 × 140 px`, copied from the same fixture family;
- `card-wide`: `440 × 180 px`, a research stress profile motivated by the observed wide-horizontal slide-card failure.

These dimensions are fixtures, not a new production layout contract. A later compatibility pass should replace/augment them with fresh rendered measurements from the current V2 placement owner when integration is actually proposed.

## Baseline validator

Run:

```bash
node scripts/research/image-variation-baseline.mjs
```

The script validates that:

- benchmark/source/target references are closed and unique;
- each case declares expected outcome before generation;
- each case declares fidelity invariants and unacceptable changes;
- automatic acceptance ceilings remain Class A/B;
- source-canvas geometry is reported only where pixel dimensions have evidence.

It also computes a deliberately weak `containAreaRatio` baseline when source-canvas dimensions are known. This measures **full source-canvas occupancy**, not product-object utilization, and therefore must not be mistaken for a fidelity or usefulness score.

Current source-pixel readback status:

- measured from prior explicit evidence: `caster` = `128 × 128 px`;
- pending fresh materialization/readback: `soft-extra`, `h45`, `soft-close`, `hinge`, `piston`, `round-leg`.

For the square 128 px caster, orthogonal rotation cannot improve canvas fit at all. More importantly, creating a larger raster would not create factual resolution. This is retained as a negative-control case against scoring simple upscaling as improvement.

## Provisional research interpretation

The repository biopsy narrows the architecture substantially:

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

The missing authority is **generation intent/evidence**, not another placement model and not a richer ZIP format.

The first hypothesis remains deliberately subtractive:

> A meaningful share of catalog value may come from segmentation + whole-object reorientation + deterministic recomposition + safe canvas/background work, without reconstructing product geometry.

The benchmark must disprove or narrow that hypothesis before a production schema is proposed.

## Next step

1. Materialize/read back the six pending factual sources and record exact byte hash, MIME and pixel dimensions without treating internet previews as source truth.
2. Record Original source-canvas baseline and, where feasible, product-object/silhouette bounding boxes separately from canvas dimensions.
3. Implement the smallest Class A/B recomposition prototype for elongated hardware only: preserve the factual object pixels, compare preserve-vs-orthogonal orientation, fit inside declared safe margins and expand neutral canvas as needed.
4. Run first on `soft-extra-wide`, `h45-wide` and `soft-close-wide`, plus negative controls (`round-leg-wide`, `caster-lowres`).
5. Only after that evidence exists, compare a source-grounded generative edit on a small subset. Do not freeze `generationIntent` or result schema yet.

## Escalation boundary

Ask for product direction instead of generalizing if evidence suggests:

- a product class needs incompatible fidelity semantics;
- a visually better result requires uncertain product reconstruction;
- semantic orientation cannot be decided from source + product class without business/product knowledge;
- V2 changes ownership/lifecycle of catalog-local derivatives;
- integration would require ProductStore/backend or main-editor composition changes.

Until one of those conditions occurs, R-IMG-1 can proceed independently on this research branch.
