# Kickstart — Parallel Research: Semantic / Placement-Aware Image Variations

## 0. Purpose of this document

This is the operational entry point for a new agent working in parallel on the image-variation problem in CatalogoTop.

The agent should be able to enter this branch with no prior chat context, request the right repository authorization, reconstruct the important product/architecture history, work independently without colliding with the active V2 line, and leave research artifacts that can later be integrated with low friction.

This is **not** an instruction to reactivate the V1 image-generation feature. The V1 transport experiment worked technically but failed the usefulness/quality bar. The purpose of this branch is to understand and specify the harder problem before asking the product to depend on it again.

---

# 1. Repository and branch topology

Repository:

`EAKerber/CatalogoTop`

Stable production baseline:

- branch: `main`
- immutable release marker: `v1.0.0`
- V1 baseline commit: `2ad3566033241ce2d8d4effd96d19b8fdbe513c9`

Active product-development line:

- branch: `v2`
- purpose: normal V2 product/architecture evolution
- current first direction: Product Library / hierarchical organization, intentionally excluding generative-image work

Parallel research line:

- branch: `research/semantic-image-variation-v2`
- purpose: research, benchmarks, contracts, prototypes and integration proposals for image variation

The three lines have deliberately different authority:

```text
main
  V1 stable / production

v2
  active product evolution

research/semantic-image-variation-v2
  isolated research + experiments + compatibility proposals
```

Do not collapse those roles merely to simplify Git history.

---

# 2. Mandatory repository-access preflight

## 2.1 Do not begin the mission before authorization

Before inspecting private/connected repository state or making any repository mutation, explicitly ask the user to confirm access under the policy below.

Use a request materially equivalent to this:

> Para iniciar o trabalho paralelo de pesquisa de variantes de imagem no repositório `EAKerber/CatalogoTop`, preciso que você confirme a seguinte autorização:
>
> - leitura de todas as branches, tags, histórico, PRs, Actions e documentação do repositório, inclusive `main` e `v2`, para acompanhar contratos e evitar incompatibilidades;
> - escrita, commits, criação/remoção de arquivos e outras mudanças apenas em `research/semantic-image-variation-v2` e em branches-filhas de pesquisa criadas por este agente;
> - operações destrutivas nessas branches de pesquisa quando necessárias, evitando risco desnecessário e avisando antes de mudanças de alto impacto ou dificilmente reversíveis;
> - criação e remoção de branches-filhas próprias, execução/ajuste de testes e workflows de pesquisa, e abertura de PR draft para revisão quando isso facilitar um futuro handoff;
> - `main` e `v2` permanecem somente leitura para este agente: não fazer merge, push, reset, rebase, force-push ou alteração direta nelas;
> - não apagar, mover ou sobrescrever `main`, `v2`, o tag `v1.0.0` ou o repositório como um todo;
> - não promover deploy de produção e não alterar dados remotos de produção como parte desta autorização;
> - um eventual merge da pesquisa em `v2` ou `main` exige nova decisão/autorização explícita.
>
> Confirma esse acesso e escopo?

If the user grants a broader authorization, respect it, but keep the narrower working discipline here unless broader power is genuinely needed.

If the user grants less, operate inside the narrower grant.

## 2.2 Why access is asymmetric

The research agent needs broad **read** access because V2 may evolve contracts that affect future compatibility. It does not need authority over V2 itself.

The parallel branch should be a place where experiments can fail cheaply. Production and active V2 development should not inherit the risk or churn of that exploration.

---

# 3. Mission

Research and define a useful, fidelity-preserving capability for adapting real product images to catalog placements.

The central problem is not:

> “Which transform should be applied?”

It is closer to:

> Given the canonical pixels of a real product, the semantic/editorial context of a placement, and explicit fidelity constraints, what visual composition would materially improve that placement without inventing or changing the product?

A representative real case is a telescopic slide whose source image is diagonal or vertical while the target is a wide horizontal card.

A useful result may:

- isolate the factual product from its source background;
- rotate the whole factual object to a better orthogonal orientation;
- scale it up with materially better effective quality;
- expand or reconstruct only background/canvas where safe;
- compose it close to the target card aspect ratio;
- use the available horizontal space instead of making a minimal cosmetic change.

An unacceptable result may:

- redraw a plausible but different slide;
- change rail geometry, holes, proportions or number of pieces;
- invent/remove fittings or attachments;
- make the product merely “look nicer” while weakening identity fidelity;
- downscale a weak source and call the output an improvement;
- return a tiny change that technically satisfies a transform contract but does not improve the placement.

The outcome of this research should be a **well-evidenced integration contract**, not merely a successful image-generation demo.

---

# 4. Historical evidence that must shape the research

## 4.1 What V1 proved

V1 successfully established much of the transport and safety plumbing around external variants:

- stable placement concepts;
- request/result transport;
- asset materialization;
- passive raster validation;
- provenance;
- image selection separate from framing;
- fail-closed import behavior;
- content-addressed assets;
- preview/print consistency.

That work is useful evidence and should not be discarded merely because the product feature was retired.

## 4.2 What V1 did not prove

It did **not** prove that the generation agent understood the source image and the placement deeply enough to produce useful catalog imagery.

The observed failure mode was not principally ZIP/schema failure. The generated images were poor, often effectively downscaled, and too conservative/minimal relative to the editorial opportunity.

That distinction is critical:

```text
transport validity != visual usefulness
schema validity    != product fidelity
image difference   != editorial improvement
```

Do not solve the retired feature by making the same protocol more elaborate before understanding the semantic-quality problem.

## 4.3 V1 stable retirement policy

V1 stable deliberately hides the external image workflow and removes `provenance.kind = external-variation` catalog-local derivatives during its stable normalization policy.

This retirement policy is a product-line boundary, not evidence that the data concepts are invalid.

The schema meanings were intentionally preserved so a future V2 capability can integrate additively rather than requiring a destructive schema reversal.

---

# 5. Stable compatibility boundary

Unless an explicit migration proposal proves a better model, preserve these semantic meanings:

```text
product.image
  canonical original / fallback

product.imageGallery[]
  approved faithful alternatives reusable for the product

product.variants
  commercial variants such as color/finish; NOT image-generation variants

presentation.imageFrames
  non-destructive framing for a placement

presentation.imageSelections
  sparse editorial choice of which image source a placement uses

presentation.imageVariants
  catalog-local derivative images
```

Also preserve these principles:

1. `product.image` must never be silently overwritten by a derivative.
2. A catalog-local derivative is not automatically product truth.
3. Promotion from a local derivative to `product.imageGallery` must be explicit.
4. Image choice and framing remain independent axes.
5. Preview and print must resolve the same selected image.
6. Asset identity should be content-/resource-based, not based on folder paths or UI positions.
7. `product.variants` remains a commercial domain and must not be overloaded.
8. A stale/unavailable image selection must have a deterministic fallback.

These are integration invariants, not an instruction to preserve every V1 implementation detail.

---

# 6. Compatibility with the V2 line

The research branch is a sibling of `v2`, not its implementation branch.

Current V2 work is expected to evolve product/library organization first. In particular, V2 may introduce stable `folderId` semantics and later saved catalog documents.

Research should therefore avoid coupling image identity to V1 organizational strings such as category/subcategory and should also avoid coupling it to future folder paths.

Preferred compatibility rules:

- product identity uses stable product IDs;
- image source identity uses stable asset/resource identity and hashes where useful;
- placement identity derives from the materialized editorial model, not DOM position;
- future folder moves do not invalidate image provenance;
- a future saved Catalog Document should be able to own catalog-local derivatives/selections without promoting them into ProductStore;
- a reusable approved alternative remains a product-level gallery concern;
- research metadata should be serializable independently of browser session state.

Do not alter `v2` to make an experiment easier. If a real compatibility requirement is discovered, document it as a proposal for V2.

---

# 7. Working model: isolate uncertainty from product code

## 7.1 Default locations

Prefer research changes under dedicated paths such as:

```text
docs/research/
experiments/image-variation/
scripts/research/              # only if executable tooling is useful
fixtures/research/             # only if repository convention supports it
```

Avoid modifying production runtime modules merely to make a prototype convenient.

If a prototype absolutely needs a production-module seam, isolate that change in a separable commit and clearly label it as an integration experiment, not a V2 requirement.

## 7.2 Do not rebuild the end-to-end product first

A second complete request-ZIP -> generation -> result-ZIP -> editor-import implementation is not the starting point.

First establish whether the semantic approach can produce reliably better images on real placements.

Transport should be revisited only after the research can say what information actually needs to cross the boundary.

## 7.3 Prefer subtractive explanations

When an image can be improved by segmentation + rotation + recomposition + safe upscale, that is preferable to invoking unconstrained reconstruction.

Do not assume “more generative” means “better”.

A central research hypothesis is that many useful catalog adaptations may be achievable without synthesizing new product geometry.

---

# 8. Transformation/risk taxonomy

Use at least this conceptual separation while researching. The exact names need not become schema field names.

## A. Pixel-preserving / deterministic

Examples:

- crop/reframe;
- resize;
- loss-aware upscale;
- canvas expansion with known background;
- whole-image or whole-object rotation;
- tonal/contrast cleanup;
- passive background cleanup where product pixels remain factual.

These are the easiest class to audit mechanically.

## B. Semantic recomposition without product invention

Examples:

- segmentation of the real product;
- choosing a better orthogonal orientation for an elongated object;
- repositioning the factual object inside a target aspect ratio;
- choosing scale/coverage based on product silhouette and card geometry;
- preserving multiple factual pieces while recomposing them as a group.

This class requires understanding what the object is and what the placement needs, but should strive to preserve product pixels/geometry.

## C. Generative reconstruction

Examples:

- synthesizing missing high-resolution product detail;
- reconstructing occluded parts;
- changing viewpoint beyond what source pixels support;
- inventing unseen sides/surfaces;
- hallucinating text, holes, fittings or geometry.

Treat this as a distinct high-risk capability. Some product classes may prohibit it entirely.

Do not let Class C become an invisible fallback for a failed Class A/B pipeline.

---

# 9. Research questions to answer before proposing integration

At minimum investigate:

1. **What counts as a useful variant?**
   - target coverage;
   - aspect fit;
   - effective clarity/resolution;
   - reduced wasted canvas;
   - actual editorial improvement relative to Original.

2. **What counts as faithful?**
   - product/model identity;
   - number of physical pieces;
   - characteristic geometry/proportions;
   - holes, rails, connectors, visible fittings;
   - labels/branding where legible;
   - no invented or removed physical elements.

3. **How should orientation be decided?**
   - preserve source orientation;
   - choose best orthogonal orientation;
   - infer semantic main axis;
   - allow an explicit desired angle only when justified.

4. **How much placement context is needed?**
   - target aspect ratio;
   - target pixel size / effective rendered size;
   - Card vs Collection member vs other future use;
   - safe margins;
   - neighboring text/content regions;
   - desired role: whole object, detail, technical clarity, application.

5. **When should the correct answer be “no variant”?**
   - source already fits well;
   - safe recomposition cannot materially improve it;
   - fidelity risk exceeds value;
   - source quality is too poor to support safe transformation.

6. **Should one request return one image or ranked candidates?**

7. **What evidence must accompany a candidate?**

8. **What can be approved automatically and what requires human approval?**

9. **What metadata is needed for future reuse without treating a placement-specific derivative as universal product truth?**

10. **How will a future Saved Catalog Document own local variants deterministically?**

---

# 10. Benchmark before schema

## 10.1 Build a real benchmark

Use approximately 10–20 representative source + placement cases before freezing a new contract.

Include different classes, for example:

- long rails/slides/profiles;
- handles;
- compact electrical pieces;
- products with multiple physical pieces;
- images with useful technical labels;
- already-good source images;
- poor/low-resolution sources;
- products for which rotation is semantically wrong;
- cases where “do not generate” is the expected answer.

The wide horizontal slide-card case should be included explicitly because it captures the observed gap.

Do not silently use arbitrary internet imagery as canonical product truth. Track source provenance and use material that the project can legitimately evaluate.

## 10.2 Define expected outcome before generation

For each benchmark case record at least:

- source identity;
- placement geometry/context;
- desired semantic outcome;
- invariants that must not change;
- acceptable transformation class;
- unacceptable changes;
- whether generation is expected to help at all.

This reduces retrospective rationalization of whatever a model happens to return.

## 10.3 Compare approaches, not just models

Where practical compare:

- deterministic crop/rotate/recompose;
- segmentation + deterministic recomposition;
- segmentation + high-quality upscale;
- source-grounded generative edit;
- Original baseline.

The purpose is to learn which capability class actually creates value.

---

# 11. Evaluation model

Do not collapse evaluation to one magic score.

Candidate evidence can include:

- object bounding-box utilization of the placement;
- source-vs-output scale/effective resolution;
- aspect-fit improvement;
- silhouette/shape similarity;
- count of distinct physical pieces;
- perceptual similarity/embedding evidence;
- preservation of visible text/brand marks;
- comparison of characteristic geometry;
- transformation trace;
- risk class;
- human review decision and notes.

Embedding/image-similarity metrics can help but must never be the sole fidelity authority. A hallucinated product can remain globally similar.

A candidate can fail either because it is unfaithful **or because it provides too little benefit over Original**.

That second failure mode matters because it is exactly what the V1 experiment exposed.

---

# 12. Contract concepts to investigate — do not freeze field names early

A future request probably needs to express an **intent**, not just an allowlist of transforms.

Candidate concepts include:

```text
generationIntent
  targetAspect
  targetPixelSize
  use / placement type
  goal
  orientationStrategy
  sourceUsage
  expectedObjectCount
  safeMargins
  preserveTextAndBrandMarks
  riskCeiling
```

A future candidate/result may need concepts such as:

```text
candidate
  asset identity
  source identity/hash
  request/intent version
  transformation class
  transformation trace
  placement compatibility
  fidelity evidence
  utility evidence
  risk classification
  approval state
```

Do not turn these sketches directly into production schema until the benchmark demonstrates which fields are actually necessary.

Prefer versioned, additive contracts once the shape stabilizes.

---

# 13. Stable placement semantics

Reuse existing placement identity/context concepts where they remain valid rather than creating a second placement authority.

The V1 work already established concepts such as:

- `placementKey`;
- `usageSignature`;
- product identity;
- placement type/use;
- target geometry;
- source hash/material identity.

Research may evolve what `usageSignature` covers if the semantic context changes, but the reason must be explicit and migration/staleness behavior must remain deterministic.

Never derive durable placement identity from DOM order/coordinates alone.

---

# 14. Git working discipline to reduce future integration friction

## 14.1 Session start

At the start of a work session:

1. read `AGENTS.md`;
2. read this kickstart;
3. read `docs/research/semantic-image-variation-v2.md`;
4. read `docs/v2/START-HERE.md` from current `v2`;
5. read back current `main`, `v2` and research heads;
6. verify `v1.0.0` still identifies the stable V1 baseline;
7. inspect only the code/contracts relevant to the next research question.

Do not assume branch heads from a previous handoff are still current.

## 14.2 Do not routinely merge V2 into research

The branches are intentionally independent.

If V2 changes a compatibility surface relevant to image research:

- inspect the change;
- record the compatibility consequence;
- adapt research contracts/prototypes in isolated commits when necessary;
- avoid pulling unrelated V2 implementation churn into the research history.

Only rebase/merge when there is a concrete technical reason.

## 14.3 Keep experiments removable

Prefer commits that separate:

- documentation/decision;
- benchmark fixtures;
- experimental tooling;
- integration seam/prototype.

A future V2 agent should be able to port the useful contract without importing the full experimental implementation.

## 14.4 History rewriting

Even within the research scope, avoid force-push/rewrite after a branch or commit has been handed to another agent unless there is a concrete benefit and the impact is called out.

Reversibility is useful, but stable checkpoints are also coordination artifacts.

## 14.5 No drive-by refactors

Do not use this branch to clean unrelated V1/V2 technical debt.

Record an issue/observation if it materially blocks research; otherwise leave it to the product line.

---

# 15. Lightweight documentation for continuation

Keep continuation cheap. Do not create documentation for its own sake.

Recommended long-lived artifacts:

```text
docs/research/semantic-image-variation-v2.md
  durable problem framing and stable research principles

docs/research/image-variation/STATUS.md
  current checkpoint, evidence, blockers and next step

docs/research/image-variation/BENCHMARK.md
  benchmark cases, expected outcomes and results

docs/research/image-variation/DECISIONS.md
  only decisions that survived evidence and should constrain later work

docs/research/image-variation/CONTRACT.md
  create only when an integration contract is mature enough to propose
```

`STATUS.md` should be rewritten as the current checkpoint rather than becoming an endless diary.

`DECISIONS.md` should distinguish:

- decided;
- provisional;
- rejected;
- open question.

When an experiment changes the conclusion, update the decision rather than preserving contradictory folklore.

---

# 16. First read-only biopsy after authorization

Before writing an implementation, inspect at least:

- `AGENTS.md`;
- `docs/v1-stable.md`;
- `docs/research/semantic-image-variation-v2.md`;
- current `docs/v2/START-HERE.md` from `v2`;
- image normalization and resolution code;
- `CatalogDocument` placement/materialization code;
- `PresentationActions` image-selection/framing boundaries;
- AssetClient / asset-store representation;
- V1 Variation Request/Result docs and fixtures;
- retirement policy in V1;
- gates that proved preview/print image consistency.

Treat the V1 bundle implementation as transport evidence, not as the desired generative architecture.

After the biopsy, return a short research plan tied to actual repository authorities and then proceed within the authorized branch without repeatedly requesting approval for ordinary scoped changes.

Ask again only when a decision would:

- affect `v2`/`main`;
- widen repository/deploy/data authority;
- introduce a destructive/high-impact operation beyond the agreed research scope;
- freeze a cross-version schema prematurely;
- require product judgment that the benchmark cannot resolve.

---

# 17. Recommended first research slice

Do not start by integrating a model.

A useful first slice is:

## R-IMG-1 — Placement Utility & Fidelity Benchmark

Deliverables:

1. benchmark manifest/cases;
2. explicit expected outcome + invariants for every case;
3. baseline measurements of the Original in the target placement;
4. deterministic/semi-deterministic recomposition prototype for at least elongated hardware;
5. comparison against at least one source-grounded generative approach when available;
6. evaluation notes covering both utility and identity fidelity;
7. initial answer to: “How much of the value can be obtained without reconstructing product geometry?”

Success is **not** “the pipeline produced an image”.

Success is evidence strong enough to narrow the next design decision.

---

# 18. Stop / escalation conditions

Stop and report instead of quietly generalizing when:

- the benchmark shows different product classes require incompatible semantics;
- a proposed automatic gate cannot distinguish a dangerous hallucination from a faithful output;
- the source material is insufficient to justify reconstruction;
- V2 changes the ownership/lifecycle of catalog-local image variants;
- an experiment requires changing ProductStore or production backend semantics;
- a solution needs free-form arbitrary composition in the main editor;
- the only way to get a “better” image is to invent uncertain product geometry.

“Do not generate a variant” is a valid and sometimes preferred system result.

---

# 19. Definition of a mature handoff back to V2

Do not recommend integration merely because some examples look good.

A mature handoff should contain:

1. **Problem statement** refined by evidence.
2. **Benchmark** with both successes and failures.
3. **Transformation/risk taxonomy** validated against real cases.
4. **Fidelity invariants** per relevant product class or a justified general core.
5. **Placement intent model** with only necessary context.
6. **Candidate/evidence model** that can explain why a derivative is acceptable.
7. **Human-approval boundary**.
8. **Compatibility mapping** to the current V2 product/catalog/asset schema.
9. **Migration/staleness semantics** for existing `imageSelections` / local variants.
10. **Integration proposal** that is additive where possible.
11. **What should remain research-only or forbidden**.
12. **A small implementation slice** for V2, rather than a demand to merge the research branch wholesale.

A preferred future flow remains conceptually:

```text
V2 product + catalog data
        ↓
materialized placement context
        ↓
placement-aware generation/recomposition request
        ↓
research/external capability
        ↓
ranked validated candidate(s)
        ↓
explicit approval
        ↓
presentation.imageVariants
        ↓ optional explicit promotion
product.imageGallery
```

Never silently replace `product.image`.

---

# 20. Relationship to the product roadmap

The research line should not block the main V2 roadmap.

The current product line is intentionally prioritizing more deterministic/high-value work first, beginning with product-library/folder foundations and then broader catalog persistence/templates/primitives as those contracts mature.

Image research should therefore optimize for **future compatibility and evidence**, not for forcing immediate integration.

This separation is a feature:

- V2 can mature predictable product infrastructure;
- research can explore a genuinely hard semantic/generative problem;
- when the research is ready, both sides meet through a defined contract rather than a large intertwined branch merge.

---

# 21. Core principle for the research agent

The image capability is valuable only if it makes a real catalog placement better **and** remains recognizably, structurally and commercially the same real product.

Use generative potential aggressively on composition when evidence supports it; use it conservatively on product identity.

The target is not “no hallucination because nothing changed”.

The target is:

> meaningful visual adaptation with bounded, inspectable fidelity risk.
