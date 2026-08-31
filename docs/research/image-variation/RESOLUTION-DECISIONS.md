# R-IMG-1.2 / R-IMG-1.3 — Resolution decisions addendum

Status: research-only  
Branch: `research/semantic-image-variation-v2`

This addendum records decisions reached after `DECISIONS.md` was written. Where they conflict with older provisional items/open questions, this file is the newer authority for raster/output-resolution research. It does not replace semantic/fidelity decisions from the main decision log.

## D12 — Better filtering matters; 8× does not currently matter

With reconstruction/downsample held constant, H45 and Soft Extra show a material difference from direct/1× sampling to Mitchell 4×, but essentially no placement-scale benefit from Mitchell 4× → 8×.

Evidence: `experiments/image-variation/results/mitchell-supersampling-factor-probe.v1.json`.

Consequence:

- Mitchell 4× is the leading current sampling-quality research fixture;
- 8× and 12× remain diagnostic/falsification options only;
- do not build a transform-severity 4×/8× policy without new isolated evidence.

This supersedes any older provisional reading that fixed 4× should first be compared against an adaptive/higher factor before proceeding.

## D13 — Source factual raster, placement adequacy and master output raster are three distinct axes

A file's intrinsic pixels do not by themselves determine whether it is adequate for a catalog use.

Evidence:

- the exact caster source is 128×128;
- that is strongly inadequate for the wide-card use;
- in the current V1 Table geometry, a square contained image is about 11×11 mm, where 128×128 corresponds to ~296 DPI;
- the factual source remains exactly 128×128 in both cases.

Consequence: never label an asset simply `high-resolution` or `low-resolution` as a complete placement decision. Record intrinsic source evidence separately from use-specific adequacy.

## D14 — Physical holder + output profile is the canonical output-resolution authority

V1 already measures Card/Collection image holders relative to the physical A4 page and records `widthMm/heightMm`.

R-IMG-1.3 uses:

```text
measured widthMm / heightMm
      + targetDpi
      ↓
derived targetWidthPx / targetHeightPx
```

Consequence:

- target pixels may be transported and hashed as derived evidence;
- target pixels should not be a second independent authority capable of contradicting physical size + output profile;
- actual materialized holder measurement outranks template/preset-name assumptions.

## D15 — Logical composition dimensions must not become native producer-output dimensions

A benchmark holder such as `440×180` expresses placement geometry/aspect, not an instruction to return a 440×180 master file.

Evidence: the same holder corresponds to roughly 116.42×47.63 mm; a 300-DPI use requires about 1376×563 pixels, while the current 1760×720 research master is about 384 DPI.

Consequence: future external/generative requests must separate:

- composition/aspect target;
- physical-use raster requirement;
- actual returned raster.

This directly addresses the observed producer tendency to satisfy `X×Y` as native resolution rather than as relative composition.

## D16 — Pixel sufficiency alone does not make a derivative reusable across placements

A wide H45 derivative can contain enough pixels for a smaller Card while still being the wrong composition/aspect for that Card.

Consequence:

- catalog derivatives remain placement-local by default;
- reuse/promotion requires composition compatibility + fidelity + authority, not only sufficient pixels;
- explicit promotion to product-level reusable imagery remains the correct boundary.

## D17 — Table image state is placement-level for both framing and resolution reasons

The V1 Table gap is not only missing UI. A Table image holder can require different framing, image selection and raster size from Card/Collection for the same product.

Consequence: V2 Table image editing should extend the placement-aware authority rather than reusing a single product-level frame/selection blindly.

## Current resolution baseline

```text
semantic/factual placement decision
      ↓
measured physical holder
      + output-use profile
      ↓
derived output raster requirement
      ↓
Mitchell 4× sampling-quality fixture where deterministic recomposition is rendered
      ↓
placement/print derivation
      ↓
source-adequacy + fidelity + authority review
```

The `4×` sampling fixture and physical output raster are deliberately not the same long-lived concept.
