// Static artifact audit of the built site (dist/). Node built-ins only. Returns human-readable failures.
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { checkHeadersFile, checkSecurityTxt } from './static-config-checks.mjs';

/** @typedef {import('./policy.mjs').Policy} Policy */

const TEXT_EXTENSIONS = new Set(['.html', '.xml', '.txt', '.json', '.css', '.svg', '.webmanifest']);
const FORBIDDEN_TAGS = /<(iframe|frame|frameset|object|embed|applet|form|base|portal)\b/gi;
const SCRIPT_OPEN = /<script\b([^>]*)>/gi;
const LD_JSON = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script\s*>/gi;
const RESOURCE_ATTR = /<([a-z][a-z0-9-]*)\b[^>]*?\s(src|srcset|poster|data|imagesrcset)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const LINK_TAG = /<link\b[^>]*>/gi;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const CSS_EXTERNAL = /(?:url\(\s*["']?\s*|@import\s+["'])(?:[a-z][a-z0-9+.-]*:|\/\/)/gi;

/**
 * @param {string} tag
 * @param {string} name
 * @returns {string | undefined}
 */
function attr(tag, name) {
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : undefined;
}

/**
 * Same-origin = a relative reference (no scheme, not protocol-relative) or an absolute URL on the site origin.
 * @param {string} url
 * @param {string} origin
 */
function isSameOrigin(url, origin) {
  const value = url.trim();
  if (value.startsWith('//')) return false;
  if (!SCHEME.test(value)) return true;
  return value === origin || value.startsWith(`${origin}/`);
}

/**
 * @param {string} text
 * @param {number} index
 */
function context(text, index) {
  return JSON.stringify(text.slice(Math.max(0, index - 30), index + 30));
}

/**
 * @param {Policy} policy
 * @param {string} file
 * @param {string} html
 * @returns {string[]}
 */
export function checkHtml(policy, file, html) {
  /** @type {string[]} */
  const failures = [];
  const origin = policy.live.origin;
  for (const match of html.matchAll(SCRIPT_OPEN)) {
    const type = attr(match[0], 'type');
    if (type === undefined || !policy.dist.allowedScriptTypes.includes(type.toLowerCase())) {
      const src = attr(match[0], 'src');
      failures.push(`${file}: <script> without an allowed type (type=${type ?? '(none)'}${src === undefined ? '' : `, src=${src}`})`);
    }
  }
  for (const match of html.matchAll(LD_JSON)) {
    try {
      JSON.parse(match[1] ?? '');
    } catch (error) {
      failures.push(`${file}: ld+json block does not parse: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (/<style\b/i.test(html)) failures.push(`${file}: <style> block (style-src 'self' forbids inline CSS)`);
  const styleAttr = /<[a-z][^>]*\sstyle\s*=/i.exec(html);
  if (styleAttr) failures.push(`${file}: style= attribute at ${context(html, styleAttr.index)}`);
  if (/\shref\s*=\s*["']?\s*javascript:/i.test(html)) failures.push(`${file}: javascript: URL`);
  for (const match of html.matchAll(FORBIDDEN_TAGS)) failures.push(`${file}: <${(match[1] ?? '').toLowerCase()}> element is forbidden`);
  for (const match of html.matchAll(RESOURCE_ATTR)) {
    const name = match[2] ?? '';
    const value = match[3] ?? match[4] ?? '';
    const urls = /srcset/i.test(name) ? value.split(',').map((part) => part.trim().split(/\s+/)[0] ?? '') : [value];
    for (const url of urls) if (!isSameOrigin(url, origin)) failures.push(`${file}: external resource <${match[1]} ${name}="${url}">`);
  }
  for (const match of html.matchAll(LINK_TAG)) {
    const href = attr(match[0], 'href');
    if (href !== undefined && !isSameOrigin(href, origin)) failures.push(`${file}: external resource <link href="${href}">`);
  }
  for (const pattern of policy.dist.whitespaceRegressionPatterns) {
    for (const match of html.matchAll(new RegExp(pattern, 'g'))) {
      failures.push(`${file}: Astro whitespace regression /${pattern}/ at ${context(html, match.index)}`);
    }
  }
  return failures;
}

/**
 * @param {string} dir
 * @returns {Promise<string[]>} every file path under dir, relative, with forward slashes (dot-folders included)
 */
async function listFiles(dir) {
  const entries = await readdir(dir, { recursive: true });
  /** @type {string[]} */
  const files = [];
  for (const entry of entries) {
    if ((await stat(join(dir, entry))).isFile()) files.push(entry.split('\\').join('/'));
  }
  return files.sort();
}

/**
 * Audits a built site directory against the policy.
 * @param {string} distDir
 * @param {Policy} policy
 * @param {Date} now used for the security.txt expiry window
 * @returns {Promise<string[]>} failures (empty = pass)
 */
export async function auditDist(distDir, policy, now) {
  const files = await listFiles(distDir);
  /** @type {string[]} */
  const failures = [];
  for (const required of policy.dist.requiredFiles) {
    if (!files.includes(required)) failures.push(`missing required file ${required}`);
  }
  for (const file of files) {
    const ext = extname(file).toLowerCase();
    if (policy.dist.forbiddenExtensions.includes(ext)) failures.push(`forbidden file type (${ext}): ${file}`);
    if (!TEXT_EXTENSIONS.has(ext)) continue;
    const text = await readFile(join(distDir, file), 'utf8');
    for (const needle of policy.dist.forbiddenStrings) {
      if (text.includes(needle)) failures.push(`${file}: forbidden string "${needle}"`);
    }
    if (ext === '.html') failures.push(...checkHtml(policy, file, text));
    if (ext === '.css') {
      for (const match of text.matchAll(CSS_EXTERNAL)) failures.push(`${file}: external url() in CSS at ${context(text, match.index)}`);
    }
  }
  if (files.includes('_headers')) failures.push(...checkHeadersFile(policy, await readFile(join(distDir, '_headers'), 'utf8')));
  if (files.includes(policy.securityTxt.path)) {
    failures.push(...checkSecurityTxt(policy, await readFile(join(distDir, policy.securityTxt.path), 'utf8'), now));
  }
  return failures;
}
