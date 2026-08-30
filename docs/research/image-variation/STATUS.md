# R-IMG-1 — Current Research Checkpoint

Date: 2026-08-30  
Branch: `research/semantic-image-variation-v2`  
Stable baseline: `main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9` / tag `v1.0.0`

## State

The current R-IMG-1 evidence cycle covers three elongated-hardware cases, two negative controls and one multi-piece semantic-group case. Product/runtime boundaries remain unchanged: no ProductStore/backend, main-editor runtime, deploy, `main` or `v2` semantics were changed.

Completed result records:

- `experiments/image-variation/results/h45-wide.v1.json`
- `experiments/image-variation/results/soft-extra-wide.v1.json`
- `experiments/image-variation/results/soft-close-wide.v1.json`
- `experiments/image-variation/results/caster-lowres.v1.json`
- `experiments/image-variation/results/round-leg-wide.v1.json`
- `experiments/image-variation/results/hinge-standard.v1.json`

The exact readback set is recorded separately in `experiments/image-variation/source-readback.v1.json` so benchmark intent remains distinct from transport evidence.

## Exact source readback

An isolated GitHub Actions probe on `research/source-readback-h45` / draft PR #46 materialized exact public bytes because the local runtime could not resolve the source CDNs directly. The same probe was extended instead of creating parallel download paths.

Latest complete run: `33333171026`; artifact: `9738228935`.

| Source | MIME | Dimensions | Bytes | SHA prefix |
| --- | --- | ---: | ---: | --- |
| H45 | JPEG | 450×450 | 16417 | `e6ed49ef777d…` |
| Soft Extra | PNG | 800×800 | 54347 | `07edaca7d481…` |
| Soft Close | JPEG | 420×420 | 9781 | `d0694fc2278a…` |
| Hinge | JPEG | 450×450 | 20634 | `222a41f6f770…` |
| Piston | PNG | 450×450 | 55284 | `a85d30da4633…` |
| Caster | JPEG | 128×128 | 2627 | `d92dadcbb33e…` |
| Round leg | WebP | 800×800 | 6418 | `3b415b130300…` |

All seven benchmark source families now have exact MIME, dimensions, byte length and SHA-256 readback evidence. This confirms that platform materialization remains useful transport plumbing without making the V1 bundle architecture the semantic solution.

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

## Multi-piece semantic group — hinge-standard

Exact source: `450 × 450 px`; target: `300 × 220 px`, safe margin 8%.

Connected-light-neutral segmentation produces 124 components, but six dominate the useful structure:

- three large components (~10.7k, 7.8k and 6.9k pixels) corresponding to the three primary hinge representations;
- three smaller components (~901, 442 and 337 pixels) corresponding to `SUPER CURVA`, `CURVA` and `RETA` labels.

Measured candidates:

- Original contain bbox utilization: **36.5%**
- trim external neutral canvas while keeping labels: **60.0%**
- product-only, same relative layout, labels removed: **62.3%**

The safe/default candidate is **trim-preserve-annotations**. Removing the labels buys only about **3.8% relative** bbox-utilization over the trim candidate while discarding explicit variant mapping carried by the source.

This case separates two concepts that must not collapse into one:

1. component decomposition is useful structural evidence;
2. component identity/role is semantic evidence and cannot be inferred from size alone.

The current Renna hinge page still exposes commercial coverage variants including reta, curva and super curva, reinforcing the relevance of preserving that mapping during research evaluation.

## Evidence-backed conclusion

The data rejects a blanket rule such as:

> elongated hardware should be rotated to fill a wide card.

Current stronger rule:

> identify factual subject/visual role first; remove irrelevant source canvas and recompute factual scale; preserve low-cost semantic annotations; only then consider whole-object/group reorientation when it adds material utility and semantic orientation permits it.

The current cases establish four independent constraints:

1. placement presence is not factual resolution;
2. image-level geometry is not product-level semantics when the source is composite;
3. disconnected components are evidence, not automatic semantic roles;
4. non-product source pixels may still carry commercially relevant meaning.

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
subject / component decomposition when necessary
        ↓
semantic role preservation or explicit selection
        ↓
research-only composition intent
        ↓
Class A/B/C experiment
        ↓
utility evidence + fidelity evidence
```

## Next step

1. Run the same evidence split on `piston-wide`, now that exact piston bytes are materialized; keep the historically illustrative-source caveat explicit.
2. Add a compact human fidelity-review checklist covering piece count, characteristic geometry, fittings/holes, segmentation damage and source-role preservation.
3. Investigate what minimal evidence distinguishes a homogeneous product group from heterogeneous roles such as product + application imagery, without freezing production field names.
4. Keep factual foreground occupancy/effective scale separate from bbox utilization and source resolution.
5. After the piston and fidelity checklist, compare one grounded Class C edit to the best A/B candidate to determine whether reconstruction adds enough utility to justify its risk.

Do not freeze a production `generationIntent` or result schema yet.
