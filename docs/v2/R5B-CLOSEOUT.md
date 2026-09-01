# V2 R5b — Closeout

## Status

**R5b — Collection Technical Detail is complete and promoted to `v2`.**

Functional promotion authority:

- base before R5b: `v2@798c8f6d292138e669d7943f65ee8bf99e740761`;
- final feature head: `2476d6edd64e168c4dbdd8ef5f00eeadec0aeaa0`;
- PR: `#65 — V2 R5b — Collection Technical Detail`;
- squash merge: `v2@a6e461086420733edea162f91da35668c3225a2e`.

`main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9` remained untouched.

## What R5b closed

The post-R5a biopsy found a concrete asymmetry in the existing editorial vocabulary: a `Collection` preserved a visual family but could not carry the small factual technical summary already present in each member's `product.specs`.

R5b closes that gap without introducing Collection 2.0 as a broad redesign and without adding a fourth primitive.

Delivered behavior:

- `Collection.COLLECTION_PRESETS` now includes `technical` / `Técnico`;
- technical detail is a pure projection of existing `product.specs`;
- only specs with non-empty values are eligible;
- factual spec order is preserved;
- budget is deterministic from existing member width:
  - `simple`: 1 spec;
  - `wide`: 2 specs;
  - `full`: 2 specs;
- exceeded specs are omitted from the summary rather than expanding the cell;
- members with no eligible specs receive no invented placeholder;
- the existing Collection inspector automatically exposes `Técnico` from the preset registry;
- existing width, emphasis and image selection/framing semantics remain valid;
- preview and print consume the same materialization.

## Boundaries preserved

R5b did **not** add or modify:

- ProductStore/ProductSnapshot facts;
- Core schema or migration;
- CatalogOrder;
- CatalogDocument;
- TemplateContract;
- TableBlock;
- top-level Collection geometry;
- Collection fragmentation;
- per-member Card content presets;
- spec overrides or local spec editing;
- generic nesting/container semantics;
- `Callout` or any other new primitive.

The Collection planner remains responsible only for discrete member widths, local rows and atomic top-level rowSpan. The DOM still does not decide pagination.

## Gate evidence

Final feature head `2476d6edd64e168c4dbdd8ef5f00eeadec0aeaa0` passed the canonical push gates:

- Validate `#1083`: **success**;
- Browser Print Gate `#894`: **success**.

PR #65 reran the same canonical gates against the same feature head:

- Validate `#1084`: **success**;
- Browser Print Gate `#895`: **success**.

The R5b browser gate proves:

- technical spec budgets `1/2/2` for `simple/wide/full`;
- empty specs are not rendered;
- factual order is preserved;
- Product specs remain unchanged when switching `technical -> visual -> technical`;
- inspector exposes the bounded preset;
- local width/emphasis remain active;
- image framing remains active;
- Collection remains atomic with no duplicate Cards;
- preview and isolated print agree;
- physical output remains A4 `210 × 297 mm`.

During gate development, two failed Browser attempts exposed fixture assumptions rather than product defects: a `<select><option>` was incorrectly required to be visually visible rather than attached, and the immutability baseline initially compared pre-Core input against normalized Core output. Both tests were corrected to compare the actual contract; no functional scope was widened to make the gates pass.

## R5 state after R5b

R5 is **active, but not pre-expanded into a predetermined R5c**.

Completed R5 recuts:

1. **R5a — Table Row Image Editing Parity** — promoted in `v2@798c8f6d292138e669d7943f65ee8bf99e740761`;
2. **R5b — Collection Technical Detail** — promoted in `v2@a6e461086420733edea162f91da35668c3225a2e`.

The next action is another biopsy of real catalog/editor cases after these two asymmetries are closed. Do not create `Callout`, Collection nesting, a generic container, placement-scoped presentation state or another R5 recut merely for roadmap symmetry.

A next R5 recut should be selected only if a concrete observed case is not already represented cleanly by Card, Collection, Table, current image presentation, or the bounded TemplateContract.

## Next bootstrap

Read in this order:

1. `docs/v2/START-HERE.md`;
2. `docs/v2/ROADMAP.md`;
3. this closeout;
4. `docs/v2/R5B-COLLECTION-TECHNICAL-DETAIL-INTENT.md`;
5. `docs/v2/R5A-TABLE-ROW-IMAGE-EDITING-INTENT.md` when comparing Table/Collection parity;
6. R4 closeouts when evaluating whether a proposed editorial capability belongs in TemplateContract or remains catalog-local.
