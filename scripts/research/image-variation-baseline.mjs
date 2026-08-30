#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const manifestPath = process.argv[2] || 'experiments/image-variation/benchmark.v1.json';
const raw = JSON.parse(await readFile(manifestPath, 'utf8'));

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function aspect(width, height) {
  return width / height;
}

function containAreaRatio(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const drawnWidth = sourceWidth * scale;
  const drawnHeight = sourceHeight * scale;
  return (drawnWidth * drawnHeight) / (targetWidth * targetHeight);
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

assert(raw?.kind === 'catalogotop.image-variation-benchmark', 'benchmark kind inválido');
assert(Number(raw?.version) === 1, 'benchmark version inválida');
assert(raw?.targetProfiles && typeof raw.targetProfiles === 'object', 'targetProfiles ausente');
assert(raw?.sources && typeof raw.sources === 'object', 'sources ausente');
assert(Array.isArray(raw?.cases) && raw.cases.length >= 10, 'benchmark precisa de pelo menos 10 casos');

const allowedDecisions = new Set(['variant-expected', 'conditional', 'no-variant-preferred']);
const allowedRisk = new Set(['A', 'B']);
const ids = new Set();
const pendingPixelReadback = new Set();
const rows = [];

for (const entry of raw.cases) {
  assert(entry && typeof entry === 'object', 'caso inválido');
  assert(entry.id && !ids.has(entry.id), `id de caso duplicado: ${entry.id || '<vazio>'}`);
  ids.add(entry.id);
  assert(raw.sources[entry.sourceId], `sourceId inexistente: ${entry.sourceId}`);
  assert(raw.targetProfiles[entry.targetProfile], `targetProfile inexistente: ${entry.targetProfile}`);
  assert(allowedDecisions.has(entry.expectedDecision), `expectedDecision inválida em ${entry.id}`);
  assert(allowedRisk.has(entry.acceptanceRiskCeiling), `acceptanceRiskCeiling deve permanecer A/B em ${entry.id}`);
  assert(Array.isArray(entry.fidelityInvariants) && entry.fidelityInvariants.length, `invariantes ausentes em ${entry.id}`);
  assert(Array.isArray(entry.unacceptableChanges) && entry.unacceptableChanges.length, `mudanças inaceitáveis ausentes em ${entry.id}`);

  const target = raw.targetProfiles[entry.targetProfile];
  assert(Number(target.widthPx) > 0 && Number(target.heightPx) > 0, `target inválido em ${entry.id}`);
  const source = raw.sources[entry.sourceId];
  const sourceCanvas = source.sourceCanvas;
  let baseline = null;

  if (sourceCanvas?.widthPx > 0 && sourceCanvas?.heightPx > 0) {
    const normal = containAreaRatio(sourceCanvas.widthPx, sourceCanvas.heightPx, target.widthPx, target.heightPx);
    const orthogonal = containAreaRatio(sourceCanvas.heightPx, sourceCanvas.widthPx, target.widthPx, target.heightPx);
    baseline = {
      sourceCanvasAspect: round(aspect(sourceCanvas.widthPx, sourceCanvas.heightPx)),
      targetAspect: round(aspect(target.widthPx, target.heightPx)),
      containAreaRatio: round(normal),
      orthogonalContainAreaRatio: round(orthogonal),
      orthogonalCanvasGain: round(orthogonal - normal)
    };
  } else {
    pendingPixelReadback.add(entry.sourceId);
  }

  rows.push({
    id: entry.id,
    sourceId: entry.sourceId,
    targetProfile: entry.targetProfile,
    expectedDecision: entry.expectedDecision,
    riskCeiling: entry.acceptanceRiskCeiling,
    baseline
  });
}

const byDecision = Object.fromEntries(
  [...allowedDecisions].map(decision => [decision, rows.filter(row => row.expectedDecision === decision).length])
);
const byRisk = Object.fromEntries(
  [...allowedRisk].map(risk => [risk, rows.filter(row => row.riskCeiling === risk).length])
);

const summary = {
  kind: 'catalogotop.image-variation-baseline-report',
  version: 1,
  benchmark: manifestPath,
  caseCount: rows.length,
  sourceCount: Object.keys(raw.sources).length,
  targetProfiles: Object.fromEntries(Object.entries(raw.targetProfiles).map(([id, target]) => [
    id,
    {
      widthPx: target.widthPx,
      heightPx: target.heightPx,
      aspectRatio: round(aspect(target.widthPx, target.heightPx)),
      origin: target.origin
    }
  ])),
  byDecision,
  byRisk,
  sourcePixelReadback: {
    measuredSources: Object.keys(raw.sources).filter(id => raw.sources[id]?.sourceCanvas?.widthPx > 0 && raw.sources[id]?.sourceCanvas?.heightPx > 0),
    pendingSources: [...pendingPixelReadback].sort()
  },
  cases: rows,
  caveats: [
    'containAreaRatio measures full source-canvas occupancy, not product-object bounding-box utilization.',
    'Orthogonal canvas gain is geometry evidence only; it never authorizes semantic rotation by itself.',
    'Class C is comparison-only in benchmark v1 and is never inside an automatic acceptance ceiling.',
    'A useful baseline still requires fresh source materialization plus object/silhouette measurements before R-IMG-1 can be considered complete.'
  ]
};

console.log(JSON.stringify(summary, null, 2));
