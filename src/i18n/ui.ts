/**
 * UI strings (site chrome). The `en` object defines the keys; every other locale must be typed
 * `Record<UiKey, string>`, so a missing or extra key fails `astro check`. Page prose lives in
 * src/content, not here.
 */
import type { Locale } from './locales';

const en = {
  'skip.main': 'Skip to main content',
  'brand.homeLabel': 'TerribleTurtles, home',
  'brand.home': 'Home',
  'nav.primaryLabel': 'Primary',
  'nav.work': 'Work',
  'nav.about': 'About',
  'footer.navLabel': 'Footer',
  'footer.privacy': 'Privacy',
  'footer.security': 'Security',
  'footer.copyright': '© {year} TerribleTurtles',
  'footer.codeLicense': 'Code MIT',
  'footer.writingLicense': 'Writing CC BY-NC 4.0',
  'footer.fontCreditsPrefix': 'Set in',
  'footer.fontCreditsAnd': 'and',
  'footer.fontCreditsSuffix': '(SIL Open Font License).',
  'status.live': 'Live',
  'status.experimental': 'Experimental',
  'status.archived': 'Archived',
  'home.title': "Things I've built.",
  'home.lede': 'A personal archive.',
  'home.workHeading': 'Work',
  'project.allWork': 'All work',
  'project.visit': 'Visit {title}',
  'project.source': 'Source on GitHub',
  'project.externalSite': '(external site)',
  'project.year': 'Year',
  'project.status': 'Status',
  'project.builtWith': 'Built with',
  'notFound.title': 'Page not found',
  'notFound.description': 'Page not found.',
  'notFound.heading': 'Page not found',
  'notFound.prose': 'There is nothing at this address.',
  'notFound.homeLink': 'Go to the home page',
  'page.lastUpdated': 'Last updated:',
  'meta.defaultDescription': 'A personal archive of things I have built.',
  'meta.defaultImageAlt': 'TerribleTurtles: things I have built.',
  'meta.titleSuffix': ' | TerribleTurtles',
} as const;

export type UiKey = keyof typeof en;

export const ui: Record<Locale, Record<UiKey, string>> = {
  en,
};

/** Returns the UI string for a locale. There is no runtime fallback: a missing key is a type error. */
export function t(locale: Locale, key: UiKey): string {
  return ui[locale][key];
}

/** Simple interpolation helper for templates with {param} placeholders. */
export function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}
