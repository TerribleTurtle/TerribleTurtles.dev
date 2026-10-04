// @ts-check
/**
 * Unit tests for the colour math behind `scripts/check-contrast.mjs`.
 * Reference values come from the WCAG 2.x definitions and the published
 * OKLab → sRGB matrices (Björn Ottosson, 2020).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseOklch,
  oklchToSrgb8,
  relativeLuminance,
  contrastRatio,
  parseLightDarkTokens,
} from '../../scripts/lib/color.mjs';

/** @param {number} actual @param {number} expected @param {number} tolerance */
const near = (actual, expected, tolerance) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${expected} ± ${tolerance}, got ${actual}`);

test('white on black is 21:1 and the ratio is symmetric', () => {
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };
  assert.equal(contrastRatio(white, black), 21);
  assert.equal(contrastRatio(black, white), 21);
});

test('identical colours have a ratio of 1', () => {
  const grey = { r: 119, g: 119, b: 119 };
  assert.equal(contrastRatio(grey, grey), 1);
});

test('relative luminance matches WCAG reference values', () => {
  assert.equal(relativeLuminance({ r: 255, g: 255, b: 255 }), 1);
  assert.equal(relativeLuminance({ r: 0, g: 0, b: 0 }), 0);
  // #777777 ≈ 0.1845 → 4.48:1 on white (the classic "just fails AA" grey).
  near(relativeLuminance({ r: 119, g: 119, b: 119 }), 0.1845, 0.0005);
  near(contrastRatio({ r: 119, g: 119, b: 119 }, { r: 255, g: 255, b: 255 }), 4.48, 0.01);
});

test('parseOklch reads percentage and unitless lightness', () => {
  assert.deepEqual(parseOklch('oklch(17% 0.012 160)'), { l: 0.17, c: 0.012, h: 160 });
  assert.deepEqual(parseOklch('oklch(0.5 0.1 30)'), { l: 0.5, c: 0.1, h: 30 });
  assert.deepEqual(parseOklch('oklch(80% 0.09 75deg)'), { l: 0.8, c: 0.09, h: 75 });
  assert.throws(() => parseOklch('rgb(0 0 0)'));
});

test('OKLCH converts to the expected 8-bit sRGB', () => {
  assert.deepEqual(oklchToSrgb8({ l: 1, c: 0, h: 0 }), { r: 255, g: 255, b: 255 });
  assert.deepEqual(oklchToSrgb8({ l: 0, c: 0, h: 0 }), { r: 0, g: 0, b: 0 });
  // CSS Color 4 reference: oklch(62.8% 0.2577 29.23) is sRGB red.
  const red = oklchToSrgb8({ l: 0.628, c: 0.2577, h: 29.23 });
  near(red.r, 255, 1);
  near(red.g, 0, 1);
  near(red.b, 0, 1);
});

test('parseLightDarkTokens extracts light and dark values per custom property', () => {
  const css = `
    :root {
      --bg: light-dark(oklch(97% 0.01 85), oklch(17% 0.012 160));
      --space-1: 0.25rem;
      --text: light-dark(oklch(25% 0.02 60), oklch(92% 0.012 90));
    }`;
  const tokens = parseLightDarkTokens(css);
  assert.deepEqual(tokens.get('--bg'), {
    light: { l: 0.97, c: 0.01, h: 85 },
    dark: { l: 0.17, c: 0.012, h: 160 },
  });
  assert.equal(tokens.size, 2);
});
