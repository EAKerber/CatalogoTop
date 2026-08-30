# R-IMG-1 — Decisions

Status: research-only. These decisions constrain further experiments; they are **not** a production schema.

## Decided from current evidence

### D1 — Subject/visual role precedes orientation planning

A principal axis over the full source image is not a reliable product-orientation authority when the source contains multiple semantic regions.

Evidence: `round-leg-wide` contains an isolated product plus an application inset. One aggregate axis is semantically meaningless.

Consequence: resolve/identify the factual subject or intended visual role before asking whether orientation should change.

### D2 — Remove irrelevant source canvas before deciding whether rotation is useful

Canvas removal / factual foreground recomposition is the dominant common utility gain across the first three slide cases.

Evidence:

- H45: 15.7% Original contain → 41.4% segmented/preserve → 74.0% horizontal.
- Soft Extra: 6.6% → 45.8% → 52.2%.
- Soft Close: 11.5% → 70.1%; forced horizontal falls to 27.4%.

Consequence: rotation must be evaluated **after** factual foreground scale/canvas waste is understood, not used as a default response to an elongated product.

### D3 — Placement utility and factual resolution are separate evidence axes

A low-resolution source can occupy more of the target while containing no new factual detail.

Evidence: `caster-lowres` starts at 128×128 with ~98×88 foreground pixels and is scaled ~1.76× by the preserve recomposition baseline.

Consequence: never credit a larger raster or larger placement presence as improved factual resolution. Super-resolution/reconstruction requires separate evidence and risk treatment.

### D4 — Source pixel fidelity and product-truth authority are separate

Faithfully preserving a source does not prove that the source itself is authoritative product truth.

Evidence: the current Soft Close product page marks imagery as illustrative.

Consequence: source authority/role must be represented in evaluation before an output can be promoted from “faithful to source pixels” to “faithful product representation”.

### D5 — Preserve semantic annotations by default when removing them buys little utility

A source annotation can carry product/variant meaning even when it is not part of the photographed product geometry.

Evidence: `hinge-standard` contains three dominant hinge components plus the source labels `RETA`, `CURVA` and `SUPER CURVA`. Trimming external neutral canvas raises bbox utilization from 36.5% to 60.0% while retaining the labels. Removing the labels raises it only to 62.3%.

Consequence: the current preferred candidate is `trim-preserve-annotations`. Removing source annotations requires evidence that their meaning is safely represented elsewhere; small geometric gains are not sufficient justification.

### D6 — BBox utilization must not stand alone as the placement-utility metric

A candidate can occupy a similar bounding box while placing substantially more factual product pixels in the target.

Evidence: `piston-wide` at exploratory threshold 246 gives 33.2% bbox utilization when preserving orientation and 33.0% when aligned horizontal, but estimated factual foreground occupancy rises from ~5.0% to ~15.3% (about 3.09×).

Consequence: evaluate bbox utilization together with factual foreground occupancy/effective scale. Neither metric alone is sufficient.

## Provisional

### P1 — Connected-light-neutral border segmentation is a useful narrow baseline

It works well enough on the first slide/caster cases to expose composition value, but it is not a general subject extraction solution.

Known failures/risks:

- light factual pixels connected to source edges;
- composite sources;
- sparse edge artifacts;
- images where background is not neutral/light;
- threshold sensitivity on white-on-white products.

`piston-wide` is direct evidence: threshold 242 splits the white product into two dominant regions; threshold 246 reconnects it. This is evidence of fragility, not permission to pick a per-case magic threshold.

### P2 — Whole-group reorientation can be a valid Class B operation

H45 shows strong benefit from rotating the factual group as a whole; Soft Extra shows only modest benefit; Soft Close rejects it geometrically.

This remains conditional on semantic orientation and human fidelity review.

### P3 — Connected components are structural evidence, not semantic authority

`hinge-standard` exposes three similarly dominant product-sized components and smaller annotation components. This is useful evidence for candidate subject/group decomposition.

`round-leg-wide` shows why this cannot become a standalone rule: multiple large components may instead represent different visual roles such as product and application imagery.

Consequence: component topology/scale can inform subject-role inference, but must be combined with source role, product metadata or review before destructive selection/recomposition.

### P4 — Source warnings may migrate representation, but may not disappear

The piston source visibly embeds `Imagem meramente ilustrativa`. A future derivative may eventually omit such pixels only if equivalent source-authority evidence remains explicit in the research/product-review path.

This is not yet a decision about how warnings should appear in production catalog layouts.

## Rejected

### R1 — “Elongated product => rotate horizontally”

Rejected by factual comparison. The rule helps H45, barely helps Soft Extra and harms Soft Close.

### R2 — “Bigger output => higher quality/resolution”

Rejected by the caster negative control.

### R3 — “One image-level principal axis is enough to determine product orientation”

Rejected by the round-leg composite source.

### R4 — “Pixel similarity alone is enough for fidelity”

Rejected by the source-authority distinction exposed by illustrative imagery.

### R5 — “Non-product pixels are automatically disposable”

Rejected by `hinge-standard`: annotation text is not hinge geometry, but it carries the explicit commercial-variant mapping present in the source.

### R6 — “Tune the segmentation threshold until the candidate looks right”

Rejected by `piston-wide`. Threshold sensitivity is a robustness warning, not a fidelity argument.

## Open questions

1. What is the minimum evidence needed to identify/select a factual subject in composite sources?
2. Can source role be inferred robustly enough for automation, or should it often be explicit/user-approved?
3. Which foreground-occupancy/effective-scale formulation remains useful across sparse, dense and multi-piece products without becoming another magic score?
4. Which signals are sufficient to distinguish a homogeneous multi-piece product group from heterogeneous roles such as product + application imagery?
5. When may source annotations be removed because equivalent semantics are already present in catalog data/layout?
6. What isolation method is robust enough for white-on-white factual product imagery without silently deleting light geometry?
7. Does a grounded Class C edit add enough utility over the best A/B candidate to justify its additional fidelity risk?
