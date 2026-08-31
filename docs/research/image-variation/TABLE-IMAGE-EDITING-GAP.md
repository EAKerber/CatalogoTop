# V1 gap — Table image editing / placement-specific image state

Status: research note only  
Branch: `research/semantic-image-variation-v2`

## Observation

V1 supports an image column for `Table` when `rowSource = products`, but a selected `table-row` cannot edit the image presentation used by that row.

This is not merely a missing inspector control. The V1 image contracts intentionally stop at Card + Collection:

- `presentation.imageFrames[productId]` is applied only to Card and Collection in v0.11.2;
- `presentation.imageSelections[productId]` is also product-scoped in V1;
- V1 Variation Bundle placement keys cover Card and Collection only;
- Table rows materialize `product.image` directly and render a plain `<img>` in the image cell.

`commercialRows` do not currently expose an image column, so this note concerns product-source table rows unless that model changes separately.

## Why the naive fix is insufficient

Simply showing the existing product-level frame control inside `table-row` would couple unlike usages.

A table image cell has a materially different holder/aspect/scale from a Card or Collection member. If a single `imageFrames[productId]` authority is reused, adjusting the table row can unintentionally change the same product's Card/Collection presentation.

The same issue applies to image selection: a compact table may legitimately prefer another approved faithful image than a wide card.

Therefore the missing capability exposes a broader V2 requirement: image selection/framing should be able to belong to an editorial **usage/placement**, with product-level state serving only as an optional/default fallback if retained for compatibility.

## R-IMG-1.3 adds a resolution reason for placement-specific state

V1 Table currently gives the image cell an outer width of `14 mm`, `.7 mm` horizontal padding on each side under global border-box sizing, and an image `max-height` of `11 mm` with `object-fit: contain`.

For a square image, the effective contained box is therefore at most about `11 × 11 mm`.

A `128×128` raster displayed at `11×11 mm` is about **296 DPI**. The same factual raster is strongly inadequate for the much larger wide-card benchmark holder.

This means three things must remain independent:

1. source factual raster (`128×128` is still `128×128`);
2. placement adequacy (approximately adequate for a tiny Table thumbnail, inadequate for a large Card);
3. master/output raster chosen for that placement.

So Table placement identity is needed not only for framing/selection but also for future resolution planning and variation requests.

## Preferred V2 behavior (conceptual, field names not frozen)

When a Table uses the image column:

1. selecting the image cell or its `table-row` exposes the same image-choice and framing vocabulary available to other single-image placements;
2. selection and framing can vary independently from Card/Collection usages of the same product;
3. preview and print resolve from the same placement-specific decision;
4. no edit mutates `product.image` or silently promotes a catalog-local derivative;
5. a Table placement can participate in future image-variation research/jobs using a stable placement identity, not DOM position;
6. its actual physical image holder can be measured and used to derive an appropriate output-raster requirement.

Candidate identity shape, not a production schema:

```text
productId
  + placementKey / usageSignature
  + image selection override
  + image frame override
  + measured physical holder
  + output-use profile
```

Possible placement vocabulary should extend the already-proven model rather than create a parallel one, e.g. conceptually:

```text
card:<productId>
collection:<blockId>:member:<productId>
table:<blockId>:row:<rowId>
```

The exact persistence key remains open until V2 supports multiple occurrences/placements cleanly.

## Resolution/request authority

R-IMG-1.3 favors a single canonical authority:

```text
measured physical holder (widthMm / heightMm)
        +
output profile / targetDpi
        ↓
derived target pixel dimensions
```

Target pixel dimensions may still be transported for consumer convenience and validation, but they should be **derived evidence**, not an independent competing authority. Otherwise `physical size + DPI` and `target pixels` can disagree while both appear valid.

This also preserves a useful separation:

- physical holder belongs to the placement;
- output DPI belongs to the intended use/quality profile;
- source dimensions belong to factual evidence;
- target pixels are a deterministic consequence.

## Relation to semantic image-variation research

This gap strengthens the placement-aware architecture already being researched:

- the useful image is a function of both factual product identity and placement context;
- target geometry is not merely metadata for generation; it governs manual framing, selection and resolution adequacy;
- a source can be adequate for one placement and inadequate for another;
- Table should eventually be included in the placement benchmark after the current research contract converges.

Do not patch V1 runtime as a side effect of R-IMG-1. Treat this as a V2 cross-cutting requirement and future regression case.
