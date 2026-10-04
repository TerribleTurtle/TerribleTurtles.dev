import { test, expect } from '@playwright/test';
import { policy, localePath } from '../security/helpers';

const nonDefaultLocales = policy.pages.locales.filter((l) => l !== policy.pages.defaultLocale);
const notFoundRoutes = policy.pages.locales.map((locale) =>
  localePath(policy.pages, locale, policy.pages.notFoundProbe),
);
const notFoundSet = new Set(notFoundRoutes);
const allRoutes = [...policy.pages.expanded.map((p) => p.path), ...notFoundRoutes];

test.describe('i18n legal notices (8.4.6)', () => {
  for (const locale of nonDefaultLocales) {
    for (const legalSlug of ['privacy', 'security']) {
      const legalRoute = `/${locale}/${legalSlug}/`;

      test(`es legal page ${legalRoute} has translation notice linking to English version`, async ({ page }) => {
        await page.goto(legalRoute);

        const notice = page.locator('p.notice');
        await expect(notice).toHaveCount(1);

        const englishLink = notice.locator('a');
        await expect(englishLink).toHaveCount(1);
        await expect(englishLink).toHaveAttribute('hreflang', 'en');
        await expect(englishLink).toHaveAttribute('lang', 'en');

        const href = await englishLink.getAttribute('href');
        expect(href).toBe(`/${legalSlug}/`);

        const response = await page.request.get(href!);
        expect(response.status()).toBe(200);
      });
    }
  }

  const englishLegalRoutes = ['/privacy/', '/security/'];
  for (const route of englishLegalRoutes) {
    test(`English legal page ${route} has no notice`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator('p.notice')).toHaveCount(0);
    });
  }

  const esNonLegalRoutes = [
    '/es/',
    '/es/about/',
    '/es/work/spellcastersdb/',
    '/es/work/spellcasters-community-api/',
  ];
  for (const route of esNonLegalRoutes) {
    test(`es non-legal page ${route} has no notice`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator('p.notice')).toHaveCount(0);
    });
  }
});

test.describe('i18n language switcher', () => {
  for (const route of allRoutes) {
    test(`language switcher on ${route}`, async ({ page }) => {
      const pageRes = await page.goto(route);
      expect(pageRes?.status()).toBe(notFoundSet.has(route) ? 404 : 200);

      const switcherNav = page.locator('header nav').filter({
        has: page.locator('span[aria-current="true"][lang]'),
      });
      await expect(switcherNav).toHaveCount(1);

      const currentItem = switcherNav.locator('span[aria-current="true"]');
      await expect(currentItem).toHaveCount(1);

      const htmlLang = await page.locator('html').getAttribute('lang');
      const itemLang = await currentItem.getAttribute('lang');
      expect(itemLang).toBe(htmlLang);

      const otherLinks = switcherNav.locator('a');
      const otherCount = await otherLinks.count();
      expect(otherCount).toBe(policy.pages.locales.length - 1);

      for (let i = 0; i < otherCount; i++) {
        const link = otherLinks.nth(i);
        const hreflang = await link.getAttribute('hreflang');
        const linkLang = await link.getAttribute('lang');
        expect(hreflang).toBeTruthy();
        expect(linkLang).toBe(hreflang);

        const href = await link.getAttribute('href');
        expect(href).toBeTruthy();

        const linkRes = await page.request.get(href!);
        expect(linkRes.status(), `Switcher link ${href} from ${route} must return 200`).toBe(200);
      }
    });
  }
});
