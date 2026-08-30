# R-IMG-1 — Current Research Checkpoint

Date: 2026-08-30  
Branch: `research/semantic-image-variation-v2`  
Stable baseline: `main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9` / tag `v1.0.0`

## State

R-IMG-1 has moved from biopsy/prototype into a first factual-source comparison across three elongated hardware cases.

The product/runtime boundaries remain unchanged:

- `CatalogDocument` owns structural/materialized placement, not generation intent;
- `product.image` remains canonical fallback;
- `product.imageGallery`, `presentation.imageVariants`, `presentation.imageSelections` and `presentation.imageFrames` remain distinct domains;
- V1 placement/source/signature concepts are transport evidence, not a frozen generative architecture;
- external image variation remains retired from V1 and is not reactivated in V2;
- research stays isolated from `main` and `v2`.

No ProductStore/backend, main-editor runtime, deploy or production-data semantics were changed.

## Benchmark

`experiments/image-variation/benchmark.v1.json` predeclares 14 cases across 7 hardware families.

Expected decisions remain:

- `variant-expected`: 3
- `conditional`: 6
- `no-variant-preferred`: 5

Class C remains comparison-only and requires human review.

## Factual-pixel research core

`scripts/research/image-recomposition-core.mjs`:

1. removes only light/neutral background connected to the image border;
2. estimates the factual foreground principal axis;
3. compares preserve/horizontal/vertical composition inside safe margins;
4. copies factual source pixels into the target with nearest-neighbor scaling.

The core does not grant semantic permission to rotate. Geometry is evidence only.

## Source materialization

The local runtime could view the public sources through the browser research layer but could not resolve the source CDNs directly. An isolated platform fallback was therefore exercised on `research/source-readback-h45` / draft PR #46.

GitHub Actions successfully materialized exact public bytes and recorded passive MIME/hash/dimension evidence. The probe is research-only and is not intended for product merge.

Current exact source readback:

| Source | MIME | Dimensions | Bytes | SHA-256 prefix |
| --- | --- | ---: | ---: | --- |
| H45 | JPEG | 450×450 | 16417 | `e6ed49ef777d…` |
| Soft Extra | PNG | 800×800 | 54347 | `07edaca7d481…` |
| Soft Close | JPEG | 420×420 | 9781 | `d0694fc2278a…` |

Elongated readback run: `33332404497`; artifact: `9738020897`.

This confirms that the old platform-download idea remains useful plumbing when a local sandbox cannot fetch source bytes.

## Factual wide-placement comparison

Target for all three cases: research `card-wide` = `440 × 180 px`, safe margin `7%`.

Result records:

- `experiments/image-variation/results/h45-wide.v1.json`
- `experiments/image-variation/results/soft-extra-wide.v1.json`
- `experiments/image-variation/results/soft-close-wide.v1.json`

### H45

- Original full-canvas contain bbox utilization: **15.7%**
- segmented foreground, orientation preserved: **41.4%**
- whole factual group aligned horizontally: **74.0%**
- best gain vs Original: **4.71×**
- additional gain from rotation after segmentation: **1.79×**

Interpretation: both canvas removal and whole-group reorientation are materially useful.

### Soft Extra

- Original full-canvas contain: **6.6%**
- segmented/preserve: **45.8%**
- aligned horizontally: **52.2%**
- best gain vs Original: **7.90×**
- additional gain from rotation after segmentation: only **1.14×**

Interpretation: almost all value comes from removing the enormous neutral source canvas and scaling the factual group. Rotation is secondary.

### Soft Close

- Original full-canvas contain: **11.5%**
- segmented/preserve: **70.1%**
- forced horizontal alignment: **27.4%**
- preserve gain vs Original: **6.10×**
- geometric choice: **preserve**

Interpretation: the same planner that rotated H45 correctly rejects rotation here. “Elongated product” is not enough to justify “make it horizontal”.

Soft Close also remains a source-authority stress case: the current GMAD page states that product images are merely illustrative. Pixel fidelity therefore cannot be treated as sufficient evidence of factual product truth.

## First conclusion that survived evidence

The original hypothesis needs refinement.

What the first three factual cases support is not:

> elongated hardware should be rotated to fill wide cards.

The stronger evidence-backed statement is:

> first remove irrelevant source canvas and recompute factual foreground scale; only then consider whole-group reorientation when it creates a material additional placement benefit and semantic orientation permits it.

Across all three cases, **canvas removal/recomposition is the dominant common source of value**. Rotation is strongly useful for H45, weakly useful for Soft Extra and actively harmful for Soft Close.

That is a materially better contract direction than a flat transform allowlist.

## Fidelity status

None of the three cases is automatically approved yet.

Human review still needs to check:

- visible piece count;
- characteristic rail geometry/proportions;
- holes, fittings and connectors;
- whether segmentation removed factual light pixels;
- whether orientation remains commercially/semantically natural;
- source authority, especially for illustrative/family-representative imagery.

The current result is evidence of **utility**, not a final fidelity gate.

## Current architecture

```text
CatalogDocument placement
        +
rendered target geometry
        +
factual source identity/pixels
        +
source-authority confidence
        +
research-only generation intent
        ↓
Class A/B/C candidate experiment
        ↓
utility evidence + fidelity evidence
```

Source authority is now explicitly a separate concern from pixel similarity.

## Next step

1. Run semantic negative controls, beginning with the round-leg wide case: geometry should not be allowed to rotate a product whose meaningful presentation is vertical.
2. Run the low-resolution caster control to ensure simple raster enlargement is not scored as newly created factual detail.
3. Add human fidelity review notes for H45/Soft Extra/Soft Close.
4. Decide whether foreground-canvas utilization should become a benchmark metric alongside bbox utilization; do not collapse them into one score.
5. Only after these A/B boundaries are clearer, compare one grounded Class C edit on a small subset.

Do not freeze a production `generationIntent` or result schema yet.

## Escalation boundary

Ask for product direction instead of generalizing if:

- a product class requires incompatible fidelity semantics;
- a better result requires uncertain product reconstruction;
- orientation cannot be decided from source + product class without business knowledge;
- V2 changes ownership/lifecycle of catalog-local derivatives;
- integration would require ProductStore/backend or main-editor composition changes.
