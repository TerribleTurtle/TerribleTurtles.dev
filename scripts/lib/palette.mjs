// @ts-check
/**
 * Resolve the Deep Shell palette from `src/styles/tokens.css` into hex strings
 * for asset-generation scripts (OG image, touch icon). Keeps tokens.css the
 * single source of truth even for raster assets.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { oklchToSrgb8, parseLightDarkTokens, parsePrimitives } from './color.mjs';

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
 * Resolve a named primitive token to a `#rrggbb` hex string.
 * @param {string} name e.g. '--palette-ochre-500'
 * @param {string} [css] optional css override
 * @returns {string} `#rrggbb`
 */
export function primitiveHex(name, css) {
  const content = css ?? readFileSync(tokensPath, 'utf8');
  const primitives = parsePrimitives(content);
  const color = primitives.get(name);
  if (!color) {
    throw new Error(`Primitive token "${name}" not found in tokens.css`);
  }
  const { r, g, b } = oklchToSrgb8(color);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Resolve the stroke width from `--mark-stroke` in tokens.css.
 * @param {string} [css] optional css override
 * @returns {string} stroke width
 */
export function markStrokeWidth(css) {
  const content = css ?? readFileSync(tokensPath, 'utf8');
  const match = /--mark-stroke:\s*([\d.]+)/.exec(content);
  return match ? match[1] : '1.25';
}

/**
 * Render the favicon SVG string from tokens and canonical scute geometry.
 * Stroke width matches the `--mark-stroke` design token (1.25).
 * @param {string} [css] optional css override
 * @returns {string}
 */
export function renderFaviconSvg(css) {
  const stroke = primitiveHex('--palette-ochre-500', css);
  const strokeWidth = markStrokeWidth(css);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"><title>TerribleTurtles</title><polygon points="14.58,2.47 25.35,8.16 29.39,16.47 23.46,24.89 9.71,27.83 4.26,18.49 4.83,9.55"/><polygon points="14.59,8.37 21.26,11.9 23.77,17.05 20.09,22.27 11.57,24.1 8.19,18.31 8.54,12.76"/><polygon points="14.3,14.39 17.21,15.93 18.3,18.17 16.7,20.44 12.99,21.24 11.52,18.72 11.67,16.3"/></svg>\n`;
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
