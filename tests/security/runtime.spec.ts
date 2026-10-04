import { test, expect, type ConsoleMessage } from '@playwright/test';
import { policy, recordViolations, violations } from './helpers';

/**
 * Runtime hygiene on every real page, in all 3 engines and both colour schemes, under production headers:
 * 0 CSP violations, 0 console errors/warnings, 0 cookies, empty Web Storage, only same-origin requests,
 * a parseable ld+json block, and (anti-vacuity) the site's own CSS and fonts really applied.
 */
const htmlRoutes = policy.routes.filter((r) => r.class === 'html' || r.class === 'not-found');
const schemes = ['dark', 'light'] as const;

for (const colorScheme of schemes) {
  for (const route of htmlRoutes) {
    for (const path of route.paths) {
      test(`${path} [${colorScheme}] runs clean under the production policy`, async ({ page, context, baseURL }) => {
        const origin = new URL(baseURL ?? '').origin;
        const consoleProblems: string[] = [];
        const requests: string[] = [];
        page.on('console', (message: ConsoleMessage) => {
          if (message.type() !== 'error' && message.type() !== 'warning') return;
          // The 404 route answers 404 on purpose; Chromium and WebKit log that status for the document itself.
          if (route.status === 404 && /status of 404/.test(message.text())) return;
          consoleProblems.push(`${message.type()}: ${message.text()}`);
        });
        page.on('pageerror', (error) => consoleProblems.push(`pageerror: ${error.message}`));
        page.on('request', (request) => requests.push(request.url()));
        await recordViolations(page);
        await page.emulateMedia({ colorScheme });

        const response = await page.goto(path, { waitUntil: 'load' });
        expect(response?.status()).toBe(route.status);
        expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(colorScheme === 'dark');
        await page.evaluate(() => document.fonts.ready.then(() => undefined));
        await page.waitForLoadState('networkidle');

        // Anti-vacuity: the strict policy must not have broken the site itself.
        const applied = await page.evaluate(() => ({
          sheets: document.styleSheets.length,
          bodyFont: getComputedStyle(document.body).fontFamily,
          loadedFonts: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')),
        }));
        expect(applied.sheets).toBeGreaterThan(0);
        expect(applied.bodyFont).toContain('Instrument Sans');
        expect(applied.loadedFonts).toContain('Instrument Sans');

        expect(await violations(page)).toEqual([]);
        expect(consoleProblems).toEqual([]);
        expect(await context.cookies()).toEqual([]);
        expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
        const foreign = requests.filter((url) => new URL(url).origin !== origin);
        expect(foreign, 'requests to other origins').toEqual([]);
        expect(requests.length).toBeGreaterThan(1);

        const ldJson = await page.locator('script[type="application/ld+json"]').allTextContents();
        expect(ldJson).toHaveLength(1);
        const data: unknown = JSON.parse(ldJson[0] ?? '');
        expect(data).toHaveProperty('@context', 'https://schema.org');
      });
    }
  }
}
