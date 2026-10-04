// @ts-check
import { defineConfig, passthroughImageService } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const site = 'https://terribleturtles.dev';

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
  integrations: [
    sitemap({
      filter: (page) => !/\/404\/?$/.test(new URL(page).pathname),
    }),
  ],
});