# V2-R4b — Template Library & Immutable Versions

## Purpose

R4b turns the bounded language established in R4a into reusable saved resources without introducing a second template representation and without weakening exact version binding.

The visible result is a `Templates` provider inside `Biblioteca` plus a constrained editor for creating and publishing custom template versions.

## Authorities

R4b adds a fourth independent resource authority:

```text
TemplateStore / TemplateSnapshot
```

It does not share ProductStore, CatalogStore or AssetIndexStore revisions.

Built-in contracts (`technical@1`, `compact@1`, `showcase@1`) remain application-owned and are **not copied into TemplateSnapshot**. Library inventory is the union of app-owned built-ins and persisted custom template resources.

## TemplateSnapshot v1

```text
TemplateSnapshot
  schemaVersion: 1
  revision
  writeId
  updatedAt
  templates[]

TemplateResource
  id
  createdAt
  updatedAt
  versions[]

TemplateVersionRecord
  version
  createdAt
  contract: TemplateContract v1
```

Invariants:

- resource `id` is stable and custom-only;
- every version contract has the same `id` as its resource;
- `record.version === contract.version`;
- versions are unique, positive and contiguous from 1;
- historical versions are immutable;
- the next write for an existing resource may only append `latest + 1`;
- built-in IDs are reserved and cannot be persisted as custom resources;
- no folder tree in R4b;
- no delete in R4b.

## Draft / publish semantics

Editing is local and ephemeral until publication.

### Create from existing

`Duplicar` on a built-in or custom version creates a local draft with:

- new custom resource ID;
- version 1;
- source contract values copied;
- name prefixed/adjusted for a new resource.

No server write occurs until `Criar template`.

### Edit custom resource

`Editar` starts from the latest persisted version and creates a local draft for `latest + 1`.

`Publicar nova versão` appends that exact next version. It never modifies an older version in place.

If the TemplateStore revision changed, publication fails closed using normal optimistic conflict handling. There is no automatic merge.

## Bounded editor surface

R4b edits only values already supported by TemplateContract v1:

- name;
- description;
- layout columns / rows;
- card orientation;
- card scale / visual scale / table scale;
- content budgets: variants / rows / specs / specsWithTable;
- default distribution;
- default typography.

The following remain inherited/read-only in this recut:

- A4 page size;
- portrait orientation;
- header/footer primitive IDs;
- capability arrays.

This deliberately avoids a capability-builder UI before real use requires one.

## Runtime registry

`Templates` remains the synchronous renderer-facing registry.

R4b extends it with an application-owned runtime projection of all persisted custom versions. TemplateStore installs/removes that projection after cache/server load and after successful writes.

The registry itself is not persistence authority.

Exact resolution remains:

```text
Templates.resolve(templateId, templateVersion)
```

A saved catalog referencing an older custom version must continue to resolve after newer versions are published.

## Catalog selector

The catalog template selector becomes version-aware.

Normal choices include:

- all built-ins;
- latest version of every custom resource.

If the currently opened catalog references an older custom version, that exact version must also remain visible/selectable so the UI never silently upgrades it.

Changing the selector updates **both** `catalog.templateId` and `catalog.templateVersion` in one Core mutation and therefore marks a saved catalog dirty.

Upgrade to a newer custom version is explicit user action.

## Biblioteca > Templates

Templates become a fourth provider inside the existing Biblioteca surface; no new primary application tab.

R4b starts flat, without folders.

Each resource row/card shows:

- name;
- built-in/custom state;
- latest version;
- short layout summary;
- version count for custom resources;
- number of saved catalogs referencing the resource/version when available.

Actions:

- built-in: `Duplicar` / `Usar no catálogo`;
- custom: `Editar`, `Duplicar`, `Usar no catálogo`;
- optionally inspect/select an older version, but no mutation/delete of old versions.

No delete operation is introduced in R4b. Retention/deletion requires a later explicit lifecycle policy because saved catalogs may depend on historical versions.

## Backend

Add `/api/templates` with the same write-session model already used by the other resource authorities:

- public GET;
- protected same-origin/write-session PUT;
- independent `expectedRevision`;
- independent history/readback;
- production global store, non-production deploy store.

Server validation mirrors TemplateContract v1 and validates TemplateSnapshot version invariants.

## Cache / bootstrap

Add an independent IndexedDB cache key for `templates-current`.

TemplateStore must install cached custom versions before normal catalog rendering when possible, then reconcile with the server snapshot. A custom-template catalog should not become `template_unavailable` merely because the network reload has not completed yet if a valid cached snapshot exists.

## Out of scope

- arbitrary HTML/CSS/JS/selectors/stylesheets;
- arbitrary XY layout;
- page-size/orientation/chrome editing;
- capability-array editing;
- template folders;
- template deletion or GC;
- automatic catalog upgrade to latest template version;
- per-template collaborative draft persistence;
- renderer redesign/new editorial primitive;
- changes to product/catalog/asset revision authorities.

## Gates

R4b is complete only when:

1. TemplateSnapshot browser/server contracts reject malformed resources and non-contiguous/rewritten versions;
2. built-in IDs cannot be persisted as custom resources;
3. TemplateStore revision/cache/history/readback are independent;
4. duplicating a built-in creates a local draft and only publication creates custom v1;
5. editing a custom latest version appends exactly vN+1 and preserves all older contracts byte-for-byte/structurally;
6. custom versions install into the synchronous Templates registry and exact historical versions remain resolvable;
7. catalog selector changes ID+version atomically;
8. opening a catalog bound to an older custom version never silently upgrades it;
9. Library exposes built-ins + custom resources without a new primary tab;
10. no template mutation calls ProductStore/CatalogStore/AssetIndexStore publish methods;
11. no delete API/UI for template resources exists;
12. preview and print remain physically green under built-ins and at least one custom template;
13. full Validate + Browser regression remains green.
