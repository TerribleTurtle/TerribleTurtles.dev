/**
 * UI strings (site chrome). The `en` object defines the keys; every other locale must be typed
 * `Record<UiKey, string>`, so a missing or extra key fails `astro check`. Page prose lives in
 * src/content, not here.
 */
import type { Locale } from './locales';

// Stale-translation check hashes the normalised text between 'const en = {' and '} as const;'.
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
  'legal.translationNotice': 'This translation is provided for convenience. In case of discrepancy, the English version governs.',
  'legal.englishVersion': 'English version',
  'lang.switcherLabel': 'Language',
  'meta.defaultDescription': 'A personal archive of things I have built.',
  'meta.defaultImageAlt': 'TerribleTurtles: things I have built.',
  'meta.titleSuffix': ' | TerribleTurtles',
} as const;

export type UiKey = keyof typeof en;

export const UI_SOURCE_HASH = {
  es: 'bed2267ec6011ac87c03a48e47617bc592811b34c26532f46bc013d03e3eb5fb',
} as const;

const es: Record<UiKey, string> = {
  'skip.main': 'Saltar al contenido principal',
  'brand.homeLabel': 'TerribleTurtles, inicio',
  'brand.home': 'Inicio',
  'nav.primaryLabel': 'Principal',
  'nav.work': 'Proyectos',
  'nav.about': 'Sobre mí',
  'lang.switcherLabel': 'Idioma',
  'footer.navLabel': 'Pie de página',
  'footer.privacy': 'Privacidad',
  'footer.security': 'Seguridad',
  'footer.copyright': '© {year} TerribleTurtles',
  'footer.codeLicense': 'Código MIT',
  'footer.writingLicense': 'Textos CC BY-NC 4.0',
  'status.live': 'Activo',
  'status.experimental': 'Experimental',
  'status.archived': 'Archivado',
  'home.title': "Cosas que he construido.",
  'home.lede': 'Un archivo personal.',
  'home.workHeading': 'Proyectos',
  'project.allWork': 'Todos los proyectos',
  'project.visit': 'Visitar {title}',
  'project.source': 'Código en GitHub',
  'project.externalSite': '(sitio externo)',
  'project.year': 'Año',
  'project.status': 'Estado',
  'project.builtWith': 'Construido con',
  'notFound.title': 'Página no encontrada',
  'notFound.description': 'Página no encontrada.',
  'notFound.heading': 'Página no encontrada',
  'notFound.prose': 'No hay nada en esta dirección.',
  'notFound.homeLink': 'Ir a la página de inicio',
  'page.lastUpdated': 'Última actualización:',
  'legal.translationNotice': 'Esta traducción se ofrece por comodidad. En caso de discrepancia, prevalece la versión en inglés.',
  'legal.englishVersion': 'English version',
  'meta.defaultDescription': 'Un archivo personal de cosas que he construido.',
  'meta.defaultImageAlt': 'TerribleTurtles: cosas que he construido.',
  'meta.titleSuffix': ' | TerribleTurtles',
};

export const ui: Record<Locale, Record<UiKey, string>> = {
  en,
  es,
};

/** Returns the UI string for a locale. There is no runtime fallback: a missing key is a type error. */
export function t(locale: Locale, key: UiKey): string {
  return ui[locale][key];
}

/** Simple interpolation helper for templates with {param} placeholders. */
export function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}
