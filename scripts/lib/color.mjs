// @ts-check
/**
 * Colour math for the contrast gate (Node built-ins only).
 *
 * OKLCH → OKLab → linear sRGB uses Björn Ottosson's published matrices.
 * Values are gamut-clipped and quantised to 8 bits, matching what a browser
 * paints and what axe-core measures. Luminance and contrast follow WCAG 2.x.
 */

/** @typedef {{ l: number, c: number, h: number }} Oklch  l in 0..1, c chroma, h degrees */
/** @typedef {{ r: number, g: number, b: number }} Rgb8   integer channels 0..255 */
/** @typedef {{ light: Oklch, dark: Oklch }} SchemePair */

const OKLCH_RE = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*\)$/;

/**
 * Parse a CSS `oklch(L C H)` string (no alpha, no `none`).
 * @param {string} input
 * @returns {Oklch}
 */
export function parseOklch(input) {
  const match = OKLCH_RE.exec(input.trim());
  if (!match) {
    throw new Error(`Not a plain oklch() value: "${input}"`);
  }
  const [, lightness, percent, chroma, hue] = match;
  const l = Number(lightness) / (percent === '%' ? 100 : 1);
  return { l: Number(l.toFixed(6)), c: Number(chroma), h: Number(hue) };
}

/**
 * @param {number} linear linear-light channel
 * @returns {number} 8-bit gamma-encoded channel (clipped)
 */
function encode8(linear) {
  const clipped = Math.min(1, Math.max(0, linear));
  const encoded = clipped <= 0.0031308 ? 12.92 * clipped : 1.055 * clipped ** (1 / 2.4) - 0.055;
  return Math.round(encoded * 255);
}

/**
 * @param {Oklch} color
 * @returns {Rgb8}
 */
export function oklchToSrgb8({ l, c, h }) {
  const hueRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hueRad);
  const b = c * Math.sin(hueRad);

  const lPrime = l + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = l - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = l - 0.0894841775 * a - 1.291485548 * b;
  const lms = [lPrime ** 3, mPrime ** 3, sPrime ** 3];
  const [L, M, S] = lms;

  return {
    r: encode8(4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S),
    g: encode8(-1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S),
    b: encode8(-0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S),
  };
}

/**
 * @param {number} channel8
 * @returns {number}
 */
function decode(channel8) {
  const v = channel8 / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/**
 * WCAG 2.x relative luminance.
 * @param {Rgb8} rgb
 * @returns {number}
 */
export function relativeLuminance({ r, g, b }) {
  return 0.2126 * decode(r) + 0.7152 * decode(g) + 0.0722 * decode(b);
}

/**
 * WCAG 2.x contrast ratio, rounded to 2 decimals.
 * @param {Rgb8} first
 * @param {Rgb8} second
 * @returns {number}
 */
export function contrastRatio(first, second) {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return Math.round(ratio * 100) / 100;
}

const PRIMITIVE_RE = /(--palette-[\w-]+)\s*:\s*(oklch\([^)]*\))/g;
const LIGHT_DARK_RE =
  /(--[\w-]+)\s*:\s*light-dark\(\s*(oklch\([^)]*\)|var\([^)]*\))\s*,\s*(oklch\([^)]*\)|var\([^)]*\))\s*\)/g;

/**
 * Extract primitive `--palette-*` custom property declarations.
 * @param {string} css
 * @returns {Map<string, Oklch>}
 */
export function parsePrimitives(css) {
  /** @type {Map<string, Oklch>} */
  const primitives = new Map();
  for (const [, name, val] of css.matchAll(PRIMITIVE_RE)) {
    if (name !== undefined && val !== undefined) {
      primitives.set(name, parseOklch(val));
    }
  }
  return primitives;
}

/**
 * Resolve a color value that is an `oklch(...)` expression or a `var(--...)` reference.
 * @param {string} val
 * @param {Map<string, Oklch>} primitives
 * @returns {Oklch}
 */
export function resolveColorValue(val, primitives) {
  const trimmed = val.trim();
  if (trimmed.startsWith('var(')) {
    const varMatch = /^var\(\s*(--[\w-]+)\s*\)$/.exec(trimmed);
    if (!varMatch || !varMatch[1]) {
      throw new Error(`Malformed var() expression: "${trimmed}"`);
    }
    const color = primitives.get(varMatch[1]);
    if (!color) {
      throw new Error(`Unresolved primitive token: "${varMatch[1]}"`);
    }
    return color;
  }
  return parseOklch(trimmed);
}

/**
 * Extract every `--token: light-dark(...)` declaration, resolving `var(--palette-...)`
 * references against defined primitives in the same stylesheet.
 * @param {string} css
 * @returns {Map<string, SchemePair>}
 */
export function parseLightDarkTokens(css) {
  const primitives = parsePrimitives(css);
  /** @type {Map<string, SchemePair>} */
  const tokens = new Map();
  for (const [, name, light, dark] of css.matchAll(LIGHT_DARK_RE)) {
    if (name === undefined || light === undefined || dark === undefined) {
      continue;
    }
    tokens.set(name, {
      light: resolveColorValue(light, primitives),
      dark: resolveColorValue(dark, primitives),
    });
  }
  return tokens;
}

