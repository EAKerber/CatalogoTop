# R-IMG-1 — Current Research Checkpoint

Date: 2026-08-30  
Branch: `research/semantic-image-variation-v2`  
Stable baseline: `main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9` / tag `v1.0.0`

## Current state

R-IMG-1 has moved beyond the initial “can we make a better-looking variant?” question. The research path now separates:

1. factual source identity / authority;
2. semantic subject/group interpretation;
3. placement composition utility;
4. source-isolation uncertainty;
5. deterministic raster quality;
6. master-output resolution;
7. human fidelity / presentation review;
8. optional Class C generation risk.

No ProductStore/backend, main-editor runtime, deploy, `main` or productive `v2` semantics have been changed.

The current production-facing conclusion remains **research only**.

## Evidence inventory

### Benchmark and exact sources

- `experiments/image-variation/benchmark.v1.json` — 14 predeclared placement cases across seven source families.
- `experiments/image-variation/source-readback.v1.json` — exact MIME, dimensions, byte lengths and SHA-256 evidence for all seven source families.

| Source | Dimensions | Key role |
| --- | ---: | --- |
| H45 | 450×450 | strong elongated-hardware / reorientation case |
| Soft Extra | 800×800 | canvas-removal-dominant slide case |
| Soft Close | 420×420 | preserve-orientation + illustrative-source authority case |
| Hinge | 450×450 | multi-piece group + semantic labels |
| Piston | 450×450 | white-on-white + illustrative warning |
| Caster | 128×128 | source-resolution negative control |
| Round leg | 800×800 | composite source / semantic-role negative control |

## Composition/semantic findings already established

- **H45:** remove canvas + whole-group horizontal reorientation materially improves wide placement; explicit result is `PASS FOR BENCHMARK COMPARISON`.
- **Soft Extra:** most utility comes from removing wasted canvas; rotation adds only modest composition gain; authority remains `REVIEW-REQUIRED`.
- **Soft Close:** preserve orientation is the correct geometric result; source-page illustrative warning keeps authority `REVIEW-REQUIRED`.
- **Hinge:** trim external neutral canvas but preserve all three representations plus `RETA / CURVA / SUPER CURVA`; annotation removal buys too little utility.
- **Round leg:** product + application inset makes one image-level principal axis semantically invalid; correct automatic result remains no variant until subject role is resolved.
- **Piston:** simple light-neutral extraction is fragile on white-on-white hardware; uncertainty must remain observable.
- **Caster:** larger raster/placement presence never upgrades the exact 128×128 factual source evidence.

## Class C trial

Plan: `experiments/image-variation/class-c-h45-plan.v1.json`  
Result: `experiments/image-variation/results/h45-class-c-producer-failure.v1.json`

Three bounded attempts on the tested producer/channel failed the requested source-image edit contract and returned report/infographic outputs instead of a factual edited photograph.

Current scoped outcome:

**`CLASS_C_NOT_JUSTIFIED_PRODUCER_CONTRACT_FAILURE`**

This closes only the tested producer path. It does not claim all grounded generative editors are incapable of useful angle/viewpoint variation.

## R-IMG-1.1 — placement vs master raster

R-IMG-1.1 established that logical placement geometry and raster-output dimensions are separate concepts.

Example fixture:

```text
card-wide logical placement: 440×180
research master fixture:      1760×720
```

A larger master improves transform/downsample behavior but is not evidence of new factual product detail.

Key artifacts:

- `experiments/image-variation/render-profiles.v1.json`
- `scripts/research/image-render-master.mjs`
- `docs/research/image-variation/PRESENTATION-REVIEW.md`
- `experiments/image-variation/results/h45-wide-master.v1.json`
- `experiments/image-variation/results/soft-extra-wide-master.v1.json`

## R-IMG-1.2 — raster quality

Current detailed checkpoint: `docs/research/image-variation/R-IMG-1.2.md`.

The original bilinear master renderer was structurally correct but visually weak. A premultiplied Mitchell-Netravali research sampler was added in `scripts/research/image-raster-quality-probe.mjs`.

### Exact committed sampler gate — PASS

Evidence: `experiments/image-variation/results/raster-quality-self-test.v1.json`.

The exact committed JS sampler was executed by GitHub Actions against the research branch and passed:

- workflow run `33343209122`;
- artifact `9741183308`;
- normalized factual coverage remains effectively stable;
- no sharpening, super-resolution or generated detail is introduced.

### Important correction — 8× is not needed from current evidence

The first H45 exploration accidentally changed supersampling factor and filter/downsample strategy together. The apparent 4×→8× gain was therefore confounded.

`experiments/image-variation/results/mitchell-supersampling-factor-probe.v1.json` isolates the factor while keeping Mitchell reconstruction and box downsample constant.

#### H45

- `1× → 4×`: material placement-scale raster change;
- `4× → 8×`: mean RGB difference ~`0.041`, P95 `0`, no pixel differs above 4 levels.

#### Soft Extra

- `1× → 4×`: measurable placement-scale raster change;
- `4× → 8×`: mean RGB difference ~`0.016`, P95 `0`, no pixel differs above 4 levels.

Current conclusion:

> **Mitchell + moderate 4× master fixture captures the useful sampling benefit for the tested cases. 8×/12× complexity is not justified as an ordinary or transform-severity policy.**

### Cross-source regression

- `soft-close-raster-quality-regression.v1.json`: pass/no regression; 8× adds negligible placement value; authority caveat remains.
- `hinge-raster-quality-regression.v1.json`: pass/no regression; semantic labels preserved; 8× adds negligible placement value.
- `caster-raster-quality-control.v1.json`: pass as source-resolution negative control.

The provisional policy is documented in `docs/research/image-variation/RASTER-QUALITY-POLICY.md`.

## Current deterministic baseline

The leading ordinary research path is now:

```text
factual source identity + authority
        ↓
subject / role / isolation evidence
        ↓
semantic composition plan
        ↓
premultiplied Mitchell reconstruction
        ↓
moderate master raster fixture
        ↓
deterministic placement preview
        ↓
utility + fidelity + authority + resolution review
```

Important: the current `4×` result answers **sampling quality**, not the final product question “what should the reusable/export/print master dimensions be?”.

## Adjacent V1 gap discovered — Table image editing

`docs/research/image-variation/TABLE-IMAGE-EDITING-GAP.md` records a separate V1 authoring gap discovered during this research.

V1 Table rows can render `product.image`, but Table is outside the current `imageFrames`, image-selection and Variation Bundle placement contracts. A `table-row` inspector therefore cannot frame/select its image independently.

The V2 direction should be placement-aware rather than simply reusing the product-level frame, because a Table cell, Card and Collection member can require different framing for the same factual asset.

This is recorded as a V2 requirement; it does not interrupt or modify V1 during R-IMG-1.

## Current architecture

```text
Catalog placement / usage
        +
factual source identity/pixels
        +
source authority / visual role
        ↓
subject/component decomposition when necessary
        ↓
semantic role preservation or explicit selection
        ↓
placement composition plan
        ↓
master-output profile
        ↓
higher-quality deterministic raster
        ↓
placement/print derivation
        ↓
utility + isolation + fidelity + authority + resolution evidence
        ↓
optional Class C only if it still adds material value
```

## What remains open

The next unresolved boundary is **master-output resolution**, not antialiasing factor.

Questions now include:

- what raster dimensions are actually needed for Card/Collection/Table holders at print/export scale;
- whether master dimensions should be use-profile-driven, source-aware, or both;
- how to expose a high-resolution deliverable without pretending a weak source contains more factual detail;
- whether generative/source-grounded producers can legitimately supply higher native-resolution alternatives while passing the same identity gates;
- how placement-aware image selection/framing extends to Table in V2.

## Next slice

### R-IMG-1.3 — master output resolution by use

1. Measure actual catalog holder → physical print/export requirements instead of using a generic multiplier.
2. Separate desired master dimensions from factual source-resolution evidence.
3. Keep caster as the source-limited negative control.
4. Determine whether `1760×720` is adequate, excessive or insufficient for real wide-card use rather than assuming 4× is a product contract.
5. Do not add 8×/12× complexity unless new isolated evidence requires it.
6. Keep Class C and Table placement support as adjacent, separately gated capabilities.
