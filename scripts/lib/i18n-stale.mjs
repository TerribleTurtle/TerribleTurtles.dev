// Pure functions for stale-translation verification.
// Detects when English source content or UI dictionary changes without updating translations.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** @typedef {import('./policy.mjs').Policy} Policy */
/** @typedef {{ root: string, policy: Policy }} FindStaleOptions */

/**
 * Normalises text before hashing:
 * - Converts CRLF to LF
 * - Strips trailing spaces/tabs on each line
 * - Trims trailing newlines
 *
 * @param {string} text
 * @returns {string}
 */
export function normalize(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n+$/, '');
}

/**
 * Computes sha256 hex digest of normalised source text.
 * @param {string} text
 * @returns {string} 64-character lowercase hex digest
 */
export function hashSource(text) {
  return createHash('sha256').update(normalize(text), 'utf8').digest('hex');
}

/**
 * Extracts the 64-char hex hash from the frontmatter `source:` field.
 * @param {string} content
 * @returns {string | null}
 */
export function getFrontmatterSourceHash(content) {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return null;
  const match = fmMatch[1].match(/^source:\s*["']?([a-f0-9]{64})["']?\s*$/m);
  return match ? match[1] : null;
}

/**
 * Extracts the raw text between `const en = {` and `} as const;` in src/i18n/ui.ts.
 * @param {string} content
 * @returns {string | null}
 */
export function extractUiEnText(content) {
  const match = content.match(/(?:^|\n)const en\s*=\s*\{([\s\S]*?)\}\s*as\s*const;/);
  return match ? match[1] : null;
}

/**
 * Extracts the source hash recorded for a locale in UI_SOURCE_HASH.
 * @param {string} content
 * @param {string} locale
 * @returns {string | null}
 */
export function extractUiSourceHash(content, locale) {
  const blockMatch = content.match(/export const UI_SOURCE_HASH\s*=\s*\{([\s\S]*?)\}\s*as\s*const;/);
  if (!blockMatch) return null;
  const entryMatch = blockMatch[1].match(new RegExp(`(?:['"]?${locale}['"]?)\\s*:\\s*['"]([a-f0-9]{64})['"]`));
  return entryMatch ? entryMatch[1] : null;
}

/**
 * Finds all stale or missing translations across pages, projects, and the UI dictionary.
 * @param {FindStaleOptions} options
 * @returns {string[]} List of failure messages (empty if all translations are fresh)
 */
export function findStale({ root, policy }) {
  /** @type {string[]} */
  const failures = [];
  const defaultLocale = policy.pages.defaultLocale;
  const nonDefaultLocales = policy.pages.locales.filter((l) => l !== defaultLocale);

  const pageEntries = policy.pages.entries.filter((e) => e.kind === 'page');
  const projectEntries = policy.pages.entries.filter((e) => e.kind === 'project' && e.id !== undefined);

  for (const locale of nonDefaultLocales) {
    // 1. Prose pages (src/content/pages/<locale>/<slug>.md)
    /** @type {Set<string>} */
    const slugs = new Set(pageEntries.map((e) => e.path.replace(/^\/+|\/+$/g, '')));
    const trPagesDir = join(root, 'src', 'content', 'pages', locale);
    if (existsSync(trPagesDir)) {
      for (const f of readdirSync(trPagesDir)) {
        if (f.endsWith('.md')) slugs.add(f.slice(0, -3));
      }
    }

    for (const slug of Array.from(slugs).sort()) {
      const trPath = join(root, 'src', 'content', 'pages', locale, `${slug}.md`);
      const enPath = join(root, 'src', 'content', 'pages', defaultLocale, `${slug}.md`);

      if (!existsSync(trPath)) continue;

      const trContent = readFileSync(trPath, 'utf8');
      const sourceHash = getFrontmatterSourceHash(trContent);

      if (!sourceHash) {
        failures.push(`translation missing source hash: ${locale}/${slug} (run npm run i18n:stamp -- ${locale} after translating)`);
      } else if (existsSync(enPath)) {
        const enContent = readFileSync(enPath, 'utf8');
        const enHash = hashSource(enContent);
        if (sourceHash !== enHash) {
          failures.push(`translation stale: ${locale}/${slug} (English changed; update the translation, then npm run i18n:stamp -- ${locale})`);
        }
      }
    }

    // 2. Project translations (src/content/projects-i18n/<locale>/<id>.md)
    /** @type {Set<string>} */
    const projectIds = new Set(projectEntries.map((e) => /** @type {string} */ (e.id)));
    const trProjDir = join(root, 'src', 'content', 'projects-i18n', locale);
    if (existsSync(trProjDir)) {
      for (const f of readdirSync(trProjDir)) {
        if (f.endsWith('.md')) projectIds.add(f.slice(0, -3));
      }
    }

    for (const id of Array.from(projectIds).sort()) {
      const trPath = join(root, 'src', 'content', 'projects-i18n', locale, `${id}.md`);
      const enPath = join(root, 'src', 'content', 'projects', `${id}.md`);

      if (!existsSync(trPath)) continue;

      const trContent = readFileSync(trPath, 'utf8');
      const sourceHash = getFrontmatterSourceHash(trContent);

      if (!sourceHash) {
        failures.push(`translation missing source hash: ${locale}/work/${id} (run npm run i18n:stamp -- ${locale} after translating)`);
      } else if (existsSync(enPath)) {
        const enContent = readFileSync(enPath, 'utf8');
        const enHash = hashSource(enContent);
        if (sourceHash !== enHash) {
          failures.push(`translation stale: ${locale}/work/${id} (English changed; update the translation, then npm run i18n:stamp -- ${locale})`);
        }
      }
    }

    // 3. UI dictionary (src/i18n/ui.ts)
    const uiPath = join(root, 'src', 'i18n', 'ui.ts');
    if (!existsSync(uiPath)) {
      failures.push(`translation missing source hash: ${locale}/ui (run npm run i18n:stamp -- ${locale} after translating)`);
    } else {
      const uiContent = readFileSync(uiPath, 'utf8');
      const enText = extractUiEnText(uiContent);
      if (!enText) {
        failures.push(`translation missing source hash: ${locale}/ui (run npm run i18n:stamp -- ${locale} after translating)`);
      } else {
        const enHash = hashSource(enText);
        const recordedHash = extractUiSourceHash(uiContent, locale);
        if (!recordedHash) {
          failures.push(`translation missing source hash: ${locale}/ui (run npm run i18n:stamp -- ${locale} after translating)`);
        } else if (recordedHash !== enHash) {
          failures.push(`translation stale: ${locale}/ui (English changed; update the translation, then npm run i18n:stamp -- ${locale})`);
        }
      }
    }
  }

  return failures;
}

/**
 * Extracts key-value pairs from a locale dictionary block in src/i18n/ui.ts.
 * @param {string} content
 * @param {string} locale
 * @returns {Map<string, string> | null}
 */
export function parseUiDictionaryBlock(content, locale) {
  const blockMatch = content.match(
    new RegExp(`(?:^|\\n)const\\s+${locale}(?:\\s*:[^=]+)?\\s*=\\s*\\{([\\s\\S]*?)\\}(?:\\s*as\\s*const)?;`),
  );
  if (!blockMatch) return null;

  /** @type {Map<string, string>} */
  const entries = new Map();
  const entryRegex = /['"]([^'"]+)['"]\s*:\s*(['"])((?:\\.|(?!\2)[^\r\n])*)\2/g;
  let match = entryRegex.exec(blockMatch[1]);
  while (match !== null) {
    entries.set(match[1], match[3]);
    match = entryRegex.exec(blockMatch[1]);
  }
  return entries;
}

/**
 * Verifies every locale in policy.pages.locales has a dictionary in src/i18n/ui.ts
 * with identical keys to defaultLocale and no empty or whitespace-only values.
 * @param {FindStaleOptions} options
 * @returns {string[]}
 */
export function checkUiDictionaries({ root, policy }) {
  /** @type {string[]} */
  const failures = [];
  const uiPath = join(root, 'src', 'i18n', 'ui.ts');
  if (!existsSync(uiPath)) return failures;

  const uiContent = readFileSync(uiPath, 'utf8');
  const defaultLocale = policy.pages.defaultLocale;
  const defaultDict = parseUiDictionaryBlock(uiContent, defaultLocale);
  if (!defaultDict) {
    failures.push(`UI dictionary missing for default locale "${defaultLocale}" in src/i18n/ui.ts`);
    return failures;
  }

  for (const [key, value] of defaultDict) {
    if (value.trim().length === 0) {
      failures.push(`UI dictionary key "${key}" in locale "${defaultLocale}" has an empty value in src/i18n/ui.ts`);
    }
  }

  for (const locale of policy.pages.locales) {
    if (locale === defaultLocale) continue;
    const dict = parseUiDictionaryBlock(uiContent, locale);
    if (!dict) {
      failures.push(`UI dictionary missing for locale "${locale}" in src/i18n/ui.ts`);
      continue;
    }

    for (const key of defaultDict.keys()) {
      if (!dict.has(key)) {
        failures.push(`UI dictionary for locale "${locale}" is missing key "${key}" in src/i18n/ui.ts`);
      }
    }

    for (const [key, value] of dict) {
      if (!defaultDict.has(key)) {
        failures.push(`UI dictionary for locale "${locale}" has unexpected key "${key}" in src/i18n/ui.ts`);
      }
      if (value.trim().length === 0) {
        failures.push(`UI dictionary key "${key}" in locale "${locale}" has an empty value in src/i18n/ui.ts`);
      }
    }
  }

  return failures;
}

