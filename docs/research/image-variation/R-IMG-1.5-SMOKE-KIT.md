# R-IMG-1.5 — Smoke Test Kit

Status: **research-only**

Purpose: test whether a source-bound image producer can obey an explicit output contract, preserve source identity, and generalize across **two products** and **two target scales/aspects**, while comparing **minimal** vs **guided** prompting.

This kit intentionally avoids the prior `clean-context` / dashboard vocabulary in the producer prompt.

## Critical execution rule

The documentation package is **not** the image binding mechanism.

For every run, attach the matching SOURCE image **directly** to the fresh chat / image producer. Do not assume that an image inside a ZIP, README, repository or document becomes the edit target.

Each run must happen in a **fresh context**. Do not show outputs from previous runs to the producer.

## Cases

### Case A — H45

Source authority:
- exact factual source: `450×450`
- SHA-256: `e6ed49ef777da2f6da8c627180370a8cafb45274b07f7bccf1742b9488614bb7`

Target:
- aspect: `22:9`
- minimum use raster: approximately `1376×563`
- preferred research master: approximately `1760×720`
- exactly **2** factual slide pieces
- clean white background

Required landmark family:
- two distinct telescopic-slide pieces;
- black stop/fitting visible in the factual source;
- rectangular window/insert region;
- recognizable circular-hole and elongated-slot sequences;
- terminal/end structures;
- stamped bracket-like structures on the second piece;
- relative rail proportions.

Allowed:
- translate whole pieces;
- rotate/reorient whole pieces;
- uniform scale for composition;
- neutral white canvas completion.

Forbidden:
- invented hardware;
- changed piece count;
- invented wheels/rollers/mechanisms;
- changed hole/slot topology;
- unsupported new viewpoint without inference classification.

### Case B — Caster / rodízio

Source authority:
- exact factual source: `128×128`
- SHA-256: `d92dadcbb33e9bef01a3197f2ec584db34bf63c72d9a95347bcaa38405aad9ba`
- original research locator: `https://product-hub-prd.madeiramadeira.com.br/292834998/images/7b563fa0-5fc2-4c71-82ec-1d09e4b730253298REN36503297REN36503296.jpg?bg-color=FFF&canvas=1%3A1&width=128`

Target:
- aspect: `1:1`
- minimum smoke-test raster: approximately `180×180`
- preferred research master: approximately `512×512`
- exactly **1** caster assembly
- clean white background

Required landmark family:
- one caster assembly;
- wheel shape and axle relationship;
- metal bracket/fork;
- brake/lever if visible in source;
- mounting plate/hardware arrangement if visible;
- overall proportions.

Important negative-control rule:

> A larger output raster must not be interpreted as recovered factual detail. The source is only `128×128`.

## Prompt strategy

Use the same base contract for all runs, with two levels of guidance.

### P0 — minimal

```text
Use a imagem anexada como autoridade factual do produto.

Retorne EXATAMENTE 1 imagem raster do produto, e nada mais.
Sem texto, legenda, relatório, dashboard, infográfico, colagem ou múltiplos painéis.
Fundo branco limpo.

Preserve a identidade factual do produto. É permitido apenas reposicionar, reorientar de forma conservadora e escalar uniformemente o objeto/peças para o alvo informado.
Não substitua por um produto genérico. Não invente ferragens, mecanismos, peças ou detalhes.
Se precisar inferir alguma superfície não visível para cumprir a apresentação, faça a menor inferência possível; não redesenhe o produto.
```

#### P0-A suffix

```text
CASO A
- alvo composicional: horizontal 22:9
- exatamente 2 peças factuais
- raster mínimo: aproximadamente 1376×563
- master preferencial de pesquisa: aproximadamente 1760×720

Saída: somente a imagem.
```

#### P0-B suffix

```text
CASO B
- alvo composicional: quadrado 1:1
- exatamente 1 conjunto de rodízio factual
- raster mínimo: aproximadamente 180×180
- master preferencial de pesquisa: aproximadamente 512×512

Não trate o aumento do raster como aumento de detalhe factual.
Saída: somente a imagem.
```

### P1 — guided

P1 uses the same base contract and target suffix as P0, plus explicit landmark guidance.

#### P1-A additional guidance

```text
Preserve especialmente:
- trava/batente preto visível;
- região de janela retangular;
- sequência e espaçamento relativos de furos circulares e rasgos alongados;
- terminações das peças;
- estruturas estampadas da segunda peça;
- proporções relativas entre os trilhos.

Não invente rodas, roldanas ou mecanismos.
```

#### P1-B additional guidance

```text
Preserve especialmente:
- formato da roda e relação com o eixo;
- garfo/suporte metálico;
- freio/alavanca, se visível;
- chapa/arranjo de montagem, se visível;
- proporções gerais.

Não invente roda extra, freio, parafusos ou ferragens.
Não trate o aumento do raster como aumento de detalhe factual.
```

## Main smoke matrix

12 runs total:

- `A-P0-R1` / `A-P0-R2` / `A-P0-R3`
- `A-P1-R1` / `A-P1-R2` / `A-P1-R3`
- `B-P0-R1` / `B-P0-R2` / `B-P0-R3`
- `B-P1-R1` / `B-P1-R2` / `B-P1-R3`

Each run:
1. fresh context;
2. direct attachment of the one matching factual source image;
3. paste only the matching prompt;
4. generate once;
5. preserve the complete output;
6. score the gates;
7. close that context.

Do **not** run multiple matrix cells in one chat.

## Gate order

### G0 — output form

Must be:
- exactly **1** image;
- raster image only;
- no text, label, report, dashboard, infographic, collage, border annotations or multi-panel content.

Any violation = `OUTPUT_CONTRACT_FAIL`.

Do not crop a good-looking product out of an invalid dashboard and count it as success.

### G1 — source binding

Must clearly be the attached product.

Reject as:
- `SOURCE_NOT_BOUND` if unrelated;
- `FANTASY_SUBSTITUTION_FAIL` if a generic/invented product replaces the source identity.

### G2 — factual landmarks

Compare source landmarks after mentally neutralizing allowed translation / rotation / scale.

Do not use a generated report's internal reference or PASS labels as evidence.

### G3 — inference classification

Use:
- `NO_INFERENCE_VISIBLE`
- `LIGHT_INFERENCE_WARNING`
- `MATERIAL_INFERENCE_REVIEW_REQUIRED`

A result with useful but inferred surfaces may remain experimentally valid with warning; this does not imply automatic production promotion.

### G4 — presentation quality

Only after G0–G3:
- background cleanliness;
- edge quality / antialiasing;
- native raster adequacy for target placement;
- obvious artifacts.

## Run terminal result

One of:
- `PASS_FULL`
- `PASS_WITH_INFERENCE_WARNING`
- `REVIEW_REQUIRED`
- `OUTPUT_CONTRACT_FAIL`
- `SOURCE_NOT_BOUND`
- `FANTASY_SUBSTITUTION_FAIL`

## Smoke-test success condition

This is not a production qualification.

The smoke is already useful if:
1. at least one run per product passes G0 + G1;
2. P1 can be compared against P0 without changing the output-format contract;
3. the `128×128` caster remains visibly source-limited rather than receiving invented factual detail;
4. dashboard/infographic emergence can be measured as a separate producer-contract variable.

## Handoff prompt for another agent

```text
Você está executando o smoke test controlado R-IMG-1.5.

Leia R-IMG-1.5-SMOKE-KIT.md e r-img-1-5-expected-output-gate.v1.json antes de gerar qualquer imagem.

Regras obrigatórias:
- cada run acontece em um chat/contexto novo;
- anexe a SOURCE factual diretamente em cada run;
- documentação/ZIP/repositório não substitui o attachment da imagem;
- não mostre outputs anteriores ao produtor;
- G0 falha imediatamente se a saída não for exatamente 1 imagem raster sem texto/dashboard/relatório;
- não recorte nem salve uma boa imagem embutida em um output inválido;
- preserve outputs integrais para auditoria;
- registre o resultado conforme r-img-1-5-run-result-template.v1.json.

Comece somente por A-P0-R1. Depois de registrar o resultado, pare e peça confirmação antes de seguir.
```
