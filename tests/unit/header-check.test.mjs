// Unit tests for the shared header checker (scripts/lib/header-check.mjs). Written before the implementation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPolicy } from '../../scripts/lib/policy.mjs';
import { parseCsp, buildCsp, buildPermissionsPolicy, checkGlobalHeaders, checkRoute } from '../../scripts/lib/header-check.mjs';

const policy = loadPolicy();

/** @returns {Record<string, string>} a header set that satisfies every global requirement. */
function goodHeaders() {
  /** @type {Record<string, string>} */
  const headers = {
    'content-security-policy': buildCsp(policy),
    'permissions-policy': buildPermissionsPolicy(policy),
  };
  for (const rule of policy.requiredHeaders) headers[rule.name.toLowerCase()] = rule.equals;
  return headers;
}

/**
 * @param {Record<string, string>} headers
 * @param {RegExp} pattern
 */
function assertFails(headers, pattern) {
  const failures = checkGlobalHeaders(policy, headers);
  assert.ok(failures.some((f) => pattern.test(f)), `expected a failure matching ${pattern}, got ${JSON.stringify(failures)}`);
}

test('parseCsp lower-cases directive names, keeps sources and flags duplicates', () => {
  const parsed = parseCsp("Default-Src 'none'; script-src 'self' https://a.example ; ;script-src 'none'");
  assert.deepEqual(parsed.directives.get('default-src'), ["'none'"]);
  assert.deepEqual(parsed.directives.get('script-src'), ["'self'", 'https://a.example']);
  assert.deepEqual(parsed.duplicates, ['script-src']);
});

test('a header set built from the policy passes', () => {
  assert.deepEqual(checkGlobalHeaders(policy, goodHeaders()), []);
});

test('header names are matched case-insensitively', () => {
  /** @type {Record<string, string>} */
  const upper = {};
  for (const [k, v] of Object.entries(goodHeaders())) upper[k.toUpperCase()] = v;
  assert.deepEqual(checkGlobalHeaders(policy, upper), []);
});

/** @type {Array<[string, (h: Record<string, string>) => void, RegExp]>} */
const cases = [
  ["'unsafe-inline' added to script-src", (h) => { h['content-security-policy'] = h['content-security-policy'].replace("script-src 'none'", "script-src 'none' 'unsafe-inline'"); }, /script-src.*'unsafe-inline'/],
  ['script-src *', (h) => { h['content-security-policy'] = h['content-security-policy'].replace("script-src 'none'", 'script-src *'); }, /script-src/],
  ['frame-ancestors removed', (h) => { h['content-security-policy'] = h['content-security-policy'].replace("; frame-ancestors 'none'", ''); }, /frame-ancestors.*missing/],
  ['trusted-types removed', (h) => { h['content-security-policy'] = h['content-security-policy'].replace("; trusted-types 'none'", ''); }, /trusted-types.*missing/],
  ['unexpected directive', (h) => { h['content-security-policy'] += '; sandbox'; }, /unexpected directive "sandbox"/],
  ['third-party host', (h) => { h['content-security-policy'] = h['content-security-policy'].replace("img-src 'self'", "img-src 'self' cdn.example.com"); }, /cdn\.example\.com/],
  ['duplicate directive', (h) => { h['content-security-policy'] += "; img-src 'none'"; }, /duplicate/],
  ['CSP missing', (h) => { delete h['content-security-policy']; }, /Content-Security-Policy.*missing/],
  ['HSTS removed', (h) => { delete h['strict-transport-security']; }, /Strict-Transport-Security.*missing/],
  ['HSTS weakened', (h) => { h['strict-transport-security'] = 'max-age=300'; }, /Strict-Transport-Security/],
  ['ACAO added', (h) => { h['access-control-allow-origin'] = '*'; }, /forbidden header Access-Control-Allow-Origin/],
  ['Set-Cookie added', (h) => { h['set-cookie'] = 'a=b'; }, /forbidden header Set-Cookie/],
  ['permission granted', (h) => { h['permissions-policy'] = h['permissions-policy'].replace('camera=()', 'camera=(self)'); }, /camera/],
  ['permission missing', (h) => { h['permissions-policy'] = h['permissions-policy'].replace('camera=(), ', ''); }, /camera.*missing/],
  ['interest-cohort present', (h) => { h['permissions-policy'] += ', interest-cohort=()'; }, /interest-cohort/],
];

for (const [name, mutate, pattern] of cases) {
  test(`checkGlobalHeaders fails when ${name}`, () => {
    const headers = goodHeaders();
    mutate(headers);
    assertFails(headers, pattern);
  });
}

test('checkRoute enforces status, content type, cache control and redirect location', () => {
  const font = policy.routes.find((r) => r.class === 'font');
  const redirect = policy.routes.find((r) => r.class === 'redirect');
  assert.ok(font && redirect);
  const ok = { status: 200, headers: { ...goodHeaders(), 'content-type': 'font/woff2', 'cache-control': font.cacheControl ?? '' } };
  assert.deepEqual(checkRoute(policy, font, '/fonts/x.woff2', ok), []);
  const bad = { status: 404, headers: { ...goodHeaders(), 'content-type': 'text/html', 'cache-control': 'no-store' } };
  const failures = checkRoute(policy, font, '/fonts/x.woff2', bad).join('\n');
  assert.match(failures, /status 404, expected 200/);
  assert.match(failures, /Content-Type/);
  assert.match(failures, /Cache-Control/);
  const wrongLocation = { status: 307, headers: { ...goodHeaders(), location: '/elsewhere/' } };
  assert.match(checkRoute(policy, redirect, '/about', wrongLocation).join('\n'), /Location/);
});

/**
 * @param {string} contentType
 * @returns {import('../../scripts/lib/policy.mjs').RouteRule}
 */
function routeWith(contentType) {
  return { class: 'probe', paths: ['/x/'], discover: undefined, status: 200, contentType, cacheControl: undefined, location: undefined };
}

test('a bare policy content type accepts the bare type or charset=utf-8, nothing else', () => {
  const route = routeWith('text/html');
  /** @param {string} ct */
  const run = (ct) => checkRoute(policy, route, '/x/', { status: 200, headers: { ...goodHeaders(), 'content-type': ct } }).join('\n');
  assert.equal(run('text/html'), '');
  assert.equal(run('text/html; charset=utf-8'), '');
  assert.equal(run('text/html;charset=UTF-8'), '');
  assert.match(run('text/html; charset=iso-8859-1'), /Content-Type/);
  assert.match(run('text/plain'), /Content-Type/);
  assert.match(run('text/html; charset=utf-8; foo=bar'), /Content-Type/);
});

test('a policy content type that names a charset stays exact', () => {
  const route = routeWith('text/plain; charset=utf-8');
  const bare = checkRoute(policy, route, '/x/', { status: 200, headers: { ...goodHeaders(), 'content-type': 'text/plain' } });
  assert.match(bare.join('\n'), /Content-Type/);
});
