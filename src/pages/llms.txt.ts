import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

const PAGES = `## Pages

- [About](https://terribleturtles.dev/about/): Who runs this site and how to get in touch.
- [Privacy](https://terribleturtles.dev/privacy/): What data this site does and doesn't collect.
- [Security](https://terribleturtles.dev/security/): How to report a security issue.
`;

export const GET: APIRoute = async (context) => {
  const site = context.site ?? new URL('https://terribleturtles.dev');
  const projects = await getCollection('projects');
  projects.sort((a, b) => a.data.order - b.data.order);

  const projectLines = projects.map((p) => {
    const url = new URL(`/work/${p.id}/`, site).toString();
    return `- [${p.data.title}](${url}): ${p.data.summary}`;
  });

  const text = `# TerribleTurtles

> A personal archive of things I've built.

This is where I keep the things I've built. It's a static site; each project page links to the live site and its source code.

## Projects

${projectLines.join('\n')}

${PAGES}`;

  return new Response(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
