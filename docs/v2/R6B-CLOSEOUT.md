# V2 R6b — Rendered Description Truncation — Closeout

## Status

**COMPLETE.**

Functional authority:

- feature head: `678f7be1228a47bfeea5c5b7c7fa78692eb57f19`;
- PR #73 squash promotion: `v2@f589053dcee8aac7b37d417b3036cd92513f24cc`;
- stable V1 remains `main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9`.

Gates on the final clean feature head:

- push Validate #1117 — success;
- push Browser Print #928 — success;
- PR Validate #1118 — success;
- PR Browser Print #929 — success.

PR #73 was merged with expected-head protection after `behind=0` / mergeability readback.

No Netlify operation was performed.

## Delivered behavior

R6b promotes one already-materialized render fact into the existing Preflight report:

```text
description_truncated — warning
```

Eligible occurrences are:

- Card description fitted by TextFit;
- Collection member description fitted by TextFit.

Table remains outside the contract because it does not expose the same explicit TextFit factual-visibility signal.

The warning means that the current composition publishes only part of the factual Product description. It does not mean Product data was modified or lost.

## Runtime shape

R6b adds a deliberately narrow render projection:

```text
state + CatalogDocument
  -> Preflight.inspect(state)
  -> structural report

already-rendered preview after TextFit
  -> PreflightRender.inspect(root)
  -> description_truncated issues

structural report + rendered issues
  -> Preflight.withIssues(...)
  -> canonical sorting / dedup / counts / status
  -> existing Preflight status + panel
```

### `src/preflight-render.js`

`PreflightRender.inspect(root)` reads only explicit datasets already produced by TextFit:

- `data-description-truncated`;
- `data-fit-lines`;
- `data-visible-words`;
- owning `data-product-id` / Collection block identity.

It does **not**:

- call TextFit;
- call `getBoundingClientRect`;
- read `scrollHeight`;
- call `getComputedStyle`;
- mutate styles or state;
- rerender;
- persist issues.

### `src/preflight.js`

`Preflight.withIssues(baseReport, extraIssues)` keeps the report authority centralized:

- canonical deterministic issue identity;
- deduplication by issue ID;
- existing severity ordering;
- existing counts;
- existing `ready | review | blocked` derivation.

`src/preflight.js` remains DOM-free.

### `src/preflight-controls.js`

Render-aware issues are trusted from the current preview after `catalogotop:catalog-rendered`, whose lifecycle occurs after renderer finalization/TextFit.

Structural-only lifecycle events can refresh R6a state without reusing potentially stale rendered issues. No timer or MutationObserver was introduced.

## Gate evidence

The final R6b browser gate proves:

- short Card description produces no truncation warning;
- a Card that TextFit actually shortens produces exactly one warning;
- a truncated Collection member produces a warning with Collection placement/block metadata;
- Table long text is a negative control and gains no inferred warning;
- Product/Core state is unchanged by inspection;
- visible copy receives no invented ellipsis;
- repeated refreshes do not duplicate issues;
- Preflight refresh does not invoke TextFit again;
- `PreflightRender.inspect()` still works when geometry/style reads and fitting are made to throw;
- opening/closing the panel does not change state or fitted copy;
- a real bounded composition change causes the warning to follow the new TextFit truth;
- R6a blockers and R6b warnings merge deterministically, with blocker status preserved;
- controlled Collection truncation remains equivalent between preview and isolated print;
- Preflight chrome stays out of print;
- mobile Catálogo gains no horizontal overflow.

## Important gate learning — width is not universally monotonic

Early fixture attempts assumed that changing a Card from `simple` to `full` should necessarily reduce truncation.

That assumption was false for `contentPreset:'visual'`: the current CSS deliberately increases heading typography for `width-full.content-visual`, so extra horizontal space and larger type are coupled. “More width” therefore does not imply “less truncation”.

The final gate isolates the intended presentation axis instead of encoding that false invariant:

- `contentPreset:'standard'` stays fixed;
- only Card width changes `simple -> full`;
- the fixture deterministically finds a description for which the existing TextFit truth is truncated in simple and complete in full;
- R6b merely observes the resulting dataset before and after the rerender.

This is a test-design finding, not a request to change Card design or TextFit behavior.

## Boundaries preserved

R6b did not change:

- Product/Catalog/Asset/Template schemas;
- ProductStore, CatalogStore, AssetIndexStore or TemplateStore;
- CatalogOrder or CatalogDocument;
- renderer semantics;
- TextFit behavior;
- TemplateContract;
- Table truncation semantics;
- print/export enforcement;
- Preflight persistence.

No auto-fix, geometry scanner, render rules engine, timers or MutationObserver were added.

## Branch-work note

During the feature branch an accidental `docs/v2/.noop` file was created. It was immediately removed before PR creation. The final clean head `678f7be...` was re-gated after removal, and PR #73 contained exactly six intended R6b files.

The incident has no runtime or promoted-tree effect.

## Post-R6b state

R6 now has two proven layers:

1. R6a — structural publication issues from state + CatalogDocument;
2. R6b — one explicit render-time factual-visibility signal from already-fitted preview DOM.

Do **not** infer an R6c merely from numbering.

Remaining candidates have different authorities/lifecycles and require independent biopsy:

- actual image-load failure;
- collision/overflow geometry;
- logical-vs-physical page validation exposed to authors;
- Table factual visibility/truncation.

R6b proves that a render-aware projection can be useful when the renderer already exposes a stable explicit signal. It does not justify turning browser-test geometry checks into a generic runtime validation engine.
