import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Content source switch (build-time only).
 *
 * `process.env` is read here on purpose: this file runs in Node at build time,
 * and `TT_CONTENT` is non-secret build configuration, not a runtime value.
 * Setting `TT_CONTENT=fixtures` swaps the loader to `tests/fixtures/projects`
 * so E2E tests never depend on (or leak) fixtures in production content.
 * Any other value, or no value, uses the real content.
 */
const useFixtures = process.env.TT_CONTENT === 'fixtures';
const projectsBase = useFixtures ? './tests/fixtures/projects' : './src/content/projects';

const projects = defineCollection({
  loader: glob({ pattern: '*.md', base: projectsBase }),
  schema: z.object({
    title: z.string().min(1),
    /** One line, shown in the work index. */
    summary: z.string().min(1),
    /** Live site. */
    url: z.url(),
    repo: z.url().optional(),
    year: z.number().int(),
    status: z.enum(['live', 'experimental', 'archived']),
    order: z.number().int().default(100),
    disclaimer: z.string().optional(),
    /** Only technologies verified from the project's own repo/manifest. */
    stack: z.array(z.string().min(1)).optional(),
    /** Primary programming languages (from GitHub's languages API); feeds JSON-LD programmingLanguage. */
    languages: z.array(z.string().min(1)).optional(),
    /** Pre-optimised image committed under public/images/work/. */
    screenshot: z
      .object({
        src: z.string().startsWith('/images/work/').optional(),
        alt: z.string().min(1),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      })
      .strict()
      .optional(),
  }).strict(),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z
    .object({
      title: z.string().min(1),
      description: z.string().min(1),
      updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
    })
    .strict(),
});

const projectsI18n = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects-i18n' }),
  schema: z
    .object({
      title: z.string().min(1),
      summary: z.string().min(1),
      disclaimer: z.string().optional(),
      screenshotAlt: z.string().min(1).optional(),
    })
    .strict(),
});

export const collections = {
  projects,
  pages,
  projectsI18n,
};
