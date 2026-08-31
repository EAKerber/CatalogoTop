# R-IMG-1.2 — Raster quality before broader rollout

Status: evidence-complete for the current benchmark slice  
Branch: `research/semantic-image-variation-v2`

## Why this slice exists

R-IMG-1.1 separated logical placement geometry from master raster dimensions, but human inspection showed that the first bilinear master renderer still had weak antialiasing/apparent raster quality.

R-IMG-1.2 freezes source, semantics, isolation and placement geometry and changes only raster sampling. A smoother result cannot therefore be confused with a different product/composition decision.

## Explicit non-goals

This slice does **not** attempt:

- super-resolution;
- sharpening as factual recovery;
- generated texture/detail;
- hole/fitting reconstruction;
- source substitution;
- a new segmentation method;
- a new semantic/orientation planner.

A smoother edge is presentation evidence only. It never increases factual source resolution.

## Initial exploration and confound

The first H45 reference exploration compared:

- bilinear 4× + box;
- bicubic 4× + box;
- bicubic 8× + Lanczos;
- bicubic 12× + Lanczos.

It correctly showed that the original bilinear path was weak and that 8×→12× was near saturation. However, 4×→8× changed both **factor and filters**, so it could not prove that 8× itself caused the visible gain.

This confound is now explicitly superseded by `experiments/image-variation/results/mitchell-supersampling-factor-probe.v1.json`.

## Committed higher-order sampler — PASS

`scripts/research/image-raster-quality-probe.mjs` implements premultiplied Mitchell-Netravali reconstruction (`B=C=1/3`) with cubic-overshoot clamping and deterministic reduction.

The exact committed sampler was executed on GitHub Actions against research head `688b2b38d9d82200f0a7fd72386df55c2d6fde94`.

Evidence: `experiments/image-variation/results/raster-quality-self-test.v1.json`.

- workflow run `33343209122`: **success**;
- partial 8× coverage pixels: `30223`;
- normalized factual-coverage delta 4× vs 8×: ~`0.000115%`;
- no sharpening, super-resolution or generated product detail.

## Factor isolation — main result

Reconstruction and downsample were then held constant while only supersampling factor changed.

### H45

Approved whole-group rotation ~30.54°.

- Mitchell `1× → 4×`: mean absolute RGB-channel difference ~`0.920`, P95 `7`, ~`3.31%` of placement pixels differ above 8 levels;
- Mitchell `4× → 8×`: mean difference ~`0.041`, P95 `0`, no placement pixel differs above 4 levels;
- normalized factual coverage remains effectively unchanged.

### Soft Extra

Approved experimental whole-group rotation ~31.54°.

- Mitchell `1× → 4×`: mean difference ~`0.282`, P95 `2`, ~`0.22%` of pixels differ above 8 levels;
- Mitchell `4× → 8×`: mean difference ~`0.016`, P95 `0`, no placement pixel differs above 4 levels;
- normalized factual coverage remains effectively unchanged.

### Conclusion

**4× captures the useful supersampling benefit for the current rotated cases. 8× is not justified as a default or transform-severity profile.**

The previous apparent H45 4×→8× gain was mainly evidence for a better filtering path, not for doubling master factor.

## Cross-source regression

### Soft Close

Evidence: `experiments/image-variation/results/soft-close-raster-quality-regression.v1.json`.

Preserve-orientation candidate passes without visible geometry/halo regression. Additional 8× effort has negligible placement benefit. Source authority remains independently `REVIEW-REQUIRED` because the current page marks imagery as illustrative.

### Hinge

Evidence: `experiments/image-variation/results/hinge-raster-quality-regression.v1.json`.

The three hinge representations and `RETA / CURVA / SUPER CURVA` annotations remain preserved. No visible halo/label regression was found; extra 8× effort again brings negligible benefit.

### Caster negative control

Evidence: `experiments/image-variation/results/caster-raster-quality-control.v1.json`.

The exact 128×128 source remains visibly source-limited even under stronger sampling. Wheel/fork/brake detail is not newly resolved.

Outcome: **PASS AS SOURCE-RESOLUTION NEGATIVE CONTROL**.

## Current deterministic raster baseline

For this research benchmark the leading ordinary path is now:

```text
approved placement plan
      ↓
premultiplied Mitchell reconstruction
      ↓
4× research master fixture
      ↓
deterministic placement downsample
```

This is a presentation-quality baseline, not a factual-resolution upgrade.

`8×` and `12×` remain diagnostic/falsification options only unless a future real case shows a material 4×→8× gain with all other variables held constant.

## What R-IMG-1.2 does not answer

The fact that 4× is enough for **sampling quality** does not prove that `1760×720` is the ideal long-lived/export/print master resolution.

Those are separate questions:

1. how densely must an approved transform be sampled to avoid poor antialiasing;
2. what raster dimensions should a reusable master asset have for its intended catalog/print/export use.

R-IMG-1.2 answers the first for the current benchmark: moderate 4× sampling is sufficient.

The second becomes the next research slice.

## Next step

1. Determine master-output resolution from actual holder/print/use requirements rather than a generic multiplier.
2. Keep source dimensions and factual-resolution evidence independent from that output profile.
3. Preserve caster as a negative control for any future upscale/resolution work.
4. Do not integrate 8× complexity or an adaptive-factor policy without new evidence.
5. Keep Class C separate; any future generative producer must beat the Mitchell 4× deterministic baseline while preserving factual identity.
