# CI-H1 — AssetIndex Write Settlement Gate

## Status

CI-H1 hardens the existing Browser Asset Library gate against an asynchronous write-ordering race. It is **test/CI hygiene only** and does not change CatalogoTop runtime semantics.

Base authority:

- `v2@92ee4802ec7045ab89b00d40bb98f9d9df0e0b01` — R5 closed; R6 is next product milestone.

## Observed failure

During R5a promotion, the existing R3b Asset Library browser gate intermittently failed with an assertion equivalent to:

`upload standalone inválido: rN->rN, posts=1`

The uploaded asset was already visible in `AssetIndexStore.getSnapshot()`, while `AssetIndexStore.getRevision()` still returned the previous revision.

A rerun of the same head passed, identifying timing sensitivity rather than an R5a product regression.

## Runtime ordering

`AssetIndexStore.publishCandidate(nextCandidate)` intentionally performs optimistic local projection before remote persistence:

1. `snapshot = nextCandidate`;
2. `pendingWrite = true`;
3. local cache/event publication;
4. remote PUT;
5. remote snapshot/revision readback;
6. `pendingWrite = false`.

Therefore **asset/folder visibility in the local snapshot is not proof that the authoritative write has settled**.

This ordering is useful runtime behavior and CI-H1 must not remove or weaken it.

## Old gate assumption

The old browser fixture commonly followed this pattern after an AssetIndex mutation:

1. trigger the UI action;
2. wait until the changed asset/folder appears in `getSnapshot()`;
3. immediately trigger another mutation or assert `getRevision()`.

Because step 2 can succeed during the optimistic window, step 3 can race the still-pending write. The upload revision assertion made the race visible, but the same sequencing assumption also existed between folder creation/move/rename operations.

## CI-H1 contract

The browser fixture now distinguishes **local projection** from **write settlement**.

A shared test helper waits until:

- `AssetIndexStore.hasPendingWrite() === false`;
- `AssetIndexStore.hasConflict() === false`.

After a mutation, the gate may still wait first for the expected local snapshot projection, preserving coverage of visible behavior. Before reading authoritative revision or starting the next AssetIndex write, it must then wait for settlement.

The fixture also adds a small deterministic delay to `/api/asset-index` PUT responses so the optimistic window exists reliably in CI instead of depending on runner/network speed.

## Mutations covered

Settlement is required after successful:

- folder creation;
- asset adoption/move;
- folder rename;
- folder move;
- standalone upload/index registration;
- deduplicated upload completion before final revision assertions.

The occupied-folder failure path remains fail-closed and does not require a successful write settlement because it must not publish a candidate.

## Invariants

CI-H1 must preserve:

- runtime `AssetIndexStore` code unchanged;
- optimistic local projection unchanged;
- revision increments unchanged;
- physical asset POST/dedup behavior unchanged;
- `Sem uso`/usage accounting unchanged;
- ProductStore/CatalogStore isolation unchanged;
- mobile Asset Library flow unchanged.

No sleep is used as the correctness condition. The artificial fixture delay only makes the race reproducible; the gate synchronizes on explicit store state.

## Promotion gate

The final CI-H1 head must pass canonical push and PR checks on the same SHA:

- CatalogoTop Validate;
- CatalogoTop Browser Print Gate, including the R3b Asset Library admin gate.

After CI-H1 promotion, R6 planning can proceed without conflating this known pre-existing gate race with new Preflight behavior.
