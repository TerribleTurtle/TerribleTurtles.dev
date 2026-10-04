/**
 * Locale metadata. The locale LIST itself is owned by security/policy.json (`pages.locales`);
 * this file only adds per-locale presentation data, and fails the build if the two disagree.
 */
import policy from '../../security/policy.json';

export const LOCALE_META = {
  en: { label: 'English', bcp47: 'en', ogLocale: 'en_US', dir: 'ltr' },
  es: { label: 'Español', bcp47: 'es', ogLocale: 'es_ES', dir: 'ltr' },
} as const satisfies Record<string, { label: string; bcp47: string; ogLocale: string; dir: 'ltr' | 'rtl' }>;

export type Locale = keyof typeof LOCALE_META;

const metaLocales = Object.keys(LOCALE_META);

export function isLocale(value: string): value is Locale {
  return metaLocales.includes(value);
}

function assertLocale(value: string, where: string): Locale {
  if (!isLocale(value)) throw new Error(`${where}: "${value}" has no entry in src/i18n/locales.ts LOCALE_META`);
  return value;
}

// Fail loudly at build time if policy.json and LOCALE_META list different locales.
const policyLocales: readonly string[] = policy.pages.locales;
for (const l of metaLocales) {
  if (!policyLocales.includes(l)) throw new Error(`src/i18n/locales.ts: "${l}" is not in security/policy.json pages.locales`);
}

export const locales: readonly Locale[] = policyLocales.map((l) => assertLocale(l, 'security/policy.json pages.locales'));
export const defaultLocale: Locale = assertLocale(policy.pages.defaultLocale, 'security/policy.json pages.defaultLocale');
export const nonDefaultLocales: readonly Locale[] = locales.filter((l) => l !== defaultLocale);

/** Prefixes a locale-free base path ("/about/") for a locale; the default locale stays unprefixed. */
export function localizePath(locale: Locale, basePath: string): string {
  return locale === defaultLocale ? basePath : `/${locale}${basePath}`;
}

/** Splits "/es/about/" into { locale: 'es', basePath: '/about/' }; unprefixed paths are the default locale. */
export function splitLocale(pathname: string): { locale: Locale; basePath: string } {
  const first = pathname.split('/')[1] ?? '';
  const prefixed: readonly string[] = nonDefaultLocales;
  if (prefixed.includes(first) && isLocale(first)) {
    return { locale: first, basePath: pathname.slice(first.length + 1) || '/' };
  }
  return { locale: defaultLocale, basePath: pathname };
}
