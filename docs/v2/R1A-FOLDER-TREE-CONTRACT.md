# V2-R1a — FolderTree + legacy migration contract

## Status

Implementation slice for `V2-R1 Product Library Foundation`.

R1a is deliberately domain-only. It does **not** alter Core state, ProductStore, Netlify storage, import UI, product UI or the A4 renderer.

Its purpose is to make the organizational semantics stable before persistence/UI depend on them.

## FolderTree authority

`src/folder-tree.js` is a pure provider-scoped hierarchy authority.

Conceptual record:

```text
Folder
  id: stable string
  parentId: stable string | null
  name: display string
```

The Product root is virtual (`parentId = null`).

### Locked invariants

- folder IDs are unique and non-empty;
- names are non-empty after normalization;
- non-root parent must exist;
- a folder cannot parent itself;
- cycles fail closed;
- sibling names are unique under the canonical name key;
- rename preserves folder ID;
- move preserves folder ID and descendant IDs;
- delete only accepts a folder with no child folders and no directly assigned product;
- deleting a folder never means deleting products.

### Display-name normalization

Display values use:

1. Unicode `NFKC`;
2. trim leading/trailing whitespace;
3. collapse internal whitespace runs to one space.

The normalized display spelling is preserved as authored.

### Sibling duplicate key

For sibling equality the display value is additionally:

1. normalized to `NFD`;
2. combining accents U+0300–U+036F removed;
3. lower-cased.

Therefore, under the same parent, common Portuguese variants such as `Corrediças`, `corredicas` and `CORREDIÇAS` represent the same sibling key.

This key is domain identity for sibling-name conflict detection, not the display label.

## FolderTree operations in R1a

The initial pure API includes:

- `normalize`
- `childrenOf`
- `descendantsOf`
- `ancestorsOf`
- `pathOf`
- `contains`
- `createFolder`
- `renameFolder`
- `moveFolder`
- `deleteEmptyFolder`

These functions return normalized copies; they do not mutate ProductStore/Core or persist anything.

R1b may add orchestration around these operations but should not duplicate their invariants inside ProductStore/UI.

## Legacy migration namespace

`src/product-folder-migration.js` owns the one-way initial organizational migration from ProductSnapshot v1 semantics.

Namespace:

`product-folders-v1`

Generated initial IDs use:

`pf1-<32 lowercase hex characters>`

The 128-bit payload is two independently namespaced FNV-1a 64-bit digests over the canonical path key.

This is **not** a security hash. Its purpose is deterministic compact identity in a synchronous buildless browser runtime.

A golden fixture locks the current algorithm. A future algorithm must use a new namespace/prefix rather than silently changing the meaning of `pf1-*`.

The migration also tracks generated IDs and fails with `folder_id_collision` if two different canonical paths ever map to the same ID.

## Canonical legacy path

A V1 product is interpreted as:

```text
category
└─ subcategory (when non-empty)
```

Important: legacy `subcategory` is treated as **one segment**, even if its text contains `/`.

Reason: V1 did not define arbitrary hierarchy. Splitting legacy labels by punctuation would reinterpret existing commercial text.

Missing/blank category becomes deterministic `Sem categoria`.

Equivalent accent/case sibling keys collapse into one folder identity.

## Deterministic serialization order

Generated folder records are ordered by:

1. path depth;
2. binary comparison of canonical path keys.

No locale-aware collation participates in persisted ordering or ID generation.

Product input order therefore does not affect generated folder IDs or serialized folder-ID order.

Display spelling for an equivalent legacy path comes from the first occurrence in the authoritative snapshot. That is presentation metadata; the canonical path key/ID does not depend on case/accent spelling.

## Compatibility projection

A V2 path is projected back to V1 mirrors as:

```text
category    = first path segment
subcategory = remaining segments joined by " / "
```

Example:

```text
Ferragens / Corrediças / Telescópicas
```

projects to:

```text
category    = Ferragens
subcategory = Corrediças / Telescópicas
```

For depth <= 2 this matches the V1 structural interpretation.

`folderId` remains authority once ProductSnapshot v2 is persisted; this projection exists only for compatibility consumers during the transition.

## Invalid-state policy

R1a is fail-closed for explicit FolderTree data.

It does not silently:

- orphan folders with missing parents;
- break cycles;
- rename duplicate siblings;
- invent replacement folder IDs;
- move products out of invalid folders.

R1b must decide where invalid remote snapshot data is surfaced to the user/operator, but it should consume these same errors rather than add an alternate normalization policy.

Legacy product migration is intentionally more tolerant only where V1 already had a deterministic fallback: blank category -> `Sem categoria`.

## Fixtures / evidence

`scripts/folder-tree-fixture.mjs` locks:

- display/key normalization;
- hierarchy traversal;
- rename/move identity preservation;
- create/delete-empty semantics;
- duplicate sibling rejection;
- missing-parent rejection;
- cycle rejection.

`scripts/product-folder-migration-fixture.mjs` locks:

- repeated-run determinism;
- order-independent folder IDs;
- order-independent serialized folder-ID ordering;
- accent/case-equivalent path convergence;
- `Sem categoria` fallback;
- a golden `pf1-*` ID;
- deeper V2 -> legacy compatibility projection;
- preservation of a legacy subcategory containing `/` as one segment.

Both fixtures run from `npm test`.

## R1a exit / R1b seam

R1a is ready to close when normal Validate + Browser regression gates are green on the final head.

R1b may then integrate this contract into:

- ProductSnapshot v2 reader/writer;
- ProductStore runtime materialization;
- IndexedDB cache;
- Core runtime/backup schema;
- Netlify snapshot validation.

R1b should **not** redesign Cadastro/Biblioteca yet. UI starts only after the ProductSnapshot v1/v2 transition is proven safe.
