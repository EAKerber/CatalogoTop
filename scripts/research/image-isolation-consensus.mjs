#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

function assertImage({ width, height, rgba }) {
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) throw new Error('invalid_dimensions');
  if (!(rgba instanceof Uint8ClampedArray) || rgba.length !== width * height * 4) throw new Error('invalid_rgba');
}

function percentile(values, p) {
  if (!values.length) throw new Error('percentile_empty');
  const sorted = Array.from(values).sort((a, b) => a - b);
  const q = Math.min(100, Math.max(0, Number(p))) / 100;
  const index = q * (sorted.length - 1);
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) return sorted[lo];
  const t = index - lo;
  return sorted[lo] * (1 - t) + sorted[hi] * t;
}

function isLightNeutral(r, g, b, alpha, threshold, chromaTolerance) {
  if (alpha === 0) return true;
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  return min >= threshold && (max - min) <= chromaTolerance;
}

export function gradientMagnitude(image) {
  assertImage(image);
  const { width, height, rgba } = image;
  const luma = new Float64Array(width * height);
  for (let i = 0; i < luma.length; i += 1) {
    const p = i * 4;
    luma[i] = (rgba[p] + rgba[p + 1] + rgba[p + 2]) / 3;
  }
  const out = new Float64Array(width * height);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const gx = Math.abs(luma[i + 1] - luma[i - 1]) / 2;
      const gy = Math.abs(luma[i + width] - luma[i - width]) / 2;
      out[i] = Math.hypot(gx, gy);
    }
  }
  return out;
}

function floodAllowedBackground(image, allowed) {
  const { width, height, rgba } = image;
  const count = width * height;
  const background = new Uint8Array(count);
  const queued = new Uint8Array(count);
  const queue = new Int32Array(count);
  let head = 0;
  let tail = 0;

  function push(index) {
    if (index < 0 || index >= count || queued[index] || !allowed[index]) return;
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
  for (let i = 0; i < count; i += 1) {
    if (rgba[i * 4 + 3] !== 0 && !background[i]) foreground[i] = 1;
  }
  return { background, foreground };
}

export function segmentEdgeGatedLightBackground(image, options = {}) {
  assertImage(image);
  const lightThreshold = Number.isFinite(Number(options.lightThreshold)) ? Number(options.lightThreshold) : 242;
  const chromaTolerance = Number.isFinite(Number(options.chromaTolerance)) ? Number(options.chromaTolerance) : 24;
  const gradientPercentile = Number.isFinite(Number(options.gradientPercentile)) ? Number(options.gradientPercentile) : 95;
  const gradient = options.gradient ?? gradientMagnitude(image);
  const gradientThreshold = percentile(gradient, gradientPercentile);
  const count = image.width * image.height;
  const allowed = new Uint8Array(count);
  for (let i = 0; i < count; i += 1) {
    const p = i * 4;
    const candidate = isLightNeutral(
      image.rgba[p], image.rgba[p + 1], image.rgba[p + 2], image.rgba[p + 3], lightThreshold, chromaTolerance
    );
    if (candidate && gradient[i] <= gradientThreshold) allowed[i] = 1;
  }
  const segmentation = floodAllowedBackground(image, allowed);
  return {
    ...segmentation,
    lightThreshold,
    chromaTolerance,
    gradientPercentile,
    gradientThreshold
  };
}

export function segmentEdgeConsensus(image, options = {}) {
  assertImage(image);
  const percentiles = Array.isArray(options.percentiles) && options.percentiles.length
    ? options.percentiles.map(Number)
    : [92, 93, 94, 95, 96];
  if (percentiles.some((p) => !Number.isFinite(p) || p < 0 || p > 100)) throw new Error('invalid_percentiles');
  const gradient = gradientMagnitude(image);
  const runs = percentiles.map((gradientPercentile) => segmentEdgeGatedLightBackground(image, {
    ...options,
    gradient,
    gradientPercentile
  }));
  const count = image.width * image.height;
  const votes = new Uint8Array(count);
  for (const run of runs) {
    for (let i = 0; i < count; i += 1) votes[i] += run.foreground[i];
  }
  const majorityVotes = Math.floor(runs.length / 2) + 1;
  const foreground = new Uint8Array(count);
  const stableForeground = new Uint8Array(count);
  const uncertain = new Uint8Array(count);
  let foregroundPixels = 0;
  let stablePixels = 0;
  let uncertainPixels = 0;
  for (let i = 0; i < count; i += 1) {
    if (votes[i] >= majorityVotes) {
      foreground[i] = 1;
      foregroundPixels += 1;
    }
    if (votes[i] === runs.length) {
      stableForeground[i] = 1;
      stablePixels += 1;
    }
    if (votes[i] > 0 && votes[i] < runs.length) {
      uncertain[i] = 1;
      uncertainPixels += 1;
    }
  }
  return {
    foreground,
    stableForeground,
    uncertain,
    votes,
    foregroundPixels,
    stablePixels,
    uncertainPixels,
    majorityVotes,
    percentiles,
    gradientThresholds: runs.map((run) => run.gradientThreshold),
    lightThreshold: runs[0].lightThreshold,
    chromaTolerance: runs[0].chromaTolerance
  };
}

export function connectedComponents(mask, width, height) {
  if (!(mask instanceof Uint8Array) || mask.length !== width * height) throw new Error('invalid_mask');
  const visited = new Uint8Array(mask.length);
  const components = [];
  const neighbors = [-width - 1, -width, -width + 1, -1, 1, width - 1, width, width + 1];
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue;
    const queue = [start];
    visited[start] = 1;
    let head = 0;
    let pixels = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    while (head < queue.length) {
      const index = queue[head++];
      pixels += 1;
      const x = index % width;
      const y = Math.floor(index / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (const delta of neighbors) {
        const next = index + delta;
        if (next < 0 || next >= mask.length || visited[next] || !mask[next]) continue;
        const nx = next % width;
        const ny = Math.floor(next / width);
        if (Math.abs(nx - x) > 1 || Math.abs(ny - y) > 1) continue;
        visited[next] = 1;
        queue.push(next);
      }
    }
    components.push({ pixels, bbox: { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 } });
  }
  return components.sort((a, b) => b.pixels - a.pixels);
}

function syntheticImage() {
  const width = 80;
  const height = 60;
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    rgba[i * 4] = 255;
    rgba[i * 4 + 1] = 255;
    rgba[i * 4 + 2] = 255;
    rgba[i * 4 + 3] = 255;
  }
  for (let y = 18; y < 42; y += 1) {
    for (let x = 12; x < 68; x += 1) {
      const p = (y * width + x) * 4;
      const edge = x === 12 || x === 67 || y === 18 || y === 41;
      const v = edge ? 238 : 246;
      rgba[p] = v;
      rgba[p + 1] = v;
      rgba[p + 2] = v;
    }
  }
  return { width, height, rgba };
}

function selfTest() {
  const image = syntheticImage();
  const consensus = segmentEdgeConsensus(image);
  if (consensus.percentiles.join(',') !== '92,93,94,95,96') throw new Error('unexpected_default_band');
  if (consensus.gradientThresholds.length !== 5) throw new Error('missing_threshold_evidence');
  if (!consensus.foregroundPixels) throw new Error('expected_foreground');
  for (let i = 0; i < consensus.foreground.length; i += 1) {
    if (consensus.stableForeground[i] && !consensus.foreground[i]) throw new Error('stable_not_majority');
  }
  const components = connectedComponents(consensus.foreground, image.width, image.height);
  if (!components.length) throw new Error('expected_component');
  return {
    kind: 'catalogotop.image-isolation-consensus-self-test',
    version: 1,
    status: 'pass',
    percentiles: consensus.percentiles,
    gradientThresholds: consensus.gradientThresholds,
    foregroundPixels: consensus.foregroundPixels,
    stablePixels: consensus.stablePixels,
    uncertainPixels: consensus.uncertainPixels,
    largestComponentPixels: components[0].pixels,
    limitations: [
      'edge gating can still fail when light factual pixels touch the source border without a separating gradient',
      'the percentile band is research evidence, not a production tuning contract',
      'majority consensus exposes sensitivity but does not establish semantic subject identity',
      'composite sources still require subject/role reasoning outside this module'
    ]
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(selfTest(), null, 2));
}
