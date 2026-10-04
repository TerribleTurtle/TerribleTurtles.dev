// Strict, dependency-free loader for security/policy.json. Any malformed or self-contradictory policy throws.
import { readFileSync } from 'node:fs';
import { PolicyError, assertRegex, int, list, optStr, record, str, strList } from './validate.mjs';

export { PolicyError };

/**
 * @typedef {{ name: string, equals: string }} HeaderRule
 * @typedef {{ from: string, pattern: string }} Discover
 * @typedef {{ class: string, paths: string[], discover: Discover | undefined, status: number,
 *   contentType: string | undefined, cacheControl: string | undefined, location: string | undefined }} RouteRule
 * @typedef {{ id: string, package: string, scope: 'dev', reason: string, expires: string }} AllowEntry
 * @typedef {{
 *   version: 1,
 *   csp: { directives: Record<string, string[]>, forbiddenTokens: string[], allowedSourceExpressions: string[] },
 *   requiredHeaders: HeaderRule[],
 *   permissionsPolicy: { deniedFeatures: string[], forbiddenFeatures: string[] },
 *   forbiddenHeaders: string[],
 *   routes: RouteRule[],
 *   previewHosts: { header: string, value: string, noindexHosts: string[], indexableHosts: string[] },
 *   dist: { forbiddenExtensions: string[], allowedScriptTypes: string[], forbiddenStrings: string[],
 *     requiredFiles: string[], whitespaceRegressionPatterns: string[] },
 *   securityTxt: { path: string, requiredContact: string, minDaysBeforeExpiry: number, maxDaysBeforeExpiry: number },
 *   audit: { failOnSeverities: string[], allowlist: AllowEntry[] },
 *   live: { origin: string, httpRedirect: { from: string, statuses: number[], location: string } },
 *   observatory: { host: string, minGrade: string }
 * }} Policy
 */

export const DEFAULT_POLICY_URL = new URL('../../security/policy.json', import.meta.url);
export const GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];


/** @param {unknown} raw @returns {Policy['csp']} */
function readCsp(raw) {
  const m = record(raw, 'csp', ['directives', 'forbiddenTokens', 'allowedSourceExpressions']);
  const forbiddenTokens = strList(m.get('forbiddenTokens'), 'csp.forbiddenTokens');
  const allowed = strList(m.get('allowedSourceExpressions'), 'csp.allowedSourceExpressions');
  /** @type {Record<string, string[]>} */
  const directives = {};
  for (const [name, sources] of record(m.get('directives'), 'csp.directives', [])) {
    const path = `csp.directives.${name}`;
    if (!Array.isArray(sources) || sources.length === 0) throw new PolicyError(`${path}: expected a non-empty array`);
    const values = strList(sources, path);
    for (const value of values) {
      if (forbiddenTokens.includes(value.toLowerCase())) throw new PolicyError(`${path}: contains forbidden token ${value}`);
      if (!allowed.includes(value)) throw new PolicyError(`${path}: ${value} is not an allowed source expression`);
    }
    directives[name.toLowerCase()] = values;
  }
  if (Object.keys(directives).length === 0) throw new PolicyError('csp.directives: expected at least one directive');
  return { directives, forbiddenTokens, allowedSourceExpressions: allowed };
}

/** @param {unknown} raw @param {number} i @returns {RouteRule} */
function readRoute(raw, i) {
  const path = `routes[${i}]`;
  const m = record(raw, path, ['class', 'status'], ['paths', 'discover', 'contentType', 'cacheControl', 'location']);
  const hasPaths = m.has('paths');
  if (hasPaths === m.has('discover')) throw new PolicyError(`${path}: needs exactly one of "paths" or "discover"`);
  /** @type {Discover | undefined} */
  let discover;
  if (m.has('discover')) {
    const d = record(m.get('discover'), `${path}.discover`, ['from', 'pattern']);
    discover = { from: str(d.get('from'), `${path}.discover.from`), pattern: str(d.get('pattern'), `${path}.discover.pattern`) };
    assertRegex(discover.pattern, `${path}.discover.pattern`);
  }
  return {
    class: str(m.get('class'), `${path}.class`),
    paths: hasPaths ? strList(m.get('paths'), `${path}.paths`) : [],
    discover,
    status: int(m.get('status'), `${path}.status`),
    contentType: optStr(m.get('contentType'), `${path}.contentType`),
    cacheControl: optStr(m.get('cacheControl'), `${path}.cacheControl`),
    location: optStr(m.get('location'), `${path}.location`),
  };
}

/** @param {unknown} raw @param {number} i @returns {AllowEntry} */
function readAllowEntry(raw, i) {
  const path = `audit.allowlist[${i}]`;
  const m = record(raw, path, ['id', 'package', 'scope', 'reason', 'expires']);
  if (m.get('scope') !== 'dev') throw new PolicyError(`${path}.scope: must be "dev" (production deps may never be allowlisted)`);
  const expires = str(m.get('expires'), `${path}.expires`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expires) || Number.isNaN(Date.parse(expires))) throw new PolicyError(`${path}.expires: expected YYYY-MM-DD`);
  const id = str(m.get('id'), `${path}.id`);
  if (!/^GHSA(-[23456789cfghjmpqrvwx]{4}){3}$/.test(id)) throw new PolicyError(`${path}.id: expected a GHSA id`);
  return { id, package: str(m.get('package'), `${path}.package`), scope: 'dev', reason: str(m.get('reason'), `${path}.reason`), expires };
}

/**
 * Validates an already-parsed policy object and returns it fully typed.
 * @param {unknown} raw
 * @returns {Policy}
 */
export function validatePolicy(raw) {
  const top = record(raw, '', ['version', 'csp', 'requiredHeaders', 'permissionsPolicy', 'forbiddenHeaders', 'routes',
    'previewHosts', 'dist', 'securityTxt', 'audit', 'live', 'observatory']);
  if (top.get('version') !== 1) throw new PolicyError('version: only version 1 is supported');

  const requiredHeaders = list(top.get('requiredHeaders'), 'requiredHeaders').map((r, i) => {
    const m = record(r, `requiredHeaders[${i}]`, ['name', 'equals']);
    return { name: str(m.get('name'), `requiredHeaders[${i}].name`), equals: str(m.get('equals'), `requiredHeaders[${i}].equals`) };
  });
  const pp = record(top.get('permissionsPolicy'), 'permissionsPolicy', ['deniedFeatures', 'forbiddenFeatures']);
  const deniedFeatures = strList(pp.get('deniedFeatures'), 'permissionsPolicy.deniedFeatures');
  const forbiddenFeatures = strList(pp.get('forbiddenFeatures'), 'permissionsPolicy.forbiddenFeatures', true);
  for (const f of forbiddenFeatures) if (deniedFeatures.includes(f)) throw new PolicyError(`permissionsPolicy: "${f}" is both denied and forbidden`);

  const ph = record(top.get('previewHosts'), 'previewHosts', ['header', 'value', 'noindexHosts', 'indexableHosts']);
  const dist = record(top.get('dist'), 'dist', ['forbiddenExtensions', 'allowedScriptTypes', 'forbiddenStrings', 'requiredFiles', 'whitespaceRegressionPatterns']);
  const whitespace = strList(dist.get('whitespaceRegressionPatterns'), 'dist.whitespaceRegressionPatterns');
  whitespace.forEach((p, i) => assertRegex(p, `dist.whitespaceRegressionPatterns[${i}]`));
  const st = record(top.get('securityTxt'), 'securityTxt', ['path', 'requiredContact', 'minDaysBeforeExpiry', 'maxDaysBeforeExpiry']);
  const minDays = int(st.get('minDaysBeforeExpiry'), 'securityTxt.minDaysBeforeExpiry');
  const maxDays = int(st.get('maxDaysBeforeExpiry'), 'securityTxt.maxDaysBeforeExpiry');
  if (minDays < 1 || maxDays > 366 || minDays >= maxDays) throw new PolicyError('securityTxt.minDaysBeforeExpiry/maxDaysBeforeExpiry: need 1 <= min < max <= 366');
  const audit = record(top.get('audit'), 'audit', ['failOnSeverities', 'allowlist']);
  const allowRaw = audit.get('allowlist');
  if (!Array.isArray(allowRaw)) throw new PolicyError('audit.allowlist: expected an array');
  const severities = strList(audit.get('failOnSeverities'), 'audit.failOnSeverities');
  for (const s of severities) if (!['low', 'moderate', 'high', 'critical'].includes(s)) throw new PolicyError(`audit.failOnSeverities: unknown severity "${s}"`);
  const live = record(top.get('live'), 'live', ['origin', 'httpRedirect']);
  const redirect = record(live.get('httpRedirect'), 'live.httpRedirect', ['from', 'statuses', 'location']);
  const obs = record(top.get('observatory'), 'observatory', ['host', 'minGrade']);
  const minGrade = str(obs.get('minGrade'), 'observatory.minGrade');
  if (!GRADES.includes(minGrade)) throw new PolicyError(`observatory.minGrade: "${minGrade}" is not one of ${GRADES.join(' ')}`);

  return {
    version: 1,
    csp: readCsp(top.get('csp')),
    requiredHeaders,
    permissionsPolicy: { deniedFeatures, forbiddenFeatures },
    forbiddenHeaders: strList(top.get('forbiddenHeaders'), 'forbiddenHeaders'),
    routes: list(top.get('routes'), 'routes').map(readRoute),
    previewHosts: {
      header: str(ph.get('header'), 'previewHosts.header'), value: str(ph.get('value'), 'previewHosts.value'),
      noindexHosts: strList(ph.get('noindexHosts'), 'previewHosts.noindexHosts'), indexableHosts: strList(ph.get('indexableHosts'), 'previewHosts.indexableHosts'),
    },
    dist: {
      forbiddenExtensions: strList(dist.get('forbiddenExtensions'), 'dist.forbiddenExtensions'),
      allowedScriptTypes: strList(dist.get('allowedScriptTypes'), 'dist.allowedScriptTypes'),
      forbiddenStrings: strList(dist.get('forbiddenStrings'), 'dist.forbiddenStrings'),
      requiredFiles: strList(dist.get('requiredFiles'), 'dist.requiredFiles'),
      whitespaceRegressionPatterns: whitespace,
    },
    securityTxt: { path: str(st.get('path'), 'securityTxt.path'), requiredContact: str(st.get('requiredContact'), 'securityTxt.requiredContact'), minDaysBeforeExpiry: minDays, maxDaysBeforeExpiry: maxDays },
    audit: { failOnSeverities: severities, allowlist: allowRaw.map(readAllowEntry) },
    live: {
      origin: str(live.get('origin'), 'live.origin'),
      httpRedirect: { from: str(redirect.get('from'), 'live.httpRedirect.from'), statuses: list(redirect.get('statuses'), 'live.httpRedirect.statuses').map((s, i) => int(s, `live.httpRedirect.statuses[${i}]`)), location: str(redirect.get('location'), 'live.httpRedirect.location') },
    },
    observatory: { host: str(obs.get('host'), 'observatory.host'), minGrade },
  };
}

/**
 * Reads, parses and validates the policy file. Throws (never returns a partial policy).
 * @param {URL | string} [location]
 * @returns {Policy}
 */
export function loadPolicy(location = DEFAULT_POLICY_URL) {
  return validatePolicy(JSON.parse(readFileSync(location, 'utf8')));
}
