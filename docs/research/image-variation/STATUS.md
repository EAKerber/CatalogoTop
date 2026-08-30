# R-IMG-1 — Current Research Checkpoint

Date: 2026-08-30  
Branch: `research/semantic-image-variation-v2`  
Stable baseline: `main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9` / tag `v1.0.0`

## State

The current R-IMG-1 evidence cycle covers three elongated-hardware cases, two negative controls, one multi-piece semantic-group case, one white-on-white/source-authority stress case, an explicit human fidelity-review pass and a cross-source isolation robustness probe. Product/runtime boundaries remain unchanged: no ProductStore/backend, main-editor runtime, deploy, `main` or `v2` semantics were changed.

Completed result records:

- `experiments/image-variation/results/h45-wide.v1.json`
- `experiments/image-variation/results/soft-extra-wide.v1.json`
- `experiments/image-variation/results/soft-close-wide.v1.json`
- `experiments/image-variation/results/caster-lowres.v1.json`
- `experiments/image-variation/results/round-leg-wide.v1.json`
- `experiments/image-variation/results/hinge-standard.v1.json`
- `experiments/image-variation/results/piston-wide.v1.json`
- `experiments/image-variation/results/piston-isolation-consensus.v1.json`

Supporting research artifacts:

- `experiments/image-variation/source-readback.v1.json` — exact readback evidence for all seven source families;
- `experiments/image-variation/reviews/elongated-wide-review.v1.json` — first explicit human-review outcomes;
- `docs/research/image-variation/DECISIONS.md` — evidence-backed/provisional/rejected research decisions;
- `docs/research/image-variation/FIDELITY-REVIEW.md` — compact human fidelity gate for benchmark candidates;
- `scripts/research/image-isolation-consensus.mjs` — research-only edge-gated isolation/uncertainty experiment with deterministic self-test.

## Exact source readback

An isolated GitHub Actions probe on `research/source-readback-h45` / PR #46 materialized exact public bytes because the local runtime could not resolve the source CDNs directly. The same probe was extended instead of creating parallel download paths.

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

All seven benchmark source families now have exact MIME, dimensions, byte length and SHA-256 readback evidence. Platform materialization remains useful transport plumbing without making the V1 bundle architecture the semantic solution.

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

## First explicit fidelity-review outcomes

The first review pass uses `docs/research/image-variation/FIDELITY-REVIEW.md` and is recorded in `experiments/image-variation/reviews/elongated-wide-review.v1.json`.

### H45-wide — PASS FOR BENCHMARK COMPARISON

- source authority: stronger product match;
- two primary slide pieces remain present;
- characteristic rail geometry, holes and fittings remain visually coherent with the exact source;
- no observed piece duplication/removal or synthetic product detail;
- deterministic nearest-neighbor edge roughness remains a presentation-quality limitation rather than an observed identity reconstruction.

This is the first explicit R-IMG-1 benchmark-comparison pass. It is **not** production approval.

### Soft Extra-wide — REVIEW-REQUIRED

- source pixels and visible two-rail/fitting structure are preserved well enough for continued comparison;
- placement benefit is measurable;
- current authority is family-level rather than a strong exact commercial-variant linkage.

Blocking question: whether family-level authority is sufficient for the intended catalog placement.

### Soft Close-wide — REVIEW-REQUIRED

- visible source geometry remains coherent under preserve-orientation recomposition;
- placement presence improves materially;
- the current product page explicitly describes imagery as illustrative.

Blocking question: source-pixel fidelity cannot by itself establish product-truth fidelity.

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

## White-on-white / authority stress — piston-wide

Exact source: `450 × 450 px`; target: `440 × 180 px`, safe margin 7%. The source itself visibly contains `Imagem meramente ilustrativa`.

The default segmentation baseline is not robust here:

- threshold 242 splits the product into two dominant components (~20.1k + 6.4k px) because light factual pixels are removed;
- threshold 246 reconnects a dominant ~27.5k-pixel product region, but this is threshold sensitivity, not a general fix;
- the product reaches the source left and right borders, so source clipping may already limit factual geometry.

Exploratory threshold-246 geometry:

| Candidate | BBox utilization | Estimated factual foreground occupancy |
| --- | ---: | ---: |
| Original contain | 27.6% | 4.1% |
| segmented/preserve | 33.2% | 5.0% |
| align horizontal | 33.0% | 15.3% |

This established that bbox utilization cannot stand alone: preserve and horizontal are effectively tied by bbox while horizontal gives about **3.09×** the estimated factual foreground presence.

### Edge-gated consensus robustness probe

A minimal alternative was tested before inventing a new segmentation stack:

- changing background seeds from full border to corners only produced the same split and was rejected;
- the color criterion remains fixed at `242 / 24`;
- background flood is additionally prevented from crossing sufficiently strong image gradients;
- instead of choosing one gradient cutoff, majority consensus is computed over global gradient percentiles **92, 93, 94, 95 and 96**;
- stable and percentile-sensitive foreground pixels remain separately observable.

Piston consensus evidence:

- one dominant product component: **28,675 px**;
- percentile-sensitive pixels: **1,608** (~5.5% of majority foreground);
- preserve bbox utilization: **33.0%**;
- horizontal bbox utilization: **33.4%**;
- preserve estimated factual foreground occupancy: **5.1%**;
- horizontal estimated factual foreground occupancy: **15.9%**;
- horizontal foreground-presence gain: **3.11×**.

The ~3× placement-presence conclusion therefore survives the full P92–P96 band without raising the per-case light threshold.

Cross-source comparison prevents overclaiming:

| Source | Consensus vs baseline IoU | Sensitive/consensus foreground | Reading |
| --- | ---: | ---: | --- |
| H45 | 0.968 | 3.9% | close to baseline |
| Soft Extra | 0.864 | 0.0% | material change; blank-heavy gradient band collapses to zero |
| Soft Close | 0.955 | 5.1% | close to baseline |
| Hinge | 0.972 | 2.6% | close to baseline |
| Caster | 0.990 | 0.8% | very close to baseline |
| Round leg | 0.880 | 10.3% | material change; composite control remains unsafe |

Conclusion: the edge-gated consensus is a useful research probe for white-on-white isolation and uncertainty, but **is not promoted into the recomposition core**. Better isolation still does not strengthen the piston's explicitly illustrative source authority or repair source clipping.

## Human fidelity review gate

`FIDELITY-REVIEW.md` evaluates candidates across:

1. source identity and authority;
2. piece count/group membership;
3. characteristic geometry;
4. fittings/holes/local detail;
5. segmentation and source-boundary integrity;
6. semantic orientation and annotations;
7. resolution honesty;
8. transformation provenance.

Allowed research outcomes are `PASS FOR BENCHMARK COMPARISON`, `REVIEW-REQUIRED`, and `REJECT / NO VARIANT`. A no-variant result remains explicitly valid.

## Evidence-backed conclusion

The current stronger rule is:

> identify factual subject/visual role first; remove irrelevant source canvas and recompute factual scale; preserve low-cost semantic annotations; evaluate both bbox and factual foreground presence; expose isolation uncertainty; only then consider whole-object/group reorientation when it adds material utility and semantic orientation permits it.

The current cases establish seven independent constraints:

1. placement presence is not factual resolution;
2. image-level geometry is not product-level semantics when the source is composite;
3. disconnected components are evidence, not automatic semantic roles;
4. non-product source pixels may still carry commercially relevant meaning;
5. bbox utilization is not sufficient to score useful factual presence;
6. threshold/parameter sensitivity is a robustness signal, not permission to tune until an image looks right;
7. improved source isolation does not improve source authority or reconstruct clipped factual geometry.

No case is automatically production/fidelity-approved.

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
placement utility evidence
  (bbox + foreground/effective scale)
        +
isolation uncertainty evidence
        +
fidelity / authority review
```

## Next step

The deterministic research prerequisites originally placed before a Class C comparison are now substantially met: exact source bytes exist, H45 has an explicit benchmark-comparison pass, and the white-on-white isolation stress has a documented non-core alternative plus uncertainty evidence.

1. Predeclare one narrowly scoped Class C comparison on **H45** against the reviewed A/B horizontal candidate. The only acceptable objective is marginal presentation utility (for example edge/background quality) while preserving the exact two-piece hardware identity; no new holes, fittings, rails, viewpoint or piece count may appear.
2. Treat `Class C not justified` as a first-class result. If the generative candidate cannot materially outperform the reviewed A/B candidate without reconstructing uncertain hardware detail, stop rather than expanding generation scope.
3. Keep Soft Extra, Soft Close and piston out of the first Class C trial because their source-authority caveats would confound generation-risk evaluation.
4. Do not freeze a production `generationIntent`, result schema or generator integration from this comparison.
