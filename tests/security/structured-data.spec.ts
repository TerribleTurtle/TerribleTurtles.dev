import { test, expect } from '@playwright/test';
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

  const projects = [
    {
      path: '/work/spellcastersdb/',
      id: 'spellcastersdb',
      repo: 'https://github.com/TerribleTurtle/spellcastersdb',
    },
    {
      path: '/work/spellcasters-community-api/',
      id: 'spellcasters-community-api',
      repo: 'https://github.com/TerribleTurtle/spellcasters-community-api',
    },
  ];

  for (const { path, id, repo } of projects) {
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
      expect(ogImage?.endsWith(`/og/${id}.png`)).toBe(true);

      const ogPath = `/og/${id}.png`;
      const ogResponse = await request.get(ogPath);
      expect(ogResponse.status()).toBe(200);
      expect(ogResponse.headers()['content-type']).toContain('image/png');
    });
  }
});
