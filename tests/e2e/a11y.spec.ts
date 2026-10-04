import { test, expect, type ConsoleMessage } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility + structure checks for every route, in both colour schemes.
 * Runs against the built site (`astro preview`, see playwright.config.ts).
 */
const NOT_FOUND = '/this-page-does-not-exist/';
const routes = ['/', '/about/', '/privacy/', '/security/', '/work/spellcastersdb/', NOT_FOUND] as const;
const schemes = ['dark', 'light'] as const;
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const colorScheme of schemes) {
  test.describe(`${colorScheme} scheme`, () => {
    test.use({ colorScheme });

    for (const route of routes) {
      test(`axe: ${route} has no WCAG 2.2 AA violations`, async ({ page }) => {
        await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
        await page.goto(route);
        const scheme = await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches);
        expect(scheme).toBe(colorScheme === 'dark');

        const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
        const summary = results.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n) => n.target.join(' ')),
        }));
        expect(summary).toEqual([]);
        // Guard against a vacuous pass: the contrast rule must have evaluated real nodes.
        expect(results.passes.map((rule) => rule.id)).toContain('color-contrast');
      });
    }
  });
}

for (const route of routes) {
  test(`structure: ${route} has one h1, a working skip link and no console errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message: ConsoleMessage) => {
      if (message.type() !== 'error') return;
      // The 404 route legitimately answers 404; Chromium logs that for the document itself.
      const isExpected404 = route === NOT_FOUND && message.text().includes('status of 404');
      if (!isExpected404) errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    const response = await page.goto(route);
    expect(response?.status()).toBe(route === NOT_FOUND ? 404 : 200);

    await expect(page.locator('h1')).toHaveCount(1);

    const skip = page.locator('a.skip-link');
    await expect(skip).toHaveCount(1);
    await expect(skip).toHaveAttribute('href', '#main');
    await expect(page.locator('main#main')).toHaveCount(1);

    // Keyboard: the skip link is the first tab stop and moves focus to <main>.
    await page.keyboard.press('Tab');
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('main#main')).toBeFocused();

    expect(errors).toEqual([]);
  });
}
