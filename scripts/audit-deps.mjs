#!/usr/bin/env node
// Dependency vulnerability audit. Usage: node scripts/audit-deps.mjs
// Verifies all dependencies against security/policy.json audit rules and ensures zero production vulns.
import { spawnSync } from 'node:child_process';
import { loadPolicy } from './lib/policy.mjs';

/**
 * @typedef {{
 *   source?: number,
 *   name?: string,
 *   dependency?: string,
 *   title?: string,
 *   url?: string,
 *   severity?: string,
 *   range?: string
 * }} ViaObject
 *
 * @typedef {{
 *   name: string,
 *   severity: string,
 *   isDirect: boolean,
 *   via: Array<string | ViaObject>,
 *   effects: string[],
 *   range: string,
 *   nodes?: string[]
 * }} VulnEntry
 *
 * @typedef {{
 *   auditReportVersion: number,
 *   vulnerabilities: Record<string, VulnEntry>,
 *   metadata: {
 *     vulnerabilities: Record<string, number>,
 *     dependencies: Record<string, number>
 *   }
 * }} AuditReport
 *
 * @typedef {{
 *   pkg: string,
 *   severity: string,
 *   advisory: string,
 *   status: 'allowlisted' | 'FAIL',
 *   error?: string
 * }} Finding
 */

const policy = loadPolicy();
const today = new Date().toISOString().slice(0, 10);

/**
 * Recursively resolves GHSA advisory IDs for a vulnerability entry.
 * @param {string} pkgName
 * @param {Record<string, VulnEntry>} vulnerabilities
 * @param {Set<string>} [visited]
 * @returns {Set<string>}
 */
function collectAdvisories(pkgName, vulnerabilities, visited = new Set()) {
  /** @type {Set<string>} */
  const ghsas = new Set();
  if (visited.has(pkgName)) return ghsas;
  visited.add(pkgName);

  const entry = vulnerabilities[pkgName];
  if (!entry || !Array.isArray(entry.via)) return ghsas;

  for (const item of entry.via) {
    if (typeof item === 'string') {
      const nested = collectAdvisories(item, vulnerabilities, visited);
      for (const id of nested) ghsas.add(id);
    } else if (item && typeof item === 'object' && typeof item.url === 'string') {
      const match = item.url.match(/GHSA(-[23456789cfghjmpqrvwx]{4}){3}/i);
      if (match) {
        ghsas.add(match[0]);
      }
    }
  }
  return ghsas;
}

// 1. Run full npm audit
const fullAuditResult = spawnSync('npm', ['audit', '--json'], { shell: true, encoding: 'utf8' });
if (!fullAuditResult.stdout) {
  console.error('audit-deps: failed to read stdout from `npm audit --json`');
  process.exit(1);
}

/** @type {AuditReport} */
let fullAudit;
try {
  fullAudit = JSON.parse(fullAuditResult.stdout);
} catch (err) {
  console.error(`audit-deps: failed to parse npm audit JSON: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

const vulnerabilities = fullAudit.vulnerabilities || {};
/** @type {Finding[]} */
const findings = [];
/** @type {string[]} */
const failureMessages = [];

for (const [pkgName, entry] of Object.entries(vulnerabilities)) {
  const sev = entry.severity?.toLowerCase();
  if (!policy.audit.failOnSeverities.includes(sev)) {
    continue;
  }

  const advisories = collectAdvisories(pkgName, vulnerabilities);
  if (advisories.size === 0) {
    findings.push({
      pkg: pkgName,
      severity: entry.severity,
      advisory: '(none)',
      status: 'FAIL',
      error: `Package "${pkgName}" has severity "${entry.severity}" but no advisory could be resolved`,
    });
    failureMessages.push(`FAIL: ${pkgName} (${entry.severity}) has no resolvable advisory`);
    continue;
  }

  for (const advId of advisories) {
    const allowEntry = policy.audit.allowlist.find((a) => a.id.toLowerCase() === advId.toLowerCase());
    if (!allowEntry) {
      findings.push({
        pkg: pkgName,
        severity: entry.severity,
        advisory: advId,
        status: 'FAIL',
        error: `Advisory ${advId} is not in policy.audit.allowlist`,
      });
      failureMessages.push(`FAIL: ${pkgName} advisory ${advId} is not in policy.audit.allowlist`);
    } else if (today > allowEntry.expires) {
      findings.push({
        pkg: pkgName,
        severity: entry.severity,
        advisory: advId,
        status: 'FAIL',
        error: `Allowlist entry for ${advId} expired on ${allowEntry.expires} (today is ${today})`,
      });
      failureMessages.push(`FAIL: ${pkgName} advisory ${advId} allowlist expired on ${allowEntry.expires} (today is ${today})`);
    } else {
      findings.push({
        pkg: pkgName,
        severity: entry.severity,
        advisory: advId,
        status: 'allowlisted',
      });
    }
  }
}

// 2. Run production-only audit
const prodAuditResult = spawnSync('npm', ['audit', '--omit=dev', '--json'], { shell: true, encoding: 'utf8' });
if (!prodAuditResult.stdout) {
  console.error('audit-deps: failed to read stdout from `npm audit --omit=dev --json`');
  process.exit(1);
}

/** @type {AuditReport} */
let prodAudit;
try {
  prodAudit = JSON.parse(prodAuditResult.stdout);
} catch (err) {
  console.error(`audit-deps: failed to parse npm audit --omit=dev JSON: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

const prodVulns = prodAudit.vulnerabilities || {};
for (const [pkgName, entry] of Object.entries(prodVulns)) {
  const sev = entry.severity?.toLowerCase();
  if (sev === 'high' || sev === 'critical') {
    failureMessages.push(`FAIL: Production dependency "${pkgName}" has ${entry.severity} vulnerability (zero high/critical permitted in production)`);
  }
}

// 3. Print findings table
console.log('Dependency Audit Findings:');
const colPkg = 36;
const colSev = 10;
const colAdv = 24;
const colStatus = 12;

console.log(
  'PACKAGE'.padEnd(colPkg) +
  'SEVERITY'.padEnd(colSev) +
  'ADVISORY'.padEnd(colAdv) +
  'STATUS'.padEnd(colStatus)
);
console.log('-'.repeat(colPkg + colSev + colAdv + colStatus));

if (findings.length === 0) {
  console.log('(no vulnerabilities matching policy severities found)');
} else {
  for (const f of findings) {
    console.log(
      f.pkg.padEnd(colPkg) +
      f.severity.padEnd(colSev) +
      f.advisory.padEnd(colAdv) +
      f.status.padEnd(colStatus)
    );
  }
}

// 4. Print outcome and exit
if (failureMessages.length > 0) {
  console.error('\nFailures:');
  for (const msg of failureMessages) {
    console.error(msg);
  }
  console.error(`\naudit-deps: FAIL (${failureMessages.length} failure(s) found)`);
  process.exit(1);
}

console.log(`\naudit-deps: PASS (all ${findings.length} dev vulnerability findings allowlisted; production dependencies have 0 high/critical vulnerabilities)`);
process.exit(0);
