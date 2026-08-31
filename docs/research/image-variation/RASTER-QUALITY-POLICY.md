# R-IMG-1.2 — Raster quality policy after factor isolation

Status: research-only / provisional  
Branch: `research/semantic-image-variation-v2`

## Purpose

R-IMG-1.2 originally considered an adaptive `4× vs 8×` policy driven by transform severity. Factor-isolation evidence no longer supports that complexity.

The renderer must remain downstream of semantic composition:

```text
source + authority
      ↓
subject / role / isolation evidence
      ↓
semantic composition decision
      ↓
placement plan
      ↓
master output profile
      ↓
higher-order factual rasterization
      ↓
placement preview / print use
```

Raster quality may improve how an already-approved transform is sampled. It may **not** decide which product, component, annotation or orientation is semantically correct.

## Corrected evidence

The initial H45 exploration changed more than one variable at once: supersampling factor, reconstruction filter and downsample filter. It therefore could not establish that 8× itself was responsible for the visible gain.

`experiments/image-variation/results/mitchell-supersampling-factor-probe.v1.json` repeats the comparison with reconstruction and downsample held constant.

### H45 — rotated whole factual group

Same Mitchell reconstruction + same box reduction:

- `1× → 4×`: mean absolute channel difference ~`0.920`; P95 `7`; ~`3.31%` of placement pixels have any channel difference above 8;
- `4× → 8×`: mean difference ~`0.041`; P95 `0`; no placement pixel differs above 4 levels;
- normalized factual coverage is effectively unchanged.

Reading: rendering through a moderate denser master changes boundary sampling materially; doubling again to 8× does not.

### Soft Extra — rotated whole factual group

Same Mitchell reconstruction + same box reduction:

- `1× → 4×`: mean difference ~`0.282`; P95 `2`; ~`0.22%` of pixels differ above 8;
- `4× → 8×`: mean difference ~`0.016`; P95 `0`; no pixel differs above 4;
- normalized factual coverage is effectively unchanged.

Reading: the same saturation pattern holds on a second off-axis case.

### Soft Close and hinge — preserved orientation

Cross-source regression already showed negligible difference between the prior 4× baseline and the 8× higher-order reference, with no geometry, halo or annotation regression.

Reading: nothing in these cases justifies an 8× default either.

### Caster — 128×128 source-limited negative control

Higher raster effort cannot recover wheel/fork/brake detail. Source-resolution honesty remains independent from master dimensions and filtering.

## Current policy candidate

### Higher-order 4× master fixture

For the current wide-placement research fixture:

- logical placement remains `440×180`;
- research master remains `1760×720` (`4×`);
- reconstruction candidate is premultiplied Mitchell-Netravali (`B=C=1/3`);
- placement preview derives from the master through deterministic reduction;
- no sharpening, super-resolution or generated detail is introduced.

This is now the simplest evidence-backed candidate.

### 8× and 12×

- **8× is not justified as a default or transform-severity profile from current evidence.**
- **12× remains diagnostic only and is even less justified.**
- both may remain available to falsify the 4× ceiling in a future case, but neither should enter ordinary policy without new evidence.

## Master dimensions are still a separate product question

Rejecting 8× as an antialiasing requirement does **not** mean every deliverable master must forever be `1760×720`.

Two questions remain distinct:

1. what master raster dimensions are useful for catalog reuse/export/print;
2. how much sampling effort is required to render that master faithfully.

A larger deliverable master may be useful operationally, but it must not be justified as recovered factual resolution. The exact source dimensions remain separately recorded.

This distinction is especially important for any future Class C producer: a generated/edit master may legitimately be requested at a larger native output size, but the deterministic path must not invent detail merely to fill those pixels.

## Benchmark mapping

| Source/case | Semantic state | Current raster reading |
| --- | --- | --- |
| H45 wide | approved off-axis whole-group reorientation | Mitchell 4× master is sufficient from current evidence |
| Soft Extra wide | approved experimental reorientation; authority review remains | Mitchell 4× sufficient; raster pass does not clear authority gate |
| Soft Close wide | preserve orientation | 4× sufficient; source authority remains `REVIEW-REQUIRED` |
| Hinge standard | preserve group + annotations | 4× sufficient; preserve labels |
| Caster | preserve; 128×128 source-limited | standing negative control; larger raster never implies factual recovery |
| Piston | isolation uncertain / illustrative | no raster-policy promotion before isolation review |
| Round leg | composite visual roles unresolved | no raster decision before subject-role selection |

## Non-negotiable invariants

- Rasterization never changes `placementPlan`.
- Rasterization never changes source authority.
- Rasterization never changes factual piece/group membership.
- Higher output dimensions never upgrade factual source resolution.
- `no variant` remains valid before rasterization.
- Source-limited imagery remains source-limited after a larger master render.
- Class C must be compared against the strongest selected deterministic baseline, not a deliberately weak renderer.

## Current next step

1. Treat Mitchell 4× as the leading deterministic raster candidate for the existing placement/master fixture.
2. Run one regression over the remaining supported deterministic families; do not render unresolved round-leg/piston semantics merely to exercise the sampler.
3. Keep caster as a standing negative control.
4. Decide separately whether the long-lived master-output dimensions should remain fixed 4×, be print/use-profile driven, or be source-aware.
5. Only after that boundary is clear decide whether to fold Mitchell into `image-render-master.mjs` and remove the weaker research path.
