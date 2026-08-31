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

The research now treats these as separate evidence axes:

1. source factual raster;
2. placement/composition utility;
3. isolation uncertainty;
4. placement-specific raster adequacy;
5. master/output raster;
6. product/source authority;
7. optional generative risk.

## Established semantic/composition findings

- **H45:** canvas removal + whole-group reorientation is materially useful; `PASS FOR BENCHMARK COMPARISON`.
- **Soft Extra:** canvas removal is the main gain; rotation adds modest gain; authority remains `REVIEW-REQUIRED`.
- **Soft Close:** preserve orientation; authority remains `REVIEW-REQUIRED` because current source imagery is marked illustrative.
- **Hinge:** preserve three hinge representations plus `RETA / CURVA / SUPER CURVA`; trim external neutral canvas only.
- **Piston:** white-on-white isolation is parameter-sensitive; uncertainty must remain observable.
- **Round leg:** composite product + application imagery; no automatic variant before subject-role selection.
- **Caster:** standing source-resolution negative control.

Detailed decisions remain in `DECISIONS.md`; newer raster/resolution decisions are in `RESOLUTION-DECISIONS.md`.

## Class C status

Historical predeclared H45 trial:

- plan: `experiments/image-variation/class-c-h45-plan.v1.json`;
- result: `experiments/image-variation/results/h45-class-c-producer-failure.v1.json`;
- scoped outcome: `CLASS_C_NOT_JUSTIFIED_PRODUCER_CONTRACT_FAILURE`.

The tested producer/channel returned report/infographic outputs rather than the requested factual edited photograph. This closes that producer path only; it does **not** establish that grounded generative viewpoint variation is generally incapable of useful results.

Any future producer must be compared against the strongest deterministic baseline and use the newer output-resolution contract.

## R-IMG-1.1 — placement is not master resolution

A logical holder such as `440×180` is composition geometry, not automatically the native derivative raster.

Initial research fixture:

```text
logical wide placement: 440×180
4× research master:     1760×720
```

The denser master improves transform/downsample representation but does not add factual product detail.

## R-IMG-1.2 — raster quality: factor question closed

The original bilinear path was visually weak. `scripts/research/image-raster-quality-probe.mjs` adds premultiplied Mitchell-Netravali reconstruction.

Exact committed sampler execution passed on GitHub Actions:

- run `33343209122`;
- artifact `9741183308`;
- normalized factual coverage stable;
- no sharpening/super-resolution/generated detail.

Important correction: the first H45 comparison confounded filter changes with 4×→8× supersampling.

`mitchell-supersampling-factor-probe.v1.json` isolates the factor:

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
- job `99344389537`;
- artifact `9741379991`;
- digest `sha256:465ddb2208278350c44d2fadd52254447fcb21e7d7803f61f767199afebbb413`.

Key measured/derived examples:

- wide `440×180 CSS px` ≈ `116.42×47.63 mm`;
- high-quality research target 300 DPI ≈ `1376×563`;
- current `1760×720` wide master ≈ **384 DPI** at that physical size;
- H45 still requires ~`2.83×` sampling of its factual source at 300-DPI wide output, so source detail—not master pixel count—is the main remaining ceiling;
- current V1 Table geometry contains a square thumbnail at about `11×11 mm`; a 128×128 caster is ~**296 DPI** there.

Therefore:

> **source factual raster, placement adequacy and master output raster are three different things.**

The benchmark output-resolution matrix is in `output-resolution-target-matrix.v1.json` and research profiles in `output-resolution-profiles.v1.json`.

## Generator-resolution consequence

`future-producer-resolution-contract.v1.json` records the future direction.

A producer request should separate:

- composition/aspect target;
- physical-use/native-output raster requirement;
- actual returned raster.

For the wide case, the instruction should mean conceptually:

> compose for the `22:9` placement, but return a native master at or above the print-use requirement; do not interpret `440×180` as the desired file resolution.

The historical H45 Class C plan is not retroactively modified.

## V1 Table image-editing gap

`TABLE-IMAGE-EDITING-GAP.md` records that V1 Table can display `product.image` but lacks placement-specific image choice/framing.

R-IMG-1.3 strengthens the V2 requirement: the same product may need not only different framing but also different raster requirements in Table/Card/Collection.

Future Table image state should therefore extend placement-aware identity rather than reuse one product-level frame blindly.

## Current strongest rules

- Resolve subject/semantic role before geometry.
- Remove irrelevant canvas before deciding rotation.
- Preserve semantic annotations unless their meaning is safely represented elsewhere.
- Keep isolation uncertainty visible.
- Keep source authority separate from pixel fidelity.
- Keep logical placement separate from native output raster.
- Plan output raster from physical use, not a universal multiplier.
- Never claim interpolation/upscale as recovered factual detail.
- Pixel sufficiency alone does not make a derivative composition reusable.
- `no variant` remains a valid result.

## Next research gate

R-IMG-1.3 has enough evidence to stop treating output resolution as a generic `4×/8×` question.

Next:

1. use the physical target matrix to decide reuse boundaries across `card-standard`, `collection-member` and `card-wide`;
2. preserve placement-local derivatives by default unless composition + fidelity + raster adequacy all support reuse;
3. predeclare a **new** source-grounded producer experiment only when a reliable image-edit channel is available, with native output resolution separate from logical composition;
4. treat viewpoint/angle change as its own Class C hypothesis with stricter geometry/identity gates, not as an incidental extension of crop/reorientation;
5. do not freeze a production `generationIntent` schema or integrate the research renderer into V2 until those boundaries are resolved.
