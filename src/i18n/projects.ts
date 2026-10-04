import { getCollection, type CollectionEntry } from 'astro:content';
import { defaultLocale, type Locale } from './locales';

export interface LocalizedProject extends CollectionEntry<'projects'> {
  translation?: CollectionEntry<'projectsI18n'>;
  title: string;
  summary: string;
  disclaimer?: string;
  screenshotAlt?: string;
  renderable: CollectionEntry<'projects'> | CollectionEntry<'projectsI18n'>;
}

/**
 * Merges localized metadata from `projectsI18n` over canonical project metadata.
 * For the default locale, returns the project as-is.
 * For other locales, throws if the translation is missing.
 */
export async function localizeProject(
  project: CollectionEntry<'projects'>,
  locale: Locale,
  allTranslations?: CollectionEntry<'projectsI18n'>[],
): Promise<LocalizedProject> {
  const translation =
    locale === defaultLocale
      ? undefined
      : (allTranslations ?? (await getCollection('projectsI18n'))).find(
          (t) => t.id === `${locale}/${project.id}`,
        );

  if (locale !== defaultLocale && !translation) {
    throw new Error(`Missing project translation for "${project.id}" in locale "${locale}"`);
  }

  const title = translation?.data.title ?? project.data.title;
  const summary = translation?.data.summary ?? project.data.summary;
  const disclaimer = translation?.data.disclaimer ?? project.data.disclaimer;
  const screenshotAlt = translation?.data.screenshotAlt ?? project.data.screenshot?.alt;
  const renderable = translation ?? project;

  return {
    ...project,
    data: {
      ...project.data,
      title,
      summary,
      disclaimer,
    },
    translation,
    title,
    summary,
    disclaimer,
    screenshotAlt,
    renderable,
  };
}
