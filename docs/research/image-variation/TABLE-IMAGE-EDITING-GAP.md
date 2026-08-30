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

## Preferred V2 behavior (conceptual, field names not frozen)

When a Table uses the image column:

1. selecting the image cell or its `table-row` exposes the same image-choice and framing vocabulary available to other single-image placements;
2. selection and framing can vary independently from Card/Collection usages of the same product;
3. preview and print resolve from the same placement-specific decision;
4. no edit mutates `product.image` or silently promotes a catalog-local derivative;
5. a Table placement can participate in future image-variation research/jobs using a stable placement identity, not DOM position.

Candidate identity shape, not a production schema:

```text
productId
  + placementKey / usageSignature
  + image selection override
  + image frame override
```

Possible placement vocabulary should extend the already-proven model rather than create a parallel one, e.g. conceptually:

```text
card:<productId>
collection:<blockId>:member:<productId>
table:<blockId>:row:<rowId>
```

The exact persistence key remains open until V2 supports multiple occurrences/placements cleanly.

## Relation to semantic image-variation research

This gap strengthens the placement-aware architecture already being researched:

- the useful image is a function of both factual product identity and placement context;
- `target geometry` is not merely metadata for generation; it also governs ordinary manual framing/selection;
- Table should eventually be included in the placement benchmark after the current raster-quality slice converges.

Do not interrupt R-IMG-1.2 to patch V1 runtime. Treat this as a V2 cross-cutting requirement and future regression case.
