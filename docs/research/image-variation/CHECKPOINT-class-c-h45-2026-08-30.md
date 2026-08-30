# R-IMG-1 — H45 Class C checkpoint

Date: 2026-08-30  
Branch: `research/semantic-image-variation-v2`  
Scope: research-only; no production/runtime integration.

## What was attempted

The predeclared first grounded Class C comparison for `h45-wide` was executed only after the deterministic prerequisites were met:

- exact H45 source bytes and SHA-256 were materialized;
- the deterministic horizontal A/B candidate passed explicit benchmark-comparison fidelity review;
- Class C objectives and stop conditions were recorded before generation.

The allowed Class C objective was deliberately narrow: improve edge/background presentation quality while preserving exactly the same factual two-piece H45 group, holes, slots, fittings, terminals, proportions and viewpoint.

## Producer result — invalid output contract

Three bounded attempts were made with the available conversation image-edit producer.

All three returned research-report/infographic images instead of an edited factual product photograph. Later attempts explicitly restated and then forced the exact factual H45 source as the visual reference, but the output class did not change.

The invalid outputs also embedded unmeasured metrics, positive verdicts and branch/experiment-like state. Those generated statements are not research evidence and must not be imported into benchmark results.

Result record:

- `experiments/image-variation/results/h45-class-c-producer-failure.v1.json`

Outcome:

> `CLASS_C_NOT_JUSTIFIED_PRODUCER_CONTRACT_FAILURE`

This means the current producer path is not a valid R-IMG-1 Class C mechanism. It does **not** establish that all grounded generative image editing is incapable of adding value.

The bounded retry rule matters here: continuing to tune prompts around a repeated wrong-output-class failure would stop testing the predeclared hypothesis and begin adapting the experiment to the producer.

## Deterministic render-quality control

Because the only allowed Class C benefit was mostly presentation cleanup, a narrower control was run before seeking another generator.

The exact same factual H45 foreground and reviewed horizontal group geometry were rendered two ways:

1. nearest-neighbor rotation/scale — previous fidelity-first research baseline;
2. premultiplied-alpha Bicubic rotation + Lanczos scale — deterministic high-quality rendering.

Measured evidence:

- factual PCA axis: ~30.54°;
- same source identity and factual group in both candidates;
- nearest-neighbor partial-alpha edge pixels: 0;
- alpha-aware high-quality candidate partial-alpha edge pixels: 4,890;
- coverage-equivalent foreground remains close (~17.6k px vs ~17.2k px);
- the high-quality candidate is visibly smoother at holder size and magnified edge inspection.

Result record:

- `experiments/image-variation/results/h45-render-quality.v1.json`

Interpretation:

> The narrow presentation-quality objective reserved for the first Class C trial can be substantially addressed by deterministic interpolation without synthesizing product geometry.

This does not turn interpolation into factual evidence; it means antialiasing/background cleanup alone is no longer sufficient justification for generative editing.

## Current decision boundary

Do **not** expand Class C to Soft Extra, Soft Close, piston or other benchmark cases from this result.

Any future Class C producer must first satisfy two conditions:

1. it must reliably execute an explicit source-image edit contract and return only an inspectable image candidate rather than generated reports or self-authored verdicts;
2. it must materially outperform the new high-quality deterministic baseline in a way visible at placement size, while passing the same fidelity gate with no new unresolved factual questions.

Until then, the stronger supported path is:

```text
source authority
  → subject / role understanding
  → factual isolation with uncertainty evidence
  → semantic transform decision
  → high-quality deterministic alpha-aware rendering
  → placement utility + fidelity review
  → optional no-variant
```

## Next experiment

Generalize the high-quality deterministic renderer across the existing benchmark evidence rather than adding another generator immediately.

Priority checks:

- H45: confirm geometry and review parity with the previous A/B candidate;
- Soft Extra: verify alpha-aware rendering improves edges without masking its family-authority caveat;
- Soft Close: preserve orientation and verify no accidental source-detail strengthening;
- Hinge: preserve the full group and semantic labels;
- Caster: verify smoother enlargement is not mis-scored as added source resolution;
- Round leg and piston: keep their existing no-auto/isolation-authority constraints.

If the deterministic renderer generalizes cleanly, decide whether it should become part of the Class A/B research core. Only after that should another Class C producer be considered.
