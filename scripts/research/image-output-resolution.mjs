#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

export const CSS_PX_PER_INCH = 96;
export const MM_PER_INCH = 25.4;

function positive(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`invalid_${name}`);
  return number;
}

export function cssPixelsToMm(px) {
  return positive(px, 'css_px') * MM_PER_INCH / CSS_PX_PER_INCH;
}

export function mmToRequiredPixels(mm, dpi) {
  return Math.ceil(positive(mm, 'mm') / MM_PER_INCH * positive(dpi, 'dpi'));
}

export function rasterRequirement({ widthMm, heightMm, dpi }) {
  const w = positive(widthMm, 'width_mm');
  const h = positive(heightMm, 'height_mm');
  const d = positive(dpi, 'dpi');
  return {
    widthPx: mmToRequiredPixels(w, d),
    heightPx: mmToRequiredPixels(h, d),
    widthMm: w,
    heightMm: h,
    dpi: d
  };
}

export function effectiveDpi({ pixelWidth, pixelHeight, widthMm, heightMm }) {
  const pw = positive(pixelWidth, 'pixel_width');
  const ph = positive(pixelHeight, 'pixel_height');
  const w = positive(widthMm, 'width_mm');
  const h = positive(heightMm, 'height_mm');
  return {
    horizontal: pw / (w / MM_PER_INCH),
    vertical: ph / (h / MM_PER_INCH),
    limiting: Math.min(pw / (w / MM_PER_INCH), ph / (h / MM_PER_INCH))
  };
}

export function containPhysicalBox({ holderWidthMm, holderHeightMm, assetWidthPx, assetHeightPx }) {
  const hw = positive(holderWidthMm, 'holder_width_mm');
  const hh = positive(holderHeightMm, 'holder_height_mm');
  const aw = positive(assetWidthPx, 'asset_width_px');
  const ah = positive(assetHeightPx, 'asset_height_px');
  const scale = Math.min(hw / aw, hh / ah);
  return {
    widthMm: aw * scale,
    heightMm: ah * scale,
    scaleMmPerPixel: scale
  };
}

export function containAssetEffectiveDpi({ holderWidthMm, holderHeightMm, assetWidthPx, assetHeightPx }) {
  const box = containPhysicalBox({ holderWidthMm, holderHeightMm, assetWidthPx, assetHeightPx });
  return {
    box,
    dpi: effectiveDpi({
      pixelWidth: assetWidthPx,
      pixelHeight: assetHeightPx,
      widthMm: box.widthMm,
      heightMm: box.heightMm
    })
  };
}

export function sourceSamplingScaleAtDpi({ placementScaleAt96Dpi, targetDpi }) {
  return positive(placementScaleAt96Dpi, 'placement_scale') * positive(targetDpi, 'target_dpi') / CSS_PX_PER_INCH;
}

export const RESEARCH_OUTPUT_PROFILES = Object.freeze({
  printBalanced: { id: 'print-balanced', dpi: 240, role: 'comparison-only' },
  printHigh: { id: 'print-high', dpi: 300, role: 'high-quality research target' }
});

function approx(actual, expected, tolerance, name) {
  if (Math.abs(actual - expected) > tolerance) throw new Error(`${name}:${actual}:${expected}`);
}

function selfTest() {
  const wideMm = {
    widthMm: cssPixelsToMm(440),
    heightMm: cssPixelsToMm(180)
  };
  approx(wideMm.widthMm, 116.4166666667, 1e-8, 'wide_width_mm');
  approx(wideMm.heightMm, 47.625, 1e-8, 'wide_height_mm');

  const wide300 = rasterRequirement({ ...wideMm, dpi: 300 });
  if (wide300.widthPx !== 1376 || wide300.heightPx !== 563) throw new Error('wide_300_dimensions');

  const current4xDpi = effectiveDpi({
    pixelWidth: 1760,
    pixelHeight: 720,
    ...wideMm
  });
  approx(current4xDpi.horizontal, 384, 1e-9, 'wide_4x_dpi_x');
  approx(current4xDpi.vertical, 384, 1e-9, 'wide_4x_dpi_y');

  // V1 Table: outer image cell is 14 mm wide with .7 mm padding on each side;
  // global border-box sizing leaves roughly 12.6 mm content width and img max-height 11 mm.
  const tableCaster = containAssetEffectiveDpi({
    holderWidthMm: 12.6,
    holderHeightMm: 11,
    assetWidthPx: 128,
    assetHeightPx: 128
  });
  approx(tableCaster.box.widthMm, 11, 1e-9, 'table_contain_width');
  approx(tableCaster.box.heightMm, 11, 1e-9, 'table_contain_height');
  approx(tableCaster.dpi.limiting, 295.5636363636, 1e-8, 'table_caster_dpi');

  const h45ScaleAt300 = sourceSamplingScaleAtDpi({
    placementScaleAt96Dpi: 0.9054865788784296,
    targetDpi: 300
  });
  approx(h45ScaleAt300, 2.8296455589950925, 1e-10, 'h45_300_scale');

  return {
    kind: 'catalogotop.image-output-resolution-self-test',
    version: 1,
    status: 'pass',
    widePlacement: {
      cssPx: { width: 440, height: 180 },
      physicalMm: wideMm,
      print240: rasterRequirement({ ...wideMm, dpi: 240 }),
      print300: wide300,
      current1760x720EffectiveDpi: current4xDpi
    },
    tableCasterContain: tableCaster,
    h45SourceSamplingScaleAt300Dpi: h45ScaleAt300,
    guarantees: [
      'physical holder size and raster-output requirement are represented independently',
      'effective DPI is a placement-adequacy metric, not a factual-detail claim',
      'contain geometry is evaluated before judging a source against a physical holder',
      'source sampling pressure can be reported separately from output raster dimensions'
    ],
    limitations: [
      'DPI cannot detect optical blur, compression damage or incorrect product identity',
      'the 240/300 DPI profiles are research targets, not frozen production defaults',
      'actual rendered placement widthMm/heightMm should be preferred over CSS-pixel conversion when available'
    ]
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(selfTest(), null, 2));
