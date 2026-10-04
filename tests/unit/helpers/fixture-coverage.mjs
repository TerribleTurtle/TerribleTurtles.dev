// Builds a minimal source tree and dist directory that satisfies check-coverage, for unit tests.
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { hashSource } from '../../../scripts/lib/i18n-stale.mjs';

/** @typedef {import('../../../scripts/lib/policy.mjs').Policy} Policy */

/**
 * @param {string} root
 * @param {string} relPath
 * @param {string} [content]
 */
export function writeTreeFile(root, relPath, content = '') {
  const filePath = join(root, relPath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

/**
 * Creates a passing source repository tree in the OS temp dir.
 * @param {Policy} policy
 * @returns {string} absolute path to temp root
 */
export function makePassingTree(policy) {
  const root = mkdtempSync(join(tmpdir(), 'tt-cov-root-'));

  // Standard Astro pages
  writeTreeFile(root, 'src/pages/index.astro', '<p>Home</p>');
  writeTreeFile(root, 'src/pages/[slug].astro', '<p>Prose</p>');
  writeTreeFile(root, 'src/pages/work/[slug].astro', '<p>Work</p>');
  writeTreeFile(root, 'src/pages/404.astro', '<p>404</p>');
  writeTreeFile(root, 'src/pages/llms.txt.ts', 'export const GET = () => new Response("llms");');

  // Locale routes
  writeTreeFile(root, 'src/pages/[locale]/index.astro', '<p>Home</p>');
  writeTreeFile(root, 'src/pages/[locale]/[slug].astro', '<p>Prose</p>');
  writeTreeFile(root, 'src/pages/[locale]/work/[slug].astro', '<p>Work</p>');

  // Content prose pages for all locales
  const pageEntries = policy.pages.entries.filter((e) => e.kind === 'page');
  for (const entry of pageEntries) {
    const slug = entry.path.replace(/^\/+|\/+$/g, '');
    const enContent = `---\ntitle: "${slug}"\ndescription: "desc"\n---\nBody`;
    const enHash = hashSource(enContent);
    for (const locale of policy.pages.locales) {
      if (locale === policy.pages.defaultLocale) {
        writeTreeFile(root, `src/content/pages/${locale}/${slug}.md`, enContent);
      } else {
        writeTreeFile(root, `src/content/pages/${locale}/${slug}.md`, `---\ntitle: "${slug}"\ndescription: "desc"\nsource: "${enHash}"\n---\nBody`);
      }
    }
  }

  // Project markdown and assets
  const projectEntries = policy.pages.entries.filter((e) => e.kind === 'project' && e.id !== undefined);
  /** @type {Map<string, string>} */
  const projectHashes = new Map();
  for (const entry of projectEntries) {
    const id = entry.id;
    if (!id) continue;
    const enContent = `---\ntitle: "${id}"\nscreenshot:\n  alt: "shot"\n---\nBody`;
    projectHashes.set(id, hashSource(enContent));
    writeTreeFile(root, `src/content/projects/${id}.md`, enContent);
    writeTreeFile(root, `public/og/${id}.png`, 'png-bytes');
    writeTreeFile(root, `public/images/work/${id}.jpg`, 'jpg-bytes');
    writeTreeFile(root, `public/images/work/${id}.webp`, 'webp-bytes');
  }

  // Project i18n translations for non-default locales
  const nonDefaultLocales = policy.pages.locales.filter((l) => l !== policy.pages.defaultLocale);
  for (const locale of nonDefaultLocales) {
    for (const entry of projectEntries) {
      const id = entry.id;
      if (!id) continue;
      const enHash = projectHashes.get(id) ?? '';
      writeTreeFile(root, `src/content/projects-i18n/${locale}/${id}.md`, `---\ntitle: "${id}"\nsummary: "summary"\nsource: "${enHash}"\n---\nBody`);
    }
  }
  writeTreeFile(root, 'src/content/projects-i18n/.gitkeep', '');

  // UI dictionary with source hashes
  const enUiInner = `\n  'brand.home': 'Home',\n`;
  const enUiHash = hashSource(enUiInner);
  const hashLines = nonDefaultLocales.map((l) => `  ${l}: '${enUiHash}',`).join('\n');
  const uiContent = [
    `// Stale-translation check hashes the normalised text between 'const en = {' and '} as const;'.`,
    `const en = {${enUiInner}} as const;`,
    ``,
    `export type UiKey = keyof typeof en;`,
    ``,
    `export const UI_SOURCE_HASH = {`,
    hashLines,
    `} as const;`,
    ``,
  ].join('\n');
  writeTreeFile(root, 'src/i18n/ui.ts', uiContent);

  // Clean security file
  const realPolicy = readFileSync(new URL('../../../security/policy.json', import.meta.url), 'utf8');
  writeTreeFile(root, 'security/policy.json', realPolicy);

  return root;
}

/**
 * Creates a passing dist directory matching the policy in the OS temp dir.
 * @param {Policy} policy
 * @returns {string} absolute path to temp dist dir
 */
export function makePassingCoverageDist(policy) {
  const dist = mkdtempSync(join(tmpdir(), 'tt-cov-dist-'));

  writeTreeFile(dist, '404.html', '<!doctype html><title>404</title>');
  for (const locale of policy.pages.locales) {
    if (locale !== policy.pages.defaultLocale) {
      writeTreeFile(dist, `${locale}/404.html`, '<!doctype html><title>404</title>');
    }
  }

  for (const page of policy.pages.expanded) {
    const relHtml = page.path === '/'
      ? 'index.html'
      : `${page.path.replace(/^\/+|\/+$/g, '')}/index.html`;
    writeTreeFile(dist, relHtml, `<!doctype html><title>${page.path}</title>`);
  }

  return dist;
}
