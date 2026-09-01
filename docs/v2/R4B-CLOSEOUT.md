# V2-R4b — Closeout

## Outcome

R4b completes the persistent-resource half of the Constrained Template System 2.0 established by R4a. Templates are now reusable saved resources without introducing a second template language, arbitrary executable authoring or silent version upgrades.

Promoted authority:

```text
v2@7f6046f7448ff4f1b80082c8aa176d7e75798b24
PR #62 — V2 R4b — Template Library & Immutable Versions
```

The short post-promotion audit found no concrete functional gap requiring an R4c. R4 is therefore closed after R4a + R4b.

## Delivered authority

R4b adds an independent:

```text
TemplateStore / TemplateSnapshot
```

Its revision, cache, optimistic conflict handling, history and readback are independent from ProductStore, CatalogStore and AssetIndexStore.

Built-ins remain application-owned and immutable:

```text
technical@1
compact@1
showcase@1
```

They are exposed through the Library/registry but are not duplicated into TemplateSnapshot persistence.

## Immutable custom versions

Custom resources have stable IDs and append-only version history.

- versioning starts at 1;
- versions are positive and contiguous;
- historical versions cannot be rewritten;
- editing latest creates exactly `latest + 1`;
- built-in IDs are reserved from custom persistence;
- no template delete or GC exists in R4b;
- no folder hierarchy was introduced without a demonstrated need.

Duplicate/edit work starts as a local draft. Publication is the persistence boundary; duplicating a source alone performs no write.

## Runtime and exact catalog binding

The synchronous `Templates` registry remains the renderer-facing projection rather than becoming persistence authority. It resolves built-ins and every persisted custom version by exact pair:

```text
Templates.resolve(templateId, templateVersion)
```

Catalog binding remains exact `templateId + templateVersion`. Older catalogs continue resolving the historical version they saved after newer versions are published. There is no automatic upgrade to latest.

Selecting another template/version updates the pair atomically and marks a saved catalog dirty.

## Biblioteca > Templates

`Templates` is the fourth provider inside the existing `Biblioteca` surface:

```text
Produtos
Catálogos
Imagens
Templates
```

No new primary application tab was created.

Built-ins can be duplicated or used in the catalog. Custom resources can be edited, duplicated or used, including explicit selection of historical versions where required by an existing catalog binding.

The editor remains bounded to properties already represented by TemplateContract v1. Page size/orientation, institutional chrome and capability arrays remain application-controlled/read-only in this recut.

## Renderer boundary

R4b does not redesign the renderer. The protected pipeline remains:

```text
state
  -> CatalogOrder
  -> CatalogDocument
  -> preview / print
```

Preview and print consume the same resolved template contract/materialized document. A4 physical behavior remains under the Browser Print regression suite.

## Gate migration discovered during closeout

The first full R4b regression was blocked by an R3-era Asset Library assertion that required exactly three Library providers. R4b legitimately adds a fourth provider, `templates`.

The gate was migrated semantically: it now validates the exact provider IDs (`products`, `catalogs`, `images`, `templates`) while preserving all Asset Library row, usage and provider-scoped revision invariants. No runtime relaxation was required.

## Final gates and promotion

Final feature-branch head before squash promotion:

```text
662957c3839c17e550354d3242eb056fbf9bf63d
```

Push gates on that exact SHA:

- CatalogoTop Validate #1063 — success;
- CatalogoTop Browser Print Gate #874 — success.

PR #62 gates on the same exact SHA:

- CatalogoTop Validate #1064 — success;
- CatalogoTop Browser Print Gate #875 — success.

Before merge, the PR readback showed:

- base `v2@4b8f6250286030b6be32ff625d97bc0de5551cc2`;
- head `662957c3839c17e550354d3242eb056fbf9bf63d`;
- `mergeable=true`;
- `mergeable_state=clean`.

The squash merge used `expected_head_sha` and produced:

```text
7f6046f7448ff4f1b80082c8aa176d7e75798b24
```

Post-merge readback confirmed `v2` at that SHA and `main` unchanged at the stable V1 authority:

```text
main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9
```

## R4 closure audit

R4a supplied the bounded TemplateContract and exact versioned binding. R4b supplied the independent persistent template authority, immutable custom versions, bounded management UI and historical resolution.

The combined system now satisfies the intended R4 boundary without requiring:

- arbitrary HTML/CSS/JS;
- arbitrary XY positioning;
- a generic webpage builder;
- template deletion/GC;
- template folders by default;
- renderer redesign;
- shared revision domains across Library providers;
- silent template fallback or auto-upgrade.

No concrete missing capability was found that belongs inside the R4 contract. R4 is therefore **complete**.

## Next boundary

The next directional milestone is **R5 — Editorial Vocabulary 2.0**.

R5 should begin with a biopsy/planning pass against real catalog cases rather than by automatically adding primitives. In particular, Collection 2.0, Table refinements and any possible Callout should be justified by cases that do not fit the existing vocabulary cleanly.

R5 is not implicitly authorized merely because R4 is closed.
