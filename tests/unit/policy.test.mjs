// Unit tests for the policy loader (scripts/lib/policy.mjs). Written before the implementation (TDD).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadPolicy, validatePolicy, PolicyError } from '../../scripts/lib/policy.mjs';

const POLICY_PATH = new URL('../../security/policy.json', import.meta.url);

// `any` is deliberate here: these tests corrupt raw, not-yet-validated JSON in ways the
// Policy type forbids. Typing it would make the malformed cases impossible to express.
/** @returns {Record<string, any>} a fresh, mutable copy of the real policy file. */
function rawPolicy() {
  return JSON.parse(readFileSync(POLICY_PATH, 'utf8'));
}

test('the committed security/policy.json is valid', () => {
  const policy = loadPolicy();
  assert.equal(policy.version, 1);
  assert.deepEqual(policy.csp.directives['default-src'], ["'none'"]);
  assert.ok(policy.routes.length > 0);
});

/** @type {Array<[string, (p: Record<string, any>) => void, RegExp]>} */
const malformed = [
  ['unknown top-level key', (p) => { p.surprise = true; }, /unknown key "surprise"/],
  ['missing section', (p) => { delete p.csp; }, /csp: missing/],
  ['wrong version', (p) => { p.version = 2; }, /version/],
  ['forbidden token inside a required directive', (p) => { p.csp.directives['script-src'] = ["'unsafe-inline'"]; }, /forbidden token/],
  ['host source not in the allowed source list', (p) => { p.csp.directives['img-src'] = ["'self'", 'cdn.example.com']; }, /not an allowed source/],
  ['empty directive list', (p) => { p.csp.directives['img-src'] = []; }, /non-empty/],
  ['required header without a value rule', (p) => { p.requiredHeaders.push({ name: 'X-Test' }); }, /equals/],
  ['permissions feature both denied and forbidden', (p) => { p.permissionsPolicy.forbiddenFeatures.push('camera'); }, /both denied and forbidden/],
  ['route with neither paths nor discover', (p) => { p.routes.push({ class: 'x', status: 200 }); }, /paths.*discover/],
  ['route status not an integer', (p) => { p.routes[0].status = '200'; }, /status/],
  ['invalid discover regex', (p) => { p.routes[2].discover.pattern = '(['; }, /regular expression/],
  ['allowlist expiry not a date', (p) => { p.audit.allowlist[0].expires = 'soon'; }, /expires/],
  ['allowlist scope not dev', (p) => { p.audit.allowlist[0].scope = 'prod'; }, /scope/],
  ['unknown observatory grade', (p) => { p.observatory.minGrade = 'A++'; }, /minGrade/],
  ['security.txt window inverted', (p) => { p.securityTxt.minDaysBeforeExpiry = 400; }, /minDaysBeforeExpiry/],
  ['non-array forbiddenHeaders', (p) => { p.forbiddenHeaders = 'Set-Cookie'; }, /forbiddenHeaders/],
];

for (const [name, mutate, message] of malformed) {
  test(`a malformed policy fails loudly: ${name}`, () => {
    const raw = rawPolicy();
    mutate(raw);
    assert.throws(() => validatePolicy(raw), (error) => {
      assert.ok(error instanceof PolicyError, 'expected a PolicyError');
      assert.match(error.message, message);
      return true;
    });
  });
}

test('$comment keys are allowed anywhere', () => {
  const raw = rawPolicy();
  raw.csp.$comment_extra = 'note';
  assert.doesNotThrow(() => validatePolicy(raw));
});

// --- Page list (single source of truth for every HTML page) ---

/** @param {import('../../scripts/lib/policy.mjs').Policy} policy @param {string} cls */
function routePaths(policy, cls) {
  const route = policy.routes.find((r) => r.class === cls);
  assert.ok(route, `route class ${cls} exists`);
  return route.paths;
}

test('the committed policy still covers exactly the pages it covered before the restructure', () => {
  const policy = loadPolicy();
  for (const path of ['/', '/about/', '/privacy/', '/security/', '/work/spellcastersdb/', '/work/spellcasters-community-api/']) {
    assert.ok(routePaths(policy, 'html').includes(path), `html covers ${path}`);
  }
  assert.ok(routePaths(policy, 'not-found').includes('/this-page-does-not-exist/'));
  for (const path of ['/og.png', '/og/spellcastersdb.png', '/og/spellcasters-community-api.png']) {
    assert.ok(routePaths(policy, 'image').includes(path), `image covers ${path}`);
  }
});

test('pages expand across every locale; the default locale has no prefix', () => {
  const raw = rawPolicy();
  raw.pages.locales = ['en', 'es'];
  const policy = validatePolicy(raw);
  const about = policy.pages.expanded.filter((p) => p.basePath === '/about/');
  assert.deepEqual(about.map((p) => [p.path, p.locale]), [['/about/', 'en'], ['/es/about/', 'es']]);
  assert.ok(policy.pages.expanded.some((p) => p.path === '/es/' && p.kind === 'home'));
});

test('route includes expand from the page list (html, not-found, project og images)', () => {
  const raw = rawPolicy();
  raw.pages.locales = ['en', 'es'];
  const policy = validatePolicy(raw);
  assert.deepEqual(routePaths(policy, 'html'), policy.pages.expanded.map((p) => p.path));
  assert.deepEqual(routePaths(policy, 'not-found'), ['/this-page-does-not-exist/', '/es/this-page-does-not-exist/']);
  const images = routePaths(policy, 'image');
  assert.ok(images.includes('/og.png'), 'explicit paths are kept');
  assert.ok(images.includes('/og/spellcastersdb.png'));
  assert.ok(images.includes('/og/es/spellcastersdb.png'));
});

/** @type {Array<[string, (p: Record<string, any>) => void, RegExp]>} */
const malformedPages = [
  ['page path without slashes', (p) => { p.pages.entries.push({ path: 'about', kind: 'page' }); }, /path/],
  ['duplicate page path', (p) => { p.pages.entries.push({ path: '/about/', kind: 'page' }); }, /duplicate/],
  ['project page without an id', (p) => { p.pages.entries.push({ path: '/work/x/', kind: 'project' }); }, /id/],
  ['unknown page kind', (p) => { p.pages.entries.push({ path: '/x/', kind: 'blog' }); }, /kind/],
  ['default locale not in locales', (p) => { p.pages.defaultLocale = 'fr'; }, /defaultLocale/],
  ['page path carries a locale prefix', (p) => { p.pages.locales = ['en', 'es']; p.pages.entries.push({ path: '/es/x/', kind: 'page' }); }, /locale prefix/],
  ['unknown route include', (p) => { p.routes[0].include = ['everything']; }, /include/],
  ['include combined with discover', (p) => { p.routes[2].include = ['pages']; }, /discover/],
];

for (const [name, mutate, message] of malformedPages) {
  test(`a malformed page list fails loudly: ${name}`, () => {
    const raw = rawPolicy();
    mutate(raw);
    assert.throws(() => validatePolicy(raw), (error) => {
      assert.ok(error instanceof PolicyError, 'expected a PolicyError');
      assert.match(error.message, message);
      return true;
    });
  });
}
