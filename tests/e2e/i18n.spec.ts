import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { policy, localePath } from '../security/helpers';

interface LocaleMeta {
  bcp47: string;
  ogLocale: string;
}

const localesSource = readFileSync(new URL('../../src/i18n/locales.ts', import.meta.url), 'utf8');

function parseLocaleMeta(source: string, locales: readonly string[]): Map<string, LocaleMeta> {
  const metaMap = new Map<string, LocaleMeta>();
  for (const locale of locales) {
    const blockMatch = source.match(new RegExp(`\\b${locale}:\\s*\\{([^}]+)\\}`));
    if (!blockMatch) throw new Error(`Could not find locale block for "${locale}" in src/i18n/locales.ts`);
    const bcp47Match = blockMatch[1].match(/bcp47:\s*['"]([^'"]+)['"]/);
    const ogLocaleMatch = blockMatch[1].match(/ogLocale:\s*['"]([^'"]+)['"]/);
    if (!bcp47Match || !ogLocaleMatch) {
      throw new Error(`Incomplete locale meta for "${locale}" in src/i18n/locales.ts`);
    }
    metaMap.set(locale, { bcp47: bcp47Match[1], ogLocale: ogLocaleMatch[1] });
  }
  return metaMap;
}

const localeMetaMap = parseLocaleMeta(localesSource, policy.pages.locales);

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

test.describe('i18n language tags, canonical, and alternates (8.4.5)', () => {
  for (const pageRef of policy.pages.expanded) {
    test(`canonical, alternates, and language tags on ${pageRef.path}`, async ({ page }) => {
      const pageRes = await page.goto(pageRef.path);
      expect(pageRes?.status()).toBe(200);

      // (1) <html lang> equals LOCALE_META-equivalent bcp47 for that page's locale
      const localeMeta = localeMetaMap.get(pageRef.locale);
      if (!localeMeta) throw new Error(`Missing locale meta for ${pageRef.locale}`);
      await expect(page.locator('html')).toHaveAttribute('lang', localeMeta.bcp47);

      // (2) exactly one link[rel=canonical], absolute, equal to site origin + page path
      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveCount(1);
      const canonicalHref = await canonical.getAttribute('href');
      const expectedCanonical = `${policy.live.origin}${pageRef.path}`;
      expect(canonicalHref).toMatch(/^https?:\/\//);
      expect(canonicalHref).toBe(expectedCanonical);

      // (3) link[rel=alternate][hreflang] set = every locale's bcp47 + 'x-default', no duplicates, each href absolute
      const alternateLocators = page.locator('link[rel="alternate"][hreflang]');
      const alternates = await alternateLocators.evaluateAll((links) =>
        links.map((link) => ({
          hreflang: link.getAttribute('hreflang') ?? '',
          href: link.getAttribute('href') ?? '',
        })),
      );

      const expectedHreflangs = [
        ...policy.pages.locales.map((l) => {
          const m = localeMetaMap.get(l);
          if (!m) throw new Error(`Missing locale meta for ${l}`);
          return m.bcp47;
        }),
        'x-default',
      ];

      expect(alternates).toHaveLength(expectedHreflangs.length);
      const hreflangList = alternates.map((a) => a.hreflang);
      expect(new Set(hreflangList).size).toBe(expectedHreflangs.length);
      expect(new Set(hreflangList)).toEqual(new Set(expectedHreflangs));

      for (const alt of alternates) {
        expect(alt.href).toMatch(/^https?:\/\//);
      }

      // x-default href equals the default-locale URL of the same base path
      const defaultLocalePath = localePath(policy.pages, policy.pages.defaultLocale, pageRef.basePath);
      const expectedXDefaultHref = `${policy.live.origin}${defaultLocalePath}`;
      const xDefaultAlt = alternates.find((a) => a.hreflang === 'x-default');
      expect(xDefaultAlt?.href).toBe(expectedXDefaultHref);

      // the alternate for the page's own locale equals its canonical
      const ownLocaleAlt = alternates.find((a) => a.hreflang === localeMeta.bcp47);
      expect(ownLocaleAlt?.href).toBe(expectedCanonical);

      // (5) meta[property="og:locale"] equals the locale's ogLocale
      const ogLocaleMeta = page.locator('meta[property="og:locale"]');
      await expect(ogLocaleMeta).toHaveCount(1);
      await expect(ogLocaleMeta).toHaveAttribute('content', localeMeta.ogLocale);

      // (4) reciprocity: for each alternate (non x-default), load that page and assert it lists original page's canonical among its alternates
      const nonDefaultAlternates = alternates.filter((a) => a.hreflang !== 'x-default');
      for (const alt of nonDefaultAlternates) {
        const targetPath = new URL(alt.href).pathname;
        await page.goto(targetPath);

        const targetAlternates = await page.locator('link[rel="alternate"][hreflang]').evaluateAll((links) =>
          links.map((link) => link.getAttribute('href')),
        );
        expect(targetAlternates).toContain(expectedCanonical);
      }
    });
  }

  for (const locale of policy.pages.locales) {
    const notFoundRoute = localePath(policy.pages, locale, policy.pages.notFoundProbe);
    test(`404 not-found probe language tags and headers on ${notFoundRoute}`, async ({ page }) => {
      const pageRes = await page.goto(notFoundRoute);
      expect(pageRes?.status()).toBe(404);

      // no hreflang alternates
      await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(0);

      // robots meta contains noindex
      const robotsMeta = page.locator('meta[name="robots"]');
      await expect(robotsMeta).toHaveCount(1);
      const robotsContent = await robotsMeta.getAttribute('content');
      expect(robotsContent).toContain('noindex');

      // <html lang> matches the locale of the probe path
      const localeMeta = localeMetaMap.get(locale);
      if (!localeMeta) throw new Error(`Missing locale meta for ${locale}`);
      await expect(page.locator('html')).toHaveAttribute('lang', localeMeta.bcp47);
    });
  }
});
