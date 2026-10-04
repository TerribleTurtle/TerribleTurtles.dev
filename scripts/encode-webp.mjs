// @ts-check
/**
 * Convert JPEG images to WebP via Chromium canvas (quality 0.8).
 * Node + Playwright built-ins only; no external imaging dependencies.
 *
 * Usage:
 *   node scripts/encode-webp.mjs [file.jpg]
 * If no file is specified, converts all JPEGs in public/images/work/.
 */
import { chromium } from '@playwright/test';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Loads a JPEG into a Chromium canvas and exports it as WebP at quality 0.8.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} jpegPath
 * @param {string} webpPath
 * @param {number} [quality]
 * @returns {Promise<void>}
 */
export async function encodeWebpFromJpeg(page, jpegPath, webpPath, quality = 0.8) {
  const bytes = readFileSync(jpegPath);
  const dataUrl = `data:image/jpeg;base64,${bytes.toString('base64')}`;
  const webpDataUrl = await page.evaluate(
    async ({ src, q }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get 2d context');
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL('image/webp', q);
    },
    { src: dataUrl, q: quality },
  );
  const base64Data = webpDataUrl.replace(/^data:image\/webp;base64,/, '');
  writeFileSync(webpPath, Buffer.from(base64Data, 'base64'));
}

// If executed as a CLI script:
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'))) {
  const targetArg = process.argv[2];
  /** @type {string[]} */
  const jpgFiles = [];

  if (targetArg) {
    jpgFiles.push(targetArg);
  } else {
    const dir = 'public/images/work';
    for (const f of readdirSync(dir)) {
      if (f.endsWith('.jpg') || f.endsWith('.jpeg')) {
        jpgFiles.push(join(dir, f));
      }
    }
  }

  if (jpgFiles.length === 0) {
    console.log('No JPEG files found to encode.');
    process.exit(0);
  }

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const jpg of jpgFiles) {
      const webp = jpg.replace(/\.jpe?g$/i, '.webp');
      await encodeWebpFromJpeg(page, jpg, webp, 0.8);
      const jpgSize = statSync(jpg).size;
      const webpSize = statSync(webp).size;
      const pct = (((webpSize - jpgSize) / jpgSize) * 100).toFixed(1);
      console.log(
        `Encoded ${webp}: ${(jpgSize / 1024).toFixed(1)} KB (jpg) -> ${(webpSize / 1024).toFixed(1)} KB (webp) (${pct}%)`,
      );
    }
  } finally {
    await browser.close();
  }
}
