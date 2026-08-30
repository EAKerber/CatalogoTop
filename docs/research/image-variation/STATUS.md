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
5. deterministic render quality;
6. master raster resolution;
7. human fidelity / presentation review;
8. optional Class C generation risk.

No ProductStore/backend, main-editor runtime, deploy, `main` or `v2` semantics have been changed.

The current production-facing conclusion remains **research only**.

## Evidence inventory

### Benchmark and exact sources

- `experiments/image-variation/benchmark.v1.json` — 14 predeclared placement cases across seven source families.
- `experiments/image-variation/source-readback.v1.json` — exact MIME, dimensions, byte lengths and SHA-256 evidence for all seven source families.

Exact source families:

| Source | Dimensions | Key role |
| --- | ---: | --- |
| H45 | 450×450 | strong elongated-hardware case |
| Soft Extra | 800×800 | canvas-removal-dominant slide case |
| Soft Close | 420×420 | illustrative-source authority case |
| Hinge | 450×450 | multi-piece group + semantic labels |
| Piston | 450×450 | white-on-white + illustrative warning |
| Caster | 128×128 | source-resolution negative control |
| Round leg | 800×800 | composite source / semantic-role negative control |

The source readback used an isolated GitHub Actions probe because the local runtime could not resolve the public source CDNs directly. That remains transport evidence only; it is not the semantic image solution.

## Deterministic composition results

### H45 wide

- Original contain bbox utilization: **15.7%**
- segmented/preserve: **41.4%**
- align horizontal: **74.0%**
- explicit fidelity review: **PASS FOR BENCHMARK COMPARISON**

Canvas removal and whole-group reorientation are both materially useful.

### Soft Extra wide

- Original contain: **6.6%**
- segmented/preserve: **45.8%**
- align horizontal: **52.2%**
- fidelity/authority review: **REVIEW-REQUIRED**

Most utility comes from removing wasted canvas; rotation adds comparatively little. Exact pixels are known, but commercial authority remains family-level.

### Soft Close wide

- Original contain: **11.5%**
- segmented/preserve: **70.1%**
- forced horizontal: **27.4%**
- fidelity/authority review: **REVIEW-REQUIRED**

The correct geometric decision is preserve. The current product page describes imagery as illustrative, so source-pixel fidelity is not enough to establish product truth.

## Semantic / negative-control results

### Hinge standard

The source decomposes into three dominant hinge components plus the labels `RETA`, `CURVA` and `SUPER CURVA`.

- Original contain bbox utilization: **36.5%**
- trim external canvas while preserving labels: **60.0%**
- product-only with same layout but labels removed: **62.3%**

Preferred research candidate: **trim-preserve-annotations**. The small additional geometric gain does not justify throwing away commercial variant mapping.

### Round leg

The source contains an isolated product plus an application inset. Image-level principal axis is therefore not product-level semantic authority.

Current correct outcome: **no automatic variant** until visual role/subject selection is resolved.

### Caster

Exact source is only 128×128. A larger placement/master can magnify the raster but cannot recover factual wheel/fork/brake detail.

Current role: explicit source-resolution negative control.

### Piston

The source visibly includes `Imagem meramente ilustrativa`, reaches source borders and is fragile under the simple light-neutral segmentation baseline.

An edge-gated percentile-consensus probe preserves the ~3× horizontal factual-presence finding while exposing parameter sensitivity, but remains research-only and is **not** promoted into the core segmenter.

## Core evidence-backed rules

Current strongest rules are:

- resolve factual subject / visual role before orientation planning;
- remove irrelevant source canvas before deciding whether rotation is useful;
- use disconnected components as structural evidence, not automatic semantic roles;
- preserve low-cost semantic annotations unless their meaning is safely represented elsewhere;
- evaluate bbox utilization together with factual foreground/effective presence;
- expose segmentation/isolation sensitivity rather than tuning until an image looks right;
- keep source authority separate from source-pixel fidelity;
- keep output raster dimensions separate from factual source resolution;
- keep `no variant` as a first-class valid result.

## Human review

`docs/research/image-variation/FIDELITY-REVIEW.md` covers factual identity/authority, piece count, geometry, holes/fittings, source boundaries, orientation, annotations, resolution honesty and provenance.

Allowed outcomes remain:

- `PASS FOR BENCHMARK COMPARISON`
- `REVIEW-REQUIRED`
- `REJECT / NO VARIANT`

No result is automatically production-approved.

## First grounded Class C trial

Plan: `experiments/image-variation/class-c-h45-plan.v1.json`  
Result: `experiments/image-variation/results/h45-class-c-producer-failure.v1.json`

The H45 trial was deliberately narrow: Class C was only allowed to improve presentation cleanup/edge quality while preserving the exact two-piece factual hardware group.

Three bounded attempts failed the producer contract. Instead of returning an edited factual photograph, the available producer repeatedly returned research-report/infographic images and introduced unmeasured text, metrics and verdicts.

Current outcome:

**`CLASS_C_NOT_JUSTIFIED_PRODUCER_CONTRACT_FAILURE`**

This is evidence against that producer/channel as the current R-IMG-1 Class C mechanism. It is **not** evidence that every possible source-grounded generative editor is incapable of adding value.

Invalid producer outputs must never be treated as benchmark evidence.

## Deterministic render-quality control

`experiments/image-variation/results/h45-render-quality.v1.json` showed that the presentation-quality objective reserved for Class C can be substantially addressed deterministically.

The alpha-aware candidate uses deterministic interpolation over the same source pixels, foreground mask and reviewed composition. It adds antialiased boundary samples, not product geometry.

Outcome: **PASS FOR BENCHMARK COMPARISON** as a stronger deterministic presentation baseline.

## R-IMG-1.1 — placement / master resolution decoupling

Current checkpoint: `docs/research/image-variation/R-IMG-1.1.md`

The user's observed failure mode was valid: a logical holder such as `440×180` should not silently become the raster-resolution target of the reusable asset.

Implemented research boundary:

```text
placement plan (logical geometry)
        ↓
master render profile (same relative geometry)
        ↓
alpha-aware deterministic master
        ↓
deterministic downsample
        ↓
placement preview
```

Artifacts:

- `experiments/image-variation/render-profiles.v1.json`
- `scripts/research/image-render-master.mjs`
- `docs/research/image-variation/PRESENTATION-REVIEW.md`
- `experiments/image-variation/results/master-render-self-test.v1.json`
- `experiments/image-variation/results/h45-wide-master.v1.json`
- `experiments/image-variation/results/soft-extra-wide-master.v1.json`

Initial research profile: wide placement `440×180` → master `1760×720` (4×). The 4× factor is a fixture, **not** a production contract.

### Renderer self-test

- relative placement/master geometry preserved exactly;
- deterministic antialias coverage present;
- normalized factual-coverage delta: ~**0.00035%**;
- placement preview derived from master by integer box downsample.

### H45 4× master

- composition remains ~**73.9%** bbox utilization;
- normalized factual coverage remains effectively unchanged;
- presentation outcome: **PASS FOR MASTER BASELINE**;
- existing factual outcome: **PASS FOR BENCHMARK COMPARISON**.

The 1760×720 raster is a denser transform asset. It does **not** convert the 450×450 source into higher factual source resolution.

### Soft Extra 4× master

- composition remains ~**52.2%** bbox utilization;
- normalized factual coverage remains effectively unchanged;
- presentation outcome: **PASS FOR MASTER BASELINE**;
- source/fidelity outcome remains **REVIEW-REQUIRED**.

This demonstrates that presentation/resolution quality can pass independently of source commercial authority.

## Current architecture

```text
CatalogDocument placement
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
master render profile
        ↓
deterministic alpha-aware render
        ↓
placement downsample + detail review
        ↓
utility + isolation + fidelity + presentation evidence
        ↓
optional Class C comparison only if still justified
```

## Current conclusion

For the cases tested so far, the ordinary path is converging toward:

> understand the source → isolate factual content → preserve semantic meaning → choose composition → render a high-quality master deterministically → derive placement preview → review fidelity/authority → say no when evidence is insufficient.

Generation is no longer assumed to be the default method for obtaining a useful variant. Any future Class C producer must beat the stronger deterministic master baseline at both master and placement scale without adding factual uncertainty.

## Next step

1. Apply the master-render path to **Soft Close** and **hinge** to test preserve-orientation and multi-piece/annotation behavior.
2. Apply it to **caster** as a source-limited negative control; a 4× master must not become a false “high-resolution success”.
3. Compare fixed 4× against a source-aware/adaptive master factor before freezing any default resolution policy.
4. Keep the current Class C trial closed unless a producer with a reliable source-image edit contract becomes available.
5. Do not integrate the research renderer into production or freeze a production `generationIntent`/result schema from this evidence alone.
