#!/usr/bin/env node
// Live deployment conformance check. Usage: node scripts/live-check.mjs [--origin <url>]
// Verifies HTTP responses, headers, and redirects against security/policy.json, and runs the
// same HTML content checks as verify-dist on every served HTML page, so markup injected at the
// edge (Cloudflare email obfuscation, analytics beacons, Rocket Loader) fails the check.
import { parseArgs } from 'node:util';
import { loadPolicy } from './lib/policy.mjs';
import { checkRoute } from './lib/header-check.mjs';
import { checkHtml } from './lib/dist-audit.mjs';

const { values } = parseArgs({
  options: {
    origin: { type: 'string' },
  },
});

const policy = loadPolicy();
const canonicalOrigin = policy.live.origin.replace(/\/+$/, '');
const origin = (values.origin ?? canonicalOrigin).replace(/\/+$/, '');

/** @type {string[]} */
const failures = [];

/**
 * Header/status checks for one response, plus HTML content checks when the body is HTML.
 * @param {import('./lib/policy.mjs').RouteRule} route
 * @param {string} path
 * @param {Response} res
 */
async function auditResponse(route, path, res) {
  const headers = Object.fromEntries(res.headers.entries());
  failures.push(...checkRoute(policy, route, path, { status: res.status, headers }));
  if ((res.headers.get('content-type') ?? '').toLowerCase().startsWith('text/html')) {
    failures.push(...checkHtml(policy, `[${route.class}] ${path}`, await res.text()));
  } else {
    // Release the socket: unread bodies keep fetch handles open past the end of the script.
    await res.body?.cancel();
  }
}

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
        const res = await fetch(`${origin}${discoveredPath}`, { redirect: 'manual' });
        await auditResponse(route, discoveredPath, res);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(`[${route.class}] discover failed: ${msg}`);
    }
  } else {
    for (const path of route.paths) {
      try {
        const res = await fetch(`${origin}${path}`, { redirect: 'manual' });
        await auditResponse(route, path, res);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failures.push(`[${route.class}] ${path}: network error: ${msg}`);
      }
    }
  }
}

// 2. Audit plain HTTP redirect (only meaningful on the canonical domain)
if (origin !== canonicalOrigin) {
  console.log(`live-check: httpRedirect check skipped (--origin ${origin} is not the canonical ${canonicalOrigin})`);
} else {
  try {
    const redirectRes = await fetch(policy.live.httpRedirect.from, { redirect: 'manual' });
    if (!policy.live.httpRedirect.statuses.includes(redirectRes.status)) {
      failures.push(`[httpRedirect] ${policy.live.httpRedirect.from}: status ${redirectRes.status}, expected one of ${policy.live.httpRedirect.statuses.join(', ')}`);
    }
    const location = redirectRes.headers.get('location');
    await redirectRes.body?.cancel();
    if (location !== policy.live.httpRedirect.location) {
      failures.push(`[httpRedirect] ${policy.live.httpRedirect.from}: Location is "${location ?? '(absent)'}", expected "${policy.live.httpRedirect.location}"`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    failures.push(`[httpRedirect] ${policy.live.httpRedirect.from}: network error: ${msg}`);
  }
}

// 3. Print report. exitCode (not process.exit) lets open fetch sockets close first; calling
// process.exit() with live handles aborted Node on Windows (0xC0000409).
if (failures.length > 0) {
  console.error(`live-check: found ${failures.length} failure(s) against ${origin}:`);
  for (const failure of failures) {
    console.error(`FAIL ${failure}`);
  }
  console.error(`\nlive-check: FAIL (${failures.length} failure(s) found)`);
  process.exitCode = 1;
} else {
  console.log(`live-check: PASS (all routes, served HTML and HTTP redirect conform to security/policy.json against ${origin})`);
}
