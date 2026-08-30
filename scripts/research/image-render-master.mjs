#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

function assertImage({ width, height, rgba }) {
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) throw new Error('invalid_dimensions');
  if (!(rgba instanceof Uint8ClampedArray) || rgba.length !== width * height * 4) throw new Error('invalid_rgba');
}

function assertMask(mask, width, height) {
  if (!(mask instanceof Uint8Array) || mask.length !== width * height) throw new Error('invalid_mask');
}

export function resolveMasterRenderProfile({ placementWidth, placementHeight, scaleFactor = 4 }) {
  if (!Number.isInteger(placementWidth) || placementWidth <= 0 || !Number.isInteger(placementHeight) || placementHeight <= 0) throw new Error('invalid_placement_dimensions');
  if (!Number.isInteger(scaleFactor) || scaleFactor < 1 || scaleFactor > 16) throw new Error('invalid_master_scale_factor');
  return {
    placement: { width: placementWidth, height: placementHeight },
    master: { width: placementWidth * scaleFactor, height: placementHeight * scaleFactor },
    scaleFactor
  };
}

export function scaleRecompositionPlan(plan, scaleFactor) {
  if (!plan?.chosen || !(plan.targetWidth > 0) || !(plan.targetHeight > 0)) throw new Error('plan_required');
  if (!Number.isInteger(scaleFactor) || scaleFactor < 1) throw new Error('invalid_scale_factor');
  const scaleCandidate = (candidate) => ({
    ...candidate,
    scale: candidate.scale * scaleFactor,
    renderedWidth: candidate.renderedWidth * scaleFactor,
    renderedHeight: candidate.renderedHeight * scaleFactor
  });
  const candidates = Object.fromEntries(Object.entries(plan.candidates || {}).map(([key, value]) => [key, scaleCandidate(value)]));
  return {
    ...plan,
    targetWidth: plan.targetWidth * scaleFactor,
    targetHeight: plan.targetHeight * scaleFactor,
    candidates,
    chosen: scaleCandidate(plan.chosen),
    masterScaleFactor: scaleFactor
  };
}

function samplePremultiplied(image, mask, sx, sy) {
  const { width, height, rgba } = image;
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const fx = sx - x0;
  const fy = sy - y0;
  let a = 0;
  let pr = 0;
  let pg = 0;
  let pb = 0;
  for (let oy = 0; oy <= 1; oy += 1) {
    for (let ox = 0; ox <= 1; ox += 1) {
      const x = x0 + ox;
      const y = y0 + oy;
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      const weight = (ox ? fx : 1 - fx) * (oy ? fy : 1 - fy);
      if (weight <= 0) continue;
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
  return { a: Math.min(1, a), pr, pg, pb };
}

export function renderAlphaAware({ image, segmentation, plan, background = [255, 255, 255, 255] }) {
  assertImage(image);
  assertMask(segmentation?.foreground, image.width, image.height);
  if (!plan?.chosen) throw new Error('plan_required');
  const width = Math.round(plan.targetWidth);
  const height = Math.round(plan.targetHeight);
  if (!(width > 0) || !(height > 0)) throw new Error('invalid_target');

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
      const sample = samplePremultiplied(image, segmentation.foreground, sx, sy);
      const a = sample.a;
      const outAlpha = a + bgAlpha * (1 - a);
      const dp = (y * width + x) * 4;
      coverageAlpha[y * width + x] = Math.round(a * 255);
      if (outAlpha <= 0) {
        rgba[dp] = rgba[dp + 1] = rgba[dp + 2] = rgba[dp + 3] = 0;
        continue;
      }
      rgba[dp] = Math.round((sample.pr + background[0] * bgAlpha * (1 - a)) / outAlpha);
      rgba[dp + 1] = Math.round((sample.pg + background[1] * bgAlpha * (1 - a)) / outAlpha);
      rgba[dp + 2] = Math.round((sample.pb + background[2] * bgAlpha * (1 - a)) / outAlpha);
      rgba[dp + 3] = Math.round(outAlpha * 255);
    }
  }
  return { width, height, rgba, coverageAlpha };
}

export function downsampleBox({ image, targetWidth, targetHeight }) {
  assertImage(image);
  if (!Number.isInteger(targetWidth) || targetWidth <= 0 || !Number.isInteger(targetHeight) || targetHeight <= 0) throw new Error('invalid_target');
  if (image.width % targetWidth !== 0 || image.height % targetHeight !== 0) throw new Error('non_integer_downsample');
  const factorX = image.width / targetWidth;
  const factorY = image.height / targetHeight;
  if (factorX !== factorY || !Number.isInteger(factorX)) throw new Error('non_uniform_downsample');
  const factor = factorX;
  const rgba = new Uint8ClampedArray(targetWidth * targetHeight * 4);
  for (let ty = 0; ty < targetHeight; ty += 1) {
    for (let tx = 0; tx < targetWidth; tx += 1) {
      const sums = [0, 0, 0, 0];
      for (let oy = 0; oy < factor; oy += 1) {
        for (let ox = 0; ox < factor; ox += 1) {
          const sx = tx * factor + ox;
          const sy = ty * factor + oy;
          const sp = (sy * image.width + sx) * 4;
          sums[0] += image.rgba[sp];
          sums[1] += image.rgba[sp + 1];
          sums[2] += image.rgba[sp + 2];
          sums[3] += image.rgba[sp + 3];
        }
      }
      const divisor = factor * factor;
      const dp = (ty * targetWidth + tx) * 4;
      rgba[dp] = Math.round(sums[0] / divisor);
      rgba[dp + 1] = Math.round(sums[1] / divisor);
      rgba[dp + 2] = Math.round(sums[2] / divisor);
      rgba[dp + 3] = Math.round(sums[3] / divisor);
    }
  }
  return { width: targetWidth, height: targetHeight, rgba };
}

export function downsampleCoverageBox({ coverageAlpha, width, height, targetWidth, targetHeight }) {
  if (!(coverageAlpha instanceof Uint8ClampedArray) || coverageAlpha.length !== width * height) throw new Error('invalid_coverage');
  if (width % targetWidth !== 0 || height % targetHeight !== 0) throw new Error('non_integer_downsample');
  const factorX = width / targetWidth;
  const factorY = height / targetHeight;
  if (factorX !== factorY || !Number.isInteger(factorX)) throw new Error('non_uniform_downsample');
  const factor = factorX;
  const out = new Uint8ClampedArray(targetWidth * targetHeight);
  for (let ty = 0; ty < targetHeight; ty += 1) {
    for (let tx = 0; tx < targetWidth; tx += 1) {
      let sum = 0;
      for (let oy = 0; oy < factor; oy += 1) {
        for (let ox = 0; ox < factor; ox += 1) sum += coverageAlpha[(ty * factor + oy) * width + tx * factor + ox];
      }
      out[ty * targetWidth + tx] = Math.round(sum / (factor * factor));
    }
  }
  return out;
}

export function renderMasterAndPlacement({ image, segmentation, placementPlan, masterScaleFactor = 4, background }) {
  const profile = resolveMasterRenderProfile({
    placementWidth: Math.round(placementPlan.targetWidth),
    placementHeight: Math.round(placementPlan.targetHeight),
    scaleFactor: masterScaleFactor
  });
  const masterPlan = scaleRecompositionPlan(placementPlan, masterScaleFactor);
  const master = renderAlphaAware({ image, segmentation, plan: masterPlan, background });
  const placement = downsampleBox({ image: master, targetWidth: profile.placement.width, targetHeight: profile.placement.height });
  const placementCoverageAlpha = downsampleCoverageBox({
    coverageAlpha: master.coverageAlpha,
    width: master.width,
    height: master.height,
    targetWidth: profile.placement.width,
    targetHeight: profile.placement.height
  });
  return { profile, masterPlan, master, placement, placementCoverageAlpha };
}

function syntheticImage(width, height) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  const foreground = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = 255;
    rgba[i * 4 + 3] = 255;
  }
  for (let y = 20; y < 100; y += 1) {
    for (let x = 34; x < 46; x += 1) {
      const i = y * width + x;
      foreground[i] = 1;
      rgba[i * 4] = 20;
      rgba[i * 4 + 1] = 40;
      rgba[i * 4 + 2] = 60;
    }
  }
  return { image: { width, height, rgba }, segmentation: { foreground } };
}

function selfTest() {
  const { image, segmentation } = syntheticImage(80, 120);
  const angleRad = Math.PI / 6;
  const plan = {
    axis: { centroidX: 40, centroidY: 60 },
    candidates: {
      horizontal: { angleRad, angleDeg: 30, scale: 1.8, renderedWidth: 140, renderedHeight: 70, bboxAreaUtilization: 0.49 }
    },
    chosen: { angleRad, angleDeg: 30, scale: 1.8, renderedWidth: 140, renderedHeight: 70, bboxAreaUtilization: 0.49 },
    targetWidth: 220,
    targetHeight: 90,
    marginRatio: 0.08,
    orientationStrategy: 'horizontal'
  };
  const rendered = renderMasterAndPlacement({ image, segmentation, placementPlan: plan, masterScaleFactor: 4 });
  if (rendered.master.width !== 880 || rendered.master.height !== 360) throw new Error('master_dimensions');
  if (rendered.placement.width !== 220 || rendered.placement.height !== 90) throw new Error('placement_dimensions');
  if (Math.abs(rendered.masterPlan.chosen.bboxAreaUtilization - plan.chosen.bboxAreaUtilization) > 1e-12) throw new Error('relative_geometry_changed');
  let partial = 0;
  for (const value of rendered.master.coverageAlpha) if (value > 0 && value < 255) partial += 1;
  if (partial === 0) throw new Error('expected_antialias_coverage');
  const direct = renderAlphaAware({ image, segmentation, plan });
  let directCoverage = 0;
  for (const value of direct.coverageAlpha) directCoverage += value / 255;
  let masterCoverage = 0;
  for (const value of rendered.master.coverageAlpha) masterCoverage += value / 255 / 16;
  if (Math.abs(directCoverage - masterCoverage) / directCoverage > 0.02) throw new Error('coverage_not_preserved');
  return {
    kind: 'catalogotop.image-render-master-self-test',
    version: 1,
    status: 'pass',
    placement: rendered.profile.placement,
    master: rendered.profile.master,
    scaleFactor: rendered.profile.scaleFactor,
    relativeGeometryPreserved: true,
    partialMasterCoveragePixels: partial,
    normalizedCoverageDeltaRatio: Math.abs(directCoverage - masterCoverage) / directCoverage,
    guarantees: [
      'master dimensions are a pure integer multiple of placement dimensions',
      'master plan preserves placement-relative geometry and semantic orientation',
      'bilinear sampling uses premultiplied factual coverage rather than inventing product geometry',
      'placement preview is derived from the master by deterministic box downsample'
    ],
    limitations: [
      'higher raster dimensions do not increase factual source resolution',
      'the renderer operates on decoded RGBA and does not encode/persist files',
      'semantic permission and source authority remain external gates'
    ]
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(selfTest(), null, 2));
