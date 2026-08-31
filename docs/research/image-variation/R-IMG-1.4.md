# R-IMG-1.4 — Native source-grounded producer trial

Status: **research-only / isolated producer trial**

Base research branch: `research/semantic-image-variation-v2`

## Question

Can a source-grounded producer return a clean, high-native-resolution H45 master for the known wide composition while preserving factual identity closely enough to outperform the strongest deterministic presentation path?

The experiment now separates:

- visual plausibility;
- factual fidelity;
- producer contract reliability;
- native output raster;
- reference-adherence regime.

## Resolution contract

- logical placement: `440×180` / aspect `22:9`;
- physical holder: approximately `116.42×47.63 mm`;
- 300-DPI minimum use raster: approximately `1376×563`;
- `1760×720` remains an acceptable research master with headroom.

## Historical producer failure modes

### Generated-dashboard self-consistency is not evidence

The visually stronger dashboard (`aa89f137...`) fabricated both its supposed deterministic control and its generated candidate. Its internal A↔B comparison is not authoritative evidence.

### Two hallucination regimes were observed

- `VISUALLY_DISCREET_GENERATIVE_REGIME_CONTROL`: generic hardware that could plausibly pass unnoticed at catalog scale, but was not proven H45-faithful.
- `SYSTEMATIC_PROTOTYPE_SUBSTITUTION`: repeated obvious fantasy rail/roller geometry across multiple dashboard outputs.

### ZIP / README clean-context test was invalid

The new-chat ZIP experiment produced unrelated object-removal, landscape, raster-analysis, bottle and backpack examples. The H45 source never became the active image-edit target.

Classification:

`INVALID_TEST_SOURCE_NOT_BOUND`

Methodological correction:

> A factual image buried inside a ZIP/README workflow must not be assumed to be bound as the producer's edit reference.

## A0 — direct source binding: first valid pass

A new clean-context test attached the exact H45 JPG directly as the image target and used a minimal source-bound image-only instruction.

Recorded result:

`experiments/image-variation/results/r-img-1-4-a0-direct-source-binding.v1.json`

Observed output:

- native raster: `1961×802`;
- aspect ratio: approximately `2.445`, effectively `22:9`;
- exceeds the current 300-DPI minimum-use raster of approximately `1376×563`;
- image-only contract satisfied;
- output contains two distinct telescopic-slide pieces corresponding to the two factual source pieces;
- salient visible landmarks remain recognizable, including the black stop/fitting, rectangular window, hole/slot sequences and stamped structures on the second piece;
- no fantasy roller mechanism or unrelated generic product substitution is visible.

Current binding verdict:

`PASS_DIRECT_SOURCE_BINDING`

This is the first valid evidence in R-IMG-1.4 that **direct image attachment + minimal instruction can make the H45 source itself the effective producer target**.

## Important remaining caveat: viewpoint inference

The source is a diagonal perspective view; the A0 output is a near-orthographic horizontal presentation.

That is useful editorially, but it means some geometry/hidden surfaces were inferred rather than copied pixel-for-pixel.

Therefore the factual verdict is deliberately narrower than a production PASS:

`LANDMARK_PASS_WITH_VIEWPOINT_INFERENCE_REVIEW_REQUIRED`

The correct next identity gate is pose-invariant. It must compare, after neutralizing allowed orientation/layout changes:

- piece count/correspondence;
- sequence and relative spacing of circular holes and elongated slots;
- terminal/end structures;
- fittings/stops;
- rail lengths/proportions;
- relationship between pieces;
- any newly exposed/inferred surfaces that were not directly visible in the source.

## Current conclusion

The prior blanket producer conclusion is superseded in scope.

We can no longer say that the channel is simply incapable of faithful image-only source-grounded output. A0 demonstrates that **source-target binding can work when the factual JPG is attached directly and the surrounding context is minimal**.

What remains unproven is **reliability**:

1. can A0 be repeated in fresh contexts without falling back to generic/fantasy hardware?
2. do the preserved landmarks remain stable across runs?
3. are inferred viewpoint surfaces acceptably faithful?
4. can A1 add an explicit deterministic composition reference without weakening factual-source authority?

Current scoped result:

`A0_PASS_BINDING_CONTINUE`

No production schema, runtime or ProductStore change is justified yet.

## Next experiment

### A0-repeat — direct source binding repeatability

Repeat in a fresh context using only:

- exact H45 factual JPG;
- the same minimal image-only prompt;
- no prior research/dashboard context.

Stop immediately if the output is not image-only or is not visibly the H45 product.

### A1 — direct source + real deterministic layout reference

Only after repeatable A0:

- source JPG remains factual authority;
- actual Mitchell deterministic render is supplied as composition/layout reference only;
- same native-raster and image-only contract.

### C — no-source negative control

Only after A0/A1 establish a stable source-bound path.

Purpose: test whether source removal causes convergence toward the previously observed generic/fantasy archetype.
