#!/usr/bin/env node
// Strict page and content coverage check.
// Verifies source pages and content collections match security/policy.json (and dist/ if provided).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadPolicy, localePath } from './lib/policy.mjs';

/** @typedef {import('./lib/policy.mjs').Policy} Policy */
/** @typedef {{ path: string, basePath: string, locale: string, sourceFile: string }} DiscoveredPage */
/** @typedef {{ root: string, policy: Policy, distDir?: string }} CheckCoverageOptions */

/**
 * Reads all project content IDs from src/content/projects/*.md.
 * @param {string} root
 * @returns {string[]}
 */
export function discoverProjectContentIds(root) {
  const dir = join(root, 'src', 'content', 'projects');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith('.md'))
    .map((file) => file.slice(0, -3))
    .sort();
}

/**
 * Recursively lists all files in a directory.
 * @param {string} dir
 * @returns {string[]}
 */
function listFilesRecursive(dir) {
  if (!existsSync(dir)) return [];
  /** @type {string[]} */
  const files = [];
  /** @param {string} current */
  function walk(current) {
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }
  walk(dir);
  return files;
}

/**
 * Discovers all HTML pages produced by source files in src/pages and content collections.
 * Kept in its own function so later steps can extend it for per-locale content folders.
 * @param {string} root Repository root directory
 * @param {Policy} policy Validated policy
 * @returns {DiscoveredPage[]}
 */
export function discoverSourcePages(root, policy) {
  const pagesDir = join(root, 'src', 'pages');
  if (!existsSync(pagesDir)) return [];

  const nonDefaultLocales = policy.pages.locales.filter((l) => l !== policy.pages.defaultLocale);
  const projectIds = discoverProjectContentIds(root);
  const files = listFilesRecursive(pagesDir);
  /** @type {DiscoveredPage[]} */
  const discovered = [];

  for (const fullPath of files) {
    const rel = relative(pagesDir, fullPath).replace(/\\/g, '/');
    if (!rel.endsWith('.astro')) continue;
    if (rel === '404.astro' || rel.endsWith('/404.astro')) continue;

    const parts = rel.split('/');
    let locale = policy.pages.defaultLocale;
    let relInLocale = rel;
    if (parts.length > 1 && nonDefaultLocales.includes(parts[0])) {
      locale = parts[0];
      relInLocale = parts.slice(1).join('/');
    }

    if (relInLocale === 'index.astro') {
      const basePath = '/';
      discovered.push({
        path: localePath(policy.pages, locale, basePath),
        basePath,
        locale,
        sourceFile: rel,
      });
    } else if (relInLocale === 'work/[slug].astro') {
      for (const id of projectIds) {
        const basePath = `/work/${id}/`;
        discovered.push({
          path: localePath(policy.pages, locale, basePath),
          basePath,
          locale,
          sourceFile: rel,
        });
      }
    } else {
      let basePath = '';
      if (relInLocale.endsWith('/index.astro')) {
        basePath = `/${relInLocale.slice(0, -'/index.astro'.length)}/`;
      } else {
        basePath = `/${relInLocale.slice(0, -'.astro'.length)}/`;
      }
      discovered.push({
        path: localePath(policy.pages, locale, basePath),
        basePath,
        locale,
        sourceFile: rel,
      });
    }
  }

  return discovered;
}

/**
 * Pure coverage verification function.
 * @param {CheckCoverageOptions} options
 * @returns {string[]} List of failure messages (empty if passing)
 */
export function checkCoverage({ root, policy, distDir }) {
  /** @type {string[]} */
  const failures = [];

  // 1. Source page discovery vs policy.pages.expanded
  const discoveredPages = discoverSourcePages(root, policy);
  const discoveredPaths = new Set(discoveredPages.map((p) => p.path));
  const expandedPaths = new Set(policy.pages.expanded.map((p) => p.path));

  for (const page of discoveredPages) {
    if (!expandedPaths.has(page.path)) {
      failures.push(`Source page "${page.path}" (${page.sourceFile}) is missing from policy.pages.expanded`);
    }
  }

  for (const page of policy.pages.expanded) {
    if (!discoveredPaths.has(page.path)) {
      failures.push(`Expanded page "${page.path}" has no corresponding source in src/pages`);
    }
  }

  // 2. Project content vs policy.pages entries
  const contentIds = discoverProjectContentIds(root);
  const contentIdSet = new Set(contentIds);
  const policyProjectEntries = policy.pages.entries.filter((e) => e.kind === 'project');
  /** @type {Set<string>} */
  const policyProjectIds = new Set();
  for (const entry of policyProjectEntries) {
    if (entry.id !== undefined) policyProjectIds.add(entry.id);
  }

  for (const contentId of contentIds) {
    if (!policyProjectIds.has(contentId)) {
      failures.push(`Project content id "${contentId}" has no kind:'project' entry in policy.pages.entries`);
    }
  }

  for (const policyId of policyProjectIds) {
    if (!contentIdSet.has(policyId)) {
      failures.push(`Policy project id "${policyId}" has no content file in src/content/projects`);
    }
  }

  // 3. Project OG images
  for (const id of contentIds) {
    const ogPath = join(root, 'public', 'og', `${id}.png`);
    if (!existsSync(ogPath)) {
      failures.push(`Missing OG image for project "${id}": public/og/${id}.png`);
    }
  }

  // 4. Content screenshots
  for (const id of contentIds) {
    const mdPath = join(root, 'src', 'content', 'projects', `${id}.md`);
    if (existsSync(mdPath)) {
      const mdContent = readFileSync(mdPath, 'utf8');
      if (/^screenshot:/m.test(mdContent)) {
        const jpgPath = join(root, 'public', 'images', 'work', `${id}.jpg`);
        const webpPath = join(root, 'public', 'images', 'work', `${id}.webp`);
        if (!existsSync(jpgPath)) {
          failures.push(`Content "${id}.md" declares screenshot, but public/images/work/${id}.jpg is missing`);
        }
        if (!existsSync(webpPath)) {
          failures.push(`Content "${id}.md" declares screenshot, but public/images/work/${id}.webp is missing`);
        }
      }
    }
  }

  // 5. Scaffold marker check
  for (const subDir of ['src', 'security']) {
    const baseDir = join(root, subDir);
    const files = listFilesRecursive(baseDir);
    for (const filePath of files) {
      try {
        const content = readFileSync(filePath, 'utf8');
        if (content.includes('TODO(scaffold)')) {
          const rel = relative(root, filePath).replace(/\\/g, '/');
          failures.push(`Found TODO(scaffold) marker in ${rel}`);
        }
      } catch {
        // Binary or unreadable files skipped
      }
    }
  }

  // 6. Dist half (if distDir provided)
  if (distDir !== undefined) {
    if (!existsSync(distDir)) {
      failures.push(`Dist directory "${distDir}" does not exist`);
      return failures;
    }

    const root404 = join(distDir, '404.html');
    if (!existsSync(root404)) {
      failures.push('Missing 404.html at dist root');
    }

    for (const locale of policy.pages.locales) {
      if (locale !== policy.pages.defaultLocale) {
        const locale404 = join(distDir, locale, '404.html');
        if (!existsSync(locale404)) {
          failures.push(`Missing 404.html for locale "${locale}" at ${locale}/404.html`);
        }
      }
    }

    for (const page of policy.pages.expanded) {
      const relHtml = page.path === '/'
        ? 'index.html'
        : join(...page.path.split('/').filter(Boolean), 'index.html');
      const distHtml = join(distDir, relHtml);
      if (!existsSync(distHtml)) {
        failures.push(`Expanded page "${page.path}" missing from dist (${relHtml.replace(/\\/g, '/')})`);
      }
    }

    const distFiles = listFilesRecursive(distDir);
    for (const filePath of distFiles) {
      const rel = relative(distDir, filePath).replace(/\\/g, '/');
      if (rel.endsWith('index.html')) {
        const route = rel === 'index.html'
          ? '/'
          : `/${rel.slice(0, -'index.html'.length)}`;
        if (!expandedPaths.has(route)) {
          failures.push(`Unexpected page in dist: "${route}" (${rel})`);
        }
      }
    }
  }

  return failures;
}

// CLI entry point
const isDirectRun = process.argv[1] &&
  resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();

if (isDirectRun) {
  const { values } = parseArgs({
    options: {
      dist: { type: 'string' },
      root: { type: 'string' },
    },
  });

  const root = values.root ? resolve(values.root) : fileURLToPath(new URL('..', import.meta.url));
  const policy = loadPolicy(join(root, 'security', 'policy.json'));
  const distDir = values.dist ? resolve(root, values.dist) : undefined;

  const failures = checkCoverage({ root, policy, distDir });
  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`FAIL: ${failure}`);
    }
    console.error(`check-coverage: ${failures.length} coverage failure(s)`);
    process.exit(1);
  }

  console.log('check-coverage: PASS, all pages, routes, content and dist match policy');
  process.exit(0);
}
