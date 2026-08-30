# Research — Semantic / Placement-Aware Image Variations

Branch: `research/semantic-image-variation-v2`  
Baseline: V1 stable `2ad3566033241ce2d8d4effd96d19b8fdbe513c9` / tag `v1.0.0`.

## Status

Research/specification only. **Do not merge an implementation into `v2` merely because it produces technically valid images.** The V1 experiment proved transport/round-trip but did not prove useful visual intelligence.

## Problem statement

The hard problem is not “apply one allowed transform”. It is:

> Given the canonical pixels of a real product and the semantic/editorial context of a placement, decide what visual composition would make materially better use of that placement while preserving the identity and geometry of the actual product.

Example real target:

- source: a telescopic slide photographed diagonally/vertically;
- placement: wide horizontal product card;
- potentially useful derivative: orient the real slide horizontally, enlarge it, clean/expand the background and compose it to approximately match the placement aspect ratio;
- unacceptable derivative: redraw a plausible-but-different slide, change rail geometry, invent/remove pieces or alter model identity.

This requires understanding source content + placement intent + permissible transformation class + evidence of fidelity.

## Stable schema compatibility boundary

Future work must preserve these V1 meanings unless a migration is explicitly designed:

```text
product.image
  canonical original / fallback

product.imageGallery[]
  reusable approved faithful alternatives

presentation.imageFrames
  non-destructive placement framing

presentation.imageSelections
  sparse editorial image choice

presentation.imageVariants
  catalog-local derivative assets
```

`provenance.kind = external-variation` remains a reserved provenance value even though V1 removes such entries during its stable normalization policy.

Do **not** overload `product.variants`; that domain remains commercial colors/finishes.

The research contract should evolve additively around these authorities so that a future accepted derivative can still enter `presentation.imageVariants` and later be promoted explicitly to `product.imageGallery` if approved.

## Do not freeze the failed mental model

The V1 transport contract used a flat allowlist of transformations. That is insufficient as the primary planning model.

Future protocol should distinguish at least three classes:

### A. Pixel-preserving deterministic transforms

Examples:
- crop/reframe;
- resize/upscale;
- small geometric rotation where all source content remains factual;
- white/background cleanup;
- tonal correction.

These can often be audited mechanically.

### B. Semantically safe recomposition / reorientation

Examples:
- rotate the entire product 90° to better fit a wide placement;
- isolate the factual product from source background and reposition it;
- expand canvas to target aspect ratio;
- choose meaningful focus/coverage based on product silhouette and placement.

These require semantic understanding but need not invent product pixels if implemented from extracted source pixels.

### C. Generative reconstruction

Examples:
- synthesize higher-resolution product detail;
- reconstruct occluded/low-resolution regions;
- change viewpoint beyond what source pixels directly support.

This class has the highest identity risk and must not be treated as equivalent to upscale/crop. It needs explicit evidence/quality gates and may remain forbidden for some products.

## Placement-aware intent

A future request should express the **goal** of the derivative, not only allowed operations. Candidate concepts, not frozen field names:

```text
generationIntent
  targetAspect / targetPixelSize
  goal
    fit-placement
    maximize-product-coverage
    technical-clarity
    clean-background
  orientationStrategy
    preserve
    choose-best-orthogonal-orientation
    explicit-angle
  expectedObjectCount
  preserveTextAndBrandMarks
  sourceUsage
    whole-object
    detail
  riskClass
```

The placement already has stable identity/context vocabulary (`placementKey`, `usageSignature`, Card/Collection use, target geometry). Reuse that instead of inventing a parallel placement identity.

## Fidelity invariants

At minimum research should be able to state and test:

- same product/model identity;
- same number of physical product pieces unless the source contract explicitly defines otherwise;
- no invented attachments/components;
- no removal of real components;
- preserved characteristic geometry/proportions;
- preserved logos/labels where present and legible;
- derived image genuinely improves target fit/coverage or clarity rather than merely differing from the source.

A technically valid ZIP is not a quality pass.

## Evidence / evaluation problem

Potential gates to investigate:

1. **target utilization** — object bounding box coverage vs target placement;
2. **aspect fit** — composition wastes less canvas while respecting safe margins;
3. **source/derivative identity similarity** — robust visual embeddings plus geometry checks, never as sole authority;
4. **object count / silhouette** — detect missing/added pieces;
5. **brand/text fidelity** — OCR/visual comparison when applicable;
6. **human approval** — final acceptance remains explicit for ambiguous generative changes;
7. **reference benchmark** — real catalog placements with expected qualitative objectives, not one universal score.

The benchmark should include cases where the correct answer is **do not generate a variant**.

## Research questions

- Can most useful catalog derivatives be achieved with segmentation + deterministic recomposition + high-quality super-resolution, avoiding full generative reconstruction?
- What source conditions justify a 90° reorientation versus preserving orientation?
- How should a system infer horizontal/vertical semantic orientation for rails, handles, profiles and other elongated hardware?
- How much placement geometry/context must be sent to an agent for useful composition decisions?
- Which generated changes can be verified automatically enough to permit import, and which must require explicit human approval?
- Is one derivative per placement enough, or should the agent return a small ranked candidate set plus rationale/evidence?
- What metadata must survive so a future V2 can reuse a derivative across similar placements without treating it as universal product truth?

## Recommended first research phase

Do not build another end-to-end ZIP feature first.

1. Assemble 10–20 real source-image + placement pairs, including the wide-card slide example.
2. For each pair, define desired semantic outcome and invariants before generation.
3. Produce derivatives through multiple approaches:
   - deterministic recomposition;
   - segmentation + upscale;
   - generative edit grounded in source pixels.
4. Compare utility and identity fidelity.
5. Only then propose `generationIntent` / evidence schema and transport changes.

## Integration rule

A future accepted capability should remain optional and additive:

```text
V2 product/catalog data
        ↓
placement-aware generation request
        ↓
external/research capability
        ↓
validated candidate(s)
        ↓
explicit approval
        ↓
presentation.imageVariants
        ↓ optional explicit promotion
product.imageGallery
```

Never silently overwrite `product.image`.

## Handoff for a future research agent

Read:
- `docs/v1-stable.md`;
- this document;
- the current image schema/normalizers;
- previous Variation Bundle docs only as evidence of transport lessons, not as settled generative semantics.

Deliver research/spec/fixtures on this branch. Do not merge to `v2` or modify production `main` without a new explicit product decision.
