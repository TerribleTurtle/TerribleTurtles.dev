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
