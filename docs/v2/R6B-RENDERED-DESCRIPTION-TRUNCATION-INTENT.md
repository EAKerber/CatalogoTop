# V2 R6b — Rendered Description Truncation — Intent

## Status

**Planned; not implemented.**

Planning authority:

- `v2@ef07409b233a79f2e3bf6ed6680e86c3c9bbdccb`;
- R6a Structural Preflight Foundation complete;
- `main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9` remains stable V1.

R6b is selected by post-R6a biopsy, not by roadmap numbering.

## Observed gap

R6a reports structural facts before/through materialization, but one publication-quality fact already exists only after rendered geometry is known: **description truncation**.

Current `TextFit` already:

- measures the actual rendered Card/Collection description geometry;
- neutralizes preview scale while fitting;
- preserves the complete factual description in `data-full-description`;
- exposes `data-description-truncated="true|false"`;
- records `data-fit-lines` and `data-visible-words`;
- performs word-bounded shortening without injecting ellipsis into the factual copy.

Current renderer runs `TextFit.fitCatalog(root)` inside `finalizePresentation()` before `App.renderCatalog()` publishes `catalogotop:catalog-rendered`.

Therefore R6b does not need to invent a truncation heuristic. It can project an already-materialized render fact into the existing `PreflightReport`.

## Goal

Add one render-aware Preflight warning:

```text
description_truncated — warning
```

when a currently rendered Card or Collection member has a factual description that TextFit had to shorten for the current catalog geometry.

The author should be able to see that publication omits part of the description while the original Product fact remains intact.

## Why this is a separate recut

R6a deliberately keeps `src/preflight.js` free of DOM measurement.

R6b must preserve that boundary:

```text
state + CatalogDocument
  -> Preflight.inspect(state)
  -> structural PreflightReport

rendered #catalogPreview after TextFit
  -> PreflightRender.inspect(root)
  -> renderIssues[]

structural report + renderIssues
  -> bounded pure report merge
  -> same Preflight status/panel
```

The render-aware projection consumes TextFit output; it does **not** measure text itself.

## New issue contract

### `description_truncated` — warning

Emit when an eligible rendered description element has:

```text
data-description-truncated="true"
```

Required identity:

- `code: 'description_truncated'`;
- `severity: 'warning'`;
- `scope: 'product'`;
- `resourceType: 'product'`;
- `resourceId: productId`;
- deterministic issue ID through the existing Preflight issue/report contract.

Useful bounded metadata:

- `productId`;
- `placement: 'card' | 'collection'`;
- `blockId` for Collection when available;
- `fitLines`;
- `visibleWords`.

Do not copy the entire hidden/full description into the issue metadata. Product truth remains in Product state and the rendered element already preserves `data-full-description` for UI/title behavior.

### Author-facing message

Equivalent meaning:

> “A descrição de 1268 foi reduzida para caber nesta composição.”

Do not call it data loss: Product state is unchanged. The problem is publication visibility.

## Severity rationale

`warning`, not blocker.

The document remains truthful and renderable, but part of the factual description is not visible in the published composition. The author may intentionally accept the compact result or choose another width/template/composition.

R6b does not decide that every truncated description must block export.

## Eligible rendered usages

R6b follows what TextFit actually measures today.

### Card

Selector authority:

```text
.catalog-card[data-product-id] h3
```

The product ID comes from the owning `.catalog-card[data-product-id]`.

### Collection member

Selector authority:

```text
.catalog-collection-item[data-product-id] .catalog-collection-copy b
```

The product ID comes from the member element. `blockId` may come from the owning `.catalog-collection[data-collection-id]`.

### Table

**Out of scope in R6b.**

Current TextFit does not expose the same truncation contract for Table cells. Do not infer Table truncation by `scrollWidth`, CSS clipping or ad-hoc geometry merely for symmetry.

A later case may add Table only after its renderer exposes an explicit factual visibility signal.

## Architecture

### `src/preflight.js`

Remains DOM-free.

A small pure helper may be added to reuse the canonical report ordering/status logic, for example:

```js
Preflight.withIssues(baseReport, extraIssues)
```

or equivalent bounded API.

Requirements:

- accepts only issue records;
- deduplicates by deterministic issue ID if needed;
- reruns canonical sorting/count/status derivation;
- does not know about DOM or TextFit.

Do not duplicate report severity/sorting rules in a second module.

### `src/preflight-render.js`

New small render projection.

Responsibilities:

- inspect an already-rendered root;
- read TextFit datasets only;
- emit `description_truncated` issues for eligible Card/Collection occurrences;
- no state mutation;
- no style mutation;
- no call to `getBoundingClientRect`, `scrollHeight`, `getComputedStyle` or fitting functions;
- no rerender.

Conceptual API:

```js
PreflightRender.inspect(root) -> issues[]
```

### `src/preflight-controls.js`

On refresh:

1. compute structural report through `Preflight.inspect(Core.getState())`;
2. inspect the current `#catalogPreview` through `PreflightRender.inspect(...)`;
3. merge render issues through the pure Preflight report helper;
4. render the existing status/panel.

No new UI surface is required.

The existing `catalogotop:catalog-rendered` lifecycle is the primary timing authority because the event fires after renderer finalization/TextFit.

Other lifecycle events may continue refreshing structural state, but render-aware issues must only be trusted from the latest materialized preview.

## Lifecycle guard

Avoid reporting stale render issues when the preview is not authoritative.

The simplest intended path:

- `App.renderCatalog()` renders/fits preview;
- then dispatches `catalogotop:catalog-rendered`;
- PreflightControls refreshes structural + render-aware issues from that preview.

If a structural-only event fires before the preview has been rerendered, do not invent or persist a stale render report. R6b should reuse the existing synchronous `renderAll()/renderCatalog()` order rather than introduce timers/MutationObservers.

## Preview/print parity

Print creates an isolated document and runs `TextFit.fitCatalog(printDoc)` again after styles/fonts/images are ready.

R6b's author-facing warning is derived from the editor preview, but its gate must verify that the controlled truncation fixture remains equivalent in isolated print:

- same full factual description;
- same visible description;
- `data-description-truncated="true"` in both;
- same fit-line budget.

This does not create a runtime print-Preflight authority. It is a regression gate proving the existing preview signal is safe enough for the selected case.

If preview/print truncation diverges materially in the fixture, stop and reassess instead of adding a second runtime issue source in R6b.

## Expected implementation surface

```text
src/preflight.js                         small pure report-merge helper
src/preflight-render.js                  new DOM-read-only projection
src/preflight-controls.js                combine structural + rendered issues
index.html                               explicit preflight-render bootstrap
scripts/preflight-render-fixture.mjs     optional static/pure-ish contract fixture if useful
scripts/browser-r6b-truncation-gate.mjs  canonical behavior/parity gate
.github/workflows/browser-print.yml      add browser gate
package.json                             only if a non-browser fixture is added
```

No CSS change is expected unless issue copy exposes an actual layout defect in the existing panel.

## Acceptance requirements

At minimum:

1. clean short Card description -> no truncation warning;
2. long Card description that TextFit truncates -> one `description_truncated` warning;
3. long Collection member description -> one warning for that product/member;
4. issue metadata identifies Card vs Collection without new persisted placement state;
5. Product description remains byte/deep-equal before/after;
6. visible text contains no invented ellipsis;
7. opening/closing Preflight does not change fitting;
8. changing width/composition and rerendering removes/adds warning according to the new TextFit result;
9. same product cannot accumulate duplicate truncation issues from repeated refreshes;
10. Table does not gain a truncation warning by inference;
11. structural R6a issues continue to merge/sort/count deterministically with render warnings;
12. blocker status from R6a remains `blocked` even when truncation warnings also exist;
13. preview and isolated print agree on the controlled truncation fixture;
14. Preflight chrome remains absent from print;
15. mobile Catálogo gains no new horizontal overflow.

## Browser gate scenario

Use a controlled catalog containing:

- one short Card description;
- one deliberately long Card description;
- a Collection with at least one deliberately long member description;
- optionally one Table row with a long description as a negative control.

Verify:

```text
render -> TextFit dataset -> PreflightRender issue -> merged status/panel
```

Then change a real bounded presentation axis (for example Card width where the existing line budget changes), rerender and prove the issue responds to the resulting TextFit truth rather than cached state.

Create an isolated print frame and prove the long controlled description fits/truncates equivalently.

## Explicitly out of scope

R6b does not include:

- image network/load failure detection;
- generic broken-resource detection;
- Table text truncation inference;
- collision/overlap/overflow scanning;
- physical PDF page-count reporting in product UI;
- DOM geometry checks inside `src/preflight.js`;
- a generic render-quality rule engine;
- persisted Preflight results;
- waivers/acknowledgements;
- auto-fix;
- automatic width/template changes;
- print/export enforcement;
- subjective copy-quality scoring.

## Stop conditions

Stop/re-plan if implementation requires:

- running TextFit a second time only for Preflight;
- measuring geometry inside `src/preflight-render.js` instead of consuming TextFit's explicit result;
- modifying Product description or presentation to clear the issue;
- persisting render issues;
- creating a second preview/print materialization path;
- delaying report correctness with arbitrary sleeps/timeouts;
- introducing MutationObserver to detect fitting;
- expanding to Table without an explicit Table visibility signal;
- copying Browser gate geometry heuristics directly into product runtime;
- disabling print merely because truncation warning exists.

## Post-R6b decision

After this recut, biopsy again.

Image-load failures and physical/overflow checks remain plausible R6 directions, but each has a different lifecycle and should not be bundled with truncation solely under the label “render-aware”.
