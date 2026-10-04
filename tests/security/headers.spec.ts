import { test, expect, type APIResponse } from '@playwright/test';
import { request as httpRequest } from 'node:http';
import { loadPolicy } from '../../scripts/lib/policy.mjs';
import { checkRoute, parseCsp } from '../../scripts/lib/header-check.mjs';

/**
 * Header conformance against real `wrangler dev` (workerd + the built `_headers`).
 * Every expectation comes from security/policy.json through the shared checker (scripts/lib/header-check.mjs),
 * the same code the live check uses after cutover.
 */
const policy = loadPolicy();

/** Collapses repeated header lines the way HTTP does (comma-joined), so duplicate CSP headers are visible. */
function headerRecord(response: APIResponse): Record<string, string> {
  const record: Record<string, string> = {};
  for (const { name, value } of response.headersArray()) {
    const key = name.toLowerCase();
    record[key] = record[key] === undefined ? value : `${record[key]}, ${value}`;
  }
  return record;
}

for (const route of policy.routes) {
  const discover = route.discover;
  if (discover !== undefined) {
    test(`[${route.class}] path discovered from ${discover.from} meets the policy`, async ({ request }) => {
      const page = await request.get(discover.from);
      const match = new RegExp(discover.pattern).exec(await page.text());
      expect(match?.[1], `no match for ${discover.pattern} in ${discover.from}`).toBeTruthy();
      const path = match?.[1] ?? '';
      const response = await request.get(path, { maxRedirects: 0 });
      expect(checkRoute(policy, route, path, { status: response.status(), headers: headerRecord(response) })).toEqual([]);
    });
    continue;
  }
  for (const path of route.paths) {
    test(`[${route.class}] ${path} meets the policy`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(checkRoute(policy, route, path, { status: response.status(), headers: headerRecord(response) })).toEqual([]);
    });
  }
}

test('the HTML CSP parses to exactly the policy directives (directive-by-directive)', async ({ request }) => {
  const response = await request.get('/');
  const { directives, duplicates } = parseCsp(response.headers()['content-security-policy'] ?? '');
  expect(duplicates).toEqual([]);
  expect([...directives.keys()].sort()).toEqual(Object.keys(policy.csp.directives).sort());
  for (const [name, expected] of Object.entries(policy.csp.directives)) {
    expect(directives.get(name), name).toEqual(expected);
  }
});

test('response bodies: security.txt and the 404 page are the real files', async ({ request }) => {
  const txt = await (await request.get('/.well-known/security.txt')).text();
  expect(txt).toContain(`Contact: ${policy.securityTxt.requiredContact}`);
  expect(txt).toMatch(/^Expires: \S+$/m);
  const notFound = await request.get('/this-page-does-not-exist/');
  expect(notFound.status()).toBe(404);
  expect(await notFound.text()).toContain('<h1');
});

/** Sends a request with an arbitrary Host header (fetch-style clients do not allow overriding it). */
function getWithHost(baseURL: string, host: string): Promise<Record<string, string | string[] | undefined>> {
  const base = new URL(baseURL);
  return new Promise((resolve, reject) => {
    const req = httpRequest({ hostname: base.hostname, port: base.port, path: '/', headers: { host } }, (res) => {
      res.resume();
      resolve(res.headers);
    });
    req.on('error', reject);
    req.end();
  });
}

test('preview / workers.dev hosts are noindex, the canonical host is indexable', async ({ baseURL }) => {
  expect(baseURL).toBeTruthy();
  const header = policy.previewHosts.header.toLowerCase();
  for (const host of policy.previewHosts.noindexHosts) {
    expect((await getWithHost(baseURL ?? '', host))[header], host).toBe(policy.previewHosts.value);
  }
  for (const host of policy.previewHosts.indexableHosts) {
    expect((await getWithHost(baseURL ?? '', host))[header], host).toBeUndefined();
  }
});
