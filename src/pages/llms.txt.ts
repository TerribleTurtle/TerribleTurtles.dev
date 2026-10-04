import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import policy from '../../security/policy.json';
import { defaultLocale } from '../i18n/locales';

export const GET: APIRoute = async (context) => {
  const site = context.site;
  if (!site) throw new Error('`site` must be set in astro.config.mjs');
  const projects = await getCollection('projects');
  projects.sort((a, b) => a.data.order - b.data.order);

  const projectLines = projects.map((p) => {
    const url = new URL(`/work/${p.id}/`, site).toString();
    return `- [${p.data.title}](${url}): ${p.data.summary}`;
  });

  const allPages = await getCollection('pages');
  const pagesBySlug = new Map(
    allPages
      .filter((p) => p.id.startsWith(`${defaultLocale}/`))
      .map((p) => [p.id.slice(defaultLocale.length + 1), p]),
  );

  const pageEntries = policy.pages.entries.filter((entry) => entry.kind === 'page');
  const pageLines = pageEntries.map((entry) => {
    const slug = entry.path.replace(/^\/|\/$/g, '');
    const page = pagesBySlug.get(slug);
    if (!page) {
      throw new Error(`Missing page content for ${defaultLocale}/${slug}`);
    }
    const url = new URL(entry.path, site).toString();
    return `- [${page.data.title}](${url}): ${page.data.description}`;
  });

  const text = `# TerribleTurtles

> A personal archive of things I've built.

This is where I keep the things I've built. It's a static site; each project page links to the live site and its source code.

## Projects

${projectLines.join('\n')}

## Pages

${pageLines.join('\n')}
`;

  return new Response(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
