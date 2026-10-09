#!/usr/bin/env node
// Stamps current English source hashes into translation frontmatters and UI_SOURCE_HASH.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractUiEnText, hashSource } from './lib/i18n-stale.mjs';
import { loadPolicy } from './lib/policy.mjs';

/** @typedef {import('./lib/policy.mjs').Policy} Policy */
/** @typedef {{ root?: string, policy?: Policy }} StampOptions */

/**
 * Rewrites or inserts the `source:` line in a markdown frontmatter block.
 * @param {string} content
 * @param {string} hash
 * @returns {string}
 */
export function setFrontmatterSource(content, hash) {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) {
    return `---\nsource: "${hash}"\n---\n\n${content}`;
  }

  const innerFm = fmMatch[1];
  let newInnerFm;
  if (/^source:\s*.*$/m.test(innerFm)) {
    newInnerFm = innerFm.replace(/^source:\s*.*$/m, `source: "${hash}"`);
  } else {
    newInnerFm = `${innerFm.trimEnd()}\nsource: "${hash}"`;
  }

  const rest = content.slice(fmMatch[0].length);
  return `---\n${newInnerFm.trim()}\n---${rest}`;
}

/**
 * Rewrites or inserts the `UI_SOURCE_HASH` entry for a locale in ui.ts content.
 * @param {string} content
 * @param {string} locale
 * @param {string} hash
 * @returns {string}
 */
export function updateUiSourceHash(content, locale, hash) {
  const blockMatch = content.match(/export const UI_SOURCE_HASH\s*=\s*\{([\s\S]*?)\}\s*as\s*const;/);
  if (!blockMatch) {
    const uiKeyMatch = content.match(/export type UiKey\s*=\s*[^;]+;/);
    if (uiKeyMatch && uiKeyMatch.index !== undefined) {
      const insertPos = uiKeyMatch.index + uiKeyMatch[0].length;
      return (
        content.slice(0, insertPos) +
        `\n\nexport const UI_SOURCE_HASH = {\n  ${locale}: '${hash}',\n} as const;` +
        content.slice(insertPos)
      );
    }
    return `${content.trimEnd()}\n\nexport const UI_SOURCE_HASH = {\n  ${locale}: '${hash}',\n} as const;\n`;
  }

  const blockFull = blockMatch[0];
  const blockInner = blockMatch[1];
  const entryRegex = new RegExp(`(^|\\n)(\\s*)(['"]?${RegExp.escape(locale)}['"]?\\s*:\\s*)['"][^'"]*['"]`);
  if (entryRegex.test(blockInner)) {
    const updatedInner = blockInner.replace(entryRegex, `$1$2$3'${hash}'`);
    return content.replace(blockFull, `export const UI_SOURCE_HASH = {${updatedInner}} as const;`);
  }

  const trimmedInner = blockInner.trimEnd();
  const updatedInner = trimmedInner.length > 0
    ? `${trimmedInner}\n  ${locale}: '${hash}',\n`
    : `\n  ${locale}: '${hash}',\n`;
  return content.replace(blockFull, `export const UI_SOURCE_HASH = {${updatedInner}} as const;`);
}

/**
 * Stamps source hashes for all translations of a given non-default locale.
 * @param {string} locale
 * @param {StampOptions} [options]
 * @returns {{ changedFiles: string[] }}
 */
export function stampLocale(locale, options = {}) {
  const root = options.root ? resolve(options.root) : fileURLToPath(new URL('..', import.meta.url));
  const policy = options.policy ?? loadPolicy(join(root, 'security', 'policy.json'));

  if (!locale) {
    throw new Error('A locale argument is required');
  }

  if (locale === policy.pages.defaultLocale) {
    throw new Error(`Cannot stamp default locale "${locale}" (English is the source)`);
  }

  if (!policy.pages.locales.includes(locale)) {
    const available = policy.pages.locales.filter((l) => l !== policy.pages.defaultLocale).join(', ');
    throw new Error(`Unknown locale "${locale}"; must be one of: ${available}`);
  }

  /** @type {string[]} */
  const changedFiles = [];
  const defaultLocale = policy.pages.defaultLocale;

  // 1. Prose pages
  const trPagesDir = join(root, 'src', 'content', 'pages', locale);
  if (existsSync(trPagesDir)) {
    const pageFiles = readdirSync(trPagesDir).filter((f) => f.endsWith('.md')).sort();
    for (const file of pageFiles) {
      const trPath = join(trPagesDir, file);
      const enPath = join(root, 'src', 'content', 'pages', defaultLocale, file);
      if (!existsSync(enPath)) continue;

      const enContent = readFileSync(enPath, 'utf8');
      const enHash = hashSource(enContent);
      const trContent = readFileSync(trPath, 'utf8');
      const updated = setFrontmatterSource(trContent, enHash);

      if (updated !== trContent) {
        writeFileSync(trPath, updated, 'utf8');
        changedFiles.push(relative(root, trPath).replace(/\\/g, '/'));
      }
    }
  }

  // 2. Project translations
  const trProjDir = join(root, 'src', 'content', 'projects-i18n', locale);
  if (existsSync(trProjDir)) {
    const projFiles = readdirSync(trProjDir).filter((f) => f.endsWith('.md')).sort();
    for (const file of projFiles) {
      const trPath = join(trProjDir, file);
      const enPath = join(root, 'src', 'content', 'projects', file);
      if (!existsSync(enPath)) continue;

      const enContent = readFileSync(enPath, 'utf8');
      const enHash = hashSource(enContent);
      const trContent = readFileSync(trPath, 'utf8');
      const updated = setFrontmatterSource(trContent, enHash);

      if (updated !== trContent) {
        writeFileSync(trPath, updated, 'utf8');
        changedFiles.push(relative(root, trPath).replace(/\\/g, '/'));
      }
    }
  }

  // 3. UI dictionary
  const uiPath = join(root, 'src', 'i18n', 'ui.ts');
  if (existsSync(uiPath)) {
    const uiContent = readFileSync(uiPath, 'utf8');
    const enText = extractUiEnText(uiContent);
    if (enText) {
      const enHash = hashSource(enText);
      const updated = updateUiSourceHash(uiContent, locale, enHash);
      if (updated !== uiContent) {
        writeFileSync(uiPath, updated, 'utf8');
        changedFiles.push(relative(root, uiPath).replace(/\\/g, '/'));
      }
    }
  }

  return { changedFiles };
}

// CLI entry point
const isDirectRun = process.argv[1] &&
  resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();

if (isDirectRun) {
  const locale = process.argv[2];
  if (!locale) {
    console.error('Usage: node scripts/i18n-stamp.mjs <locale>');
    process.exit(1);
  }

  try {
    const { changedFiles } = stampLocale(locale);
    if (changedFiles.length === 0) {
      console.log(`i18n-stamp: all translations already up to date for ${locale}`);
    } else {
      for (const file of changedFiles) {
        console.log(`stamped: ${file}`);
      }
      console.log(`i18n-stamp: updated ${changedFiles.length} file(s) for ${locale}`);
    }
    process.exit(0);
  } catch (err) {
    console.error(`i18n-stamp error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
