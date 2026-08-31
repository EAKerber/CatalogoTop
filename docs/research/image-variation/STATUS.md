# R-IMG-1 — Current Research Checkpoint

Date: 2026-08-30 / 2026-08-31 runner evidence  
Branch: `research/semantic-image-variation-v2`  
Stable baseline: `main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9` / tag `v1.0.0`

Status: **research only**. No ProductStore/backend, productive V2 runtime or `main` behavior has been changed.

## Current architecture

```text
factual source identity + authority
        ↓
subject / role / isolation evidence
        ↓
semantic composition decision
        ↓
placement identity + measured physical holder
        ↓
output-use profile / target DPI
        ↓
derived output raster requirement
        ↓
higher-quality deterministic raster
        ↓
placement / print derivation
        ↓
utility + fidelity + authority + resolution review
        ↓
optional Class C only when it adds material value
```

The research treats source factual raster, placement/composition utility, isolation uncertainty, placement-specific raster adequacy, master/output raster, product/source authority and optional generative risk as separate evidence axes.

## Established semantic/composition findings

- **H45:** canvas removal + whole-group reorientation is materially useful; `PASS FOR BENCHMARK COMPARISON`.
- **Soft Extra:** canvas removal is the main gain; rotation adds modest gain; authority remains `REVIEW-REQUIRED`.
- **Soft Close:** preserve orientation; authority remains `REVIEW-REQUIRED` because current source imagery is marked illustrative.
- **Hinge:** preserve three hinge representations plus `RETA / CURVA / SUPER CURVA`; trim external neutral canvas only.
- **Piston:** white-on-white isolation is parameter-sensitive; uncertainty must remain observable.
- **Round leg:** composite product + application imagery; no automatic variant before subject-role selection.
- **Caster:** standing source-resolution negative control.

Detailed decisions remain in `DECISIONS.md`; newer raster/resolution decisions are in `RESOLUTION-DECISIONS.md`.

## R-IMG-1.1 — placement is not master resolution

A logical holder such as `440×180` is composition geometry, not automatically the native derivative raster. Initial research used a `1760×720` 4× master. The denser master improves transform/downsample representation but does not add factual product detail.

## R-IMG-1.2 — raster quality: factor question closed

The original bilinear path was visually weak. `scripts/research/image-raster-quality-probe.mjs` adds premultiplied Mitchell-Netravali reconstruction.

Exact committed sampler execution passed on GitHub Actions:

- run `33343209122`;
- artifact `9741183308`;
- normalized factual coverage stable;
- no sharpening/super-resolution/generated detail.

`mitchell-supersampling-factor-probe.v1.json` isolated supersampling effort:

- H45: `1×→4×` material; `4×→8×` essentially zero;
- Soft Extra: same saturation pattern;
- Soft Close/Hinge: higher effort safe but no material placement gain;
- Caster remains visibly source-limited.

Current raster conclusion:

> **Mitchell + moderate 4× sampling fixture is sufficient for the tested cases. 8×/12× and adaptive-factor complexity are not justified without new isolated evidence.**

Detailed checkpoint: `R-IMG-1.2.md` and `RASTER-QUALITY-POLICY.md`.

## R-IMG-1.3 — physical-use output resolution: first gate passed

Detailed checkpoint: `R-IMG-1.3.md`.

V1 already measures Card/Collection holders relative to physical A4 and records `widthMm/heightMm`. R-IMG-1.3 adopts that as the preferred authority rather than template names or generic multipliers.

Canonical research model:

```text
measured holder widthMm / heightMm
       + targetDpi / output-use profile
       ↓
derived targetWidthPx / targetHeightPx
```

Exact committed `image-output-resolution.mjs` execution passed:

- research head tested: `41a35cf56b91fa72911d791915cb3e4f667153a5`;
- workflow run `33343924318`;
- artifact `9741379991`;
- digest `sha256:465ddb2208278350c44d2fadd52254447fcb21e7d7803f61f767199afebbb413`.

Key examples:

- wide `440×180 CSS px` ≈ `116.42×47.63 mm`;
- 300 DPI ≈ `1376×563`;
- current `1760×720` wide master ≈ **384 DPI** at that physical size;
- H45 still requires about `2.83×` sampling of its factual source at 300-DPI wide output, so source detail—not master pixel count—is the main remaining ceiling;
- current V1 Table geometry contains a square thumbnail at about `11×11 mm`; a 128×128 caster is about **296 DPI** there.

Therefore:

> **source factual raster, placement adequacy and master output raster are three different things.**

The benchmark output-resolution matrix is in `output-resolution-target-matrix.v1.json`; future producer guidance is in `future-producer-resolution-contract.v1.json`.

## R-IMG-1.4 — native source-grounded producer trial: stopped at producer contract

Detailed checkpoint: `R-IMG-1.4.md`.

A new H45 trial used the newer resolution contract:

- logical composition: `440×180` / `22:9`;
- physical-use minimum at 300 DPI: about `1376×563`;
- preferred research master: `1760×720`;
- viewpoint frozen;
- exact H45 source identity required.

Two producer attempts were made, the second with an explicit exact-source image reference. Both returned `1536×1024` research infographics rather than an edited H45 product-image asset. The returned aspect was `3:2`, and generated report text contained unmeasured PASS claims/metrics.

Result:

> `CLASS_C_NATIVE_MASTER_NOT_EVALUABLE_WITH_CURRENT_PRODUCER_CHANNEL`

This is not evidence against generative image variation in general. It is evidence that this producer/channel does not currently satisfy the required output-shape/source-grounding contract. Raster size alone cannot compensate for returning the wrong asset type or losing factual identity.

The stricter viewpoint/angle experiment is therefore **not authorized through this producer/channel yet**. A viewpoint change has higher factual risk and should only proceed after a producer can reliably return a fixed-view source-grounded edit.

Machine-readable result: `experiments/image-variation/results/h45-native-producer-trial.v1.json`.

## V1 Table image-editing gap

`TABLE-IMAGE-EDITING-GAP.md` records that V1 Table can display `product.image` but lacks placement-specific image choice/framing.

R-IMG-1.3 strengthens the V2 requirement: the same product may need not only different framing but also different raster requirements in Table/Card/Collection. Future Table image state should therefore extend placement-aware identity rather than reuse one product-level frame blindly.

## Current strongest rules

- Resolve subject/semantic role before geometry.
- Remove irrelevant canvas before deciding rotation.
- Preserve semantic annotations unless their meaning is safely represented elsewhere.
- Keep isolation uncertainty visible.
- Keep source authority separate from pixel fidelity.
- Keep logical placement separate from native output raster.
- Plan output raster from physical use, not a universal multiplier.
- Never claim interpolation/upscale as recovered factual detail.
- Generated report text or self-declared producer metrics are not evidence unless independently measured.
- Pixel sufficiency alone does not make a derivative composition reusable.
- `no variant` remains a valid result.

## Next research gate

1. use the physical target matrix to decide reuse boundaries across `card-standard`, `collection-member`, `card-wide` and Table;
2. preserve placement-local derivatives by default unless composition + fidelity + raster adequacy all support reuse;
3. predeclare stricter viewpoint/angle invariants, but keep that experiment blocked until a reliable source-grounded image-edit producer is available;
4. keep the Mitchell 4× path as the current deterministic research baseline unless new isolated raster evidence justifies more complexity;
5. do not freeze a production `generationIntent` schema or integrate the research renderer into V2 until those boundaries are resolved.
