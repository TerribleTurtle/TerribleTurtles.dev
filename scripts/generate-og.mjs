// @ts-check
/**
 * Render public/og.png (1200×630) from a local HTML template with Playwright.
 * Colours are resolved from src/styles/tokens.css (dark scheme); fonts are the
 * committed woff2 files, embedded as data URLs so the render is fully offline.
 * The template's inline styles exist only inside this build-time renderer and
 * never ship to the site.
 *
 * Usage: node scripts/generate-og.mjs
 */
import { chromium } from '@playwright/test';
import { readFileSync, statSync } from 'node:fs';
import { paletteHex, scutePolygons } from './lib/palette.mjs';

const OUT = 'public/og.png';
const c = paletteHex('dark');

/** @param {string} file */
const fontUrl = (file) => `data:font/woff2;base64,${readFileSync(`public/fonts/${file}`).toString('base64')}`;

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
@font-face { font-family: Newsreader; font-weight: 200 800; src: url(${fontUrl('newsreader-latin-wght-normal.woff2')}) format("woff2"); }
@font-face { font-family: "Instrument Sans"; font-weight: 400 700; src: url(${fontUrl('instrument-sans-latin-wght-normal.woff2')}) format("woff2"); }
* { box-sizing: border-box; margin: 0; }
body { width: 1200px; height: 630px; background: ${c.bg}; color: ${c.text}; font-family: "Instrument Sans"; padding: 88px 96px; display: flex; flex-direction: column; }
.brand { display: flex; align-items: center; gap: 22px; font-size: 38px; font-weight: 500; letter-spacing: -0.01em; }
.brand svg { width: 64px; height: 64px; fill: none; stroke: ${c.accent}; stroke-width: 1.25; stroke-linejoin: round; }
h1 { margin-top: auto; font-family: Newsreader; font-weight: 400; font-size: 104px; line-height: 1.05; letter-spacing: -0.01em; }
p { margin-top: 24px; font-size: 36px; color: ${c['text-muted']}; }
.rule { margin-top: 56px; height: 1px; background: ${c.hairline}; }
.foot { margin-top: 22px; font-size: 26px; color: ${c.accent}; }
</style></head><body>
<div class="brand"><svg viewBox="0 0 32 32">${scutePolygons()}</svg>TerribleTurtles</div>
<h1>Things I've built.</h1>
<p>A personal archive.</p>
<div class="rule"></div>
<div class="foot">terribleturtles.dev</div>
</body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  const loaded = await page.evaluate(() =>
    ['400 16px Newsreader', '400 16px "Instrument Sans"'].every((f) => document.fonts.check(f)),
  );
  if (!loaded) throw new Error('Template fonts failed to load.');
  await page.screenshot({ path: OUT, type: 'png' });
} finally {
  await browser.close();
}
console.log(`Wrote ${OUT} (1200×630, ${(statSync(OUT).size / 1024).toFixed(1)} KB)`);
