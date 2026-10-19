// Unit tests for the dependency vulnerability audit (scripts/audit-deps.mjs). Written first (TDD).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectAdvisories, evaluateAudit } from '../../scripts/audit-deps.mjs';

/**
 * @param {Partial<import('../../scripts/lib/policy.mjs').Policy['audit']>} [overrides]
 * @returns {Pick<import('../../scripts/lib/policy.mjs').Policy, 'audit'>}
 */
function makePolicy(overrides = {}) {
  return {
    audit: {
      failOnSeverities: ['high', 'critical'],
      allowlist: [
        {
          id: 'GHSA-vfj7-8cjw-p6xm',
          package: 'braces',
          scope: 'dev',
          reason: 'Dev-only globbing dependency.',
          expires: '2027-01-04',
        },
      ],
      ...overrides,
    },
  };
}

/**
 * @param {Record<string, import('../../scripts/audit-deps.mjs').VulnEntry>} [vulnerabilities]
 * @returns {import('../../scripts/audit-deps.mjs').AuditReport}
 */
function makeReport(vulnerabilities = {}) {
  return {
    auditReportVersion: 2,
    vulnerabilities,
    metadata: {
      vulnerabilities: {},
      dependencies: {},
    },
  };
}

test('collectAdvisories resolves direct and transitive GHSA IDs without infinite loops on cycles', () => {
  const vulns = {
    stylelint: {
      name: 'stylelint',
      severity: 'high',
      isDirect: true,
      via: ['micromatch', 'stylelint'],
      effects: [],
      range: '*',
    },
    micromatch: {
      name: 'micromatch',
      severity: 'high',
      isDirect: false,
      via: ['braces'],
      effects: ['stylelint'],
      range: '*',
    },
    braces: {
      name: 'braces',
      severity: 'high',
      isDirect: false,
      via: [
        {
          source: 1,
          name: 'braces',
          dependency: 'braces',
          title: 'Uncontrolled resource consumption in braces',
          url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm',
          severity: 'high',
          range: '<3.0.3',
        },
      ],
      effects: ['micromatch'],
      range: '<3.0.3',
    },
  };

  assert.deepEqual([...collectAdvisories('stylelint', vulns)], ['GHSA-vfj7-8cjw-p6xm']);
});

test('evaluateAudit passes when all high/critical dev vulnerabilities match an unexpired allowlist entry and prod is clean', () => {
  const fullAudit = makeReport({
    braces: {
      name: 'braces',
      severity: 'high',
      isDirect: false,
      via: [{ url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm' }],
      effects: [],
      range: '<3.0.3',
    },
  });
  const prodAudit = makeReport({});
  const result = evaluateAudit({
    fullAudit,
    prodAudit,
    policy: makePolicy(),
    today: '2026-10-18',
  });

  assert.deepEqual(result.failureMessages, []);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0]?.status, 'allowlisted');
});

test('evaluateAudit fails on an unallowlisted high/critical dev vulnerability', () => {
  const fullAudit = makeReport({
    braces: {
      name: 'braces',
      severity: 'high',
      isDirect: false,
      via: [{ url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm' }],
      effects: [],
      range: '<3.0.3',
    },
    unlisted: {
      name: 'unlisted',
      severity: 'critical',
      isDirect: true,
      via: [{ url: 'https://github.com/advisories/GHSA-2222-3333-4444' }],
      effects: [],
      range: '*',
    },
  });
  const result = evaluateAudit({
    fullAudit,
    prodAudit: makeReport({}),
    policy: makePolicy(),
    today: '2026-10-18',
  });

  assert.ok(
    result.failureMessages.some((m) => m.includes('GHSA-2222-3333-4444') && m.includes('not in policy.audit.allowlist')),
    `expected unallowlisted failure, got ${JSON.stringify(result.failureMessages)}`,
  );
});

test('evaluateAudit fails when a matched allowlist entry is expired', () => {
  const fullAudit = makeReport({
    braces: {
      name: 'braces',
      severity: 'high',
      isDirect: false,
      via: [{ url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm' }],
      effects: [],
      range: '<3.0.3',
    },
  });
  const result = evaluateAudit({
    fullAudit,
    prodAudit: makeReport({}),
    policy: makePolicy(),
    today: '2027-01-05',
  });

  assert.ok(
    result.failureMessages.some((m) => m.includes('GHSA-vfj7-8cjw-p6xm') && m.includes('expired on 2027-01-04')),
    `expected expiry failure, got ${JSON.stringify(result.failureMessages)}`,
  );
});

test('evaluateAudit fails when a production dependency has a high or critical vulnerability', () => {
  const fullAudit = makeReport({
    braces: {
      name: 'braces',
      severity: 'high',
      isDirect: false,
      via: [{ url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm' }],
      effects: [],
      range: '<3.0.3',
    },
  });
  const prodAudit = makeReport({
    astro: {
      name: 'astro',
      severity: 'high',
      isDirect: true,
      via: [{ url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm' }],
      effects: [],
      range: '*',
    },
  });
  const result = evaluateAudit({
    fullAudit,
    prodAudit,
    policy: makePolicy(),
    today: '2026-10-18',
  });

  assert.ok(
    result.failureMessages.some((m) => m.includes('Production dependency "astro"')),
    `expected prod vulnerability failure, got ${JSON.stringify(result.failureMessages)}`,
  );
});

test('evaluateAudit fails when policy.audit.allowlist contains an unused / stale entry not present in npm audit', () => {
  const fullAudit = makeReport({
    braces: {
      name: 'braces',
      severity: 'high',
      isDirect: false,
      via: [{ url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm' }],
      effects: [],
      range: '<3.0.3',
    },
  });
  const policy = makePolicy({
    allowlist: [
      {
        id: 'GHSA-vfj7-8cjw-p6xm',
        package: 'braces',
        scope: 'dev',
        reason: 'Dev-only globbing dependency.',
        expires: '2027-01-04',
      },
      {
        id: 'GHSA-wq5f-xc86-pv6w',
        package: 'sharp',
        scope: 'dev',
        reason: 'Resolved upstream.',
        expires: '2027-04-08',
      },
    ],
  });

  const result = evaluateAudit({
    fullAudit,
    prodAudit: makeReport({}),
    policy,
    today: '2026-10-18',
  });

  assert.ok(
    result.failureMessages.some(
      (m) => m.includes('GHSA-wq5f-xc86-pv6w') && m.includes('sharp') && m.includes('stale'),
    ),
    `expected stale allowlist failure for sharp, got ${JSON.stringify(result.failureMessages)}`,
  );
});
