// @ts-check
import { defineConfig, passthroughImageService } from 'astro/config';


// https://astro.build/config
export default defineConfig({
  output: 'static',
  build: {
    inlineStylesheets: 'always'
  },
  image: {
    service: passthroughImageService()
  }
});