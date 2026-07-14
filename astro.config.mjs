// @ts-check
import { defineConfig, passthroughImageService } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://terribleturtles.dev',
  output: 'static',
  build: {
    inlineStylesheets: 'always'
  },
  image: {
    service: passthroughImageService()
  },
  integrations: [sitemap()]
});