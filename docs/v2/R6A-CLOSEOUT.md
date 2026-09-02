# V2 R6a — Structural Preflight Foundation — Closeout

## Status

**Complete and promoted.**

Functional authority:

- `v2@4a7dfbdaeb5bcf918c29a764d862956b0e120d3b`;
- feature head `3018c8fbe89786c17c3d8243e3d209a3c9d4508b`;
- PR #70 — `V2 R6a — Structural Preflight Foundation`;
- `main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9` unchanged.

Gates on the exact feature head:

- push Validate #1101 — success;
- push Browser Print #912 — success;
- PR Validate #1102 — success;
- PR Browser Print #913 — success.

PR #70 was squash-merged with expected-head protection after `mergeable:true` and `behind=0` readback.

## What R6a delivered

R6a adds publication **observability**, not corrective policy.

The new `Preflight.inspect(state)` is a pure, ephemeral projection over current state plus `CatalogDocument`. It returns a deterministic report:

```js
{
  status: 'ready' | 'review' | 'blocked',
  counts: { blockers, warnings, info },
  issues: [...]
}
```

Issue identity/order are deterministic. Inspecting does not mutate the supplied state and no Preflight result is persisted.

### Structural checks shipped

R6a implements exactly the eight checks selected by the intent:

1. `template_unavailable` — blocker;
2. `catalog_empty` — blocker;
3. `selected_product_missing` — blocker;
4. `selected_product_inactive` — warning;
5. `required_product_fact_missing` — blocker for code/description only;
6. `editorial_block_not_materialized` — warning;
7. `image_selection_fallback` — warning;
8. `visible_image_missing` — warning.

Known template-binding failures are converted into a report blocker while unexpected programmer/runtime errors still surface instead of being hidden as publication issues.

## Placement-aware image semantics

Image checks are derived from **materialized usage**, not a generic product rule.

- Card with a real variant-image grid does not require the canonical main image for that usage.
- Collection members are single-image usages.
- Table rows are single-image usages only for `rowSource:'products'` with the `image` column active.
- `commercialRows` remains outside image semantics.

This preserves the R5 authority boundary and avoids inventing row/placement-scoped image state.

## Author-facing UI

Catálogo now exposes one compact Preflight status control:

- `Pronto`;
- `Revisar · N`;
- `Bloqueios · N`.

The control opens a lightweight issue panel with summary and resource references. The panel recomputes from existing lifecycle events and stores no parallel truth.

R6a deliberately does **not** disable/intercept `Gerar PDF / Imprimir`. A report may be `blocked`, but enforcement remains a future explicit product decision.

Preflight chrome is excluded from isolated print output.

## Architecture preserved

R6a did not require changes to:

- `CatalogDocument`;
- `CatalogOrder`;
- ProductStore/ProductSnapshot;
- CatalogStore/CatalogSnapshot;
- AssetIndexStore/AssetStore;
- TemplateStore/TemplateContract;
- renderer semantics;
- Core schema;
- pagination/materialization rules.

No PreflightStore, validation plugin engine, auto-fix pipeline, DOM measurement inside the pure domain or new persistence revision authority was introduced.

Bootstrap remains explicit through `index.html`; no script/CSS side-effect loader or MutationObserver was added.

## Tests

### Pure fixture

`scripts/preflight-fixture.mjs` covers:

- ready state;
- exact-template failure;
- missing selected ID;
- inactive selected product;
- required code/description;
- stale/non-materialized block;
- stale image selection;
- missing image;
- variant-grid false-positive guard;
- Table without image column;
- `commercialRows` image exclusion;
- deterministic report order/identity;
- non-mutation of input.

### Browser gate

`scripts/browser-r6a-preflight-gate.mjs` verifies:

- `Pronto → Revisar → Bloqueios` reactive states;
- issue-panel content;
- no Core mutation when opening/closing;
- unchanged A4 geometry/page count;
- print button remains available under R6a blockers;
- no Preflight chrome in isolated print;
- no new mobile horizontal overflow.

Both are part of canonical Validate/Browser pipelines.

## Out of scope remains out of scope

R6a did not pull forward:

- TextFit/DOM truncation detection;
- real image-load/network failure checks;
- collision/overflow geometry checks;
- logical-vs-physical PDF checks surfaced to the author;
- persisted reports/history;
- issue acknowledgement/waivers;
- auto-fix;
- print/export enforcement;
- business-specific price/spec requirements;
- subjective quality scoring.

## Next decision

Do not assume a predetermined R6b.

The strongest directional candidate remains a **render-aware publication layer**, because TextFit already exposes truncation and browser gates already know physical A4 facts. Before implementing it, biopsy the signals that can be promoted cleanly from rendered output without creating a second materialization authority or turning test-only physical assertions into unstable runtime heuristics.

R6a proves the issue/report vocabulary and author-facing surface. The next recut should reuse that contract rather than generalize it into a rules engine.
