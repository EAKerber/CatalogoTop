# R-IMG-1 — Current Research Checkpoint

Date: 2026-08-30  
Branch: `research/semantic-image-variation-v2`  
Stable baseline: `main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9` / tag `v1.0.0`

## State

The kickstart biopsy is complete and R-IMG-1 is now producing factual-source evidence without changing product runtime code.

Current boundaries remain:

- `CatalogDocument` owns structural/materialized placement, not generation intent;
- `product.image` remains canonical fallback;
- `product.imageGallery`, `presentation.imageVariants`, `presentation.imageSelections` and `presentation.imageFrames` remain distinct domains;
- existing V1 `placementKey`, target measurement, source hash and deterministic fallback concepts remain useful transport evidence;
- V1 external variation remains retired from the product line;
- research is isolated from `main` and `v2`.

No ProductStore/backend, main-editor runtime, deploy or production-data semantics were changed.

## Benchmark

`experiments/image-variation/benchmark.v1.json` predeclares 14 cases across 7 hardware families before new outputs are evaluated.

Expected decisions:

- `variant-expected`: 3
- `conditional`: 6
- `no-variant-preferred`: 5

Automatic acceptance ceilings remain Class A/B only. Class C is comparison-only and requires human review.

## Deterministic factual-pixel prototype

`scripts/research/image-recomposition-core.mjs` remains the narrow Class A/B core:

1. remove only light/neutral background connected to the image border;
2. estimate foreground principal axis;
3. compare preserve/horizontal/vertical placement within safe margins;
4. copy factual foreground pixels into the target raster with nearest-neighbor scaling.

The module deliberately does not decide whether a product is semantically allowed to rotate. Geometry is evidence, not product authority.

Synthetic self-test still passes.

## First factual benchmark result — H45 wide

Result record:

`experiments/image-variation/results/h45-wide.v1.json`

The current H45 public source was materialized through an isolated GitHub Actions research probe because the local runtime could not resolve the source CDN directly.

Passive source evidence:

- source: Renna H45 / 500 mm / 35 kg listing image;
- MIME: JPEG;
- dimensions: `450 × 450 px`;
- bytes: `16417`;
- SHA-256: `e6ed49ef777da2f6da8c627180370a8cafb45274b07f7bccf1742b9488614bb7`;
- materialization run: `33332270953`;
- artifact: `9737982426`.

The source foreground under the current connected-light-neutral segmentation contains `21466` pixels with bbox `379 × 277 px`. Its principal axis is approximately `30.54°`.

For the research `card-wide` target (`440 × 180`, safe margin 7%):

- Original full-canvas contain bbox utilization: `0.156859` (~15.7%);
- segmented foreground, orientation preserved: `0.413977` (~41.4%);
- whole factual group aligned horizontally: `0.739028` (~74.0%);
- horizontal gain vs Original contain: `4.7114×`;
- horizontal gain vs segmented/preserve: `1.7852×`.

This is strong evidence that a large fraction of the placement benefit can come from **removing irrelevant source canvas + whole-group factual recomposition**, without synthesizing product geometry.

It is **not yet a fidelity pass**. Human review still needs to confirm visible piece count, characteristic rail geometry, holes/fittings and model identity. The metric proves material utility, not safe automatic approval.

## Source-materialization lesson

The V1-style platform fallback remains useful research plumbing:

```text
local runtime cannot fetch source
        ↓
platform/GitHub Actions materializes public bytes
        ↓
passive MIME/hash/dimension evidence
        ↓
research prototype operates on factual bytes
```

The isolated probe lives on `research/source-readback-h45` / draft PR #46 and is not intended for product merge.

The same isolated path is now being used to read back Soft Extra and Soft Close so the elongated-hardware comparison can use exact bytes rather than previews.

## Source-authority caveat

Pixel fidelity and product-truth authority are separate.

- H45 currently has a comparatively strong page/product/source match.
- Soft Close remains an authority-stress case because the current GMAD page states that images are merely illustrative.
- A faithful transform of an illustrative image is not automatically factual product evidence.

This distinction should influence future evidence metadata, but field names remain intentionally unfrozen.

## Current interpretation

The working architecture is still:

```text
CatalogDocument placement
        +
rendered target geometry
        +
canonical/factual source identity and pixels
        +
research-only generation intent
        ↓
Class A/B/C candidate experiment
        ↓
utility evidence + fidelity evidence
```

The main open hypothesis is now narrower:

> For elongated catalog hardware, how much reliable placement value can be obtained through source segmentation and whole-object/group recomposition before any generative reconstruction is justified?

H45 provides the first positive factual datapoint: geometric utility is large enough that a non-generative path deserves serious evaluation.

## Next step

1. Finish exact source readback for Soft Extra and Soft Close.
2. Run the same Original → segmented/preserve → aligned-horizontal comparison.
3. Compare whether the H45 gain generalizes or is source-specific.
4. Run semantic negative controls, especially the round-leg wide case, where a geometrically attractive 90° rotation should be rejected.
5. Add human fidelity review notes to H45 before calling it a benchmark pass.
6. Only after the A/B evidence is clearer, compare a grounded Class C edit on a small subset.

Do not freeze a production `generationIntent` or result schema yet.

## Escalation boundary

Ask for product direction instead of generalizing if:

- a product class requires incompatible fidelity semantics;
- a better result requires uncertain product reconstruction;
- orientation cannot be decided from source + product class without business knowledge;
- V2 changes ownership/lifecycle of catalog-local derivatives;
- integration would require ProductStore/backend or main-editor composition changes.
