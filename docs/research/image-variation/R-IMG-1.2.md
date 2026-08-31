# R-IMG-1.2 — Raster quality before broader rollout

Status: active research slice; deterministic gate passed, cross-source regression in progress  
Branch: `research/semantic-image-variation-v2`

## Why this slice exists

R-IMG-1.1 successfully separated logical placement geometry from master raster dimensions, but human inspection exposed a second problem: the master path is structurally correct while its antialiasing and apparent image quality remain weak.

The R-IMG-1.1 renderer uses bilinear 2×2 inverse sampling and integer box downsample. That is conservative and easy to audit, but it is not a strong presentation-quality ceiling.

R-IMG-1.2 freezes everything except rasterization quality so that a smoother result cannot be confused with a semantic or factual change.

## Frozen inputs

For every R-IMG-1.2 comparison, all of these remain unchanged:

- exact source bytes and SHA-256;
- the already-selected foreground/isolation evidence;
- factual group membership;
- semantic orientation decision;
- safe-margin placement geometry;
- logical placement dimensions;
- source-authority and fidelity-review state.

Only sampling/reconstruction quality may vary.

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

## Exploration matrix vs committed sampler

The first local H45 exploration compared conventional raster paths to find a useful ceiling:

| Exploration path | Role |
| --- | --- |
| bilinear 4× + box | R-IMG-1.1 baseline |
| bicubic 4× + box | higher-order reference |
| bicubic 8× + Lanczos | quality-ceiling reference |
| bicubic 12× + Lanczos | diminishing-return diagnostic |

That exploration established the useful supersampling range but is not itself the long-lived sampler contract.

The committed research sampler is `scripts/research/image-raster-quality-probe.mjs` and uses:

- premultiplied Mitchell-Netravali reconstruction (`B=C=1/3`);
- explicit 4× / 8× / diagnostic 12× profiles;
- deterministic integer box downsample for placement review;
- cubic-overshoot clamping instead of treating ringing as factual detail;
- no sharpening or super-resolution.

## H45 finding

`experiments/image-variation/results/h45-raster-quality-probe.v1.json` records the exploratory raster diagnostics.

- 4× → 8× still changes the reduced `440×180` H45 placement materially enough to justify a stronger sampler.
- 8× → 12× is close to saturation: mean absolute RGB-channel difference is ~0.51 and only ~0.52% of placement pixels have any channel difference above 8 levels.
- The exact H45 source remains only `450×450`; supersampling cannot recover unsupported factual hardware detail.

Therefore **8× remains the experimental ceiling** and 12× remains diagnostic/non-default.

## Committed sampler self-test — PASS

Evidence: `experiments/image-variation/results/raster-quality-self-test.v1.json`.

The exact committed sampler was executed by GitHub Actions against research head `688b2b38d9d82200f0a7fd72386df55c2d6fde94`.

- workflow run: `33343209122`;
- result: `success`;
- artifact: `9741183308`;
- partial 8× coverage pixels: `30223`;
- normalized factual-coverage delta 4× vs 8×: ~`0.000115%`.

This closes the deterministic-execution gate that was previously pending. The result validates the sampler mechanics; visual/factual review remains separate.

## Source-resolution negative control — PASS

`experiments/image-variation/results/caster-raster-quality-control.v1.json` keeps the exact 128×128 caster as a negative control.

The higher-quality path modestly improves transform presentation, but wheel/fork/brake detail remains visibly source-limited. The experiment therefore does **not** convert a low-resolution source into a false high-resolution success.

Outcome: **PASS AS SOURCE-RESOLUTION NEGATIVE CONTROL**.

## Cross-source regression

### Soft Close — PASS, negligible benefit

Evidence: `experiments/image-variation/results/soft-close-raster-quality-regression.v1.json`.

Frozen decision: preserve orientation; trim only previously accepted external canvas.

At `440×180`, 4× baseline vs 8× higher-order reconstruction gives:

- mean absolute channel difference: ~`0.107`;
- P95 absolute difference: `1`;
- pixels with any channel difference >8: `0%`.

No visible geometry/halo regression was found, but there is no material presentation gain. The source-authority state remains **REVIEW-REQUIRED** because the product page marks imagery as illustrative.

### Hinge — PASS, negligible benefit

Evidence: `experiments/image-variation/results/hinge-raster-quality-regression.v1.json`.

Frozen decision: preserve the three hinge representations and `RETA / CURVA / SUPER CURVA` annotations while trimming external neutral canvas.

At `300×220`, 4× baseline vs 8× higher-order reconstruction gives:

- mean absolute channel difference: ~`0.074`;
- P95 absolute difference: `1`;
- pixels with any channel difference >8: `0%`.

No visible geometry, halo or annotation regression was found. Again, the 8× path is safe here but adds no material placement-scale benefit.

## Revised hypothesis

The useful policy is no longer “pick one larger master factor”. Current evidence separates three causes:

1. **transform severity** — rotation/non-axis-aligned recomposition creates a stronger need for higher-order sampling (H45);
2. **mild preserve-orientation transforms** — 8× can be safe but effectively redundant (Soft Close, hinge);
3. **source ceiling** — severely low-resolution sources remain low-detail regardless of supersampling (caster).

Therefore raster quality should become **transform-severity-aware** before any production/default policy is frozen.

## Promotion gate

The higher-order path may replace the current research baseline only where the selected quality profile is justified by the transform. Any promoted research policy must satisfy:

1. no semantic/placement re-planning inside rasterization;
2. no visible new/fabricated holes, fittings, rails or terminal structures;
3. no unacceptable ringing/halo;
4. stable normalized factual coverage;
5. explicit source-resolution honesty;
6. a lower-cost profile remains valid when 8× yields negligible visible benefit.

## Next step

1. Convert the current evidence into a small **transform-severity quality policy** rather than promoting 8× globally.
2. Test that policy on Soft Extra and one composite/ambiguous control to ensure it does not confuse transform complexity with source semantics.
3. Keep caster as a standing negative control for every future upscale/sampling change.
4. Only after the adaptive policy stabilizes decide whether `image-render-master.mjs` should absorb the higher-order sampler or remain layered.
5. Keep Class C separate; a future generative producer must beat the selected deterministic profile, not a deliberately weak raster baseline.
