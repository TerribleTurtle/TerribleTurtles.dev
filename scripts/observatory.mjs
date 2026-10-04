#!/usr/bin/env node
// Mozilla HTTP Observatory scan audit. Usage: node scripts/observatory.mjs [--host <hostname>]
// Triggers an Observatory scan and asserts that the resulting grade meets policy.observatory.minGrade.
import { parseArgs } from 'node:util';
import { loadPolicy, GRADES } from './lib/policy.mjs';

/**
 * @typedef {{
 *   id?: number,
 *   grade?: string,
 *   score?: number,
 *   tests_passed?: number,
 *   tests_failed?: number,
 *   tests_quantity?: number,
 *   details_url?: string,
 *   error?: string | null
 * }} ObservatoryResponse
 */

const { values } = parseArgs({
  options: {
    host: { type: 'string' },
  },
});

const policy = loadPolicy();
const host = values.host ?? policy.observatory.host;
const apiUrl = `https://observatory-api.mdn.mozilla.net/api/v2/scan?host=${encodeURIComponent(host)}`;

console.log(`Triggering Mozilla Observatory scan for ${host}...`);

/** @type {Response} */
let res;
try {
  res = await fetch(apiUrl, { method: 'POST' });
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`observatory: network error connecting to ${apiUrl}: ${msg}`);
  process.exit(1);
}

if (!res.ok) {
  const body = await res.text().catch(() => '');
  console.error(`observatory: scan request failed with HTTP ${res.status}: ${body}`);
  process.exit(1);
}

/** @type {ObservatoryResponse} */
let data;
try {
  data = /** @type {ObservatoryResponse} */ (await res.json());
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`observatory: failed to parse API response JSON: ${msg}`);
  process.exit(1);
}

console.log('\nObservatory Scan Results:');
console.log(`  Host:         ${host}`);
console.log(`  Grade:        ${data.grade ?? '(none)'}`);
console.log(`  Score:        ${data.score ?? '(none)'}`);
console.log(`  Tests Passed: ${data.tests_passed ?? '(none)'}`);
console.log(`  Tests Failed: ${data.tests_failed ?? '(none)'}`);
console.log(`  Details:      ${data.details_url ?? '(none)'}`);
if (data.error) {
  console.log(`  Error:        ${data.error}`);
}

const minGrade = policy.observatory.minGrade;
const minIndex = GRADES.indexOf(minGrade);
const actualGrade = data.grade;
const actualIndex = typeof actualGrade === 'string' ? GRADES.indexOf(actualGrade) : -1;

/** @type {string[]} */
const failures = [];

if (data.error) {
  failures.push(`Observatory reported error: "${data.error}"`);
}

if (!actualGrade || actualIndex === -1) {
  failures.push(`Scan returned invalid or missing grade: "${actualGrade ?? '(none)'}"`);
} else if (actualIndex > minIndex) {
  failures.push(`Grade "${actualGrade}" is below minimum required "${minGrade}"`);
}

if (failures.length > 0) {
  console.error('\nFailures:');
  for (const failure of failures) {
    console.error(`FAIL ${failure}`);
  }
  console.error(`\nobservatory: FAIL (${failures.length} failure(s) found)`);
  process.exitCode = 1;
} else {
  console.log(`\nobservatory: PASS (grade "${actualGrade}" satisfies minimum required "${minGrade}")`);
  process.exitCode = 0;
}
