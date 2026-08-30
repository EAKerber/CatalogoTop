# R-IMG-1.1 — Placement / Master Resolution Decoupling

Status: implemented research slice. No production/runtime integration.

## Question

Does a logical catalog holder such as `440 × 180` need to be the raster size of the image-variation asset, or should composition geometry and output raster resolution be independent?

R-IMG-1.1 implements the second model.

## Implemented boundary

```text
factual source pixels
        +
semantic/fidelity decisions
        +
placement plan (logical geometry)
        ↓
master render profile (same relative geometry, denser raster)
        ↓
alpha-aware deterministic master render
        ↓
deterministic downsample
        ↓
placement preview
```

The placement remains the composition authority. The master is a render-resolution choice only.

## Research profiles

`experiments/image-variation/render-profiles.v1.json` defines 4× master fixtures for the current placement profiles:

| Placement | Logical size | 4× master |
| --- | ---: | ---: |
| card-wide | 440×180 | 1760×720 |
| card-standard | 300×220 | 1200×880 |
| collection-member | 180×140 | 720×560 |

The 4× factor is a research fixture, **not** a production contract.

## Renderer

`scripts/research/image-render-master.mjs` adds:

- pure scaling of an existing recomposition plan into master coordinates;
- inverse affine bilinear sampling;
- premultiplied factual coverage at subject boundaries;
- opaque neutral-background compositing;
- deterministic integer box downsample from master to placement;
- coverage-alpha evidence kept separately from the composited output;
- a standalone deterministic self-test.

The renderer deliberately does not own:

- product/source authority;
- semantic permission to rotate;
- segmentation choice;
- image decoding/encoding or persistence;
- promotion into product truth.

Those remain external boundaries.

## Self-test

`experiments/image-variation/results/master-render-self-test.v1.json` records a passing synthetic test:

- placement: 220×90;
- master: 880×360;
- scale: 4×;
- relative geometry preserved exactly;
- antialiased partial-coverage pixels present at master scale;
- normalized factual-coverage delta between direct and 4× master render: ~0.00035%.

This is evidence that raster density can change without silently re-planning the product composition.

## H45 result

`experiments/image-variation/results/h45-wide-master.v1.json`

Source: exact 450×450 H45 JPEG.  
Placement: 440×180.  
Master: 1760×720.

Measured evidence:

- horizontal composition bbox utilization remains ~73.9%;
- normalized factual coverage is effectively unchanged between direct placement and 4× master;
- direct-placement vs master-downsample RGB mean absolute channel difference: ~0.85;
- the difference is concentrated in transform/boundary sampling rather than changed composition;
- source-to-master scale exceeds 3.6×, therefore the master must **not** be described as containing 3.6× more factual detail.

Presentation outcome: **PASS FOR MASTER BASELINE**.  
Existing factual outcome: **PASS FOR BENCHMARK COMPARISON**.

## Soft Extra result

`experiments/image-variation/results/soft-extra-wide-master.v1.json`

Source: exact 800×800 PNG.  
Placement: 440×180.  
Master: 1760×720.

Measured evidence:

- horizontal bbox utilization remains ~52.2%;
- normalized factual coverage is effectively unchanged between direct placement and 4× master;
- direct-placement vs master-downsample RGB mean absolute channel difference: ~0.25;
- source-to-master fitted scale is ~3.0×, still requiring resolution-honesty language.

Presentation outcome: **PASS FOR MASTER BASELINE**.  
Existing factual/authority outcome: **REVIEW-REQUIRED**.

This is a useful separation: render quality can pass while source authority remains unresolved.

## Decisions from this slice

### 1. Placement geometry and master raster resolution are separate axes

A placement profile answers **how the product should compose**. A master profile answers **at what raster density that composition should be materialized**.

Changing the second must not silently change the first.

### 2. Placement preview should derive from the master

Independent placement and master renders can differ because they sample transform boundaries differently. R-IMG-1.1 therefore treats the master as the render authority and derives the placement preview from it by deterministic downsample.

### 3. Higher output resolution is not higher factual source resolution

A larger raster can improve:

- edge sampling;
- antialiasing;
- downstream reductions;
- crop flexibility;
- presentation consistency.

It cannot recover holes, fittings, texture or geometry that the source never resolved.

### 4. Resolution alone is not a reason to invoke Class C

The H45 Class C producer trial already failed its edit-output contract. R-IMG-1.1 further raises the deterministic baseline: a future grounded generator must outperform the master-render path at both master and placement scales while still passing factual review.

## Presentation review gate

`docs/research/image-variation/PRESENTATION-REVIEW.md` adds a second review axis beside `FIDELITY-REVIEW.md`.

A candidate is now evaluated separately for:

- factual identity/authority;
- composition utility;
- master/placement presentation quality;
- source-resolution honesty.

No one axis can promote a candidate by itself.

## Current reading

The user's observed failure mode was real: treating `440×180` as both a logical holder and an output-resolution target artificially lowers the ceiling of otherwise useful variations.

The research implementation now removes that coupling.

At the same time, the experiment shows why simply asking for “more pixels” is insufficient: both initial masters exceed their source sampling along the fitted product axis. Their value is better rendering and downstream sampling, not invented factual resolution.

## Next step

1. Re-run the master path on Soft Close and hinge to test preserve-orientation and multi-piece/annotation semantics.
2. Use caster as an explicit source-limited negative control: a 4× master must not convert a 128×128 source into a “high-resolution” success.
3. Compare fixed 4× against a source-aware/adaptive master factor before freezing any default.
4. Only reconsider Class C when a producer can reliably return a source-grounded edited photograph and materially beat this stronger deterministic baseline at both master and placement scales.

Do not integrate this renderer into production or freeze the 4× factor from R-IMG-1.1 alone.
