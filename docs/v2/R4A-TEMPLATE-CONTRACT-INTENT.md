# V2-R4a — Template Contract & Versioned Binding

## Purpose

R4a turns the current hard-coded template choices into a bounded, versioned declarative contract without introducing a template persistence authority yet and without redesigning the A4 output.

The vertical is deliberately ordered as language first, persistence binding second, renderer migration third. A future TemplateStore/Library provider may only persist contracts that already survive this recut.

## Current problem

Before R4a, a catalog stores only `catalog.templateId`. The corresponding template definition is a static registry entry, while real behavior is split across `templates.js`, `Composition`, `Render` and template-id CSS branches. Changing the meaning of an existing ID could therefore change the output of an already saved catalog.

Header/footer are shared institutional chrome but are hard-coded inside the generic renderer rather than selected through an explicit supported primitive.

## Contract

`TemplateContract v1` is data only. It contains:

- stable `id` + immutable positive integer `version`;
- name/description;
- A4 portrait page declaration;
- supported institutional header/footer primitive IDs;
- bounded rows/columns;
- card orientation/scale/content budgets;
- default distribution/typography;
- explicit capability sets for blocks, widths, content presets, distributions and typography.

`perPage` is derived from `columns × rows`; it is not an authored field.

The contract MUST NOT contain HTML, JavaScript, CSS, selectors, stylesheet URLs, style strings or arbitrary XY coordinates. Unknown fields fail closed.

## Built-ins and migration

The three current visual systems become immutable built-ins:

- `technical@1` — 2×4;
- `compact@1` — 3×4;
- `showcase@1` — 2×3.

R4a has no intentional redesign. Existing pagination/content-budget/orientation behavior must be reproduced by these v1 contracts.

Legacy aliases remain deterministic migrations:

- `eletrica` -> `technical@1`;
- `moveis` -> `compact@1`;
- `promo` -> `showcase@1`.

After persistence migration, unknown ID/version combinations fail closed as `template_unavailable`; they must never silently render as another template.

## Persisted binding

R4a upgrades catalog state to persist:

```text
catalog.templateId
catalog.templateVersion
```

Core session schema advances from 8 to 9. CatalogSnapshot advances from v1 to v2 with deterministic v1 -> v2 migration assigning version 1 to existing known templates.

Dirty signatures include both fields. Saving/reopening/duplicating a catalog preserves the exact template reference.

## Renderer boundary

The supported pipeline remains:

`state -> CatalogOrder -> CatalogDocument -> Render -> preview / print`

`CatalogDocument` resolves the exact `templateId@templateVersion` once and materializes the resolved contract. Preview and print consume the same resolved document/template.

Template-specific decisions that are currently conditional on IDs move to contract properties/tokens. Runtime DOM attributes/classes are implementation detail derived from validated enums, not authored strings.

## Institutional chrome

R4a extracts shared document chrome behind a small application-owned registry/primitive. Initial supported primitive:

`top-mobili-v1`

Templates may choose only supported primitive IDs. They cannot provide markup. Logo/location/WhatsApp remain application/institutional configuration rather than editable template facts.

## Out of scope

- TemplateStore / TemplateSnapshot / backend template API;
- `Biblioteca > Templates`;
- editing or creating user template resources;
- arbitrary HTML/CSS/JS;
- free-form XY layout;
- new A4 design;
- new editorial primitives;
- changes to ProductStore, AssetIndexStore or AssetStore authorities.

## Gates

R4a is complete only when:

1. all three built-ins validate under TemplateContract v1;
2. executable/unknown fields and out-of-range values fail closed;
3. legacy catalog bindings migrate deterministically to version 1;
4. save/open/duplicate preserve `templateId + templateVersion`;
5. unknown exact template references fail instead of falling back;
6. renderer has no template-ID behavior branches outside the registry/migration compatibility seam;
7. preview and print resolve the same exact template contract;
8. physical A4 remains 210 × 297 mm and logical/physical page counts agree;
9. representative 13-card pagination remains technical=2 pages, compact=2, showcase=3;
10. ProductStore/AssetIndex revisions remain unaffected by template selection;
11. the full existing Validate + Browser regression stays green.
