import { test, expect } from '@playwright/test';
import { policy, localePath } from '../security/helpers';

const notFoundRoutes = policy.pages.locales.map((locale) =>
  localePath(policy.pages, locale, policy.pages.notFoundProbe),
);
const routes = [...policy.pages.expanded.map((p) => p.path), ...notFoundRoutes];
const widths = [280, 320, 375, 768, 1024, 1440, 2560] as const;

for (const route of routes) {
  test.describe(`reflow: ${route}`, () => {
    for (const width of widths) {
      test(`no horizontal overflow at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(route);
        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
      });
    }

    test('WCAG 1.4.12 text-spacing stress at 320px', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 800 });
      await page.goto(route);
      await page.addStyleTag({
        content:
          '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-block-end: 2em !important; }',
      });
      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(innerWidth);

      const clipped = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('h1, p, li, a'));
        const issues: string[] = [];
        for (const el of elements) {
          if (
            el.classList.contains('visually-hidden') ||
            (el.classList.contains('skip-link') && !el.matches(':focus-visible'))
          ) {
            continue;
          }
          if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth) {
            issues.push(
              `<${el.tagName.toLowerCase()}> text="${el.textContent?.trim().slice(0, 30)}": scrollWidth(${el.scrollWidth}) > clientWidth(${el.clientWidth})`,
            );
          }
        }
        return issues;
      });
      expect(clipped).toEqual([]);
    });

    test('200% text size at 640px', async ({ page }) => {
      await page.setViewportSize({ width: 640, height: 800 });
      await page.goto(route);
      await page.addStyleTag({
        content: 'html { font-size: 200% !important; }',
      });
      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
    });
  });
}
