// @ts-check
/**
 * Proves that public/favicon.svg is derived from tokens.css and geometry without drift.
 * Regenerates the SVG string in memory and fails if public/favicon.svg differs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderFaviconSvg } from '../../scripts/lib/palette.mjs';

test('public/favicon.svg matches generated output from tokens.css (drift check)', () => {
  const committed = readFileSync(fileURLToPath(new URL('../../public/favicon.svg', import.meta.url)), 'utf8');
  const expected = renderFaviconSvg();
  assert.equal(committed, expected);
});

test('favicon drift test fails when stroke colour differs', () => {
  const divergentCss = `:root {
    --palette-ochre-500: oklch(50% 0.1 50);
    --mark-stroke: 1.25;
  }`;
  const divergent = renderFaviconSvg(divergentCss);
  const committed = readFileSync(fileURLToPath(new URL('../../public/favicon.svg', import.meta.url)), 'utf8');
  assert.notEqual(committed, divergent);
});
