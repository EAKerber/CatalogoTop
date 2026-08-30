# R-IMG-1 — Current Research Checkpoint

Date: 2026-08-30  
Branch: `research/semantic-image-variation-v2`  
Stable baseline: `main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9` / tag `v1.0.0`

## State

The first R-IMG-1 evidence cycle now covers three elongated-hardware cases and two negative controls. Product/runtime boundaries remain unchanged: no ProductStore/backend, main-editor runtime, deploy, `main` or `v2` semantics were changed.

Completed result records:

- `experiments/image-variation/results/h45-wide.v1.json`
- `experiments/image-variation/results/soft-extra-wide.v1.json`
- `experiments/image-variation/results/soft-close-wide.v1.json`
- `experiments/image-variation/results/caster-lowres.v1.json`
- `experiments/image-variation/results/round-leg-wide.v1.json`

## Exact source readback

An isolated GitHub Actions probe on `research/source-readback-h45` / draft PR #46 materialized exact public bytes because the local runtime could not resolve the source CDNs directly.

Latest run: `33332626528`; artifact: `9738077704`.

| Source | MIME | Dimensions | Bytes | SHA prefix |
| --- | --- | ---: | ---: | --- |
| H45 | JPEG | 450×450 | 16417 | `e6ed49ef777d…` |
| Soft Extra | PNG | 800×800 | 54347 | `07edaca7d481…` |
| Soft Close | JPEG | 420×420 | 9781 | `d0694fc2278a…` |
| Caster | JPEG | 128×128 | 2627 | `d92dadcbb33e…` |
| Round leg | WebP | 800×800 | 6418 | `3b415b130300…` |

This confirms that platform materialization remains useful transport plumbing without making the V1 bundle architecture the semantic solution.

## Elongated wide-placement evidence

Research target: `440 × 180 px`, safe margin 7%.

### H45

- Original contain bbox utilization: **15.7%**
- segmented/preserve: **41.4%**
- aligned horizontal: **74.0%**
- best gain vs Original: **4.71×**
- rotation gain after segmentation: **1.79×**

Canvas removal and reorientation are both materially useful.

### Soft Extra

- Original contain: **6.6%**
- segmented/preserve: **45.8%**
- aligned horizontal: **52.2%**
- best gain vs Original: **7.90×**
- rotation gain after segmentation: **1.14×**

The dominant gain is source-canvas removal; rotation adds little.

### Soft Close

- Original contain: **11.5%**
- segmented/preserve: **70.1%**
- forced horizontal: **27.4%**
- preserve gain vs Original: **6.10×**

The planner correctly prefers preserve. The current product page also marks imagery as illustrative, so pixel fidelity is not automatically product-truth fidelity.

## Negative controls

### Caster low resolution

Exact source: `128 × 128 px`; estimated factual foreground bbox about `98 × 88 px`.

- Original contain: **15.9%**
- segmented/preserve: **33.7%**
- horizontal: **35.1%**
- preserve scale: about **1.76×**

The object can become larger without gaining factual detail. Placement utility and effective/source resolution must remain separate evidence axes.

### Round-leg composite source

The source contains an isolated vertical product plus a circular application image. Naive segmentation finds 53 connected components, with two dominant semantic regions: the application inset (~44.8k pixels) and isolated leg (~18.6k pixels).

One principal axis over the full source is therefore not a product-orientation authority. The correct current system outcome is **no automatic variant** until the factual subject/visual role is resolved.

This exposes a semantic ordering requirement: **source subject decomposition precedes orientation planning**.

## Evidence-backed conclusion

The data rejects a blanket rule such as:

> elongated hardware should be rotated to fill a wide card.

Current stronger rule:

> identify factual subject/visual role first; remove irrelevant source canvas and recompute factual scale; only then consider whole-object/group reorientation when it adds material utility and semantic orientation permits it.

The first five cases also establish two independent constraints:

1. placement presence is not factual resolution;
2. image-level geometry is not product-level semantics when the source is composite.

No case is automatically fidelity-approved yet.

## Current architecture

```text
CatalogDocument placement
        +
rendered target geometry
        +
factual source identity/pixels
        +
source authority / visual role
        ↓
subject decomposition when necessary
        ↓
research-only composition intent
        ↓
Class A/B/C experiment
        ↓
utility evidence + fidelity evidence
```

## Next step

1. Human fidelity review of H45 / Soft Extra / Soft Close, especially segmentation boundaries and preserved product geometry.
2. Investigate source-role / subject-selection evidence without freezing production field names.
3. Test `hinge-standard` as a multi-piece/group-recomposition case.
4. Add factual foreground occupancy/effective-scale evidence, kept separate from bbox utilization and source resolution.
5. Only then compare one grounded Class C edit to determine whether reconstruction adds enough value to justify its risk.

Do not freeze a production `generationIntent` or result schema yet.
