# V2-R4a — Closeout

## Outcome

R4a established a single bounded, versioned template language before introducing persistent template resources. The recut intentionally did **not** create TemplateStore, TemplateSnapshot, a template backend API or `Biblioteca > Templates`.

## Delivered contract

- `TemplateContract v1` is data-only and fail-closed.
- Built-ins are immutable `technical@1`, `compact@1` and `showcase@1`.
- `perPage` is derived from rows × columns.
- HTML, CSS, JavaScript, selectors, stylesheet URLs, style strings and arbitrary XY coordinates are rejected as authored template data.
- Legacy aliases migrate deterministically to known built-ins.

## Persisted binding

Catalog state now persists both:

```text
catalog.templateId
catalog.templateVersion
```

Core session schema is 9. CatalogSnapshot is v2 and migrates prior known bindings to version 1. Save/open/duplicate preserve the exact pair and dirty-state includes both fields.

Unknown ID/version combinations fail as unavailable rather than silently rendering with another template.

## Renderer boundary

The canonical pipeline remains:

`state -> CatalogOrder -> CatalogDocument -> Render -> preview / print`

`CatalogDocument` resolves the exact template contract. Template-specific content budgets and layout choices come from bounded contract tokens rather than branches on template identity. Preview and print consume the same resolved materialization.

Institutional header/footer were extracted behind application-owned `DocumentChrome`; initial primitive is `top-mobili-v1`. Templates may reference supported chrome IDs but cannot provide markup.

No redesign was intended. Physical A4, pagination and existing editorial primitives remain compatible.

## User-visible corrections closed during the recut

The R4a physical gate also hardened regressions observed during manual testing:

- unavailable product thumbnails fall back without exposing the browser broken-image icon;
- catalog action toolbar reflows without action/count/zoom overlap or horizontal overflow;
- Card/member `PREÇO` control receives sufficient width for all four labels without truncation;
- the `EXISTENTES` card header has real content inset rather than clipping against the card edge.

These are shell/inspector fixes and do not expand TemplateContract capabilities.

## Gates

The R4a runtime reached full green regression before closeout:

- Validate #1018 — success;
- Browser #829 — success, including existing A4/browser regression and the R4a-specific physical gate.

A final Validate + Browser pair is required on the clean closeout SHA before promotion to `v2`.

## V2 test environment reseed

During final manual validation, the V2 test dataset was found to contain test placeholder products with failing `picsum.photos` references plus products with empty image fields. The user cleared the V2 test resources and authorized a fresh migration from V1.

A temporary one-shot migration copied the current V1 ProductSnapshot into V2 using the deterministic R1 schema-1-to-schema-2 folder migration. Any managed SHA assets would be copied by verified hash; existing external V1 image references were preserved.

Live verification after the reseed reported:

```text
V1 revision:       187
V1 products:       25
V2 products:       25
V2 folders:        3
Image references:  23
Images available:  all
picsum references: 0
```

The verifier compared product payloads by stable V1 product ID: V2 preserved each V1 product payload and added only the derived `folderId`. The migration/scheduled function and temporary verification workflow were then removed. The final deployment returned to the six normal application functions with no scheduled functions.

This reseed is an environment operation, not a permanent V2 migration service or product feature.

## Out of scope / next boundary

R4a does not provide user-managed template resources. The next directional recut is **R4b — Template Library & Immutable Versions**, subject to explicit planning/authorization.

R4b should reuse the language established here rather than creating another template representation. Expected invariants:

- TemplateStore/TemplateSnapshot revision is independent from Product/Catalog/Asset authorities;
- built-ins remain immutable sources;
- editing a published resource creates a new immutable version;
- catalog version upgrades are explicit;
- no stored executable HTML/CSS/JS or arbitrary XY layout.
