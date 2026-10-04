// @ts-check
/**
 * Render raster icons from public/favicon.svg with Playwright (no extra deps):
 * - public/favicon.ico        32×32, transparent, PNG-in-ICO (supported since Windows Vista / all modern browsers)
 * - public/apple-touch-icon.png 180×180 on the carapace background (iOS fills transparency with black)
 *
 * Usage: node scripts/generate-icons.mjs
 */
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { paletteHex, renderFaviconSvg } from './lib/palette.mjs';

// 1. Write public/favicon.svg from tokens.css
const svg = renderFaviconSvg();
writeFileSync('public/favicon.svg', svg, 'utf8');

const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
const dark = paletteHex('dark');

/**
 * Wrap a single PNG in an ICO container (ICONDIR + one ICONDIRENTRY).
 * @param {Buffer} png
 * @param {number} size
 * @returns {Buffer}
 */
function pngToIco(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // image count
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0); // width
  entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
  entry.writeUInt8(0, 2); // palette colours
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8); // image size
  entry.writeUInt32LE(header.length + entry.length, 12); // image offset
  return Buffer.concat([header, entry, png]);
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });

  // favicon.ico — transparent 32×32
  await page.setViewportSize({ width: 32, height: 32 });
  await page.setContent(
    `<html><body style="margin:0;background:transparent"><img src="${svgDataUrl}" width="32" height="32" style="display:block"></body></html>`,
  );
  const favicon = await page.screenshot({ type: 'png', omitBackground: true });
  writeFileSync('public/favicon.ico', pngToIco(favicon, 32));

  // apple-touch-icon.png — 180×180 on the carapace background, mark at ~60%
  await page.setViewportSize({ width: 180, height: 180 });
  await page.setContent(
    `<html><body style="margin:0;width:180px;height:180px;display:grid;place-items:center;background:${dark.bg}"><img src="${svgDataUrl}" width="112" height="112"></body></html>`,
  );
  writeFileSync('public/apple-touch-icon.png', await page.screenshot({ type: 'png' }));
} finally {
  await browser.close();
}

console.log(
  'Wrote public/favicon.svg, public/favicon.ico (32×32 PNG-in-ICO), and public/apple-touch-icon.png (180×180).',
);
