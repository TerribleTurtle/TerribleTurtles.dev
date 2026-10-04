// @ts-check
/**
 * Resolve the Deep Shell palette from `src/styles/tokens.css` into hex strings
 * for asset-generation scripts (OG image, touch icon). Keeps tokens.css the
 * single source of truth even for raster assets.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { oklchToSrgb8, parseLightDarkTokens } from './color.mjs';

const tokensPath = fileURLToPath(new URL('../../src/styles/tokens.css', import.meta.url));

/**
 * @param {'light' | 'dark'} scheme
 * @returns {Record<string, string>} token name (without `--color-`) → `#rrggbb`
 */
export function paletteHex(scheme) {
  const tokens = parseLightDarkTokens(readFileSync(tokensPath, 'utf8'));
  /** @type {Record<string, string>} */
  const out = {};
  for (const [name, pair] of tokens) {
    const { r, g, b } = oklchToSrgb8(pair[scheme]);
    out[name.replace(/^--color-/, '')] = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  }
  return out;
}

/**
 * The scute mark polygons, read from the committed favicon so every asset
 * uses identical geometry.
 * @returns {string} the inner `<polygon .../>` markup
 */
export function scutePolygons() {
  const svg = readFileSync(fileURLToPath(new URL('../../public/favicon.svg', import.meta.url)), 'utf8');
  const polygons = svg.match(/<polygon [^>]*\/>/g);
  if (!polygons || polygons.length === 0) {
    throw new Error('public/favicon.svg contains no <polygon> elements.');
  }
  return polygons.join('');
}
