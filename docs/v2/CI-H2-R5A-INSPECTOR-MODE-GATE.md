# CI-H2 — R5a Inspector Image Mode Gate Settlement

## Status

**Test hygiene only. Runtime behavior unchanged.**

Base authority:

- `v2@99ce7caf30fd733d714a619bb3042f04f310c943`;
- R6 already closed after R6a + R6b;
- stable V1 remains `main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9`.

## Trigger

The documentation-only R6 closeout PR #75 exposed an intermittent failure in the older R5a browser gate.

The failing assertion was the first wait for:

```text
#contextualInspector [data-table-row-image-frame][data-image-frame-editor="p1"]
```

Playwright `waitForSelector()` defaults to `state:'visible'`.

The same exact PR head passed when the failed Browser job was rerun without any code change, confirming a timing-sensitive gate rather than a docs/runtime regression.

## Runtime sequence

For an eligible products-source Table row with an active image column:

```text
row selected
  -> ContextualInspector renders row facts/actions
  -> ImageVariantControls queueMicrotask(render)
       -> inserts data-table-row-image-frame
  -> GroupingControls schedules inspector augmentation
       -> creates Configuração / Ordenação mode tabs
  -> MobileWorkspace schedules image-mode synchronization
       -> detects editable image frame
       -> adds Imagem tab
       -> data-has-image-mode="true"
       -> current mode remains general
  -> grouping-controls.css intentionally hides editable image frame in general mode
```

The frame is therefore allowed to be briefly visible between insertion and final mode synchronization, but the **settled UI contract** is:

```text
general mode -> image frame attached but hidden
Imagem mode  -> image frame visible/editable
```

The old gate accidentally depended on observing the transient pre-settlement visibility window.

## Hardening

`scripts/browser-r5a-table-row-image-gate.mjs` now:

1. waits for the Table image frame to be **attached**, not visible;
2. waits for the Image tab to exist;
3. waits for `data-has-image-mode="true"` and `data-inspector-mode="general"`;
4. asserts the frame is hidden in settled general mode;
5. keeps the image-choice control available in general mode;
6. clicks the Image tab;
7. only then requires the frame/fitting controls to be visible;
8. preserves all existing image selection, framing, product-truth, geometry, preview/print and eligibility assertions.

No arbitrary sleep is used as correctness criterion.

## Why runtime is not changed

Current runtime behavior is intentional:

- Configuração, Ordenação and Imagem are separate inspector tasks;
- an editable image frame is hidden in general mode;
- choosing Imagem reveals framing controls;
- image choice remains available independently where supported.

Changing CSS or event scheduling merely to satisfy the old gate would regress the product contract and hide the actual test race.

## Scope

CI-H2 changes only browser-test synchronization plus this durable diagnosis.

It does **not** change:

- `ContextualInspector`;
- `ImageVariantControls`;
- `MobileWorkspace`;
- `GroupingControls`;
- CSS visibility rules;
- R5a image semantics;
- Product/Catalog schemas;
- renderer/print behavior;
- Preflight;
- Netlify.

## Gate expectation

The final exact head must pass canonical Validate + Browser on push and again on PR before promotion into `v2`.

This hardening is independent of product roadmap numbering and does not reopen R5 or R6.