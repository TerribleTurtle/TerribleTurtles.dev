// Shared HTTP header conformance checks. Used by the local Playwright suite (tests/security/headers.spec.ts),
// the dist audit (scripts/lib/dist-audit.mjs, on the `_headers` file) and the live check (scripts/live-check.mjs).
// Pure functions: they take a status + header map and return human-readable failures (empty array = pass).

/** @typedef {import('./policy.mjs').Policy} Policy */
/** @typedef {import('./policy.mjs').RouteRule} RouteRule */
/** @typedef {{ status: number, headers: Record<string, string> }} HttpResult */

/**
 * Parses a CSP header value into a directive map. Later duplicates are ignored by browsers, so they are
 * reported separately instead of merged.
 * @param {string} value
 * @returns {{ directives: Map<string, string[]>, duplicates: string[] }}
 */
export function parseCsp(value) {
  /** @type {Map<string, string[]>} */
  const directives = new Map();
  /** @type {string[]} */
  const duplicates = [];
  for (const part of value.split(';')) {
    const [first, ...sources] = part.trim().split(/\s+/).filter(Boolean);
    if (first === undefined) continue;
    const name = first.toLowerCase();
    if (directives.has(name)) duplicates.push(name);
    else directives.set(name, sources);
  }
  return { directives, duplicates };
}

/** @param {Policy} policy @returns {string} the CSP value the policy demands. */
export function buildCsp(policy) {
  return Object.entries(policy.csp.directives).map(([name, sources]) => [name, ...sources].join(' ')).join('; ');
}

/** @param {Policy} policy @returns {string} the Permissions-Policy value the policy demands. */
export function buildPermissionsPolicy(policy) {
  return policy.permissionsPolicy.deniedFeatures.map((feature) => `${feature}=()`).join(', ');
}

/**
 * @param {Record<string, string>} headers
 * @returns {Map<string, string>} header names lower-cased
 */
function lowerCaseHeaders(headers) {
  return new Map(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value.trim()]));
}

/**
 * @param {Policy} policy
 * @param {string} value
 * @returns {string[]}
 */
export function checkCsp(policy, value) {
  /** @type {string[]} */
  const failures = [];
  if (value.includes(',')) failures.push('Content-Security-Policy contains several policies (comma); exactly one is expected');
  const { directives, duplicates } = parseCsp(value);
  for (const name of duplicates) failures.push(`CSP has a duplicate ${name} directive (browsers ignore the second one)`);
  for (const [name, expected] of Object.entries(policy.csp.directives)) {
    const actual = directives.get(name);
    if (actual === undefined) {
      failures.push(`CSP directive ${name} is missing (expected "${expected.join(' ')}")`);
      continue;
    }
    const same = actual.length === expected.length && [...actual].sort().join(' ') === [...expected].sort().join(' ');
    if (!same) failures.push(`CSP ${name} is "${actual.join(' ')}", expected "${expected.join(' ')}"`);
  }
  for (const [name, sources] of directives) {
    if (!(name in policy.csp.directives)) failures.push(`CSP has unexpected directive "${name}"`);
    for (const source of sources) {
      if (policy.csp.forbiddenTokens.includes(source.toLowerCase())) failures.push(`CSP ${name} contains forbidden token ${source}`);
      else if (!policy.csp.allowedSourceExpressions.includes(source)) failures.push(`CSP ${name} contains disallowed source ${source} (only ${policy.csp.allowedSourceExpressions.join(' ')} are allowed)`);
    }
  }
  return failures;
}

/**
 * @param {Policy} policy
 * @param {string} value
 * @returns {string[]}
 */
function checkPermissionsPolicy(policy, value) {
  /** @type {string[]} */
  const failures = [];
  /** @type {Map<string, string>} */
  const features = new Map();
  for (const entry of value.split(',')) {
    const [feature, allowlist] = entry.trim().split('=');
    if (feature) features.set(feature.trim(), (allowlist ?? '').trim());
  }
  for (const feature of policy.permissionsPolicy.deniedFeatures) {
    if (!features.has(feature)) failures.push(`Permissions-Policy feature ${feature} is missing`);
  }
  for (const [feature, allowlist] of features) {
    if (policy.permissionsPolicy.forbiddenFeatures.includes(feature)) failures.push(`Permissions-Policy contains forbidden feature ${feature}`);
    else if (allowlist !== '()') failures.push(`Permissions-Policy ${feature}=${allowlist} is not denied with ()`);
  }
  return failures;
}

/**
 * Checks the headers every response must carry (CSP, required, Permissions-Policy) and must not carry.
 * @param {Policy} policy
 * @param {Record<string, string>} headers
 * @returns {string[]}
 */
export function checkGlobalHeaders(policy, headers) {
  const h = lowerCaseHeaders(headers);
  /** @type {string[]} */
  const failures = [];
  const csp = h.get('content-security-policy');
  if (csp === undefined) failures.push('Content-Security-Policy header is missing');
  else failures.push(...checkCsp(policy, csp));
  for (const rule of policy.requiredHeaders) {
    const actual = h.get(rule.name.toLowerCase());
    if (actual === undefined) failures.push(`${rule.name} header is missing (expected "${rule.equals}")`);
    else if (actual !== rule.equals) failures.push(`${rule.name} is "${actual}", expected "${rule.equals}"`);
  }
  const pp = h.get('permissions-policy');
  if (pp === undefined) failures.push('Permissions-Policy header is missing');
  else failures.push(...checkPermissionsPolicy(policy, pp));
  for (const name of policy.forbiddenHeaders) {
    const actual = h.get(name.toLowerCase());
    if (actual !== undefined) failures.push(`forbidden header ${name} is present: "${actual}"`);
  }
  return failures;
}

/**
 * A policy content type without a charset (e.g. `text/html`) accepts the bare type or `; charset=utf-8`:
 * production Workers Static Assets serves the bare type while wrangler dev adds the charset, and
 * verify-dist proves those files declare their encoding (meta charset) or are ASCII. A policy value
 * that names a charset must match exactly.
 * @param {string} expected
 * @param {string | undefined} actual
 */
function contentTypeMatches(expected, actual) {
  if (actual === undefined) return false;
  if (actual === expected) return true;
  if (expected.includes(';')) return false;
  const parts = actual.split(';').map((part) => part.trim().toLowerCase());
  return parts.length === 2 && parts[0] === expected.toLowerCase() && parts[1] === 'charset=utf-8';
}

/**
 * Checks one response against its route class plus all global header rules.
 * @param {Policy} policy
 * @param {RouteRule} route
 * @param {string} path
 * @param {HttpResult} result
 * @returns {string[]} failures, each prefixed with the route class and path
 */
export function checkRoute(policy, route, path, result) {
  const h = lowerCaseHeaders(result.headers);
  /** @type {string[]} */
  const failures = [];
  if (result.status !== route.status) failures.push(`status ${result.status}, expected ${route.status}`);
  if (route.contentType !== undefined) {
    const actual = h.get('content-type');
    if (!contentTypeMatches(route.contentType, actual)) failures.push(`Content-Type is "${actual ?? '(absent)'}", expected "${route.contentType}"`);
  }
  /** @type {Array<[string, string | undefined]>} */
  const exact = [['Cache-Control', route.cacheControl], ['Location', route.location]];
  for (const [name, expected] of exact) {
    if (expected === undefined) continue;
    const actual = h.get(name.toLowerCase());
    if (actual !== expected) failures.push(`${name} is "${actual ?? '(absent)'}", expected "${expected}"`);
  }
  failures.push(...checkGlobalHeaders(policy, result.headers));
  return failures.map((failure) => `[${route.class}] ${path}: ${failure}`);
}
