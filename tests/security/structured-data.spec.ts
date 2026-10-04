import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { policy } from './helpers';

interface GraphNode {
  '@type'?: string;
  '@id'?: string;
  codeRepository?: string;
  mainEntity?: { '@id'?: string };
}

interface LdJsonDocument {
  '@context'?: string;
  '@graph'?: GraphNode[];
}

const htmlRoutes = policy.routes.filter((r) => r.class === 'html' || r.class === 'not-found');

test.describe('Structured data and social preview cards', () => {
  for (const route of htmlRoutes) {
    for (const path of route.paths) {
      test(`${path} has exactly one valid ld+json block that parses`, async ({ page }) => {
        await page.goto(path);
        const scripts = page.locator('script[type="application/ld+json"]');
        await expect(scripts).toHaveCount(1);
        const content = (await scripts.textContent()) ?? '';
        expect(content.trim().length).toBeGreaterThan(0);

        let parsed: LdJsonDocument | undefined;
        expect(() => {
          parsed = JSON.parse(content);
        }).not.toThrow();

        expect(parsed?.['@context']).toBe('https://schema.org');
        expect(Array.isArray(parsed?.['@graph'])).toBe(true);
      });
    }
  }

  test('/about/ graph contains a ProfilePage whose mainEntity @id equals the Person @id', async ({ page }) => {
    await page.goto('/about/');
    const content = (await page.locator('script[type="application/ld+json"]').textContent()) ?? '';
    const parsed: LdJsonDocument = JSON.parse(content);
    const graph = parsed['@graph'] ?? [];

    const person = graph.find((node) => node['@type'] === 'Person');
    expect(person).toBeDefined();
    expect(person?.['@id']).toBe('https://terribleturtles.dev/#person');

    const profile = graph.find((node) => node['@type'] === 'ProfilePage');
    expect(profile).toBeDefined();
    expect(profile?.mainEntity?.['@id']).toBe(person?.['@id']);
  });

  const projects = policy.pages.expanded
    .filter((p) => p.kind === 'project' && p.id !== undefined)
    .map((p) => {
      const id = p.id!;
      const mdPath = new URL(`../../src/content/projects/${id}.md`, import.meta.url);
      const md = readFileSync(mdPath, 'utf8');
      const repoMatch = md.match(/^repo:\s*["']?([^"'\r\n]+)["']?/m);
      const repo = repoMatch ? repoMatch[1].trim() : undefined;
      const ogPath = p.locale === policy.pages.defaultLocale ? `/og/${id}.png` : `/og/${p.locale}/${id}.png`;
      return { path: p.path, id, repo, ogPath };
    });

  for (const { path, repo, ogPath } of projects) {
    test(`${path} graph contains SoftwareSourceCode and BreadcrumbList, and valid og:image`, async ({
      page,
      request,
    }) => {
      await page.goto(path);
      const content = (await page.locator('script[type="application/ld+json"]').textContent()) ?? '';
      const parsed: LdJsonDocument = JSON.parse(content);
      const graph = parsed['@graph'] ?? [];

      const software = graph.find((node) => node['@type'] === 'SoftwareSourceCode');
      expect(software).toBeDefined();
      expect(software?.codeRepository).toBe(repo);

      const breadcrumb = graph.find((node) => node['@type'] === 'BreadcrumbList');
      expect(breadcrumb).toBeDefined();

      const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
      expect(ogImage).toBeTruthy();
      expect(ogImage?.endsWith(ogPath)).toBe(true);

      const ogResponse = await request.get(ogPath);
      expect(ogResponse.status()).toBe(200);
      expect(ogResponse.headers()['content-type']).toContain('image/png');
    });
  }
});
