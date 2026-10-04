// @ts-check
/**
 * Capture a project screenshot with Playwright (Chromium) as a JPEG.
 *
 * Usage:
 *   node scripts/capture-screenshot.mjs <url> <out.jpg> [width=1440] [height=900] [quality=80]
 * Example:
 *   node scripts/capture-screenshot.mjs https://www.spellcastersdb.com/ public/images/work/spellcastersdb.jpg
 *
 * Device scale 1, viewport-only (not full page), reduced motion, dark scheme.
 * Prints the output size; warns if it is over 250 KB so quality can be lowered.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, statSync } from 'node:fs';
import { dirname } from 'node:path';

const MAX_BYTES = 250 * 1024;

/**
 * @param {string | undefined} value
 * @param {number} fallback
 * @param {string} name
 * @returns {number}
 */
function intArg(value, fallback, name) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer, got "${value}"`);
  }
  return parsed;
}

const [url, out, widthArg, heightArg, qualityArg] = process.argv.slice(2);
if (!url || !out) {
  console.error('Usage: node scripts/capture-screenshot.mjs <url> <out.jpg> [width] [height] [quality]');
  process.exit(2);
}
const target = new URL(url);
if (target.protocol !== 'https:') {
  throw new Error(`Refusing non-HTTPS URL: ${target.href}`);
}
const width = intArg(widthArg, 1440, 'width');
const height = intArg(heightArg, 900, 'height');
const quality = intArg(qualityArg, 80, 'quality');

const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto(target.href, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  mkdirSync(dirname(out), { recursive: true });
  await page.screenshot({ path: out, type: 'jpeg', quality });
} finally {
  await browser.close();
}

const bytes = statSync(out).size;
console.log(`Saved ${out}: ${width}x${height}, quality ${quality}, ${(bytes / 1024).toFixed(1)} KB`);
if (bytes > MAX_BYTES) {
  console.warn(`Warning: over ${MAX_BYTES / 1024} KB. Re-run with a lower quality.`);
  process.exitCode = 1;
}
