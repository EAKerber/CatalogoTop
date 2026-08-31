# R-IMG-1.3 — Master output resolution by physical use

Status: active research slice  
Branch: `research/semantic-image-variation-v2`

## Why this slice exists

R-IMG-1.2 established that the current antialiasing problem does not justify escalating from a moderate 4× supersampling fixture to 8×/12×. With reconstruction/downsample held constant, Mitchell 4× captures the material sampling gain on H45 and Soft Extra.

That does **not** answer a different product question:

> How many pixels should the reusable/output image actually have for the physical placement in the printed/exported catalog?

A generic multiplier is the wrong authority because CatalogoTop placements vary substantially: Card widths can span different slots, Collection members have local grids, and Table image cells are physically small.

## Existing V1 evidence worth preserving

V1 already has the correct physical-measurement idea in the Variation Bundle.

For supported Card and Collection placements, `measureRenderedPlacements()`:

1. locates the actual image holder in the materialized catalog;
2. reads the rendered holder width/height;
3. relates it to the actual A4 page (`210 × 297 mm`);
4. stores both `widthPx/heightPx` and `widthMm/heightMm`.

This is stronger than inferring image resolution from template names or Card presets.

R-IMG-1.3 therefore treats **measured physical holder dimensions** as the preferred resolution-planning authority.

## Three independent resolution axes

### 1. Source factual raster

The exact factual source bytes and intrinsic pixel dimensions.

Examples:

- H45: `450×450` JPEG;
- Soft Extra: `800×800` PNG;
- Caster: `128×128` JPEG.

This axis answers what raster evidence actually exists. It is never upgraded by rendering a larger file.

### 2. Placement adequacy

Whether the available raster is sufficient for the **physical size at which it is used**.

Research formula:

```text
requiredPixels = ceil(holderMm / 25.4 × targetDpi)
```

The same 128×128 source can therefore be inadequate for a large Card and approximately adequate for a very small Table thumbnail. That is not a contradiction; the factual pixels are unchanged while the physical use changes.

### 3. Master output raster

The dimensions of the derivative delivered for a specific use.

This may be larger than the source to support clean transforms/downsampling, but the extra samples remain interpolation unless a separately validated source-grounded generative capability adds new native pixels.

## Research DPI targets

`experiments/image-variation/output-resolution-profiles.v1.json` currently defines two comparison targets only:

- `print-balanced`: **240 DPI**;
- `print-high`: **300 DPI**.

They are research targets, not frozen production defaults.

Screen preview does not need its own stored high-resolution master merely because CSS uses 96 px/in. Preview should derive from the chosen output/master path.

## Wide placement example

For the benchmark logical holder `440×180 CSS px`, the CSS absolute-length relationship gives approximately:

- physical width: **116.42 mm**;
- physical height: **47.63 mm**.

Nominal raster requirements:

| Physical use | Required raster |
| --- | ---: |
| 240 DPI | `1101×450` |
| 300 DPI | `1376×563` |
| current 4× fixture / 384 DPI equivalent | about `1760×720` |

Therefore the existing `1760×720` R-IMG-1.1 master already contains roughly **384 output pixels per physical inch** for a holder of that size.

This changes the diagnosis of the visually weak H45 result:

> the master raster itself is not too small for ordinary high-quality print use; the dominant remaining quality ceiling is the factual 450×450 source and its supported detail.

For H45, the approved 96-DPI placement transform has `placementScaleFromSource ≈ 0.9055`. At a 300-DPI output target, the same transform would require source sampling at roughly **2.83×**. That is a direct source-pressure signal, not evidence that the output should be called low-resolution.

## Table example — why placement matters

V1 Table defines:

- image cell outer width: `14 mm`;
- `.7 mm` horizontal cell padding on each side under global border-box sizing;
- image max-height: `11 mm`;
- `object-fit: contain`.

A reasonable image-content holder estimate is therefore about `12.6 × 11 mm` before contain fitting.

At 300 DPI, that content box needs only about:

- `149 px` horizontally;
- `130 px` vertically.

For a square 128×128 caster image under `contain`, the actual rendered image box becomes approximately `11 × 11 mm`, giving an effective raster density of about **296 DPI**.

This is a useful correction to the earlier shorthand “caster 128×128 is low resolution”:

- it is strongly source-limited for a wide Card;
- it is close to a 300-DPI raster requirement for a small Table thumbnail;
- its factual information content is unchanged in both cases.

Therefore **placement adequacy must be use-specific**.

## Collection

Collection members vary by:

- collection block height within the page grid;
- local `2 / 3 / 4` column configuration;
- local member width (`simple / wide / full`);
- number of local rows;
- image/copy split.

A static “Collection image size” table would therefore recreate the same mistake as a fixed Card multiplier.

The preferred approach is to measure the actual `.catalog-collection-image` holder, as V1 Variation Bundle already does, and derive output pixels from its physical dimensions.

## V2 consequence

The useful V2 model is placement-aware:

```text
placementKey
   + measured holder widthMm/heightMm
   + intended output profile / DPI
   + selected factual source
   + framing / contain-cover semantics
        ↓
required output raster
        +
source adequacy / upscale pressure evidence
        ↓
renderer or optional external capability
```

This also reinforces the Table image-editing gap: Table should eventually have its own placement identity because its framing and required raster can legitimately differ from Card/Collection for the same product.

## New research utility

`scripts/research/image-output-resolution.mjs` provides deterministic helpers for:

- CSS px → mm fallback conversion;
- physical mm + DPI → required raster dimensions;
- effective DPI of a raster at a physical size;
- contain-fit physical box/effective DPI;
- source sampling scale at an output DPI from an existing 96-DPI placement plan.

Actual measured `widthMm/heightMm` remains preferable to CSS-pixel conversion when available.

## Guardrails

- DPI adequacy is **not** an image-quality score.
- DPI cannot detect optical blur, JPEG damage, poor focus or wrong product identity.
- A larger deterministic master does not create factual detail.
- A source may be adequate for one placement and inadequate for another.
- Raster planning must happen after semantic role/placement selection.
- `no variant` remains valid before any output raster is planned.
- A future generative high-resolution asset must pass the same identity/fidelity gates; native output dimensions alone do not establish authority.

## Current hypothesis

For placement-local catalog derivatives, output resolution should be **physical-use-driven**, with `300 DPI` as a high-quality research comparison target, rather than defined by a universal `4×` or `8×` multiplier.

The 4× Mitchell result remains useful as an internal sampling-quality fixture, but `masterScaleFactor` should not become the long-lived product contract.

## Next gate

1. Execute the committed output-resolution self-test through the isolated research runner.
2. Record its exact output/head as evidence.
3. Extend the placement-measurement concept to the Table gap in the V2 design notes, without modifying V1.
4. Decide whether a future request contract should send `targetPhysicalSize + targetDpi`, explicit target pixels, or both (with one canonical authority).
5. Only after that decide how a source-grounded generative producer should be asked for a native high-resolution master.
