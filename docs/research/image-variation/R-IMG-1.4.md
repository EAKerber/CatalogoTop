# R-IMG-1.4 — Native source-grounded producer trial

Status: **research-only / isolated producer trial**

Base research branch: `research/semantic-image-variation-v2`

## Question

Can a source-grounded producer return a clean, high-native-resolution H45 master for the known wide composition while preserving factual identity closely enough to outperform the strongest deterministic presentation path?

This experiment intentionally separates:

- visual plausibility;
- factual fidelity;
- producer contract reliability;
- native output raster.

## Resolution contract

The wide placement is composition geometry, not the requested file raster.

Current physical-use requirement:

- logical placement: `440×180` / aspect `22:9`;
- physical holder: approximately `116.42×47.63 mm`;
- 300-DPI minimum use raster: approximately `1376×563`;
- `1760×720` remains an acceptable research master with headroom.

## Producer behavior

The producer repeatedly returns research dashboards/infographics instead of an image-only edited product master.

This is a producer-contract failure. Generated tables, metrics, PASS labels, source depictions and claimed dimensions inside those reports are not research evidence.

Three additional repeatability attempts in this slice all failed the image-only contract. See `results/r-img-1-4-producer-repeatability.v1.json`.

## Important human-review correction

One earlier attempt (`aa89f137-0218-41db-b39f-be47943197cc`) looked very convincing at ordinary viewing size and was correctly recorded first as a visual-pass candidate.

Independent comparison against the exact source bytes changes the factual verdict:

- exact source: two separate telescopic-slide pieces;
- generated candidate: materially different dominant assembled-rail topology;
- visible hole/slot pattern and terminal structures do not correspond sufficiently;
- result: `FAIL_FACTUAL_TOPOLOGY_MISMATCH`.

The key lesson is not that the model looks bad. The opposite is more important: it can produce **very plausible incorrect hardware**. Therefore normal-view plausibility is an especially weak fidelity gate for this domain.

See `reviews/r-img-1-4-independent-factual-review.v1.json`.

## Current conclusion

The capability remains visually promising, but this producer/channel is not reliable enough for faithful product-image masters in the current experiment.

Current scoped result:

`PRODUCER_NOT_RELIABLE_FOR_FAITHFUL_IMAGE_ONLY_MASTER`

This does **not** prove that source-grounded generation or viewpoint variation is generally unsuitable. It means the tested route cannot yet provide the clean image-only samples needed to measure factual pass rate or native-resolution advantage.

## Stop condition

Do not consume more samples on the same producer/channel merely to obtain a successful-looking example. Resume this hypothesis only when the editing channel behavior materially changes or a producer can actually return source-anchored image-only outputs.

## Architecture consequence

Keep Class C optional and downstream of deterministic composition/raster paths. Any future Class C gate must compare against exact source evidence and evaluate landmark topology before presentation quality.

No production schema, runtime or ProductStore change is justified by this trial.
