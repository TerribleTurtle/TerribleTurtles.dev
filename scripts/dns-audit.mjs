#!/usr/bin/env node
// Cloudflare DoH DNS and host availability audit. Usage: node scripts/dns-audit.mjs [--strict]
// Resolves hostnames in security/hosts.json, verifies HTTPS availability, and audits DNSSEC/CAA/MX/SPF/DMARC.
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

/**
 * @typedef {{
 *   name: string,
 *   type: number,
 *   TTL: number,
 *   data: string
 * }} DnsAnswer
 *
 * @typedef {{
 *   Status: number,
 *   TC: boolean,
 *   RD: boolean,
 *   RA: boolean,
 *   AD: boolean,
 *   CD: boolean,
 *   Question?: Array<{ name: string, type: number }>,
 *   Answer?: DnsAnswer[]
 * }} DohResponse
 *
 * @typedef {{
 *   $comment?: string,
 *   hosts: string[]
 * }} HostsConfig
 */

const { values } = parseArgs({
  options: {
    strict: { type: 'boolean', default: false },
    hosts: { type: 'string' },
  },
});

const DEFAULT_HOSTS_URL = new URL('../security/hosts.json', import.meta.url);
const hostsUrl = values.hosts ? new URL(values.hosts, `file://${process.cwd()}/`) : DEFAULT_HOSTS_URL;

/** @type {HostsConfig} */
const config = JSON.parse(readFileSync(hostsUrl, 'utf8'));
if (!Array.isArray(config.hosts) || config.hosts.length === 0) {
  console.error('dns-audit: invalid hosts.json, expected a non-empty "hosts" array');
  process.exitCode = 1;
}

/**
 * Queries Cloudflare DoH JSON API.
 * @param {string} name
 * @param {string} type
 * @returns {Promise<DohResponse>}
 */
async function queryDoh(name, type) {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}&do=1`;
  const res = await fetch(url, { headers: { accept: 'application/dns-json' } });
  if (!res.ok) {
    throw new Error(`DoH query failed for ${name} (${type}): HTTP ${res.status}`);
  }
  return /** @type {Promise<DohResponse>} */ (res.json());
}

/** @type {string[]} */
const hostFailures = [];

console.log(`Auditing hosts from ${hostsUrl.pathname.replace(/^\/([A-Za-z]:)/, '$1')}...`);

// 1. Audit resolution and HTTPS answering for every host in hosts.json
console.log('\nHost Availability:');
for (const host of config.hosts || []) {
  let aCount = 0;
  let aaaaCount = 0;
  try {
    const [aRes, aaaaRes] = await Promise.all([queryDoh(host, 'A'), queryDoh(host, 'AAAA')]);
    aCount = aRes.Answer?.filter((a) => a.type === 1).length ?? 0;
    aaaaCount = aaaaRes.Answer?.filter((a) => a.type === 28).length ?? 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    hostFailures.push(`[${host}] DNS resolution query failed: ${msg}`);
  }

  const resolves = aCount > 0 || aaaaCount > 0;
  if (!resolves) {
    hostFailures.push(`[${host}] failed to resolve: no A or AAAA records found`);
  }

  let answersHttps = false;
  let httpsStatus = 0;
  let httpsError = '';
  try {
    const res = await fetch(`https://${host}/`, { method: 'GET', redirect: 'manual' });
    httpsStatus = res.status;
    answersHttps = res.status < 500;
  } catch (err) {
    httpsError = err instanceof Error ? err.message : String(err);
    answersHttps = false;
  }

  if (!answersHttps) {
    hostFailures.push(`[${host}] failed HTTPS GET (status: ${httpsStatus || 'none'}${httpsError ? `, error: ${httpsError}` : ''})`);
  }

  const resStatusStr = resolves ? `OK (A: ${aCount}, AAAA: ${aaaaCount})` : 'MISSING';
  const httpsStatusStr = answersHttps ? `OK (${httpsStatus})` : `FAIL (${httpsStatus || httpsError})`;
  console.log(`  ${host}: resolve ${resStatusStr}, HTTPS ${httpsStatusStr}`);
}

// 2. Report apex security records for terribleturtles.dev
const apex = 'terribleturtles.dev';
console.log(`\nApex Security Records (${apex}):`);

/** @type {DohResponse} */
const fallbackDoh = { Status: -1, TC: false, RD: false, RA: false, AD: false, CD: false, Answer: [] };

const [aRes, caaRes, mxRes, txtRes, dmarcRes] = await Promise.all([
  queryDoh(apex, 'A').catch(() => fallbackDoh),
  queryDoh(apex, 'CAA').catch(() => fallbackDoh),
  queryDoh(apex, 'MX').catch(() => fallbackDoh),
  queryDoh(apex, 'TXT').catch(() => fallbackDoh),
  queryDoh(`_dmarc.${apex}`, 'TXT').catch(() => fallbackDoh),
]);

// DNSSEC: AD true
const dnssecOk = aRes.AD === true;
console.log(`  DNSSEC: ${dnssecOk ? 'OK' : 'MISSING'}${!dnssecOk ? ' (AD flag false)' : ''}`);

// CAA records
const caaAnswers = caaRes.Answer?.filter((a) => a.type === 257) ?? [];
const caaOk = caaAnswers.length > 0;
console.log(`  CAA:    ${caaOk ? 'OK' : 'MISSING'}`);

// MX records (or null MX)
const mxAnswers = mxRes.Answer?.filter((a) => a.type === 15) ?? [];
const mxOk = mxAnswers.length > 0;
console.log(`  MX:     ${mxOk ? 'OK' : 'MISSING'}`);

// SPF: TXT starting with v=spf1
const spfRecords = (txtRes.Answer?.filter((a) => a.type === 16) ?? [])
  .map((a) => a.data.replace(/^"|"$/g, ''))
  .filter((data) => data.startsWith('v=spf1'));
const spfOk = spfRecords.length > 0;
console.log(`  SPF:    ${spfOk ? 'OK' : 'MISSING'}`);

// DMARC: TXT on _dmarc. starting with v=DMARC1
const dmarcRecords = (dmarcRes.Answer?.filter((a) => a.type === 16) ?? [])
  .map((a) => a.data.replace(/^"|"$/g, ''))
  .filter((data) => data.startsWith('v=DMARC1'));
const dmarcOk = dmarcRecords.length > 0;
/** @type {string | undefined} */
let pValue;
if (dmarcOk) {
  const pMatch = dmarcRecords[0]?.match(/(?:^|;\s*)p=([a-zA-Z]+)/);
  if (pMatch) pValue = pMatch[1]?.toLowerCase();
}
const dmarcStr = dmarcOk ? `OK (p=${pValue ?? 'unspecified'})` : 'MISSING';
console.log(`  DMARC:  ${dmarcStr}`);

// 3. Evaluate Pass/Fail based on mode
if (values.strict) {
  /** @type {string[]} */
  const strictFailures = [...hostFailures];
  if (!dnssecOk) strictFailures.push('DNSSEC is off (response AD is false)');
  if (!caaOk) strictFailures.push('CAA records are missing');
  if (!spfOk) strictFailures.push('SPF record (v=spf1) is missing');
  if (!dmarcOk) {
    strictFailures.push('DMARC record (_dmarc) is missing');
  } else if (pValue !== 'reject') {
    strictFailures.push(`DMARC policy is "p=${pValue ?? 'none'}", expected "p=reject"`);
  }

  if (strictFailures.length > 0) {
    console.error('\nFailures (--strict):');
    for (const f of strictFailures) {
      console.error(`FAIL ${f}`);
    }
    console.error(`\ndns-audit: FAIL (--strict: ${strictFailures.length} failure(s) found)`);
    process.exitCode = 1;
  } else {
    console.log('\ndns-audit: PASS (--strict: all security records and host requirements satisfied)');
    process.exitCode = 0;
  }
} else {
  if (hostFailures.length > 0) {
    console.error('\nFailures:');
    for (const f of hostFailures) {
      console.error(`FAIL ${f}`);
    }
    console.error(`\ndns-audit: FAIL (${hostFailures.length} host failure(s) found)`);
    process.exitCode = 1;
  } else {
    console.log('\ndns-audit: PASS (all hosts in hosts.json resolved and answered HTTPS)');
    process.exitCode = 0;
  }
}
