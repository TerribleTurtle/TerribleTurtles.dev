// @ts-check
import { defineConfig, passthroughImageService } from 'astro/config';


// https://astro.build/config
export default defineConfig({
  output: 'static',
  image: {
    service: passthroughImageService()
  }
});