import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const readmes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/readmes' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    type: z.enum(['tool', 'site']),
    status: z.enum(['active', 'deprecated', 'archived']).default('active'),
  }),
});

export const collections = {
  readmes,
};
