#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { downsampleBox, downsampleCoverageBox, scaleRecompositionPlan } from './image-render-master.mjs';

function assertImage({ width, height, rgba }) {
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) throw new Error('invalid_dimensions');
  if (!(rgba instanceof Uint8ClampedArray) || rgba.length !== width * height * 4) throw new Error('invalid_rgba');
}

function assertMask(mask, width, height) {
  if (!(mask instanceof Uint8Array) || mask.length !== width * height) throw new Error('invalid_mask');
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

// Mitchell-Netravali, B=C=1/3. Chosen as a conservative cubic reconstruction
// filter: smoother than bilinear, less ringing-prone than a sharp Catmull-Rom path.
export function mitchellWeight(x, B = 1 / 3, C = 1 / 3) {
  const t = Math.abs(x);
  if (t < 1) {
    return ((12 - 9 * B - 6 * C) * t ** 3 + (-18 + 12 * B + 6 * C) * t ** 2 + (6 - 2 * B)) / 6;
  }
  if (t < 2) {
    return ((-B - 6 * C) * t ** 3 + (6 * B + 30 * C) * t ** 2 + (-12 * B - 48 * C) * t + (8 * B + 24 * C)) / 6;
  }
  return 0;
}

function samplePremultipliedMitchell(image, mask, sx, sy) {
  const { width, height, rgba } = image;
  const xBase = Math.floor(sx);
  const yBase = Math.floor(sy);
  let a = 0;
  let pr = 0;
  let pg = 0;
  let pb = 0;

  for (let oy = -1; oy <= 2; oy += 1) {
    const y = yBase + oy;
    const wy = mitchellWeight(sy - y);
    if (wy === 0 || y < 0 || y >= height) continue;
    for (let ox = -1; ox <= 2; ox += 1) {
      const x = xBase + ox;
      const wx = mitchellWeight(sx - x);
      const weight = wx * wy;
      if (weight === 0 || x < 0 || x >= width) continue;
      const index = y * width + x;
      if (!mask[index]) continue;
      const p = index * 4;
      const sourceAlpha = rgba[p + 3] / 255;
      const wa = weight * sourceAlpha;
      a += wa;
      pr += rgba[p] * wa;
      pg += rgba[p + 1] * wa;
      pb += rgba[p + 2] * wa;
    }
  }

  // Cubic filters can overshoot around hard binary masks. Clamp coverage and
  // premultiplied channels rather than interpreting ringing as factual detail.
  a = clamp01(a);
  const maxPremultiplied = 255 * a;
  pr = Math.max(0, Math.min(maxPremultiplied, pr));
  pg = Math.max(0, Math.min(maxPremultiplied, pg));
  pb = Math.max(0, Math.min(maxPremultiplied, pb));
  return { a, pr, pg, pb };
}

export function renderAlphaAwareMitchell({ image, segmentation, plan, background = [255, 255, 255, 255] }) {
  assertImage(image);
  assertMask(segmentation?.foreground, image.width, image.height);
  if (!plan?.chosen) throw new Error('plan_required');
  const width = Math.round(plan.targetWidth);
  const height = Math.round(plan.targetHeight);
  const rgba = new Uint8ClampedArray(width * height * 4);
  const coverageAlpha = new Uint8ClampedArray(width * height);
  const angle = plan.chosen.angleRad;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const scale = plan.chosen.scale;
  const cx = plan.axis.centroidX;
  const cy = plan.axis.centroidY;
  const tx = width / 2;
  const ty = height / 2;
  const bgAlpha = background[3] / 255;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const rx = (x + 0.5 - tx) / scale;
      const ry = (y + 0.5 - ty) / scale;
      const sx = cx + rx * cos + ry * sin;
      const sy = cy - rx * sin + ry * cos;
      const sample = samplePremultipliedMitchell(image, segmentation.foreground, sx, sy);
      const a = sample.a;
      const outAlpha = a + bgAlpha * (1 - a);
      const dp = (y * width + x) * 4;
      coverageAlpha[y * width + x] = Math.round(a * 255);
      rgba[dp] = Math.round((sample.pr + background[0] * bgAlpha * (1 - a)) / Math.max(outAlpha, 1e-9));
      rgba[dp + 1] = Math.round((sample.pg + background[1] * bgAlpha * (1 - a)) / Math.max(outAlpha, 1e-9));
      rgba[dp + 2] = Math.round((sample.pb + background[2] * bgAlpha * (1 - a)) / Math.max(outAlpha, 1e-9));
      rgba[dp + 3] = Math.round(outAlpha * 255);
    }
  }
  return { width, height, rgba, coverageAlpha };
}

export function renderMitchellMasterAndPlacement({ image, segmentation, placementPlan, masterScaleFactor = 8, background }) {
  if (![4, 8, 12].includes(masterScaleFactor)) throw new Error('unsupported_probe_scale');
  const masterPlan = scaleRecompositionPlan(placementPlan, masterScaleFactor);
  const master = renderAlphaAwareMitchell({ image, segmentation, plan: masterPlan, background });
  const placement = downsampleBox({ image: master, targetWidth: Math.round(placementPlan.targetWidth), targetHeight: Math.round(placementPlan.targetHeight) });
  const placementCoverageAlpha = downsampleCoverageBox({
    coverageAlpha: master.coverageAlpha,
    width: master.width,
    height: master.height,
    targetWidth: Math.round(placementPlan.targetWidth),
    targetHeight: Math.round(placementPlan.targetHeight)
  });
  return { masterPlan, master, placement, placementCoverageAlpha, masterScaleFactor };
}

export const RASTER_QUALITY_PROFILES = Object.freeze({
  baseline: { reconstruction: 'bilinear', masterScaleFactor: 4, downsample: 'box' },
  cubic4x: { reconstruction: 'mitchell-bc-1/3', masterScaleFactor: 4, downsample: 'box' },
  cubic8x: { reconstruction: 'mitchell-bc-1/3', masterScaleFactor: 8, downsample: 'box' },
  diagnostic12x: { reconstruction: 'mitchell-bc-1/3', masterScaleFactor: 12, downsample: 'box', defaultEligible: false }
});

function syntheticImage(width, height) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  const foreground = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = 255;
    rgba[i * 4 + 3] = 255;
  }
  for (let y = 10; y < height - 10; y += 1) {
    const left = Math.round(12 + y * 0.18);
    for (let x = left; x < left + 11; x += 1) {
      const i = y * width + x;
      foreground[i] = 1;
      rgba[i * 4] = 54;
      rgba[i * 4 + 1] = 72;
      rgba[i * 4 + 2] = 88;
    }
  }
  return { image: { width, height, rgba }, segmentation: { foreground } };
}

function coverageEquivalent(alpha) {
  let sum = 0;
  for (const value of alpha) sum += value / 255;
  return sum;
}

function selfTest() {
  const { image, segmentation } = syntheticImage(72, 96);
  const plan = {
    axis: { centroidX: 28, centroidY: 48 },
    candidates: { chosen: { angleRad: Math.PI / 11, angleDeg: 16.36, scale: 1.85, renderedWidth: 132, renderedHeight: 62, bboxAreaUtilization: 0.4547 } },
    chosen: { angleRad: Math.PI / 11, angleDeg: 16.36, scale: 1.85, renderedWidth: 132, renderedHeight: 62, bboxAreaUtilization: 0.4547 },
    targetWidth: 220,
    targetHeight: 90,
    marginRatio: 0.08,
    orientationStrategy: 'horizontal'
  };
  const four = renderMitchellMasterAndPlacement({ image, segmentation, placementPlan: plan, masterScaleFactor: 4 });
  const eight = renderMitchellMasterAndPlacement({ image, segmentation, placementPlan: plan, masterScaleFactor: 8 });
  if (four.master.width !== 880 || four.master.height !== 360) throw new Error('4x_dimensions');
  if (eight.master.width !== 1760 || eight.master.height !== 720) throw new Error('8x_dimensions');
  let partial = 0;
  for (const value of eight.master.coverageAlpha) if (value > 0 && value < 255) partial += 1;
  if (!partial) throw new Error('expected_partial_coverage');
  const normalizedFour = coverageEquivalent(four.master.coverageAlpha) / 16;
  const normalizedEight = coverageEquivalent(eight.master.coverageAlpha) / 64;
  const coverageDeltaRatio = Math.abs(normalizedFour - normalizedEight) / Math.max(1, normalizedEight);
  if (coverageDeltaRatio > 0.02) throw new Error('coverage_drift');
  return {
    kind: 'catalogotop.image-raster-quality-probe-self-test',
    version: 1,
    status: 'pass',
    profiles: RASTER_QUALITY_PROFILES,
    partial8xCoveragePixels: partial,
    normalizedCoverageDelta4xVs8x: coverageDeltaRatio,
    guarantees: [
      'sampling quality changes do not alter the placement plan or semantic orientation',
      'cubic interpolation operates on premultiplied factual coverage',
      'cubic overshoot is clamped rather than treated as factual detail',
      'no sharpening, super-resolution or generated product detail is introduced'
    ],
    limitations: [
      'this probe does not increase factual source resolution',
      '8x is an experimental quality ceiling, not a production default',
      'visual review remains required before replacing the 4x bilinear research baseline'
    ]
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(selfTest(), null, 2));
