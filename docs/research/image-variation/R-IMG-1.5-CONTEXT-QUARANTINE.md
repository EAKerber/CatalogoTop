# R-IMG-1.5 — Context quarantine and pre-generation meta-evaluation

Status: **research-only protocol guidance**

This guidance formalizes a behavior that materially improved recent smoke-test outcomes: use meta-evaluation to verify the run before generation, while preventing prior experiment context from becoming part of the image producer's effective task.

It does **not** change P0/P1 prompt contents. The goal is to control the producer envelope, not optimize prompts retrospectively.

## Why this exists

Observed failures showed two different tasks competing inside the same conversation:

1. generate/edit the factual product image;
2. explain, evaluate or visualize the experiment itself.

When prior dashboards, PASS/FAIL discussion, benchmark language, meta-analysis language or earlier generated images remain salient, the producer can switch from the first task to the second and return reports/infographics or generic/fantasy product imagery.

Recent successful H45 and caster runs support the hypothesis that deliberately treating each kit as first exposure and rejecting prior experimental context can materially improve source binding and output-contract compliance.

## Rule 1 — fresh context is the gold standard

Each primary R-IMG-1.5 run should begin in a genuinely fresh chat/context whenever possible.

Fresh context is stronger than an instruction to "ignore previous context". Do not claim perfect isolation when the execution still occurs in a conversation containing earlier outputs.

If a fresh context is unavailable, the run must be marked as using **best-effort context quarantine** rather than true fresh-context isolation.

## Rule 2 — context quarantine

Before calling the image producer, divide available information into two sets.

### Producer-eligible

Only these may influence the producer request:

- the single factual SOURCE image for the current run, attached directly;
- the exact P0 or P1 prompt assigned by the matrix;
- explicit target aspect/raster values already contained in that prompt;
- for future conditions that deliberately allow it, an explicitly authorized composition reference with its role clearly scoped.

### Quarantined

These may be used by the coordinating/review agent, but must not be intentionally introduced into the producer request or used as image references:

- previous generated outputs;
- dashboards, reports or infographics;
- prior PASS/FAIL verdicts;
- previous fantasy/generic examples;
- discussion of experiment history;
- benchmark/report terminology not present in the assigned prompt;
- previous agent explanations of why generation failed or succeeded;
- meta-analysis or meta-evaluation language as visual/output content;
- improvised prompt additions derived from earlier runs.

The coordinating agent may know these things. The producer should not be asked to render, explain or respond to them.

## Rule 3 — meta-evaluation is a private preflight, not output content

Immediately before generation, the coordinating agent performs a short preflight.

Required checks:

1. correct run ID is selected;
2. correct factual SOURCE is attached directly;
3. SOURCE is the only factual image authority for P0/P1 runs;
4. exact assigned prompt version is being used without ad-hoc additions;
5. expected output count is exactly 1 image;
6. dashboard/report/text/multi-panel output is forbidden;
7. prior generated images are not intentionally supplied as references;
8. no request to explain, score, audit or visualize the experiment is included in the producer request;
9. target aspect/raster matches the run matrix;
10. if true fresh context is unavailable, the run is marked `best-effort-quarantine` before generation.

The agent should use this checklist internally/operationally. Do **not** prepend a visible "meta-evaluation", PASS/FAIL checklist or research summary to the image-generation instruction.

## Rule 4 — precondition failure stops before generation

If the agent cannot establish the correct direct SOURCE binding or cannot determine which image will be the factual authority, it must not call the producer as though the run were valid.

Record:

`CONTEXT_ISOLATION_PRECONDITION_FAIL`

or

`SOURCE_BINDING_PRECONDITION_FAIL`

as appropriate.

This is different from `OUTPUT_CONTRACT_FAIL`, which is used only after a valid run reaches the producer and the returned output violates G0.

## Rule 5 — one run, one generation, one context

For the primary smoke matrix:

- one fresh context per run;
- one generation attempt per run;
- preserve the returned output intact;
- do not retry inside the same run after observing a failure;
- do not show the next run the output of the previous run.

Retries are separate runs with separate IDs.

This preserves independence and lets the experiment measure routing instability rather than hide it through local correction.

## Rule 6 — output review starts only after generation

Meta-evaluation before generation checks whether the run is well-formed.

After generation, use the normal gate order:

1. G0 — output form/count;
2. G1 — source binding;
3. G2 — factual landmarks;
4. G3 — inference classification;
5. G4 — presentation quality.

A visually excellent image inside a dashboard still fails G0. Do not crop or rescue it for the primary result.

## Run metadata additions

Each run should record:

```json
{
  "contextIsolation": {
    "mode": "fresh-context | best-effort-quarantine",
    "priorOutputsIntentionallyExposedToProducer": false,
    "priorEvaluationNarrativeIntentionallyExposedToProducer": false,
    "sourceAttachedDirectly": true,
    "preGenerationMetaGatePassed": true
  }
}
```

These fields are research metadata, not a production schema proposal.

## Current hypothesis

The present working hypothesis is:

> Producer quality is affected not only by source/image capability but also by intent routing. Explicit pre-generation meta-evaluation plus context quarantine can reduce leakage from "discourse about the experiment" into "the image the producer should generate".

R-IMG-1.5 should continue to measure this hypothesis rather than assume it proven.

## Non-goals

- This policy does not claim that a same-chat instruction can literally erase model context.
- It does not permit changing P0/P1 after seeing results.
- It does not replace fresh-context repetitions.
- It does not make inferred product details factual.
- It does not promote generated variants into V2/product truth.
