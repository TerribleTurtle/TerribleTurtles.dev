#!/usr/bin/env node
// Live deployment conformance check. Usage: node scripts/live-check.mjs [--origin <url>]
// Verifies HTTP responses, headers, and redirects against security/policy.json.
import { parseArgs } from 'node:util';
import { loadPolicy } from './lib/policy.mjs';
import { checkRoute } from './lib/header-check.mjs';

const { values } = parseArgs({
  options: {
    origin: { type: 'string' },
  },
});

const policy = loadPolicy();
const origin = (values.origin ?? policy.live.origin).replace(/\/+$/, '');

/** @type {string[]} */
const failures = [];

// 1. Audit all configured policy routes
for (const route of policy.routes) {
  if (route.discover) {
    try {
      const discoverUrl = `${origin}${route.discover.from}`;
      const discRes = await fetch(discoverUrl, { redirect: 'manual' });
      const html = await discRes.text();
      const match = html.match(new RegExp(route.discover.pattern));
      if (!match || !match[1]) {
        failures.push(`[${route.class}] could not discover path from ${route.discover.from}: pattern did not match`);
      } else {
        const discoveredPath = match[1];
        const targetUrl = `${origin}${discoveredPath}`;
        const res = await fetch(targetUrl, { redirect: 'manual' });
        const headers = Object.fromEntries(res.headers.entries());
        failures.push(...checkRoute(policy, route, discoveredPath, { status: res.status, headers }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(`[${route.class}] discover failed: ${msg}`);
    }
  } else {
    for (const path of route.paths) {
      try {
        const targetUrl = `${origin}${path}`;
        const res = await fetch(targetUrl, { redirect: 'manual' });
        const headers = Object.fromEntries(res.headers.entries());
        failures.push(...checkRoute(policy, route, path, { status: res.status, headers }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failures.push(`[${route.class}] ${path}: network error: ${msg}`);
      }
    }
  }
}

// 2. Audit plain HTTP redirect
try {
  const redirectRes = await fetch(policy.live.httpRedirect.from, { redirect: 'manual' });
  if (!policy.live.httpRedirect.statuses.includes(redirectRes.status)) {
    failures.push(`[httpRedirect] ${policy.live.httpRedirect.from}: status ${redirectRes.status}, expected one of ${policy.live.httpRedirect.statuses.join(', ')}`);
  }
  const location = redirectRes.headers.get('location');
  if (location !== policy.live.httpRedirect.location) {
    failures.push(`[httpRedirect] ${policy.live.httpRedirect.from}: Location is "${location ?? '(absent)'}", expected "${policy.live.httpRedirect.location}"`);
  }
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  failures.push(`[httpRedirect] ${policy.live.httpRedirect.from}: network error: ${msg}`);
}

// 3. Print report and exit
if (failures.length > 0) {
  console.error(`live-check: found ${failures.length} failure(s) against ${origin}:`);
  for (const failure of failures) {
    console.error(`FAIL ${failure}`);
  }
  console.error(`\nlive-check: FAIL (${failures.length} failure(s) found)`);
  process.exit(1);
}

console.log(`live-check: PASS (all routes and HTTP redirect conform to security/policy.json against ${origin})`);
process.exit(0);
