// @ts-check
/**
 * Contrast gate: reads `src/styles/tokens.css`, converts every light-dark()
 * colour token to 8-bit sRGB and checks WCAG 2.x contrast for the pairs the
 * site actually uses, in both colour schemes. Exits 1 if any pair fails.
 *
 * Usage: node scripts/check-contrast.mjs [path/to/tokens.css]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  contrastRatio,
  oklchToSrgb8,
  parseLightDarkTokens,
  parsePrefersContrastMoreTokens,
} from './lib/color.mjs';

/** @typedef {'text' | 'ui' | 'decorative'} PairKind */
/** @typedef {{ fg: string, bg: string, kind: PairKind, use: string }} Pair */

/** Minimum ratio per kind (WCAG 1.4.3 text, 1.4.11 non-text). Decorative = report only. */
const MINIMUM = /** @type {const} */ ({ text: 4.5, ui: 3, decorative: 0 });

/**
 * Tokens explicitly documented as decorative with an architectural reason.
 * @type {ReadonlyMap<string, string>}
 */
const DECORATIVE_ALLOWLIST = new Map([
  ['--color-hairline', 'Subtle dividing lines; never used as the sole visual cue for content or state.'],
]);

/** @type {Pair[]} */
const PAIRS = [
  { fg: '--color-text', bg: '--color-bg', kind: 'text', use: 'body text' },
  { fg: '--color-text', bg: '--color-surface', kind: 'text', use: 'text on surface' },
  { fg: '--color-text-muted', bg: '--color-bg', kind: 'text', use: 'summaries, meta' },
  { fg: '--color-text-muted', bg: '--color-surface', kind: 'text', use: 'muted on surface' },
  { fg: '--color-accent', bg: '--color-bg', kind: 'text', use: 'links' },
  { fg: '--color-accent', bg: '--color-surface', kind: 'text', use: 'links on surface' },
  { fg: '--color-accent', bg: '--color-bg', kind: 'ui', use: 'focus ring, status dot, mark' },
  { fg: '--color-accent', bg: '--color-surface', kind: 'ui', use: 'focus ring on surface' },
  { fg: '--color-hairline', bg: '--color-bg', kind: 'decorative', use: 'list dividers' },
];

const tokensPath = process.argv[2] ?? fileURLToPath(new URL('../src/styles/tokens.css', import.meta.url));
const cssText = readFileSync(tokensPath, 'utf8');
const tokens = parseLightDarkTokens(cssText);
const moreOverrides = parsePrefersContrastMoreTokens(cssText);

// Check coverage: every defined semantic --color-* token must be tested in at least one pair
// unless explicitly permitted in DECORATIVE_ALLOWLIST.
const definedSemanticTokens = new Set();
for (const match of cssText.matchAll(/(--color-[\w-]+)\s*:/g)) {
  definedSemanticTokens.add(match[1]);
}
const testedTokens = new Set(PAIRS.flatMap((p) => [p.fg, p.bg]));
const untested = [...definedSemanticTokens].filter((t) => !testedTokens.has(t) && !DECORATIVE_ALLOWLIST.has(t));
if (untested.length > 0) {
  console.error(`Untested semantic colour token(s) found in tokens.css: ${untested.join(', ')}`);
  process.exit(1);
}

let failures = 0;

// 1. Default scheme pairs
for (const scheme of /** @type {const} */ (['dark', 'light'])) {
  console.log(`\n${scheme}`);
  for (const pair of PAIRS) {
    const fg = tokens.get(pair.fg);
    const bg = tokens.get(pair.bg);
    if (!fg || !bg) {
      throw new Error(`Missing light-dark() token: ${!fg ? pair.fg : pair.bg}`);
    }
    const ratio = contrastRatio(oklchToSrgb8(fg[scheme]), oklchToSrgb8(bg[scheme]));
    const min = MINIMUM[pair.kind];
    const ok = ratio >= min;
    if (!ok) failures += 1;
    const verdict = pair.kind === 'decorative' ? 'info' : ok ? 'pass' : 'FAIL';
    console.log(
      `  ${verdict.padEnd(4)} ${ratio.toFixed(2).padStart(5)}:1  ${pair.fg} on ${pair.bg}  [${pair.kind}${min ? ` ≥ ${min}` : ''}] ${pair.use}`,
    );
  }
}

// 2. High-contrast overrides (prefers-contrast: more)
const moreTokens = new Map(tokens);
for (const [key, value] of moreOverrides) {
  moreTokens.set(key, value);
}

for (const scheme of /** @type {const} */ (['dark', 'light'])) {
  console.log(`\nprefers-contrast: more (${scheme})`);
  for (const pair of PAIRS) {
    const fg = moreTokens.get(pair.fg);
    const bg = moreTokens.get(pair.bg);
    if (!fg || !bg) {
      throw new Error(`Missing token under prefers-contrast: more: ${!fg ? pair.fg : pair.bg}`);
    }
    const ratio = contrastRatio(oklchToSrgb8(fg[scheme]), oklchToSrgb8(bg[scheme]));
    let min = /** @type {number} */ (MINIMUM[pair.kind]);
    let label = /** @type {string} */ (pair.kind);
    if (pair.fg === '--color-text-muted' && pair.bg === '--color-bg') {
      min = 7;
      label = 'text ≥ 7';
    } else if (pair.fg === '--color-hairline' && pair.bg === '--color-bg') {
      min = 3;
      label = 'ui ≥ 3';
    }
    const ok = ratio >= min;
    if (!ok) failures += 1;
    const verdict = ok ? 'pass' : 'FAIL';
    console.log(
      `  ${verdict.padEnd(4)} ${ratio.toFixed(2).padStart(5)}:1  ${pair.fg} on ${pair.bg}  [${label}] ${pair.use}`,
    );
  }
}

if (failures > 0) {
  console.error(`\n${failures} contrast pair(s) below the WCAG minimum.`);
  process.exit(1);
}
console.log('\nAll contrast pairs meet WCAG 2.2 AA.');
