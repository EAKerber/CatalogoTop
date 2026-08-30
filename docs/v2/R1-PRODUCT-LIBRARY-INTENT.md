# V2-R1 — Product Library Foundation: intent contract

## 1. Why this recut exists

V1 mixes three different jobs inside the `Produtos` area:

1. author one product;
2. find/browse existing products;
3. administrate categories/products, including destructive operations.

Its organization model is also implicit: categories are derived from `product.category`; there is no stable folder identity. Deleting a category therefore means deleting every product whose category string matches it.

V2-R1 exists to replace that implicit coupling with an explicit, stable organization model while keeping the proven catalog/A4 engine unchanged.

This recut is successful when product organization can evolve independently from editorial composition.

## 2. User outcome

A user should be able to:

- create or edit a product in a clearly identified folder path;
- immediately see products already present in that folder/subtree while authoring, even before typing a search;
- use an existing product as a base for a new one without copying identity or duplicating immutable asset bytes;
- open a dedicated Library to browse a hierarchy, select products, move them, and perform destructive administration;
- rename or move a folder without changing product IDs or catalog membership;
- create deeper organization than `category/subcategory` without breaking the V1 renderer;
- import the same legacy CSV/XLSX inputs and obtain deterministic folder organization;
- reload/synchronize the shared product base without different clients inventing different folder IDs.

## 3. Product-navigation intent

Primary navigation becomes:

`Cadastro | Catálogo | Biblioteca`

### Cadastro

Purpose: one-product authoring.

Contains:

- product form;
- folder-path selector;
- contextual existing-products panel for the selected folder + descendants;
- actions such as `Editar`, `Usar como base`, `Abrir na Biblioteca`.

Does not own:

- bulk selection;
- mass deletion;
- folder restructuring UI;
- destructive folder management.

It may allow creating a missing folder/path as part of assigning a product, but advanced folder management belongs to Biblioteca.

### Catálogo

Purpose remains editorial composition of the current catalog.

R1 should preserve the current V1 document pipeline and A4 output. Template selection remains available here even though the old top-level `Templates` tab is removed from primary navigation.

### Biblioteca

Purpose: resource navigation and administration.

In R1 it exposes only the Product provider, even though the shell is intended to accept additional providers later.

Contains:

- folder tree;
- product list for the selected scope;
- text search/filtering;
- selection/multi-selection;
- move product(s);
- create/rename/move folder;
- delete product(s);
- delete empty folder;
- open product in Cadastro.

R1 does not need to imitate a desktop operating-system file manager. The filesystem metaphor is organizational, not a requirement for arbitrary drag/drop or every desktop-file behavior.

## 4. Authority model

### ProductStore remains the remote authority for product resources

Current V1 remote state is a revisioned snapshot containing only `products[]`. R1 evolves this authority instead of creating a parallel LibraryStore.

Target shape:

```text
ProductSnapshot v2
  schemaVersion: 2
  revision
  updatedAt
  writeId
  folders[]
  products[]
    ...product facts
    folderId
```

The existing concurrency model should be preserved:

- `expectedRevision`;
- short write-session;
- `writeId` readback;
- historical snapshots/conflict evidence;
- offline IndexedDB cache;
- deploy-preview isolation from production.

### Core is a runtime mirror, not the remote product authority

Core may expose product folders in runtime state because UI/query/catalog code needs them, and its local/backup schema may need to migrate accordingly. That does not make localStorage the Product Library authority.

The ProductStore snapshot remains the shared authority for products + product-folder metadata.

### FolderTree is domain logic, not storage

`FolderTree` should be a pure authority over a provider-scoped set of folders.

Conceptual folder:

```text
Folder
  id: stable string
  parentId: stable string | null
  name: display string
```

Do not store mutable full paths as identity.

## 5. Folder invariants — locked for R1

These are intent-level decisions, not implementation suggestions:

1. Folder ID is stable across rename and move.
2. Product ID is stable across move.
3. A folder has at most one parent.
4. Cycles are invalid.
5. A non-root parent must exist.
6. Empty/whitespace-only names are invalid.
7. Siblings cannot have equivalent normalized names.
8. The Product root is virtual; it does not need a persisted folder record.
9. A product belongs to exactly one product folder after migration.
10. Folder deletion is allowed only when the folder has no child folders and no directly assigned products in R1.
11. Deleting a folder must never implicitly delete its products.
12. Moving a folder moves its subtree by ancestry, not by rewriting descendant identities.

### Name normalization intent

Display spelling/case/accent is preserved, but duplicate detection needs a canonical key.

Recommended contract for R1:

- Unicode normalization;
- trim;
- collapse internal whitespace;
- case-insensitive comparison;
- accent-insensitive comparison for duplicate sibling detection.

The exact portable normalization implementation must be fixture-locked before data migration.

## 6. Legacy `category/subcategory` compatibility

`folderId` becomes the organizational authority in V2.

`category` and `subcategory` remain compatibility projections during R1 because V1 renderer/composition/import assumptions still consume them.

### Migration from legacy products

Legacy product:

```text
category = Ferragens
subcategory = Corrediças
```

migrates conceptually to:

```text
Produtos (virtual root)
└─ Ferragens
   └─ Corrediças
      └─ product
```

Products without subcategory belong directly to their category folder.

Products without a meaningful category migrate into a deterministic `Sem categoria` folder.

### Deterministic folder IDs

The same legacy normalized path must generate the same initial folder ID in every client/runtime.

Do not use random UUIDs while *reading/migrating* ProductSnapshot v1.

After migration, IDs are persisted and no longer derive dynamically from path; rename/move must not change them.

The exact ID encoding/hash algorithm is an implementation decision that must satisfy:

- deterministic across browser/server tests;
- bounded valid ID length;
- explicit namespace/version so a later algorithm cannot silently reinterpret old IDs;
- deterministic collision handling or a construction with practically eliminated collisions.

### Compatibility projection for deeper paths — decision proposed for R1

For a V2 folder path:

`Ferragens / Corrediças / Telescópicas`

recommended mirrors are:

```text
category    = Ferragens
subcategory = Corrediças / Telescópicas
```

Rationale: `category` preserves the V1 top-level grouping while `subcategory` retains the remainder of the hierarchy instead of silently losing middle levels.

For all legacy depth <= 2 data, this projection round-trips to the same V1 values.

This projection should be confirmed before implementation and then fixture-locked.

## 7. Product query semantics — one shared interpretation

Create one pure query authority reused by Cadastro and Biblioteca, and later by product selection in Catálogo.

Conceptual API:

```text
ProductQuery({
  products,
  folders,
  folderId,
  recursive: true,
  text
})
```

Locked semantics:

- no `folderId` = all products;
- selected folder with `recursive=true` = directly assigned products + all descendants;
- Cadastro defaults to recursive scope;
- Biblioteca may offer direct-only later, but R1 should not create divergent implementations;
- empty text still returns the scoped product set;
- text search must not be required merely to discover existing products.

Search ranking can remain simple. Useful priority:

1. exact product code;
2. code prefix;
3. description match;
4. path/category metadata match.

Do not introduce semantic/vector/fuzzy search in R1.

## 8. Product identity and duplicate rules

Product `id` remains the immutable identity used by catalogs, editorial order and blocks.

Product `code` is a business key and must be unique under a canonical comparison.

R1 should centralize code uniqueness so manual creation, clone and import do not use different rules.

Recommended canonical comparison:

- trim;
- case-insensitive;
- preserve the displayed code exactly as authored.

An exact normalized code collision is a blocking error.

Similar description/name is only a warning/lookup signal, not a blocking identity rule.

## 9. `Usar como base` intent

This is an explicit domain operation, not DOM duplication.

Conceptual operation:

```text
cloneAsNewProduct(sourceProduct)
```

The clone starts as a new product draft.

Copy:

- `folderId`;
- description;
- status;
- price / quantity pricing;
- specs;
- notes;
- canonical image reference;
- `imageGallery` references;
- commercial variants;
- commercial table rows.

Do not copy:

- product `id`;
- product `code` (starts empty/new and remains required);
- `updatedAt`;
- catalog membership/order/presentation state;
- catalog-local `presentation.imageVariants`, framing or selections.

Immutable content-addressed assets may be referenced by both products. Do not upload duplicate bytes merely because a product was cloned.

The operation creates no permanent parent/child relation between products.

## 10. Folder creation and management intent

### Cadastro

Assigning a product should not require leaving Cadastro just because the desired folder does not exist.

A path selector may offer a narrow action such as:

`Criar “Telescópicas” em Ferragens / Corrediças`

This is acceptable because it directly serves product assignment.

Do not recreate the entire Library folder-management UI inside Cadastro.

### Biblioteca

Biblioteca owns restructuring:

- create folder;
- rename folder;
- move folder;
- delete empty folder;
- move one/many products.

Move should preferably be an explicit action/menu/dialog first. Drag/drop can be added only if it measurably improves the workflow without creating mobile/accessibility ambiguity.

## 11. Import compatibility intent

CSV/XLSX continues to accept the V1 columns `Categoria` and `Subcategoria`.

Importer behavior should resolve/create the corresponding path and write `folderId`.

### Merge mode

- preserve existing folders;
- resolve existing equivalent paths;
- create missing paths;
- merge products by the established code rule.

### Replace-products mode — conservative R1 proposal

Replacing products should not automatically erase the explicit folder tree.

Recommended behavior:

- replace the product set;
- preserve existing folders;
- ensure paths needed by imported products exist;
- leave now-empty folders for explicit user cleanup.

Rationale: once folders become first-class metadata, silently deleting hand-authored empty structure is more destructive than the old product-only `replace` semantics.

If this proposal is rejected, the UI label should make the stronger destructive semantics explicit before implementation.

## 12. Snapshot migration / publication intent

Current remote ProductSnapshot v1 is revisioned and server-authoritative. R1 should preserve a safe migration path rather than perform an uncontrolled one-time rewrite.

Preferred transition semantics:

1. reader accepts snapshot v1 and v2;
2. v1 is materialized deterministically as a v2 runtime snapshot;
3. UI can operate on the migrated representation;
4. first legitimate product/folder write publishes schema v2 using normal `expectedRevision` protection;
5. history remains readable evidence of prior v1 snapshots;
6. offline cached v1 snapshots migrate with the same fixture-locked rules.

No client should generate random folder IDs merely because it was first to open an old snapshot.

## 13. App-local state / backup intent

R1 will likely require a Core state-schema increment because runtime needs folder information and backups must round-trip organization.

Important distinction:

- ProductStore shared snapshot = authority for products + product folders;
- Core state = current application runtime/editor state;
- localStorage session = convenience/recovery, not persistent Library truth;
- JSON backup = portable snapshot/recovery artifact, not the future saved-catalog store.

A backup that contains products must contain enough folder metadata to reconstruct their organization exactly.

## 14. Catalog compatibility invariant

R1 is an organization recut, not a rendering recut.

For a legacy product dataset and unchanged catalog selection/presentation:

```text
legacy products
  -> deterministic folder migration
  -> compatibility mirrors
  -> CatalogOrder / CatalogDocument
```

must produce the same logical document/pagination as the V1 baseline.

Moving/renaming folders may intentionally change category/subcategory labels exposed to future documents, but must not silently:

- change product IDs;
- drop catalog membership;
- reorder selected products;
- rewrite presentation overrides;
- dissolve Collection/Table merely because organization changed.

## 15. UI intent at desktop

### Cadastro

Prefer a compact authoring workspace rather than retaining the full V1 filesystem beside the form.

Suggested composition:

```text
Cadastro
├─ product form
│  └─ folder path selector
└─ Produtos nesta pasta e subpastas
   ├─ scoped count
   ├─ lightweight search
   └─ Editar / Usar como base / Abrir na Biblioteca
```

The contextual list should be useful at rest, not an empty autocomplete that only appears after typing.

### Biblioteca

Suggested composition:

```text
Biblioteca · Produtos
├─ folder tree
├─ toolbar/search/actions
└─ product list
```

The exact number of columns/panes is not an architectural contract. The important contract is responsibility separation.

## 16. Mobile intent

Do not force desktop tree + table + form into one squeezed surface.

Cadastro remains form-first; contextual products can be an expandable secondary surface.

Biblioteca can switch between:

- Pastas;
- Produtos/lista;

or use a drawer/back-stack model.

The mobile interaction must preserve clear navigation context and avoid making destructive operations reachable through ambiguous swipe gestures.

## 17. Explicitly out of scope

R1 must not absorb:

- saved catalog persistence;
- global LibraryStore for every resource type;
- asset-manager metadata system;
- template schema 2.0;
- arbitrary template CSS/HTML/JS;
- new A4 renderer architecture;
- Collection 2.0 / Callout;
- generative/external image variation;
- product version history;
- cross-user permissions/roles;
- semantic search;
- arbitrary drag/drop file-manager behavior;
- removal of legacy `category/subcategory` consumers.

## 18. Gates / evidence of completion

Minimum structural gates:

1. ProductSnapshot v1 -> deterministic v2 migration produces identical IDs on repeated independent runs.
2. Serialize/reload of v2 preserves folder/product IDs and ancestry.
3. Cycle, missing parent, duplicate sibling name and invalid folder references fail closed or normalize by an explicitly documented deterministic policy.
4. Querying a folder recursively returns direct + descendant products at depth > 2.
5. Move folder preserves folder IDs, descendants and product IDs.
6. Move product changes only organizational metadata/mirrors, not catalog/editorial identity.
7. Clone produces a new ID, blank/new code, copied factual fields and shared asset references.
8. Duplicate code is blocked consistently in manual and import paths.
9. Backup round-trip preserves folders.
10. Legacy CSV/XLSX still imports into deterministic paths.
11. Browser desktop: choose/create folder -> see existing subtree products -> use as base -> save -> open Library -> move -> reopen Cadastro.
12. Browser mobile equivalent covers navigation without accidental destructive action.
13. V1 regression gate: unchanged legacy catalog materializes the same CatalogDocument/page count after migration.
14. ProductStore conflict/write-session/readback behavior remains intact with schema v2.

## 19. Implementation slicing recommendation

Do not implement R1 as one large visual rewrite.

Recommended slices:

### R1a — FolderTree + migration contract

Pure domain/fixtures only.

Exit: folder invariants and deterministic legacy migration are stable.

### R1b — ProductSnapshot v2 + ProductStore/Core/cache/backend

No major UI redesign yet.

Exit: v1/v2 snapshots read safely, v2 writes use existing revision contract, backup/cache round-trip.

### R1c — ProductQuery + code uniqueness + clone operation

Exit: shared product lookup and clone semantics are independent of UI.

### R1d — Cadastro surface

Introduce folder path selector and contextual product lookup; move destructive/library responsibilities out.

### R1e — Biblioteca Product provider

Hierarchy, product management, multi-select/move/delete, desktop/mobile behavior.

### R1f — shell/import/regression cleanup

Switch primary navigation to `Cadastro | Catálogo | Biblioteca`, retire obsolete V1 category-browser paths, align import and complete browser/A4 regression gates.

A slice can be split further if a migration or concurrency uncertainty appears. Do not compensate for uncertainty by implementing UI and persistence simultaneously.

## 20. Decisions to confirm before implementation begins

These are the few intent questions still worth explicitly resolving before R1a/R1b:

1. **Deep-path compatibility mirror:** confirm `category = first segment`, `subcategory = remaining path joined by " / "`.
2. **Replace import:** confirm product replacement preserves explicit folders rather than deleting/rebuilding the whole tree.
3. **Sibling duplicate equivalence:** confirm case/accent-insensitive folder-name uniqueness.
4. **Empty folders:** confirm they are legitimate first-class organization and may exist without products.
5. **Cadastro creation:** confirm the path selector may create a missing folder inline, while restructure remains Biblioteca-only.

Everything else above can be implemented without committing the product to a generic filesystem or broader V2 architecture.
