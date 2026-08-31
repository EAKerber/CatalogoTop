# R-IMG-1.4 — Native source-grounded producer trial

Status: **research only / producer contract failure**

## Question

Can the currently available source-grounded image producer return a native high-resolution H45 image asset when logical placement geometry is separated from output raster requirements?

This trial is intentionally narrower than a viewpoint experiment. Viewpoint must remain unchanged here.

## Input authority

- source: exact H45 public readback;
- SHA-256: `e6ed49ef777da2f6da8c627180370a8cafb45274b07f7bccf1742b9488614bb7`;
- source raster: `450×450`;
- placement: logical `440×180`, aspect `22:9`;
- physical holder: about `116.42×47.63 mm`;
- minimum 300-DPI use raster: about `1376×563`;
- preferred research master: `1760×720`.

## Frozen invariants

The requested output must:

- depict the same H45 product identity;
- preserve the same two factual slide pieces;
- preserve visible holes, rails, fittings, terminals and relative geometry;
- preserve viewpoint in this experiment;
- use neutral white canvas/background as needed;
- be returned as a product-image asset, not as a report, dashboard, comparison board or infographic.

The trial does **not** authorize hallucinated reconstruction to recover source detail.

## Attempts

Two attempts were made.

### Attempt 1

The producer returned a `1536×1024` multi-panel research infographic rather than a source-grounded H45 image asset. Its `3:2` aspect did not follow the requested `22:9` composition and the depicted hardware was not a faithful edit of the factual H45 source.

### Attempt 2 — explicit exact-source reference

The exact H45 source image was explicitly supplied as the target reference. The producer again returned a `1536×1024` research infographic rather than an edited product-image asset.

The generated report included PASS labels, metrics and experiment claims. Those statements are **not evidence**: none may be accepted unless independently measured by the research pipeline.

## Decision

`CLASS_C_NATIVE_MASTER_NOT_EVALUABLE_WITH_CURRENT_PRODUCER_CHANNEL`

The experiment stops before visual-quality comparison because the producer did not satisfy the output-shape/source-grounding contract.

A large returned raster is not sufficient evidence of high-resolution contract compliance when:

- the returned object is not the requested asset type;
- aspect/composition authority was ignored;
- factual product identity is not preserved.

## Consequence for viewpoint research

Do **not** run the planned viewpoint/angle-change experiment through this producer/channel yet. Viewpoint change has a higher factual risk than the fixed-view native-master trial, so it must not proceed through a channel that cannot first return a reliable source-grounded edit.

This is a producer/channel stop condition, not a general rejection of generative viewpoint variation.

## Next useful work

Continue the non-generative research where evidence is available:

1. finish placement-reuse boundaries across wide / standard / collection / Table;
2. keep physical-use raster adequacy independent from source factual resolution;
3. define the stricter predeclared fidelity invariants for a future viewpoint-change experiment;
4. resume Class C only when an image-edit producer reliably returns an actual source-grounded image asset.

Machine-readable result: `experiments/image-variation/results/h45-native-producer-trial.v1.json`.
