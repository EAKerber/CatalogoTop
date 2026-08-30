#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

function assertImage({ width, height, rgba }) {
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) throw new Error('invalid_dimensions');
  if (!(rgba instanceof Uint8ClampedArray) || rgba.length !== width * height * 4) throw new Error('invalid_rgba');
}

function isLightNeutral(r, g, b, alpha, threshold, chromaTolerance) {
  if (alpha === 0) return true;
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  return min >= threshold && (max - min) <= chromaTolerance;
}

export function segmentConnectedLightBackground(image, options = {}) {
  assertImage(image);
  const threshold = Number.isFinite(Number(options.threshold)) ? Number(options.threshold) : 242;
  const chromaTolerance = Number.isFinite(Number(options.chromaTolerance)) ? Number(options.chromaTolerance) : 24;
  const { width, height, rgba } = image;
  const count = width * height;
  const background = new Uint8Array(count);
  const queued = new Uint8Array(count);
  const queue = new Int32Array(count);
  let head = 0;
  let tail = 0;

  function candidate(index) {
    const p = index * 4;
    return isLightNeutral(rgba[p], rgba[p + 1], rgba[p + 2], rgba[p + 3], threshold, chromaTolerance);
  }

  function push(index) {
    if (index < 0 || index >= count || queued[index] || !candidate(index)) return;
    queued[index] = 1;
    queue[tail++] = index;
  }

  for (let x = 0; x < width; x += 1) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    push(y * width);
    push(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    background[index] = 1;
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) push(index - 1);
    if (x + 1 < width) push(index + 1);
    if (y > 0) push(index - width);
    if (y + 1 < height) push(index + width);
  }

  const foreground = new Uint8Array(count);
  let foregroundPixels = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let i = 0; i < count; i += 1) {
    const alpha = rgba[i * 4 + 3];
    if (alpha === 0 || background[i]) continue;
    foreground[i] = 1;
    foregroundPixels += 1;
    const x = i % width;
    const y = Math.floor(i / width);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  if (!foregroundPixels) throw new Error('foreground_empty');

  return {
    foreground,
    foregroundPixels,
    backgroundPixels: count - foregroundPixels,
    bbox: {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    },
    threshold,
    chromaTolerance
  };
}

export function principalAxis(mask, width, height) {
  if (!(mask instanceof Uint8Array) || mask.length !== width * height) throw new Error('invalid_mask');
  let n = 0;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < mask.length; i += 1) {
    if (!mask[i]) continue;
    n += 1;
    sumX += i % width;
    sumY += Math.floor(i / width);
  }
  if (n < 2) return { angleRad: 0, angleDeg: 0, centroidX: sumX / Math.max(1, n), centroidY: sumY / Math.max(1, n) };
  const cx = sumX / n;
  const cy = sumY / n;
  let xx = 0;
  let yy = 0;
  let xy = 0;
  for (let i = 0; i < mask.length; i += 1) {
    if (!mask[i]) continue;
    const dx = (i % width) - cx;
    const dy = Math.floor(i / width) - cy;
    xx += dx * dx;
    yy += dy * dy;
    xy += dx * dy;
  }
  const angleRad = 0.5 * Math.atan2(2 * xy, xx - yy);
  return { angleRad, angleDeg: angleRad * 180 / Math.PI, centroidX: cx, centroidY: cy };
}

function rotatedForegroundBounds(mask, width, height, cx, cy, angleRad) {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < mask.length; i += 1) {
    if (!mask[i]) continue;
    const dx = (i % width) - cx;
    const dy = Math.floor(i / width) - cy;
    const x = dx * cos - dy * sin;
    const y = dx * sin + dy * cos;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function normalizeDegrees(value) {
  let out = Number(value) || 0;
  while (out <= -180) out += 360;
  while (out > 180) out -= 360;
  return out;
}

function candidateFor(label, angleRad, mask, sourceWidth, sourceHeight, axis, targetWidth, targetHeight, marginRatio) {
  const bounds = rotatedForegroundBounds(mask, sourceWidth, sourceHeight, axis.centroidX, axis.centroidY, angleRad);
  const safeWidth = targetWidth * (1 - 2 * marginRatio);
  const safeHeight = targetHeight * (1 - 2 * marginRatio);
  const scale = Math.min(safeWidth / bounds.width, safeHeight / bounds.height);
  const renderedWidth = bounds.width * scale;
  const renderedHeight = bounds.height * scale;
  return {
    label,
    angleRad,
    angleDeg: normalizeDegrees(angleRad * 180 / Math.PI),
    bounds,
    scale,
    renderedWidth,
    renderedHeight,
    bboxAreaUtilization: (renderedWidth * renderedHeight) / (targetWidth * targetHeight)
  };
}

export function planRecomposition({ image, segmentation, targetWidth, targetHeight, marginRatio = 0.07, orientationStrategy = 'choose-best-axis' }) {
  assertImage(image);
  if (!segmentation?.foreground) throw new Error('segmentation_required');
  if (!(targetWidth > 0) || !(targetHeight > 0)) throw new Error('invalid_target');
  if (!(marginRatio >= 0 && marginRatio < 0.45)) throw new Error('invalid_margin');
  const axis = principalAxis(segmentation.foreground, image.width, image.height);
  const preserve = candidateFor('preserve', 0, segmentation.foreground, image.width, image.height, axis, targetWidth, targetHeight, marginRatio);
  const horizontal = candidateFor('align-horizontal', -axis.angleRad, segmentation.foreground, image.width, image.height, axis, targetWidth, targetHeight, marginRatio);
  const vertical = candidateFor('align-vertical', Math.PI / 2 - axis.angleRad, segmentation.foreground, image.width, image.height, axis, targetWidth, targetHeight, marginRatio);
  const candidates = { preserve, horizontal, vertical };
  let chosen;
  if (orientationStrategy === 'preserve') chosen = preserve;
  else if (orientationStrategy === 'horizontal') chosen = horizontal;
  else if (orientationStrategy === 'vertical') chosen = vertical;
  else if (orientationStrategy === 'choose-best-axis') chosen = [preserve, horizontal, vertical].sort((a, b) => b.bboxAreaUtilization - a.bboxAreaUtilization)[0];
  else throw new Error(`unsupported_orientation_strategy:${orientationStrategy}`);
  return { axis, candidates, chosen, targetWidth, targetHeight, marginRatio, orientationStrategy };
}

export function renderNearestNeighbor({ image, segmentation, plan, background = [255, 255, 255, 255] }) {
  assertImage(image);
  if (!segmentation?.foreground || !plan?.chosen) throw new Error('plan_required');
  const width = Math.round(plan.targetWidth);
  const height = Math.round(plan.targetHeight);
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    out[i * 4] = background[0];
    out[i * 4 + 1] = background[1];
    out[i * 4 + 2] = background[2];
    out[i * 4 + 3] = background[3];
  }

  const angle = plan.chosen.angleRad;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const scale = plan.chosen.scale;
  const cx = plan.axis.centroidX;
  const cy = plan.axis.centroidY;
  const tx = width / 2;
  const ty = height / 2;
  const src = image.rgba;
  const mask = segmentation.foreground;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const rx = (x + 0.5 - tx) / scale;
      const ry = (y + 0.5 - ty) / scale;
      const sx = Math.round(cx + rx * cos + ry * sin);
      const sy = Math.round(cy - rx * sin + ry * cos);
      if (sx < 0 || sx >= image.width || sy < 0 || sy >= image.height) continue;
      const sourceIndex = sy * image.width + sx;
      if (!mask[sourceIndex]) continue;
      const sp = sourceIndex * 4;
      const dp = (y * width + x) * 4;
      out[dp] = src[sp];
      out[dp + 1] = src[sp + 1];
      out[dp + 2] = src[sp + 2];
      out[dp + 3] = src[sp + 3];
    }
  }
  return { width, height, rgba: out };
}

function syntheticImage(width, height, paint) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    rgba[i * 4] = 255;
    rgba[i * 4 + 1] = 255;
    rgba[i * 4 + 2] = 255;
    rgba[i * 4 + 3] = 255;
  }
  paint(rgba, width, height);
  return { width, height, rgba };
}

function fillRect(rgba, width, x0, y0, x1, y1, color = [20, 20, 20, 255]) {
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const p = (y * width + x) * 4;
      rgba[p] = color[0];
      rgba[p + 1] = color[1];
      rgba[p + 2] = color[2];
      rgba[p + 3] = color[3];
    }
  }
}

function selfTest() {
  const vertical = syntheticImage(80, 120, (rgba, width) => fillRect(rgba, width, 34, 20, 46, 100));
  const seg = segmentConnectedLightBackground(vertical);
  const plan = planRecomposition({
    image: vertical,
    segmentation: seg,
    targetWidth: 220,
    targetHeight: 90,
    marginRatio: 0.08,
    orientationStrategy: 'choose-best-axis'
  });
  if (plan.chosen.label !== 'align-horizontal') throw new Error(`expected_horizontal:${plan.chosen.label}`);
  if (!(plan.chosen.bboxAreaUtilization > plan.candidates.preserve.bboxAreaUtilization * 2)) throw new Error('expected_material_utility_gain');

  const output = renderNearestNeighbor({ image: vertical, segmentation: seg, plan });
  if (output.width !== 220 || output.height !== 90) throw new Error('output_dimensions');

  const sourceColors = new Set();
  for (let i = 0; i < vertical.rgba.length; i += 4) sourceColors.add(`${vertical.rgba[i]},${vertical.rgba[i+1]},${vertical.rgba[i+2]},${vertical.rgba[i+3]}`);
  for (let i = 0; i < output.rgba.length; i += 4) {
    const color = `${output.rgba[i]},${output.rgba[i+1]},${output.rgba[i+2]},${output.rgba[i+3]}`;
    if (!sourceColors.has(color)) throw new Error(`invented_color:${color}`);
  }

  const framedHole = syntheticImage(30, 30, (rgba, width) => {
    fillRect(rgba, width, 6, 6, 24, 24, [10, 10, 10, 255]);
    fillRect(rgba, width, 10, 10, 20, 20, [255, 255, 255, 255]);
  });
  const holeSeg = segmentConnectedLightBackground(framedHole);
  if (!holeSeg.foreground[15 * 30 + 15]) throw new Error('enclosed_white_detail_was_removed');

  return {
    kind: 'catalogotop.image-recomposition-core-self-test',
    version: 1,
    status: 'pass',
    chosen: {
      label: plan.chosen.label,
      angleDeg: Math.round(plan.chosen.angleDeg * 100) / 100,
      preserveUtilization: Math.round(plan.candidates.preserve.bboxAreaUtilization * 10000) / 10000,
      chosenUtilization: Math.round(plan.chosen.bboxAreaUtilization * 10000) / 10000
    },
    guaranteesOfThisPrototype: [
      'connected near-white border background is removed deterministically',
      'foreground colors are copied from source pixels; nearest-neighbor scaling introduces no new colors',
      'rotation/recomposition changes placement only, not source geometry',
      'semantic permission to rotate remains external to this module'
    ],
    limitations: [
      'white/light product pixels connected to the border may be misclassified as background',
      'nearest-neighbor scale is a fidelity baseline, not a quality upscale',
      'principal-axis orientation is geometric evidence, not semantic authority',
      'the module does not encode PNG/JPEG/WebP or persist assets'
    ]
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(selfTest(), null, 2));
}
