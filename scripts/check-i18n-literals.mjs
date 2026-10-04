#!/usr/bin/env node
// @ts-check
/**
 * Hardcoded English literal check for .astro templates.
 * Fails when user-visible English text is typed directly into templates
 * instead of using the i18n dictionary.
 *
 * Usage:
 *   node scripts/check-i18n-literals.mjs [paths...]
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @typedef {{
 *   file: string,
 *   line: number,
 *   text: string,
 * }} LiteralFinding
 */

/**
 * Allowlist of brand and product names that may appear as literal text in templates.
 * Each entry includes an architectural justification.
 * @type {ReadonlySet<string>}
 */
export const ALLOWLIST = new Set([
  'TerribleTurtles', // Solo developer pseudonym and primary site brand name
  'GitHub', // Third-party open source platform name
]);

export const DEFAULT_ALLOWLIST = ALLOWLIST;

/**
 * Computes 1-indexed line number for a character offset in source text.
 * @param {string} source
 * @param {number} offset
 * @returns {number}
 */
export function getLineNumber(source, offset) {
  let line = 1;
  const limit = Math.min(offset, source.length);
  for (let i = 0; i < limit; i++) {
    if (source.charCodeAt(i) === 10) {
      line++;
    }
  }
  return line;
}

/**
 * Masks Astro frontmatter (between the first two `---` lines) with spaces,
 * preserving newlines to retain source character positions and line numbers.
 * @param {string} source
 * @returns {string}
 */
export function maskFrontmatter(source) {
  const match = source.match(/^(?:[ \t]*\r?\n)*---[^\r\n]*\r?\n[\s\S]*?\r?\n---[^\r\n]*(?:\r?\n|$)/);
  if (!match) return source;
  const len = match[0].length;
  const masked = match[0].replace(/[^\r\n]/g, ' ');
  return masked + source.slice(len);
}

/**
 * Masks <style>, <script>, and HTML comments with spaces, preserving newlines.
 * @param {string} source
 * @returns {string}
 */
export function maskStylesScriptsAndComments(source) {
  return source.replace(
    /<!--[\s\S]*?-->|<style\b[^>]*>[\s\S]*?<\/style>|<script\b[^>]*>[\s\S]*?<\/script>|<script\b[^>]*\/>|<style\b[^>]*\/>/gi,
    (match) => match.replace(/[^\r\n]/g, ' ')
  );
}

/**
 * Strips Astro/JSX expressions delimited by balanced curly braces {...},
 * replacing stripped characters with spaces while preserving newlines.
 * Handles strings ('...', "...", `...` with ${...}), line comments, and block comments.
 *
 * @param {string} source
 * @returns {string}
 */
export function maskExpressions(source) {
  const result = source.split('');
  const n = source.length;
  let i = 0;

  while (i < n) {
    if (source[i] === '{') {
      const start = i;
      let depth = 1;
      /** @type {Array<'CODE' | 'SINGLE' | 'DOUBLE' | 'TEMPLATE' | 'LINE_COMMENT' | 'BLOCK_COMMENT'>} */
      const stack = ['CODE'];
      i++;

      while (i < n && depth > 0) {
        const ch = source[i];
        const next = i + 1 < n ? source[i + 1] : '';
        const state = stack[stack.length - 1];

        if (state === 'SINGLE') {
          if (ch === '\\') {
            i += 2;
            continue;
          }
          if (ch === "'") {
            stack.pop();
          }
          i++;
          continue;
        }

        if (state === 'DOUBLE') {
          if (ch === '\\') {
            i += 2;
            continue;
          }
          if (ch === '"') {
            stack.pop();
          }
          i++;
          continue;
        }

        if (state === 'LINE_COMMENT') {
          if (ch === '\n') {
            stack.pop();
          }
          i++;
          continue;
        }

        if (state === 'BLOCK_COMMENT') {
          if (ch === '*' && next === '/') {
            stack.pop();
            i += 2;
            continue;
          }
          i++;
          continue;
        }

        if (state === 'TEMPLATE') {
          if (ch === '\\') {
            i += 2;
            continue;
          }
          if (ch === '$' && next === '{') {
            depth++;
            stack.push('CODE');
            i += 2;
            continue;
          }
          if (ch === '`') {
            stack.pop();
          }
          i++;
          continue;
        }

        // state === 'CODE'
        if (ch === "'") {
          stack.push('SINGLE');
          i++;
        } else if (ch === '"') {
          stack.push('DOUBLE');
          i++;
        } else if (ch === '`') {
          stack.push('TEMPLATE');
          i++;
        } else if (ch === '/' && next === '/') {
          stack.push('LINE_COMMENT');
          i += 2;
        } else if (ch === '/' && next === '*') {
          stack.push('BLOCK_COMMENT');
          i += 2;
        } else if (ch === '{') {
          depth++;
          i++;
        } else if (ch === '}') {
          depth--;
          i++;
          if (depth === 0) {
            break;
          }
          if (stack.length > 1 && stack[stack.length - 1] === 'CODE') {
            stack.pop();
          }
        } else {
          i++;
        }
      }

      for (let j = start; j < i; j++) {
        if (result[j] !== '\r' && result[j] !== '\n') {
          result[j] = ' ';
        }
      }
    } else {
      i++;
    }
  }

  return result.join('');
}

/**
 * Determines whether a given text snippet contains a hardcoded literal.
 * It's a literal if it contains at least one letter sequence of 2+ letters
 * [\p{L}]{2,} that is not in the allowlist.
 * HTML entities and symbols (↗, ←, ·, ©) are not letters and pass.
 *
 * @param {string} text
 * @param {ReadonlySet<string>} allowlist
 * @returns {boolean}
 */
export function isLiteral(text, allowlist) {
  // Strip HTML entities (&rarr;, &amp;, &#123;, etc.) so entity names are not treated as letters
  const cleaned = text.replace(/&[a-zA-Z0-9#]+;/g, ' ');
  const words = cleaned.match(/[\p{L}]{2,}/gu);
  if (!words) return false;
  return words.some((word) => !allowlist.has(word));
}

/**
 * Checks for literal attribute values in aria-label, alt, title, and placeholder.
 * Masked attributes are replaced with spaces in the returned source.
 *
 * @param {string} source
 * @param {string} file
 * @param {ReadonlySet<string>} allowlist
 * @returns {{ findings: Array<LiteralFinding & { offset: number }>, maskedSource: string }}
 */
function checkAndMaskAttributes(source, file, allowlist) {
  /** @type {Array<LiteralFinding & { offset: number }>} */
  const findings = [];
  const chars = source.split('');
  const attrRegex = /\b(aria-label|alt|title|placeholder)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  let match;

  while ((match = attrRegex.exec(source)) !== null) {
    const rawVal = match[2] ?? match[3] ?? '';
    const collapsed = rawVal.replace(/\s+/g, ' ').trim();
    const matchIndex = match.index;
    const matchLength = match[0].length;

    if (collapsed && isLiteral(collapsed, allowlist)) {
      const line = getLineNumber(source, matchIndex);
      findings.push({ file, line, text: collapsed, offset: matchIndex });
    }

    for (let j = matchIndex; j < matchIndex + matchLength; j++) {
      if (chars[j] !== '\r' && chars[j] !== '\n') {
        chars[j] = ' ';
      }
    }
  }

  return { findings, maskedSource: chars.join('') };
}

/**
 * Scans remaining text nodes between `>` and `<` (and outside tags).
 *
 * @param {string} source
 * @param {string} file
 * @param {ReadonlySet<string>} allowlist
 * @returns {Array<LiteralFinding & { offset: number }>}
 */
function checkTextNodes(source, file, allowlist) {
  /** @type {Array<LiteralFinding & { offset: number }>} */
  const findings = [];

  // Match text between > and <
  const regex = />([^<]+)(?=<)/g;
  let match;

  while ((match = regex.exec(source)) !== null) {
    const rawText = match[1];
    const collapsed = rawText.replace(/\s+/g, ' ').trim();
    if (!collapsed) continue;

    if (isLiteral(collapsed, allowlist)) {
      const leadingWsMatch = rawText.match(/^\s*/);
      const leadingWsLen = leadingWsMatch ? leadingWsMatch[0].length : 0;
      const textOffset = match.index + 1 + leadingWsLen;
      const line = getLineNumber(source, textOffset);
      findings.push({ file, line, text: collapsed, offset: textOffset });
    }
  }

  // Text before first <
  const firstLt = source.indexOf('<');
  if (firstLt > 0) {
    const rawText = source.slice(0, firstLt);
    const collapsed = rawText.replace(/\s+/g, ' ').trim();
    if (collapsed && isLiteral(collapsed, allowlist)) {
      const leadingWsMatch = rawText.match(/^\s*/);
      const leadingWsLen = leadingWsMatch ? leadingWsMatch[0].length : 0;
      const line = getLineNumber(source, leadingWsLen);
      findings.push({ file, line, text: collapsed, offset: leadingWsLen });
    }
  }

  // Text after last >
  const lastGt = source.lastIndexOf('>');
  if (lastGt >= 0 && lastGt < source.length - 1) {
    const rawText = source.slice(lastGt + 1);
    const collapsed = rawText.replace(/\s+/g, ' ').trim();
    if (collapsed && isLiteral(collapsed, allowlist)) {
      const leadingWsMatch = rawText.match(/^\s*/);
      const leadingWsLen = leadingWsMatch ? leadingWsMatch[0].length : 0;
      const offset = lastGt + 1 + leadingWsLen;
      const line = getLineNumber(source, offset);
      findings.push({ file, line, text: collapsed, offset });
    }
  }

  // File without any < or >
  if (firstLt === -1 && lastGt === -1) {
    const collapsed = source.replace(/\s+/g, ' ').trim();
    if (collapsed && isLiteral(collapsed, allowlist)) {
      const leadingWsMatch = source.match(/^\s*/);
      const leadingWsLen = leadingWsMatch ? leadingWsMatch[0].length : 0;
      const line = getLineNumber(source, leadingWsLen);
      findings.push({ file, line, text: collapsed, offset: leadingWsLen });
    }
  }

  return findings;
}

/**
 * Scans an Astro template source string for hardcoded English literals.
 *
 * @param {string} source - The Astro template source code.
 * @param {string} [file=''] - The file path for reporting findings.
 * @param {ReadonlySet<string> | Iterable<string>} [allowlist=ALLOWLIST] - Set of allowed words/names.
 * @returns {LiteralFinding[]}
 */
export function findLiterals(source, file = '', allowlist = ALLOWLIST) {
  const allowed = allowlist instanceof Set ? allowlist : new Set(allowlist ?? ALLOWLIST);

  // 1. Strip frontmatter
  let cleanSource = maskFrontmatter(source);

  // 2. Strip <style>, <script>, and HTML comments
  cleanSource = maskStylesScriptsAndComments(cleanSource);

  // 3. Strip {...} expressions
  cleanSource = maskExpressions(cleanSource);

  // 4. Check attributes (aria-label, alt, title, placeholder) and mask them
  const { findings: attrFindings, maskedSource } = checkAndMaskAttributes(cleanSource, file, allowed);

  // 5. Check text nodes between > and <
  const textFindings = checkTextNodes(maskedSource, file, allowed);

  // Merge and sort by document position (offset)
  const combined = [...attrFindings, ...textFindings];
  combined.sort((a, b) => a.offset - b.offset);

  return combined.map(({ file: f, line, text }) => ({ file: f, line, text }));
}

/**
 * Recursively collects all .astro files in a directory.
 * @param {string} dir
 * @returns {string[]}
 */
export function findAstroFiles(dir) {
  if (!existsSync(dir)) return [];
  /** @type {string[]} */
  const results = [];
  /** @param {string} current */
  function walk(current) {
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.astro')) {
        results.push(fullPath);
      }
    }
  }
  walk(dir);
  return results.sort();
}

/**
 * Resolves a list of input paths (files or directories) into a sorted list of .astro file paths.
 * @param {string[]} paths
 * @returns {string[]}
 */
export function resolveAstroPaths(paths) {
  /** @type {Set<string>} */
  const fileSet = new Set();
  for (const p of paths) {
    const resolved = resolve(p);
    if (!existsSync(resolved)) continue;
    const stat = statSync(resolved);
    if (stat.isDirectory()) {
      for (const f of findAstroFiles(resolved)) {
        fileSet.add(f);
      }
    } else if (stat.isFile() && resolved.endsWith('.astro')) {
      fileSet.add(resolved);
    }
  }
  return [...fileSet].sort();
}

/**
 * CLI execution logic.
 *
 * @param {string[]} [args=process.argv.slice(2)]
 * @param {(msg: string) => void} [log=console.log]
 * @returns {number} Exit code: 0 if no findings, 1 if any findings found.
 */
export function runCli(args = process.argv.slice(2), log = console.log) {
  const rootDir = process.cwd();
  /** @type {string[]} */
  let targetFiles;

  if (args.length > 0) {
    targetFiles = resolveAstroPaths(args);
  } else {
    const srcDir = join(rootDir, 'src');
    targetFiles = findAstroFiles(srcDir);
  }

  /** @type {LiteralFinding[]} */
  const allFindings = [];

  for (const absPath of targetFiles) {
    let displayPath = relative(rootDir, absPath).replaceAll('\\', '/');
    if (displayPath.startsWith('..')) {
      displayPath = absPath.replaceAll('\\', '/');
    }
    const source = readFileSync(absPath, 'utf8');
    const findings = findLiterals(source, displayPath);
    for (const f of findings) {
      allFindings.push(f);
    }
  }

  if (allFindings.length > 0) {
    for (const finding of allFindings) {
      log(`${finding.file}:${finding.line}  "${finding.text}"`);
    }
    return 1;
  }

  log(`check-i18n-literals: PASS (${targetFiles.length} files)`);
  return 0;
}

const isDirectRun = process.argv[1] &&
  resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();

if (isDirectRun) {
  const exitCode = runCli(process.argv.slice(2));
  process.exit(exitCode);
}
