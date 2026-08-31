# R-IMG-1.6 — Execution findings

Status: research-only.

## Key finding: gates are not producer prompt content

The RIMG16 smoke execution exposed a new failure mode: asking an agent to "apply the gates as a prompt" causes the evaluation protocol itself to leak into image generation. The producer then tends to synthesize dashboards, reports, PASS/FAIL panels, or other meta-content instead of the factual product image.

This is distinct from source-fidelity failure. It is an **instruction-envelope failure**.

### Correct separation

The agent owns the gates.

The producer should receive only:

- the directly bound factual SOURCE image;
- the minimal or guided product-edit prompt for the current case;
- the target composition/aspect/raster contract.

The producer should **not** receive:

- gate names;
- PASS/FAIL language;
- result schema;
- reviewer notes;
- benchmark narrative;
- prior generated outputs;
- dashboard/report terminology except as explicit forbidden-output words in the minimal product prompt.

Gate evaluation happens only before and after generation.

## Context quarantine

Fresh context remains the preferred condition.

When a fresh context is unavailable, apply best-effort quarantine:

1. privately identify the current SOURCE and run;
2. reject prior generated outputs as producer references;
3. reject prior judgments and experiment narrative as producer instructions;
4. privately verify expected count/aspect/raster;
5. send only the current SOURCE + current product prompt to the producer;
6. after generation, resume the gate protocol.

Metaevaluation is therefore **private preflight**, never visual content.

## Binding lesson from RIMG16

The ZIP may transport and document SOURCE files, but extracting or viewing a SOURCE does not prove that the image producer has it bound as the edit target.

A run is valid only when the factual SOURCE becomes an actual eligible image reference for the producer. If that cannot be established, classify the run as a precondition failure rather than a product-generation failure.

## Observed execution patterns

The smoke sequence included:

- runs that immediately produced dashboards/infographics;
- deterministic fallback outputs that preserved SOURCE pixels but did not test generation;
- a three-panel invented mechanical-parts infographic when multiple cases were requested together;
- later one-by-one image generations after the user explicitly requested each SOURCE be handled individually.

The first three categories must not be counted as generative fidelity passes.

The final one-by-one outputs are the correct objects to evaluate as candidate runs, but their factual fidelity should be scored independently against each SOURCE before promotion.

## Protocol correction for next kit

Use a two-envelope design:

### Producer envelope

Only:
- one SOURCE image;
- one P0/P1 product prompt;
- target aspect/raster.

### Evaluator envelope

Contains:
- gate definitions;
- result schema;
- prior failures;
- context-quarantine policy;
- landmark checklist;
- inference taxonomy.

Never concatenate the evaluator envelope into the producer prompt.

## Current conclusion

The experiment should treat source binding, output-form compliance, factual fidelity, and evaluation-protocol obedience as separate dimensions. A dashboard output can represent a good internal understanding of the task while still being a hard `OUTPUT_CONTRACT_FAIL`.

No production schema/runtime change is implied by this finding.
