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

Evidence: `piston-wide` gives ~33% bbox utilization both preserving orientation and aligned horizontal, while estimated factual foreground occupancy rises from about 5% to about 15%.

Consequence: evaluate bbox utilization together with factual foreground occupancy/effective scale. Neither metric alone is sufficient.

### D7 — Isolation uncertainty must remain observable

When a foreground extraction changes materially across nearby parameter choices, the system should expose that sensitivity instead of selecting one visually convenient cutoff and presenting the mask as certain.

Evidence: the piston edge-gated experiment over gradient percentiles 92–96 keeps one dominant product component and stable ~3.1× horizontal foreground-presence gain, while ~5.5% of the consensus foreground remains percentile-sensitive. Round-leg shows >10% sensitivity under the same experiment.

Consequence: experimental isolation may expose stable/uncertain pixels or equivalent confidence evidence; uncertainty must not be silently erased before fidelity review.

### D8 — Logical placement geometry and master raster resolution are separate axes

A target such as `440×180` describes the intended composition in the catalog. It must not silently become the raster-resolution contract for the reusable derivative.

Evidence: R-IMG-1.1 renders the same H45 and Soft Extra placement plans as 4× masters (`1760×720`) while preserving relative geometry and normalized factual coverage.

Consequence: placement planning remains the composition authority; master resolution is a downstream render choice.

### D9 — Placement preview should derive from the master render

Direct placement rendering and master-then-downsample rendering can differ slightly at transform boundaries even when composition is identical.

Evidence: H45 direct-vs-master-downsample RGB mean absolute channel difference is ~0.85; Soft Extra is ~0.25, while normalized factual coverage remains effectively unchanged in both cases.

Consequence: once a master profile is selected, derive placement previews deterministically from that master instead of independently re-rendering/re-planning the placement.

### D10 — Higher master raster dimensions do not imply higher factual source resolution

A denser render can improve antialiasing, downstream reduction, crop flexibility and presentation stability while still relying on exactly the same source evidence.

Evidence: H45 450×450 → 1760×720 master requires ~3.62× fitted source scaling; Soft Extra 800×800 → 1760×720 requires ~3.01×. Neither operation resolves new holes, fittings or texture.

Consequence: always record source dimensions separately from master dimensions. Master scale is a rendering property, not a factual-detail claim.

### D11 — The current Class C producer path is closed after contract failure

The first H45 Class C comparison was predeclared narrowly and allowed only presentation cleanup over the reviewed deterministic geometry.

Evidence: three bounded producer attempts returned report/infographic images rather than an edited factual photograph, including after explicit source binding. The outputs also introduced unmeasured text/metrics/verdicts.

Consequence: current result is `CLASS_C_NOT_JUSTIFIED_PRODUCER_CONTRACT_FAILURE`. Do not expand that producer path to other benchmark cases. This conclusion is scoped to the tested producer/channel and does not claim all grounded generative editors must fail.

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

### P5 — Edge-gated percentile consensus is a useful white-on-white research probe, not a replacement segmenter

Keeping the 242/24 chromatic criterion and preventing background flood through sufficiently strong image gradients reconnects the piston without raising the light threshold. Majority consensus over P92–P96 makes parameter sensitivity explicit.

Cross-source evidence is mixed by design:

- H45, Soft Close, Hinge and Caster remain close to the baseline mask;
- Soft Extra changes materially and its gradient percentile band collapses to zero because the source is extremely blank-heavy;
- round-leg changes materially and remains a composite/no-auto-isolation control.

Consequence: retain this method under `scripts/research/`; do not promote it into the recomposition core or production behavior yet.

### P6 — Alpha-aware master rendering is the stronger deterministic presentation baseline

R-IMG-1.1 passes the new presentation gate on H45 and Soft Extra. The master/downsample path preserves composition and normalized factual coverage while improving the sampling model beyond the nearest-neighbor fidelity prototype.

Consequence: test the same renderer on preserve-orientation, multi-piece and source-limited cases before promoting it into the recomposition core. Any future Class C trial should compare against this stronger baseline rather than the old placement-sized nearest-neighbor render.

### P7 — Fixed 4× is a useful research fixture, not yet the correct default policy

The 4× master cleanly separates composition from raster resolution, but both initial cases still upscale source sampling materially.

Consequence: compare fixed 4× against a source-aware/adaptive factor before freezing any production or long-lived research default.

## Rejected

### R1 — “Elongated product => rotate horizontally”

Rejected by factual comparison. The rule helps H45, barely helps Soft Extra and harms Soft Close.

### R2 — “Bigger output => higher quality/resolution”

Rejected by the caster negative control and reinforced by R-IMG-1.1. A bigger raster may improve transform presentation; it does not by itself add factual source detail.

### R3 — “One image-level principal axis is enough to determine product orientation”

Rejected by the round-leg composite source.

### R4 — “Pixel similarity alone is enough for fidelity”

Rejected by the source-authority distinction exposed by illustrative imagery.

### R5 — “Non-product pixels are automatically disposable”

Rejected by `hinge-standard`: annotation text is not hinge geometry, but it carries the explicit commercial-variant mapping present in the source.

### R6 — “Tune the segmentation threshold until the candidate looks right”

Rejected by `piston-wide`. Threshold sensitivity is a robustness warning, not a fidelity argument.

### R7 — “Changing background seeds to the corners solves source-edge contact”

Rejected experimentally on the piston: corner-only seeding produced the same split as the all-border baseline. The failure is not merely where the flood starts; light-neutral connectivity through the product is the deeper issue.

### R8 — “Ask for a high-resolution output and treat that as the resolution solution”

Rejected as an evaluation rule. Resolution must be represented explicitly as source evidence + master render profile + placement/downsample behavior. Output dimensions alone are not enough.

## Open questions

1. What is the minimum evidence needed to identify/select a factual subject in composite sources?
2. Can source role be inferred robustly enough for automation, or should it often be explicit/user-approved?
3. Which foreground-occupancy/effective-scale formulation remains useful across sparse, dense and multi-piece products without becoming another magic score?
4. Which signals are sufficient to distinguish a homogeneous multi-piece product group from heterogeneous roles such as product + application imagery?
5. When may source annotations be removed because equivalent semantics are already present in catalog data/layout?
6. What isolation method is robust enough for white-on-white factual product imagery without silently deleting light geometry or retaining excessive halo/context?
7. Does the alpha-aware master path remain useful on preserve-orientation, multi-piece and source-limited cases?
8. What source-aware/adaptive master factor is preferable to a fixed 4× research fixture?
9. Is a producer with a reliable source-image edit contract available that can materially beat the deterministic master baseline without adding factual uncertainty?
