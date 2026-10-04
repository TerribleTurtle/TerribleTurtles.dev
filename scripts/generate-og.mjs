// @ts-check
/**
 * Render social preview images (1200×630) from a local HTML template with Playwright.
 * - public/og.png (site default)
 * - public/og/<project-id>.png (per project in src/content/projects)
 *
 * Colours are resolved from src/styles/tokens.css (dark scheme); fonts are the
 * committed woff2 files, embedded as data URLs so the render is fully offline.
 * The template's inline styles exist only inside this build-time renderer and
 * never ship to the site.
 *
 * Usage: node scripts/generate-og.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { paletteHex, scutePolygons } from './lib/palette.mjs';
import { loadPolicy } from './lib/policy.mjs';

const c = paletteHex('dark');

/** @param {string} file */
const fontUrl = (file) => `data:font/woff2;base64,${readFileSync(`public/fonts/${file}`).toString('base64')}`;

/**
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {string} markdown
 * @returns {{ title: string, summary: string }}
 */
function parseFrontmatter(markdown) {
  const titleMatch = /^title:\s*["']?([^"'\r\n]+)["']?\s*$/m.exec(markdown);
  const summaryMatch = /^summary:\s*["']?([^"'\r\n]+)["']?\s*$/m.exec(markdown);
  if (!titleMatch || !summaryMatch) {
    throw new Error('Could not parse title or summary from frontmatter');
  }
  return { title: titleMatch[1].trim(), summary: summaryMatch[1].trim() };
}

/**
 * @param {string} title
 * @param {string} summary
 * @param {number} [titleSize]
 * @returns {string}
 */
function renderHtml(title, summary, titleSize = 88) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
@font-face { font-family: Newsreader; font-weight: 200 800; src: url(${fontUrl('newsreader-latin-wght-normal.woff2')}) format("woff2"); }
@font-face { font-family: "Instrument Sans"; font-weight: 400 700; src: url(${fontUrl('instrument-sans-latin-wght-normal.woff2')}) format("woff2"); }
* { box-sizing: border-box; margin: 0; }
body { width: 1200px; height: 630px; background: ${c.bg}; color: ${c.text}; font-family: "Instrument Sans"; padding: 88px 96px; display: flex; flex-direction: column; }
.brand { display: flex; align-items: center; gap: 22px; font-size: 38px; font-weight: 500; letter-spacing: -0.01em; }
.brand svg { width: 64px; height: 64px; fill: none; stroke: ${c.accent}; stroke-width: 1.25; stroke-linejoin: round; }
h1 { margin-top: auto; font-family: Newsreader; font-weight: 400; font-size: ${titleSize}px; line-height: 1.05; letter-spacing: -0.01em; }
p { margin-top: 24px; font-size: 34px; color: ${c['text-muted']}; line-height: 1.25; }
.rule { margin-top: 48px; height: 1px; background: ${c.hairline}; }
.foot { margin-top: 22px; font-size: 26px; color: ${c.accent}; }
</style></head><body>
<div class="brand"><svg viewBox="0 0 32 32">${scutePolygons()}</svg>TerribleTurtles</div>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(summary)}</p>
<div class="rule"></div>
<div class="foot">terribleturtles.dev</div>
</body></html>`;
}

/** @type {{ out: string, title: string, summary: string, titleSize: number }[]} */
const cards = [
  {
    out: 'public/og.png',
    title: "Things I've built.",
    summary: 'A personal archive.',
    titleSize: 104,
  },
];

const projectsDir = 'src/content/projects';
for (const entry of readdirSync(projectsDir)) {
  if (entry.endsWith('.md')) {
    const id = basename(entry, extname(entry));
    const content = readFileSync(`${projectsDir}/${entry}`, 'utf8');
    const { title, summary } = parseFrontmatter(content);
    cards.push({
      out: `public/og/${id}.png`,
      title,
      summary,
      titleSize: 84,
    });
  }
}

// One card per translated project, for every non-default locale in the policy.
const { pages } = loadPolicy();
for (const locale of pages.locales.filter((l) => l !== pages.defaultLocale)) {
  const dir = `src/content/projects-i18n/${locale}`;
  mkdirSync(`public/og/${locale}`, { recursive: true });
  for (const entry of readdirSync(dir)) {
    if (entry.endsWith('.md')) {
      const id = basename(entry, extname(entry));
      const { title, summary } = parseFrontmatter(readFileSync(`${dir}/${entry}`, 'utf8'));
      cards.push({
        out: `public/og/${locale}/${id}.png`,
        title,
        summary,
        titleSize: 84,
      });
    }
  }
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const card of cards) {
    await page.setContent(renderHtml(card.title, card.summary, card.titleSize));
    await page.evaluate(() => document.fonts.ready);
    const loaded = await page.evaluate(() =>
      ['400 16px Newsreader', '400 16px "Instrument Sans"'].every((f) => document.fonts.check(f)),
    );
    if (!loaded) throw new Error(`Template fonts failed to load for ${card.out}.`);
    await page.screenshot({ path: card.out, type: 'png' });
    console.log(`Wrote ${card.out} (1200×630, ${(statSync(card.out).size / 1024).toFixed(1)} KB)`);
  }
} finally {
  await browser.close();
}
