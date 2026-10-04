/**
 * UI strings (site chrome). The `en` object defines the keys; every other locale must be typed
 * `Record<UiKey, string>`, so a missing or extra key fails `astro check`. Page prose lives in
 * src/content, not here.
 */
import type { Locale } from './locales';

const en = {
  'skip.main': 'Skip to main content',
} as const;

export type UiKey = keyof typeof en;

export const ui: Record<Locale, Record<UiKey, string>> = {
  en,
};

/** Returns the UI string for a locale. There is no runtime fallback: a missing key is a type error. */
export function t(locale: Locale, key: UiKey): string {
  return ui[locale][key];
}
