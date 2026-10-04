// @ts-check
import { existsSync, readFileSync, renameSync, rmdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, passthroughImageService } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const site = 'https://terribleturtles.dev';

// The locale list is owned by security/policy.json (`pages`), so pages, tests, coverage and
// Astro's i18n can never disagree. src/i18n/locales.ts adds labels and fails the build on drift.
/** @type {{ pages: { defaultLocale: string, locales: string[] } }} */
const policy = JSON.parse(readFileSync(new URL('./security/policy.json', import.meta.url), 'utf8'));
const { defaultLocale, locales } = policy.pages;

/**
 * Astro's `directory` format emits `<locale>/404/index.html`, but Workers Static Assets looks for the
 * nearest `404.html` file. After the build, move each non-default locale's 404 to `<locale>/404.html`.
 * Fails the build if an expected 404 page is missing.
 * @returns {import('astro').AstroIntegration}
 */
function flatLocale404() {
  return {
    name: 'flat-locale-404',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        for (const locale of locales.filter((l) => l !== defaultLocale)) {
          const from = new URL(`${locale}/404/index.html`, dir);
          const to = new URL(`${locale}/404.html`, dir);
          if (!existsSync(from)) throw new Error(`flat-locale-404: missing ${fileURLToPath(from)}`);
          renameSync(from, to);
          rmdirSync(new URL(`${locale}/404/`, dir));
          logger.info(`moved ${locale}/404/index.html -> ${locale}/404.html`);
        }
      },
    },
  };
}

// https://astro.build/config
export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // External stylesheets only, so the CSP can use `style-src 'self'` without 'unsafe-inline'.
    inlineStylesheets: 'never',
  },
  image: {
    service: passthroughImageService(),
  },
  i18n: {
    defaultLocale,
    locales,
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    flatLocale404(),
    sitemap({
      filter: (page) => !/\/404\/?$/.test(new URL(page).pathname),
      i18n: { defaultLocale, locales: Object.fromEntries(locales.map((l) => [l, l])) },
    }),
  ],
});