# CatalogoTop V2 — Roadmap and dependency order

## Baseline and intent

V2 starts from the stable V1 release:

- `main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9`
- tag `v1.0.0`
- active product-development line: `v2`

CatalogoTop remains a constrained catalog-authoring system. V2 makes products, catalogs, reusable assets and templates explicit resources without collapsing their authorities into one monolithic state object.

## Current milestone status

- **R1 — Product Library Foundation: complete**.
- **R2 — Saved Catalog Documents: complete**. See `R2-CLOSEOUT.md`.
- **R3 — Asset Library: complete**. See `R3-CLOSEOUT.md`.
- **R4 — Constrained Template System 2.0: split into staged recuts**.
  - **R4a — Template Contract & Versioned Binding: implementation complete / closing promotion**. See `R4A-TEMPLATE-CONTRACT-INTENT.md` and `R4A-CLOSEOUT.md`.
  - **R4b — Template Library & Immutable Versions: next directional recut, not automatically authorized**.
- R5+ remain directional.

## One Library UI, multiple authorities

```text
Biblioteca UI
  ├─ Product provider    -> ProductStore / ProductSnapshot
  ├─ Catalog provider    -> CatalogStore / CatalogSnapshot
  ├─ Asset provider      -> AssetIndexStore / AssetIndexSnapshot + AssetStore
  └─ Template provider   -> future R4b TemplateStore / TemplateSnapshot

Built-in template language -> TemplateRegistry / TemplateContract
```

`FolderTree` may be reused as pure vocabulary, but namespaces and revisions remain provider-scoped.

Primary navigation remains `Cadastro | Catálogo | Biblioteca`. Templates are not a permanent fourth primary tab; selection stays in `Catálogo`, and future reusable-template administration may live in `Biblioteca`.

## Completed recuts

### R1 — Product Library Foundation — COMPLETE

Delivered ProductSnapshot v2, deterministic legacy folder migration, provider-scoped FolderTree, contextual Cadastro lookup and Product Library administration.

### R2 — Saved Catalog Documents — COMPLETE

Delivered independent CatalogSnapshot/CatalogStore, create/open/save/duplicate, dirty state, catalog folders and compatible session/backup migration while preserving the existing A4 materialization pipeline.

### R3 — Asset Library — COMPLETE

Delivered independent AssetIndex authority, authoritative usage projection, image Library provider, folders/search/accounting, standalone upload, SHA deduplication and reuse. No blob GC was introduced merely because an asset is `Sem uso`.

## R4 — Constrained Template System 2.0

### R4a — Template Contract & Versioned Binding — IMPLEMENTATION COMPLETE

Delivered:

- `TemplateContract v1`, strict bounded data contract;
- immutable built-ins `technical@1`, `compact@1`, `showcase@1`;
- `perPage` derived from rows × columns;
- persisted `templateId + templateVersion`;
- Core schema 9 and CatalogSnapshot v2 migration;
- exact resolution with fail-closed unavailable ID/version;
- renderer budgets/layout driven by contract tokens rather than template-ID behavior branches;
- application-owned `DocumentChrome` with `top-mobili-v1`;
- preview and print using the same resolved template contract;
- physical A4 behavior preserved;
- no TemplateStore/API/Library provider in this recut.

Detailed contract: `R4A-TEMPLATE-CONTRACT-INTENT.md`. Closure: `R4A-CLOSEOUT.md`.

### R4b — Template Library & Immutable Versions — NEXT DIRECTIONAL RECUT

Subject to explicit planning/authorization, expected responsibilities are:

- independent `TemplateSnapshot` / `TemplateStore` revision authority;
- `Biblioteca > Templates` without a new primary application tab;
- built-ins exposed as immutable sources/presets;
- duplicate built-in/existing template to create an editable resource;
- publishing/editing creates a new immutable version rather than rewriting a referenced version;
- catalog upgrades between versions are explicit and mark the catalog dirty;
- server/browser validation reuses `TemplateContract` as the only template language.

Still out of scope unless separately decided: stored HTML/CSS/JS, arbitrary selectors/stylesheets, arbitrary XY layout or generic webpage-builder behavior.

## R5 — Editorial Vocabulary 2.0

Directional work after template resources stabilize: Collection/Table refinements and possibly a constrained Callout only where Card/Collection/Table cannot model a real case cleanly. No generic nesting system by default.

## R6 — Preflight / publication quality gate

Directional checks include required facts, missing assets, stale references, invalid blocks, overflow/collision, logical vs physical page count, template compatibility and preview/print parity. Preflight validates; it does not mutate commercial truth to pass.

## Cross-cutting invariants

1. `main` remains stable V1 until an explicit V2 release decision.
2. Product truth and presentation truth stay separate.
3. Resource identity survives organizational move/rename.
4. Revisions are scoped to their authority.
5. Shared UI does not imply shared persistence.
6. V1 migration is deterministic and testable.
7. Subtractive/unifying solutions are valid.
8. A4 changes require physical browser gates.
9. No free-form editor or executable template system without a new product decision.
10. Browser session state is not a substitute for saved-resource persistence.
11. Content-addressed asset bytes remain immutable.
12. Usage derives from authoritative snapshots.
13. `Sem uso` is accounting, not deletion safety.
14. Saved catalogs bind to an exact template ID/version and never silently fall back to another visual system.
15. Future persisted templates remain bounded data validated by the app-owned TemplateContract.

## Sequence rationale

R1 established Library/folder vocabulary; R2 established reopenable catalog identity; R3 established reusable assets; R4a established a safe versioned template language. R4b can now add template-resource persistence without inventing a second language. R5 can expand editorial vocabulary against explicit capabilities, and R6 can validate the stabilized authoritative structures.

This order is directional, not a promise to implement every item unchanged.
