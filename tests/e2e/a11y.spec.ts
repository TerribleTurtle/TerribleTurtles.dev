import { test, expect, type ConsoleMessage } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { policy, localePath } from '../security/helpers';

/**
 * Accessibility + structure checks for every route, in both colour schemes.
 * Runs against the built site (`astro preview`, see playwright.config.ts).
 */
const notFoundRoutes = policy.pages.locales.map((locale) => localePath(policy.pages, locale, policy.pages.notFoundProbe));
const notFoundSet = new Set(notFoundRoutes);
const routes = [...policy.pages.expanded.map((p) => p.path), ...notFoundRoutes];
const schemes = ['dark', 'light'] as const;
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const colorScheme of schemes) {
  test.describe(`${colorScheme} scheme`, () => {
    test.use({ colorScheme });
    // Skipped before any browser context exists (a late skip tripped a Playwright/Firefox context-close protocol error).
    test.skip(({ browserName }) => browserName === 'firefox' && colorScheme === 'dark', 'Playwright 1.61 / Firefox 151: colorScheme emulation has no effect; dark is covered in chromium + webkit');

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
  test(`structure: ${route} has one h1, a working skip link and no console errors`, async ({ page, browserName }) => {
    const errors: string[] = [];
    page.on('console', (message: ConsoleMessage) => {
      if (message.type() !== 'error') return;
      // The 404 route legitimately answers 404; Chromium logs that for the document itself.
      const isExpected404 = notFoundSet.has(route) && message.text().includes('status of 404');
      if (!isExpected404) errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    const response = await page.goto(route);
    expect(response?.status()).toBe(notFoundSet.has(route) ? 404 : 200);

    await expect(page.locator('h1')).toHaveCount(1);

    const skip = page.locator('a.skip-link');
    await expect(skip).toHaveCount(1);
    await expect(skip).toHaveAttribute('href', '#main');
    await expect(page.locator('main#main')).toHaveCount(1);

    // Keyboard: the skip link is the first tab stop and moves focus to <main>.
    if (browserName === 'webkit') {
      // Playwright's Windows WebKit never moves focus on Tab or Alt+Tab (activeElement stays <body>; verified with a
      // scratch diagnostic). Real keyboard order is proven in chromium + firefox; here assert it is first in focus order.
      const firstFocusable = await page.evaluate(() => document.querySelector('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')?.className ?? '');
      expect(firstFocusable).toBe('skip-link');
      await skip.focus();
    } else {
      await page.keyboard.press('Tab');
    }
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('main#main')).toBeFocused();

    expect(errors).toEqual([]);
  });
}

for (const route of routes) {
  test(`tab-order: ${route} visits every visible link in DOM order with focus outline`, async ({ page, browserName }) => {
    test.skip(
      browserName === 'webkit',
      'Playwright Windows WebKit does not move focus on Tab; verified in chromium + firefox',
    );

    await page.goto(route);

    const linkCount = await page.evaluate(() => document.querySelectorAll('a[href]').length);
    expect(linkCount).toBeGreaterThan(0);

    const visitedIndices: number[] = [];
    let returnedToEndTarget = false;

    for (let step = 0; step < linkCount + 5; step++) {
      await page.keyboard.press('Tab');

      const info = await page.evaluate(() => {
        const active = document.activeElement;
        if (!active) {
          return { isBody: false, isSkipLink: false, linkIndex: -1, outlineStyle: 'none', outlineWidth: 0 };
        }
        const links = Array.from(document.querySelectorAll('a[href]'));
        const linkIndex = links.indexOf(active as HTMLAnchorElement);
        const style = window.getComputedStyle(active);
        const outlineWidthPx = parseFloat(style.outlineWidth) || 0;
        return {
          isBody: active === document.body,
          isSkipLink: active.classList.contains('skip-link'),
          linkIndex,
          outlineStyle: style.outlineStyle,
          outlineWidth: outlineWidthPx,
        };
      });

      if (info.linkIndex !== -1) {
        expect(
          info.outlineStyle !== 'none' && info.outlineWidth > 0,
          `link at index ${info.linkIndex} must have a visible focus outline`,
        ).toBe(true);

        if (visitedIndices.length < linkCount) {
          visitedIndices.push(info.linkIndex);
        } else if (info.isSkipLink) {
          returnedToEndTarget = true;
          break;
        }
      } else if (info.isBody) {
        returnedToEndTarget = true;
        break;
      }
    }

    const expectedIndices = Array.from({ length: linkCount }, (_, i) => i);
    expect(visitedIndices).toEqual(expectedIndices);

    if (browserName === 'chromium') {
      expect(returnedToEndTarget, 'focus must return to body or skip link at end').toBe(true);
    } else {
      // In headless Firefox on Windows, pressing Tab at the document boundary does not wrap without browser chrome.
      // Confirm there is no keyboard trap by verifying Shift+Tab moves focus backward to the preceding link.
      await page.keyboard.press('Shift+Tab');
      const prevIndex = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href]'));
        return links.indexOf(document.activeElement as HTMLAnchorElement);
      });
      expect(prevIndex).toBe(linkCount - 2);
    }
  });
}

test.describe('forced-colors mode', () => {
  for (const route of routes) {
    test(`axe: ${route} has no violations with forcedColors active`, async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'forced-colors axe checks run in chromium');
      await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
      await page.goto(route);
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      const summary = results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target.join(' ')),
      }));
      expect(summary).toEqual([]);
    });
  }
});

