# R-IMG-1.2 — Provisional transform-severity raster policy

Status: research-only / provisional  
Branch: `research/semantic-image-variation-v2`

## Purpose

R-IMG-1.2 shows that one master factor should not be used as a universal quality setting.

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
transform-severity assessment
      ↓
raster quality profile
      ↓
master → placement preview
```

Raster quality may improve how an already-approved transform is sampled. It may **not** decide which product, component, annotation or orientation is semantically correct.

## Current evidence

### H45

The approved composition contains a substantial off-axis whole-group rotation. Higher-order 4×→8× exploration still changes the final `440×180` placement materially; 8×→12× is near saturation.

Research reading: **higher sampling effort is justified by transform severity**.

### Soft Close

The approved composition preserves orientation and mainly removes neutral canvas. Bilinear 4× vs higher-order 8× differs negligibly at placement scale.

Research reading: **8× is safe but unnecessary**.

### Hinge

The approved composition preserves orientation and semantic annotations while trimming external canvas. Bilinear 4× vs higher-order 8× again differs negligibly.

Research reading: **8× is safe but unnecessary; annotation preservation remains the stronger constraint**.

### Caster

The source is only 128×128. Higher sampling effort can clean transform presentation slightly, but cannot recover wheel/fork/brake detail.

Research reading: **source resolution remains an independent ceiling; raster effort must not imply factual recovery**.

## Candidate profiles

These are research roles, not production field names.

### `quality-mild`

Candidate implementation:

- premultiplied higher-order reconstruction;
- 4× master fixture;
- deterministic placement downsample;
- no sharpening / super-resolution.

Intended role: preserve-orientation or near-axis transforms where additional 8× sampling has no material placement-scale benefit.

### `quality-transform-heavy`

Candidate implementation:

- same premultiplied higher-order reconstruction;
- 8× experimental master ceiling;
- deterministic placement downsample;
- no sharpening / super-resolution.

Intended role: meaningful off-axis rotation/recomposition or another transform that demonstrably benefits from denser sampling.

### `quality-diagnostic`

- 12× only for saturation/diagnostic comparison;
- never a default from current evidence.

## Severity signals to investigate

Do not freeze thresholds yet. Useful signals include:

1. angular distance from an axis-aligned transform;
2. fitted source scale required by the approved placement plan;
3. whether transform boundaries cross source pixels substantially (rotation/shear-like resampling burden);
4. master→placement reduction ratio;
5. source-resolution ceiling and effective factual foreground size.

No single signal should become a quality score without cross-source evidence.

In particular:

- target dimensions alone are insufficient;
- source dimensions alone are insufficient;
- a product being elongated is irrelevant unless the semantic planner already chose a transform;
- low source resolution may justify a warning/review state, not automatically more supersampling.

## Benchmark mapping before threshold calibration

| Source/case | Semantic state | Provisional raster role |
| --- | --- | --- |
| H45 wide | approved off-axis whole-group reorientation | `quality-transform-heavy` candidate |
| Soft Extra wide | off-axis reorientation gives modest composition gain; authority review remains | test `quality-transform-heavy`, do not auto-approve |
| Soft Close wide | preserve orientation | `quality-mild` candidate |
| Hinge standard | preserve group + annotations | `quality-mild` candidate |
| Caster | preserve; 128×128 source-limited | standing negative control; no factual-resolution promotion |
| Piston | isolation uncertain / illustrative | no automatic quality-profile promotion before isolation review |
| Round leg | composite visual roles unresolved | no raster-profile decision before subject-role selection |

## Non-negotiable invariants

- The raster profile never changes `placementPlan`.
- The raster profile never changes source authority.
- The raster profile never changes factual piece/group membership.
- A higher factor never upgrades `sourceResolution` or equivalent evidence.
- `no variant` remains valid before rasterization.
- A source-limited image remains source-limited after a larger master render.
- Class C must be compared against the selected deterministic profile, not against a deliberately weaker baseline.

## Next calibration

1. Run Soft Extra through the mild/heavy comparison while keeping its existing semantic/authority caveats.
2. Use round-leg as a guard that raster policy cannot run ahead of unresolved subject-role semantics.
3. Keep caster in every future sampling/upscale regression.
4. If the mapping holds, replace the fixed-factor question with a small explicit transform-severity policy in the research core.
5. Only then decide whether the Mitchell sampler should be folded into `image-render-master.mjs` or remain a selectable downstream strategy.
