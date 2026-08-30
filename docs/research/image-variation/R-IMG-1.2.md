# R-IMG-1.2 — Raster quality before broader rollout

Status: active research slice  
Branch: `research/semantic-image-variation-v2`

## Why this slice exists

R-IMG-1.1 successfully separated logical placement geometry from master raster dimensions, but human inspection exposed a second problem: the master path is structurally correct while its antialiasing and apparent image quality remain weak.

The current renderer uses bilinear 2×2 inverse sampling and integer box downsample. That is conservative and easy to audit, but it is not a strong presentation-quality ceiling.

R-IMG-1.2 freezes everything except rasterization quality so that a smoother result cannot be confused with a semantic or factual change.

## Frozen inputs

For the initial H45 probe, all of these remain unchanged:

- exact source bytes and SHA-256;
- foreground isolation;
- two-piece factual group membership;
- horizontal orientation decision;
- safe-margin placement geometry;
- logical target `440×180`;
- source-authority and fidelity review state.

Only sampling/reconstruction is allowed to vary.

## Explicit non-goals

This slice does **not** attempt:

- super-resolution;
- sharpening as factual recovery;
- generated texture;
- hole/fitting reconstruction;
- source substitution;
- a new segmentation method;
- a new orientation/occupancy planner.

A smoother edge may be presentation evidence. It is never evidence that source resolution increased.

## Probe matrix

The first local reference comparison used the same H45 placement and compared:

| Pipeline | Role |
| --- | --- |
| bilinear 4× + box | current R-IMG-1.1 baseline |
| bicubic 4× + box | higher-order reconstruction reference |
| bicubic 8× + Lanczos | current quality-ceiling candidate |
| bicubic 12× + Lanczos | diminishing-return diagnostic only |

Diagnostic edge/gradient measurements are recorded in `experiments/image-variation/results/h45-raster-quality-probe.v1.json`. They describe raster behavior; they are **not** fidelity or factual-resolution scores.

## Main finding

The useful distinction is not “more pixels is always better”.

- 4× → 8× still changes the reduced `440×180` placement materially enough to justify further review.
- 8× → 12× is close to saturation: mean absolute RGB-channel difference is ~0.51 and only ~0.52% of placement pixels have any channel difference above 8 levels.
- The exact H45 source is still only `450×450`; supersampling cannot recover unsupported factual hardware detail.

Therefore the current research ceiling is **8×**, not 12×.

## Implemented research sampler

`scripts/research/image-raster-quality-probe.mjs` adds a premultiplied Mitchell-Netravali cubic sampler (`B=C=1/3`).

Design constraints:

- operates on the same factual mask and plan;
- reconstructs color in premultiplied factual coverage;
- clamps cubic overshoot instead of interpreting ringing as new factual detail;
- introduces no sharpening or super-resolution;
- supports 4× / 8× / 12× only as explicit probe factors;
- marks 12× as non-default diagnostic.

This module is research-only and does not replace `image-render-master.mjs` yet.

## Current hypothesis

The weak appearance has two separable causes:

1. **renderer quality** — bilinear + box leaves visible room for better edge sampling;
2. **source ceiling** — once sampling improves, the 450×450 H45 source becomes the dominant limit on microdetail.

The expected good outcome is therefore not a magically sharp 1760×720 asset. It is a cleaner, more stable transform that remains honest about source detail.

## Promotion gate

The cubic path may replace the current research baseline only if it passes all of these:

1. H45 human review at master, placement and zoom scales;
2. no visible new/fabricated holes, fittings, rails or terminal structures;
3. no unacceptable ringing/halo introduced by cubic reconstruction;
4. normalized factual coverage remains stable;
5. caster 128×128 still reads correctly as a low-resolution negative control rather than a false high-resolution success.

## Next step

1. Validate the cubic sampler self-test and H45 visual result.
2. If H45 passes, run the exact same pipeline on the 128×128 caster before Soft Close/hinge.
3. Only after the negative control passes should the higher-quality sampler be tested across the remaining benchmark families.
4. Keep 8× as an experimental ceiling and 12× rejected as a default unless new evidence overturns the current saturation result.
