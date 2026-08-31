# R-IMG-1.4 — Native source-grounded producer trial

Status: **research-only / isolated producer trial**

Base research branch: `research/semantic-image-variation-v2`

## Question

Can a source-grounded producer return a clean, high-native-resolution H45 master for the known wide composition while preserving factual identity closely enough to outperform the strongest deterministic presentation path?

The experiment now separates five things:

- visual plausibility;
- factual fidelity;
- producer contract reliability;
- native output raster;
- **reference-adherence regime**.

## Resolution contract

The wide placement is composition geometry, not the requested file raster.

- logical placement: `440×180` / aspect `22:9`;
- physical holder: approximately `116.42×47.63 mm`;
- 300-DPI minimum use raster: approximately `1376×563`;
- `1760×720` remains an acceptable research master with headroom.

## Producer-contract behavior

The tested producer repeatedly returns research dashboards/infographics instead of an image-only edited product master.

Generated tables, metrics, PASS labels, source depictions, control images and claimed dimensions inside those reports are not research evidence.

Three additional repeatability attempts failed the image-only contract. See `results/r-img-1-4-producer-repeatability.v1.json`.

## Critical audit: the dashboard regenerated its own control

A later comparison against the actual research files exposed an important error in our earlier interpretation.

The visually stronger dashboard (`aa89f137-0218-41db-b39f-be47943197cc`) shows an `A) determinístico` rail next to a `B) source-grounded` rail. However, that A panel is **not the real Mitchell deterministic H45 output**.

Authoritative evidence:

- exact H45 source: two separate telescopic-slide pieces;
- real Mitchell deterministic output: preserves both factual pieces while reorienting the group;
- dashboard A: a newly synthesized assembled rail;
- dashboard B: another newly synthesized assembled rail.

Therefore:

> **A↔B similarity inside a generated dashboard is self-consistency of the generated report, not source-fidelity evidence.**

This supersedes two earlier overstatements in opposite directions:

1. `FAIL_FACTUAL_TOPOLOGY_MISMATCH` was too strong because it treated allowed pose/layout change as topology evidence;
2. `POSITIVE_CONTROL_PENDING_POSE_INVARIANT_LANDMARK_REVIEW` was also too strong because the supposed deterministic comparison image was itself generated.

The aa89f137 candidate is now retained only as:

`VISUALLY_DISCREET_GENERATIVE_REGIME_CONTROL`

It demonstrates a much less obvious hallucination regime, not a validated faithful H45 master.

## Two clearly different visual regimes

### Regime D — discreet generic-hardware synthesis

The aa89f137 embedded rail looks close enough to ordinary telescopic-slide hardware that it could plausibly pass unnoticed at normal catalog scale.

That is valuable capability evidence about appearance quality, but factual H45 identity is not established.

### Regime F — fantasy prototype substitution

Attempt `2638cff6-aec2-4753-b809-3b968d1426cb` and later repeatability outputs (`f3660d0d...`, `835c43b7...`, `feecda2c...`) converge on essentially the same obvious fantasy rail/roller mechanism.

This is not a subtle product mismatch. The mechanical structures are visibly invented and the repeated cross-run similarity indicates a stable learned/prototypical fallback rather than independent random mistakes.

Diagnosis:

`SYSTEMATIC_PROTOTYPE_SUBSTITUTION`

## Regime-switch investigation

See `results/r-img-1-4-regime-switch-investigation.v1.json`.

The current strongest hypotheses are:

1. **reference-target binding / proximity** — moderate-high, unproven. The visually discreet run occurred immediately after the exact H45 image was re-established as the active image target; later runs happened after generated-dashboard context accumulated;
2. **dashboard-context contamination** — high confidence. Every run synthesized a report even when the desired deliverable was an image-only product master;
3. **semantic archetype fallback** — high confidence. Weakly grounded runs repeatedly converge on the same fantasy slide archetype;
4. requested high raster itself — weak evidence as a cause;
5. random seed alone — unlikely to explain repeated convergence on one wrong archetype.

## Clean-chat ZIP experiment — invalid, source never bound

A new-chat experiment attempted to remove the accumulated dashboard context by uploading `r-img-1-4-clean-context-ab.zip` and asking the new chat to follow its README.

The resulting outputs were unrelated to H45 and instead interpreted the package name / task semantically as generic "clean context" work. Observed outputs included:

- street-scene object removal;
- unrelated landscape reconstruction;
- geospatial raster cleaning / R-analysis;
- generic product A/B guidance using bottles;
- backpack-isolation comparison.

Even after the new chat explicitly restated **Condition A — source-bound minimal**, the following producer call still returned a generic clean-context comparison rather than an H45 image.

Therefore this test is classified:

`INVALID_TEST_SOURCE_NOT_BOUND`

See `results/r-img-1-4-clean-context-zip-execution.v1.json`.

This is **not** evidence that a clean context fails to improve H45 grounding. It means the archive/document layer prevented the factual JPG from becoming the active image-edit target. The ZIP experiment tested package interpretation, not source-grounded image editing.

Important methodological correction:

> **A source image buried inside a ZIP/README workflow must not be assumed to be bound as the image producer's edit reference.**

The next test must attach the factual H45 JPG directly and put the minimal edit contract in the user message itself. The first attempt should exclude the terms `clean-context`, `AB`, benchmark/report language and external composition references.

## Correct next experiment

### A0 — direct source binding, minimal

- attach exact H45 JPG directly as an image, not inside an archive;
- one short image-edit instruction in the message;
- no README or package execution;
- no prior dashboard screenshots;
- no composition reference on the first attempt;
- no mention of previous failures or research report structure.

First gate: output must visibly be the H45 source product and must be image-only. If it instead returns a report or unrelated object, stop; do not score landmarks.

### A1 — direct source + composition reference

Only if A0 establishes source binding:

- attach H45 factual source as authority;
- attach actual deterministic Mitchell render as layout/composition reference only;
- keep source identity authority explicit;
- image-only output contract.

### C — no-source negative control

Only after A0/A1 establish a valid source-bound route:

- text-only telescopic-slide description;
- same aspect/output request.

If the fantasy archetype is a semantic fallback, C may cluster toward it while A0/A1 remain close to source landmarks.

## Factual gate for any future clean candidate

Allowed pose transforms must be neutralized before identity review.

Compare against exact source evidence:

- piece count/correspondence;
- sequence and relative spacing of circular holes and elongated slots;
- terminal/end structures;
- fittings/stops;
- rail lengths/proportions;
- relationship between pieces after pose normalization.

A generated report is never allowed to regenerate its own control/reference and use that internal comparison as evidence.

## Current conclusion

The producer/channel remains unsuitable for promotion because:

1. image-only contract compliance is effectively zero in the valid H45 trial slice;
2. it can collapse catastrophically into fantasy hardware;
3. the visually discreet run is not proven source-grounded after auditing its fabricated control panel;
4. the attempted clean-context ZIP experiment did not bind the H45 source and is therefore invalid for fidelity conclusions;
5. the regime-switch conditions remain uncontrolled.

Scoped producer result remains:

`PRODUCER_NOT_RELIABLE_FOR_FAITHFUL_IMAGE_ONLY_MASTER`

The broader capability hypothesis remains open:

> **The producer can synthesize product imagery ranging from subtly believable generic hardware to obvious fantasy. The remaining research question is whether direct image attachment in a minimal edit context can reliably bind the factual source rather than triggering package/report/archetype synthesis.**

## Architecture consequence

Keep Class C optional and downstream of deterministic composition/raster paths. No production schema, runtime or ProductStore change is justified by this trial.
