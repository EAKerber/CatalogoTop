# R-IMG-1 — Human Fidelity Review

Status: research-only evaluation aid. This is not a production approval workflow or schema.

Use this checklist after a candidate shows measurable placement utility. Utility alone is not a fidelity pass.

## Review dimensions

### 1. Source identity and authority

- Is the candidate traceable to the intended source bytes/hash?
- Is the source authoritative product imagery, family-representative, illustrative, low-resolution, or otherwise qualified?
- Did the transformation preserve that authority caveat instead of silently strengthening it?

### 2. Piece count and group membership

- Are all required visible primary pieces still present?
- Were no pieces merged, duplicated, invented or removed?
- For multi-piece groups, is the relative grouping still semantically understandable?

### 3. Characteristic geometry

- Are overall proportions preserved?
- Are characteristic cups, rails, rods, brackets, forks, wheels and other defining forms unchanged?
- Is there any sign that clipping, segmentation or reconstruction altered the factual silhouette?

### 4. Fittings, holes and local detail

- Are visible holes, fittings, attachment points and distinctive hardware still present in the same factual arrangement?
- Did scaling/segmentation destroy a detail that matters for identity?
- Did any process invent detail not supported by source pixels/evidence?

### 5. Segmentation and source-boundary integrity

- Are light/white factual pixels intact?
- Are shadows/background artifacts being mistaken for product or vice versa?
- Does the source itself clip the product at an edge?
- If the extraction is threshold-sensitive, treat the candidate as review-required rather than robust.

### 6. Semantic orientation and annotations

- Is the chosen orientation semantically natural for the product/group rather than merely geometrically efficient?
- Were source annotations, variant labels or disclaimers preserved when they carry meaning?
- If an annotation was removed from pixels, is equivalent meaning explicitly preserved elsewhere in the research evidence/presentation?

### 7. Resolution honesty

- Did the candidate merely become larger, or did factual source detail actually increase?
- Never score interpolation, larger output dimensions or generative sharpening as additional factual resolution without independent evidence.

### 8. Transformation provenance

- Is the operation class (A/B/C) clear?
- Can the candidate be reproduced from declared source + parameters when deterministic?
- Are generative edits explicitly source-grounded and human-review-only?

## Review outcome

Use one of three outcomes:

- **PASS FOR BENCHMARK COMPARISON** — measurable utility and no observed fidelity/authority violation. This does not imply production approval.
- **REVIEW-REQUIRED** — useful candidate, but one or more fidelity/authority questions remain unresolved.
- **REJECT / NO VARIANT** — fidelity risk, semantic loss, weak source evidence or negligible utility outweighs the placement gain.

A valid `NO VARIANT` outcome is preferable to a visually cleaner but less trustworthy product representation.
