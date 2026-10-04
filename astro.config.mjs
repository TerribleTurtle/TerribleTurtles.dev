// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig, passthroughImageService } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const site = 'https://terribleturtles.dev';

// The locale list is owned by security/policy.json (`pages`), so pages, tests, coverage and
// Astro's i18n can never disagree. src/i18n/locales.ts adds labels and fails the build on drift.
/** @type {{ pages: { defaultLocale: string, locales: string[] } }} */
const policy = JSON.parse(readFileSync(new URL('./security/policy.json', import.meta.url), 'utf8'));
const { defaultLocale, locales } = policy.pages;

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
    sitemap({
      filter: (page) => !/\/404\/?$/.test(new URL(page).pathname),
      i18n: { defaultLocale, locales: Object.fromEntries(locales.map((l) => [l, l])) },
    }),
  ],
});