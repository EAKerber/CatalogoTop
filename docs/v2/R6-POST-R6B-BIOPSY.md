# V2 R6 — Post-R6b Publication-Quality Biopsy

## Status

**COMPLETE — no R6c selected.**

Biopsy base:

- `v2@5218e39c36739b538aaf5198ab1ef5d6f7ed766b`;
- R6a Structural Preflight Foundation complete;
- R6b Rendered Description Truncation complete;
- `main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9` remains stable V1.

This biopsy asks a narrow question:

> after R6b, is there another publication-quality signal that already has a sufficiently explicit authority/lifecycle to justify a bounded R6c without inventing a second truth?

The answer is **no** for the four candidates carried forward from R6b.

## Selection standard

R6b was justified because the renderer already produced an explicit, stable factual-visibility signal:

```text
TextFit measurement
  -> data-description-truncated
  -> PreflightRender reads the result
```

A follow-up recut should have comparable evidence. A nearby symptom or a browser-gate measurement is not enough by itself.

The preferred order remains:

1. reuse an explicit existing fact;
2. if none exists, identify the real authority/lifecycle before adding product behavior;
3. do not create a generic render-quality engine merely to make several unrelated checks look symmetrical.

## Candidate A — actual image-load failure

### Existing evidence

`src/print.js::waitForImages(doc)` already acknowledges the asynchronous image lifecycle:

- an image is considered immediately ready only when `image.complete && image.naturalWidth`;
- otherwise print attempts `image.decode()` or waits for `load/error`;
- a decode/load failure is deliberately swallowed so one broken external image does not prevent printing the rest of the document.

That is real behavior, but it is **not** an author-facing image-health authority.

The preview path is different:

```text
App.renderCatalog()
  -> Render.renderCatalog(...)
  -> catalogotop:catalog-rendered
```

`catalogotop:catalog-rendered` is dispatched synchronously after render finalization. It does not wait for every remote image to reach `load/error` settlement.

`PreflightControls` currently trusts render-aware issues from that synchronous lifecycle.

### Why not R6c now

Correct image-load reporting would require a new bounded asynchronous contract, for example:

- a render-instance image settlement projection;
- explicit `load/error/decode` status attached to eligible image usages;
- a lifecycle/event that says the current preview's image observations are settled enough to trust;
- invalidation when rerender replaces those nodes/usages.

Without that, reading `naturalWidth` at `catalog-rendered` can produce false failures for images that are merely still loading.

Adding timers, a broad MutationObserver, or persisting transient failures would be the wrong substitute.

### Decision

**Parked.**

Image-load failure is a plausible future quality feature, but it needs its own asynchronous authority/lifecycle biopsy before implementation.

It must not be folded into `PreflightRender.inspect()` merely because that module already reads DOM datasets.

## Candidate B — Table factual visibility / truncation

### Existing evidence

Table already has deterministic structure and width planning:

- `TableBlock.columnDemand()` derives bounded text-length demand;
- `TableBlock.planColumnWidths()` produces semantic column percentages;
- Table uses `table-layout: fixed`;
- Table cells use `overflow: hidden` and `text-overflow: ellipsis` in `table-block.css`.

However, those are **layout policy**, not an explicit statement that a particular factual value was or was not fully visible.

`TextFit.fitCatalog()` currently measures only:

- Card descriptions;
- Collection member descriptions.

It does not measure Table cells or emit a Table visibility dataset.

`columnDemand` cannot be promoted as truncation truth: it uses bounded character-length statistics to choose column widths, not rendered pixel visibility for each cell.

### Why not R6c now

A truthful Table warning would first require one of two explicit product decisions:

1. extend the Table renderer with a bounded factual-visibility measurement/signal; or
2. deliberately accept a new geometry-based Table visibility observer.

Either choice changes the rendering/measurement contract and deserves its own intent/gates.

Inferring truncation from CSS, string length or column demand would recreate the heuristic path R6b intentionally avoided.

### Decision

**Parked.**

Do not generalize `description_truncated` to Table by selector symmetry.

## Candidate C — collision / overflow geometry

### Existing evidence

Browser gates already use targeted geometry reads for specific invariants:

- `getBoundingClientRect()` for known elements;
- `scrollWidth/clientWidth` for explicit viewport overflow checks;
- computed styles for known preview/print parity assertions.

Those checks are valuable because each one has a specific expected relationship.

There is no equivalent generic runtime contract saying:

```text
all bounding-box intersections = collision defect
all overflow = publication defect
```

The document deliberately contains clipping, hidden overflow, decorative elements, nested grids, full-width units and internal scrolling/chrome outside print.

### Why not R6c now

A generic scanner would need policy before code:

- which element classes participate;
- which overlaps are intentional;
- what tolerance applies to borders/rounding;
- when fonts/images/layout are stable enough to measure;
- preview-scale neutralization;
- whether the same rule must be recomputed in isolated print;
- how to identify the responsible product/block without turning DOM position into persistence identity.

That is substantially broader than R6b's read-only projection of an existing renderer fact.

### Decision

**Parked.**

Targeted browser geometry gates remain appropriate. No generic collision/overflow Preflight rule is justified yet.

## Candidate D — logical vs physical page parity exposed to authors

### Existing evidence

This invariant is already strongly tested, but its authority lives at export/gate time.

`src/print.js::renderPages(state)` checks:

```text
CatalogDocument.pageCount == rendered .catalog-page count
```

before building printable HTML.

The Browser Print Gate goes further:

```text
CatalogDocument logical pages
  -> printable DOM pages
  -> Chromium PDF
  -> pdf-lib physical page count
```

and asserts the physical PDF remains the expected number of A4 pages.

### Why not R6c now

The browser application itself does not have the same `page.pdf() + pdf-lib` capability used by the Playwright gate.

The live editor can know logical page count and isolated DOM page count, but those are not equivalent to proving how the browser's PDF engine physically paginated the output.

Pretending otherwise would weaken the definition of “physical parity”. Moving Playwright/pdf-lib logic into product runtime is not a viable browser architecture.

### Decision

**Keep as physical Browser/CI authority.**

If author-facing export validation is later required, treat it as an export/release workflow decision, potentially with a backend or downloadable-PDF inspection path, not as a synchronous live Preflight check by default.

## Comparative result

| Candidate | Existing explicit signal? | Lifecycle compatible with current Preflight? | New authority required? | R6c? |
| --- | --- | --- | --- | --- |
| Image-load failure | partial, print-only observation | no — asynchronous settlement | yes | no |
| Table truncation | no — only layout/clipping policy | no explicit visibility signal | yes | no |
| Collision/overflow | targeted gate measurements only | no generic stable policy | yes | no |
| Physical page parity | yes, but Playwright/PDF gate authority | no — not available to editor runtime | export/gate workflow | no |

None meets the same standard that selected R6b.

## Architectural conclusion

R6 should **close after R6a + R6b**.

This is a positive scope decision, not unfinished numbering.

R6 delivered two different but coherent layers:

```text
state + CatalogDocument
  -> R6a structural Preflight

already-materialized explicit TextFit fact
  -> R6b render-aware warning

both
  -> one deterministic PreflightReport / existing UI
```

The remaining candidates would each force a new authority, lifecycle, measurement policy or execution environment. Bundling them under “render-aware” would erase precisely the distinctions the architecture has been preserving.

## Re-entry conditions

A parked candidate may return only when its missing contract becomes concrete.

### Image failure may return when

- eligible image usages and identities are explicit;
- settlement/invalidation lifecycle is defined;
- loading vs failed is distinguishable without arbitrary sleeps;
- preview and print semantics are intentionally reconciled.

### Table visibility may return when

- Table renderer exposes an explicit factual-visibility signal or a new measurement contract is deliberately approved;
- cell/row identity is stable;
- measurement does not infer product truth from text length alone.

### Collision/overflow may return when

- a real observed defect class is selected;
- participants/tolerances/stability timing are bounded;
- intentional overlap/overflow is excluded by contract.

### Physical parity may return when

- there is an author-facing export-validation workflow capable of observing the generated physical artifact;
- the system does not pretend DOM page count is physical PDF page count.

## Stop condition for the roadmap

Do not create `R6c` simply to continue R6.

After the R6 closeout, select the next product slice from fresh evidence. It may be publication-related, editor-related, release-related or something else; milestone adjacency is not authorization.