# V2 R6b — Rendered Description Truncation — Final Contract

## Status

**COMPLETE.**

Functional authority:

- feature head `678f7be1228a47bfeea5c5b7c7fa78692eb57f19`;
- PR #73 promoted to `v2@f589053dcee8aac7b37d417b3036cd92513f24cc`;
- R6a Structural Preflight Foundation remains the structural base;
- `main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9` remains stable V1.

R6b was selected by post-R6a biopsy, not by roadmap numbering.

Execution/gate details live in `R6B-CLOSEOUT.md`.

## Observed gap

R6a reports structural facts before/through materialization, but one publication-quality fact already existed only after rendered geometry was known: **description truncation**.

`TextFit` already:

- measures actual rendered Card/Collection description geometry;
- neutralizes preview scale while fitting;
- preserves the complete factual description in `data-full-description`;
- exposes `data-description-truncated="true|false"`;
- records `data-fit-lines` and `data-visible-words`;
- performs word-bounded shortening without injecting ellipsis into the factual copy.

The renderer runs `TextFit.fitCatalog(root)` inside finalization before `App.renderCatalog()` publishes `catalogotop:catalog-rendered`.

R6b therefore projects an already-materialized render fact into the existing `PreflightReport`; it does not invent a new truncation heuristic.

## Delivered issue

```text
description_truncated — warning
```

Emit when an eligible rendered Card or Collection description has:

```text
data-description-truncated="true"
```

Canonical identity remains governed by Preflight:

- `code: 'description_truncated'`;
- `severity: 'warning'`;
- `scope: 'product'`;
- `resourceType: 'product'`;
- `resourceId: productId`.

Bounded metadata may include:

- `productId`;
- `placement: 'card' | 'collection'`;
- `blockId` for Collection;
- `fitLines`;
- `visibleWords`.

The issue does not copy the full hidden description. Product truth remains in Product state and the rendered element already retains `data-full-description`.

Author-facing meaning is equivalent to:

> A descrição do produto foi reduzida para caber nesta composição.

This is publication visibility, not Product data loss.

## Severity

`warning`, not blocker.

The document remains renderable and factual Product truth remains intact, but part of the description is not visible in the current composition. R6b does not require every truncation to block export.

## Eligible rendered usages

### Card

Selector authority:

```text
.catalog-card[data-product-id] h3
```

### Collection member

Selector authority:

```text
.catalog-collection-item[data-product-id] .catalog-collection-copy b
```

Collection block identity may be derived from the owning `.catalog-collection[data-collection-id]`.

### Table

**Out of scope.**

Current TextFit does not expose the equivalent factual-visibility contract for Table cells. R6b does not infer truncation through clipping, `scrollWidth` or ad-hoc geometry for symmetry.

## Final architecture

```text
state + CatalogDocument
  -> Preflight.inspect(state)
  -> structural PreflightReport

rendered #catalogPreview after TextFit
  -> PreflightRender.inspect(root)
  -> renderIssues[]

structural report + renderIssues
  -> Preflight.withIssues(...)
  -> canonical sort / dedup / counts / status
  -> existing Preflight UI
```

### `src/preflight.js`

Remains DOM-free.

`Preflight.withIssues(baseReport, extraIssues)` reuses canonical issue identity, ordering, counts and `ready | review | blocked` derivation rather than duplicating those rules in a render module.

### `src/preflight-render.js`

`PreflightRender.inspect(root)`:

- inspects an already-rendered root;
- reads TextFit datasets only;
- emits `description_truncated` for eligible Card/Collection occurrences;
- does not mutate state/style;
- does not call `getBoundingClientRect`, `scrollHeight`, `getComputedStyle` or fitting functions;
- does not rerender or persist results.

### `src/preflight-controls.js`

After `catalogotop:catalog-rendered`:

1. compute structural report with `Preflight.inspect(Core.getState())`;
2. inspect current `#catalogPreview` with `PreflightRender.inspect(...)`;
3. merge through `Preflight.withIssues(...)`;
4. render the existing status/panel.

Structural-only events do not reuse render issues from potentially stale preview DOM. No timer or MutationObserver is needed.

## Preview/print boundary

Print creates an isolated document and runs TextFit after styles/fonts/images are ready.

R6b derives author-facing warnings from the editor preview only. Preview/isolated-print equivalence remains a regression gate, **not** a second runtime Preflight authority.

The controlled gate proves equal full factual description, equal visible description, truncation flag and fit-line budget for the selected Collection case.

## Acceptance evidence

The final browser gate proves:

1. short Card -> no warning;
2. Card actually truncated by TextFit -> one warning;
3. truncated Collection member -> one warning;
4. Card/Collection placement metadata without persisted placement state;
5. Product/Core state unchanged;
6. no invented ellipsis;
7. opening/closing Preflight does not change fitting;
8. bounded composition rerender causes warning to follow new TextFit truth;
9. repeated refreshes do not duplicate issues;
10. Table does not gain truncation semantics;
11. R6a structural issues merge/sort/count canonically with R6b issues;
12. R6a blocker status remains blocked alongside render warnings;
13. controlled preview and isolated print fitting agree;
14. Preflight chrome remains absent from print;
15. mobile Catálogo gains no horizontal overflow;
16. Preflight does not run TextFit a second time;
17. render projection does not depend on geometry/style reads.

Final gates:

- push Validate #1117 — success;
- push Browser Print #928 — success;
- PR Validate #1118 — success;
- PR Browser Print #929 — success.

## Test-design learning

A first gate assumption treated Card `simple -> full` as necessarily reducing truncation. That is not a valid product invariant for `contentPreset:'visual'`, because the full visual Card deliberately increases heading typography.

The final proof isolates a real bounded axis:

- `contentPreset:'standard'` stays fixed;
- only width changes;
- the fixture deterministically selects a description whose existing TextFit result differs between simple and full;
- R6b observes that truth rather than predicting it.

This finding changes the test, not Card design or TextFit.

## Explicitly out of scope

R6b does **not** include:

- image network/load failure detection;
- generic broken-resource detection;
- Table text truncation inference;
- collision/overlap/overflow scanning;
- physical PDF page-count reporting in product UI;
- DOM geometry checks inside `src/preflight.js` or `src/preflight-render.js`;
- a generic render-quality rules engine;
- persisted Preflight results;
- waivers/acknowledgements;
- auto-fix;
- automatic width/template changes;
- print/export enforcement;
- subjective copy-quality scoring.

## Preserved stop conditions

Future work should still stop/re-plan rather than stretching R6b if it requires:

- a second fitting pass only for Preflight;
- new geometry measurement merely to infer a visibility fact;
- mutating Product/presentation to clear an issue;
- persisting render issues;
- a second preview/print materialization authority;
- arbitrary sleeps/MutationObserver for correctness;
- Table generalization without an explicit Table visibility signal;
- copying Browser-gate geometry heuristics directly into runtime;
- disabling print because a warning exists.

## Post-R6b decision

R6b is closed. No R6c is selected by this contract.

Image-load failures, geometry anomalies, physical-page validation and Table visibility remain plausible R6 directions, but each has a materially different authority/lifecycle and requires independent biopsy.
