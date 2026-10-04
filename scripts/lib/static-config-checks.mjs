// Checks for the two static config files that ship in dist: `_headers` (Cloudflare) and `security.txt` (RFC 9116).
import { checkGlobalHeaders } from './header-check.mjs';

/** @typedef {import('./policy.mjs').Policy} Policy */
/** @typedef {{ pattern: string, headers: Map<string, string>, detached: string[] }} HeadersRule */

const DAY_MS = 86_400_000;
// Cloudflare limits: https://developers.cloudflare.com/workers/static-assets/headers/
const MAX_RULES = 100;
const MAX_LINE = 2000;
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Parses a Cloudflare `_headers` file. Duplicate header lines inside one rule are merged with ", " (as Cloudflare does).
 * @param {string} text
 * @returns {{ rules: HeadersRule[], errors: string[] }}
 */
export function parseHeadersFile(text) {
  /** @type {HeadersRule[]} */
  const rules = [];
  /** @type {string[]} */
  const errors = [];
  /** @type {HeadersRule | undefined} */
  let current;
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (raw.length > MAX_LINE) errors.push(`line ${index + 1} exceeds ${MAX_LINE} characters`);
    if (line === '' || line.startsWith('#')) return;
    if (!/^\s/.test(raw)) {
      current = { pattern: line, headers: new Map(), detached: [] };
      rules.push(current);
      return;
    }
    if (current === undefined) {
      errors.push(`line ${index + 1}: header line before any URL pattern`);
      return;
    }
    if (line.startsWith('!')) {
      current.detached.push(line.slice(1).trim().toLowerCase());
      return;
    }
    const colon = line.indexOf(':');
    if (colon < 1) {
      errors.push(`line ${index + 1}: not a "Name: value" header line`);
      return;
    }
    const name = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    const previous = current.headers.get(name);
    current.headers.set(name, previous === undefined ? value : `${previous}, ${value}`);
  });
  if (rules.length > MAX_RULES) errors.push(`${rules.length} rules exceed the Cloudflare limit of ${MAX_RULES}`);
  return { rules, errors };
}

/**
 * @param {Policy} policy
 * @param {string} text contents of dist/_headers
 * @returns {string[]}
 */
export function checkHeadersFile(policy, text) {
  const { rules, errors } = parseHeadersFile(text);
  const failures = errors.map((e) => `_headers: ${e}`);
  const globalNames = ['Content-Security-Policy', 'Permissions-Policy', ...policy.requiredHeaders.map((r) => r.name)];
  const root = rules.find((rule) => rule.pattern === '/*');
  if (root === undefined) failures.push('_headers: no "/*" rule, so the global security headers are not applied');
  else failures.push(...checkGlobalHeaders(policy, Object.fromEntries(root.headers)).map((f) => `_headers /*: ${f}`));
  for (const rule of rules) {
    for (const name of policy.forbiddenHeaders) {
      if (rule !== root && rule.headers.has(name.toLowerCase())) failures.push(`_headers ${rule.pattern}: forbidden header ${name}`);
    }
    for (const name of globalNames) {
      const lower = name.toLowerCase();
      if (rule.detached.includes(lower)) failures.push(`_headers ${rule.pattern}: removes required header ${name}`);
      if (rule !== root && rule.headers.has(lower)) failures.push(`_headers ${rule.pattern}: overrides global header ${name} (Cloudflare would merge both values)`);
    }
  }
  return failures;
}

/**
 * @param {Policy} policy
 * @param {string} text contents of security.txt
 * @param {Date} now
 * @returns {string[]}
 */
export function checkSecurityTxt(policy, text, now) {
  /** @type {string[]} */
  const failures = [];
  /** @type {Map<string, string[]>} */
  const fields = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon < 1) {
      failures.push(`security.txt: malformed line "${line}"`);
      continue;
    }
    const name = line.slice(0, colon).trim().toLowerCase();
    fields.set(name, [...(fields.get(name) ?? []), line.slice(colon + 1).trim()]);
  }
  const contacts = fields.get('contact') ?? [];
  if (contacts.length === 0) failures.push('security.txt: Contact field is missing (RFC 9116 requires one)');
  else if (!contacts.includes(policy.securityTxt.requiredContact)) failures.push(`security.txt: Contact must include ${policy.securityTxt.requiredContact}`);
  const expires = fields.get('expires') ?? [];
  const [first] = expires;
  if (expires.length !== 1 || first === undefined) {
    failures.push(`security.txt: exactly one Expires field is required (found ${expires.length})`);
  } else if (!RFC3339.test(first) || Number.isNaN(Date.parse(first))) {
    failures.push(`security.txt: Expires "${first}" is not a valid RFC 3339 date-time`);
  } else {
    const days = (Date.parse(first) - now.getTime()) / DAY_MS;
    const { minDaysBeforeExpiry: min, maxDaysBeforeExpiry: max } = policy.securityTxt;
    if (days <= 0) failures.push(`security.txt: Expires ${first} is in the past`);
    else if (days < min) failures.push(`security.txt: Expires ${first} is within ${min} days; renew it`);
    if (days > max) failures.push(`security.txt: Expires ${first} is more than ${max} days away (RFC 9116: under one year)`);
  }
  for (const canonical of fields.get('canonical') ?? []) {
    if (!canonical.startsWith('https://')) failures.push(`security.txt: Canonical "${canonical}" must be an https URL`);
  }
  return failures;
}
