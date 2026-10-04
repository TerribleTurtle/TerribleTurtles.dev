#!/usr/bin/env node
// Static artifact audit CLI. Usage: node scripts/verify-dist.mjs [--dist dist] [--now 2026-10-04T00:00:00Z]
// Exits 0 when dist/ satisfies security/policy.json, 1 with a list of failures otherwise, 2 on usage errors.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { loadPolicy } from './lib/policy.mjs';
import { auditDist } from './lib/dist-audit.mjs';

const { values } = parseArgs({ options: { dist: { type: 'string', default: 'dist' }, now: { type: 'string' } } });
const distDir = resolve(values.dist);
const now = values.now === undefined ? new Date() : new Date(values.now);

if (Number.isNaN(now.getTime())) {
  console.error(`verify-dist: --now "${values.now}" is not a date`);
  process.exit(2);
}
if (!existsSync(distDir)) {
  console.error(`verify-dist: ${distDir} does not exist. Run \`npm run build\` first.`);
  process.exit(2);
}

const failures = await auditDist(distDir, loadPolicy(), now);
if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.error(`verify-dist: ${failures.length} failure(s) in ${distDir}`);
  process.exit(1);
}
console.log(`verify-dist: OK, ${distDir} satisfies security/policy.json`);
