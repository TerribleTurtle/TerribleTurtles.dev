// Builds a minimal dist/ directory that satisfies security/policy.json, for verify-dist unit tests.
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { buildCsp, buildPermissionsPolicy } from '../../../scripts/lib/header-check.mjs';

/** @typedef {import('../../../scripts/lib/policy.mjs').Policy} Policy */

const DAY_MS = 86_400_000;

/**
 * @param {Policy} policy
 * @returns {string} a `_headers` file whose `/*` block carries every required header.
 */
export function renderHeadersFile(policy) {
  const lines = ['/*', `  Content-Security-Policy: ${buildCsp(policy)}`, `  Permissions-Policy: ${buildPermissionsPolicy(policy)}`];
  for (const rule of policy.requiredHeaders) lines.push(`  ${rule.name}: ${rule.equals}`);
  lines.push('', '/_astro/*', '  Cache-Control: public, max-age=31536000, immutable', '');
  return lines.join('\n');
}

/**
 * @param {Date} now
 * @param {number} daysAhead
 * @returns {string}
 */
export function renderSecurityTxt(now, daysAhead) {
  const expires = new Date(now.getTime() + daysAhead * DAY_MS).toISOString();
  return `Contact: mailto:security@terribleturtles.dev\nExpires: ${expires}\nCanonical: https://terribleturtles.dev/.well-known/security.txt\n`;
}

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fixture page</title>
<link rel="stylesheet" href="/_astro/site.abc123.css"><link rel="canonical" href="https://terribleturtles.dev/">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite"}</script></head>
<body><main id="main"><p>Read the <a href="/about/">about page</a> or visit <a href="https://example.org/">an outbound link</a>.</p>
<img src="/og.png" alt="" width="1" height="1"></main></body></html>`;

/**
 * Creates a passing dist directory in the OS temp dir.
 * @param {Policy} policy
 * @param {Date} now
 * @returns {string} absolute path of the dist directory
 */
export function makePassingDist(policy, now) {
  const root = mkdtempSync(join(tmpdir(), 'tt-dist-'));
  /** @type {Record<string, string>} */
  const files = {
    '_headers': renderHeadersFile(policy),
    'index.html': PAGE.replace('Fixture page', 'Home'),
    '404.html': PAGE.replace('Fixture page', 'Not found'),
    'about/index.html': PAGE.replace('Fixture page', 'About'),
    '.well-known/security.txt': renderSecurityTxt(now, 200),
    '_astro/site.abc123.css': 'body{font-family:serif}@font-face{src:url(/fonts/a.woff2)}',
  };
  for (const [name, content] of Object.entries(files)) writeFile(root, name, content);
  return root;
}

/**
 * @param {string} root
 * @param {string} name
 * @param {string} content
 */
export function writeFile(root, name, content) {
  const path = join(root, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
}
