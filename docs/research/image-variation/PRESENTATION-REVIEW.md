# R-IMG-1.1 — Presentation / Resolution Review

Status: research-only. This gate complements `FIDELITY-REVIEW.md`; it does not replace factual/authority review.

## Why this gate exists

A logical placement such as `440 × 180` describes composition intent. It must not silently become the raster-resolution contract for the asset itself.

R-IMG-1.1 therefore reviews the same candidate at three levels:

1. **master** — high-resolution render at the same relative composition;
2. **placement** — deterministic downsample to the logical holder;
3. **detail zoom** — inspection of characteristic edges, holes, fittings, terminals and segmentation boundaries.

## Required evidence

For each candidate record:

- source pixel dimensions and authority;
- placement profile;
- master profile and integer scale factor;
- whether master geometry is a pure scale of the placement plan;
- transform/resampling method;
- factual foreground/effective-coverage evidence at placement scale;
- whether the master requires source upscaling;
- presentation observations at master and placement size;
- explicit statement that output raster size is not factual source resolution.

## Review dimensions

### 1. Relative composition parity

PASS only if master and placement share the same semantic orientation, margins and relative object geometry. A master must not be independently re-planned merely because more pixels are available.

### 2. Edge quality

Inspect:

- stair-stepping;
- dark/white halos;
- fringe contamination from transparent-edge resampling;
- discontinuities introduced at segmentation boundaries.

Antialiasing/interpolation may add intermediate pixel values. Those values are presentation samples, not new factual product details.

### 3. Master usefulness

The master should remain visually coherent at its native raster and support downstream downsampling/cropping better than a placement-sized-only derivative.

A large master is **not** automatically useful if it merely magnifies a low-resolution source.

### 4. Placement downsample

The catalog-sized preview must be derived from the master by a deterministic reduction path and must preserve the intended composition.

Review whether supersampling produces a visible reduction in aliasing or unstable one-pixel details.

### 5. Detail honesty

Zoom inspection must distinguish:

- source-supported holes/fittings/edges;
- interpolation introduced solely to represent those edges smoothly;
- unsupported reconstruction or sharpening that implies detail absent from the source.

The third category fails the factual gate even if it looks sharper.

### 6. Source-resolution honesty

Always record source dimensions separately from master dimensions.

Examples:

- source `450 × 450` → master `1760 × 720` means the transform raster is larger;
- it does **not** mean the product now contains four times the factual linear detail.

For low-resolution cases such as the caster, a large master may improve layout consistency but must never be scored as recovered detail.

## Outcomes

Use one of:

- `PASS FOR MASTER BASELINE` — presentation quality is adequate to become the deterministic comparison baseline;
- `REVIEW-REQUIRED` — master/placement behavior is useful but an unresolved resolution, boundary or authority question remains;
- `REJECT / SOURCE-LIMITED` — increasing raster dimensions does not produce a trustworthy/useful asset;
- `REJECT / TRANSFORM-QUALITY` — the renderer itself adds unacceptable artifacts.

No outcome here constitutes production approval.

## Initial R-IMG-1.1 cases

- `h45-wide` — strong product/source match and strong orientation benefit;
- `soft-extra-wide` — useful contrast because most placement gain comes from canvas removal and the source is already `800 × 800`.

These two cases should establish whether the 4× master path improves presentation consistently without being confused with factual-resolution claims.
