# R-IMG-1.7 — Producer / Evaluator Separation

Status: **research-only**

## Motivation

R-IMG-1.6 exposed an additional failure mode beyond ordinary context contamination: when an agent turns evaluation gates into part of the image-generation prompt, terms such as gates, PASS/FAIL, benchmark, report and evaluation can themselves become visual content. The producer may generate dashboards or infographics instead of a product image.

Therefore the experiment must physically separate the generation envelope from the evaluation envelope.

## Producer envelope

The image producer may receive only:

1. the factual SOURCE image, attached directly as the active image reference;
2. the run prompt (`P0` or `P1`).

It must not receive:

- gates;
- PASS/FAIL vocabulary;
- result schema;
- benchmark narrative;
- prior outputs;
- dashboards or reports;
- experiment history;
- research conclusions.

## Evaluator envelope

The evaluator may use:

- output gates;
- context/isolation policy;
- prior evidence;
- result schemas;
- human-review notes;
- comparison artifacts.

Evaluator content must never be pasted into or shown to the image producer as part of the generation request.

## Meta-evaluation

Meta-evaluation remains useful as a **private preflight** before generation. The agent checks:

- correct run ID;
- correct SOURCE bound directly;
- correct run prompt;
- target aspect and minimum raster;
- expected output count = 1;
- no prior generated outputs exposed to the producer.

The preflight must not be rendered or verbalized to the producer.

## Context policy

A fresh context remains preferred. When it is unavailable, use best-effort context quarantine: prior outputs, judgments, dashboards and experimental narrative may be known by the coordinating agent but are excluded from the producer envelope.

If this separation is violated before generation, classify the run as:

`CONTEXT_ISOLATION_PRECONDITION_FAIL`

This is distinct from `OUTPUT_CONTRACT_FAIL`, which applies only after a valid producer invocation returns the wrong form.

## Materialized smoke kit

The corresponding local smoke kit is `RIMG17-smoke-kit.zip` and uses three item families inherited from R-IMG-1.6:

- A — PIN — horizontal 16:9;
- B — LEG — vertical 3:4;
- C — PISTON — square 1:1.

Each case keeps P0/P1 and two repetitions. The kit includes `TOOLS/prepare_run.py`, which materializes a clean `ACTIVE-RUN/` directory containing only `SOURCE.png`, `PROMPT.txt`, a run id and minimal execution instructions.

## Research consequence

The primary experimental unit is no longer merely `source + prompt`. It is:

> **isolated producer envelope + factual source binding + output contract + independent evaluator**

This separation should be preserved in future source-grounded image-generation experiments before drawing conclusions about fidelity or producer capability.
