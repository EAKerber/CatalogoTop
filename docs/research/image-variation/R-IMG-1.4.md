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

## Two distinct output regimes

The current evidence should not be collapsed into a single statement that the producer is uniformly poor.

### High-adherence positive-control regime

Attempt `aa89f137-0218-41db-b39f-be47943197cc` contains an embedded generated H45 candidate that is visually very close to the deterministic factual recomposition shown beside it. The overall longitudinal structure, terminal region, dark fitting/stop region, rail proportions and much of the visible hole/slot logic track the factual recomposition far better than the later fantasy outputs.

The earlier independent review incorrectly promoted raw pose/layout difference into a topology verdict. Because the H45 benchmark explicitly allows whole-group reorientation/recomposition, factual review must be **pose-invariant**. The prior `FAIL_FACTUAL_TOPOLOGY_MISMATCH` verdict is therefore superseded and the candidate is now retained as:

`POSITIVE_CONTROL_PENDING_POSE_INVARIANT_LANDMARK_REVIEW`

This does not yet mean faithful-variant approval. It means the producer has demonstrated a qualitatively much stronger source-adherence regime that is worth reproducing and characterizing.

### Fantasy prototype-substitution regime

Later dashboard outputs repeatedly converge on essentially the **same obviously invented telescopic-slide/roller prototype**.

This object is not merely an imperfect H45. It contains conspicuous fantasy mechanical structures and should not be described as commercially plausible or nearly faithful.

The repeated similarity across these outputs is therefore not positive repeatability. It is:

`SYSTEMATIC_PROTOTYPE_SUBSTITUTION`

The important producer-level finding is the enormous regime difference: the same broad experiment can produce either a near-reference reconstruction or a repeated fantasy archetype.

## Correct factual-review method

Allowed pose/composition transforms must be neutralized before evaluating identity.

The next factual gate for the positive control must compare, per factual piece:

- piece count and correspondence;
- sequence and relative spacing of circular holes and elongated slots;
- terminal/end structures;
- visible fittings/stops;
- rail lengths/proportions;
- relative overlap/relationship between pieces after alignment.

Raw diagonal-vs-horizontal layout is not itself a topology difference.

## Current conclusion

The producer/channel remains unsuitable for promotion because:

1. it fails the image-only contract repeatedly;
2. it can collapse catastrophically into fantasy hardware;
3. the conditions that separate the high-adherence regime from the fantasy regime are not yet understood.

Current scoped producer result remains:

`PRODUCER_NOT_RELIABLE_FOR_FAITHFUL_IMAGE_ONLY_MASTER`

But the capability hypothesis is stronger than that result alone suggests:

> **At least one observed output regime is visually close enough to the factual deterministic reconstruction that source-grounded generation remains worth investigating. The research problem is now reference-adherence reliability / regime switching, not a simple capability/no-capability question.**

## Stop condition for blind repetition

Do not consume more samples by repeating the same context/prompt blindly. Resume generation only through an experiment designed to isolate what changes reference adherence: clean context, reference binding, edit-vs-generation mode, prompt scope and output contract.

## Architecture consequence

Keep Class C optional and downstream of deterministic composition/raster paths.

Future gates must use exact source evidence and pose-invariant landmarks. Cross-run convergence is positive evidence only if candidates also converge on the factual landmarks; convergence on the same fantasy archetype is an explicit failure signal.

No production schema, runtime or ProductStore change is justified by this trial.
