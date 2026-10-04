// Unit tests for the static artifact audit (scripts/verify-dist.mjs + scripts/lib/dist-audit.mjs). Written first (TDD).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPolicy } from '../../scripts/lib/policy.mjs';
import { auditDist } from '../../scripts/lib/dist-audit.mjs';
import { makePassingDist, renderSecurityTxt, writeFile } from './helpers/fixture-dist.mjs';

const policy = loadPolicy();
const NOW = new Date('2026-10-04T00:00:00.000Z');
const CLI = fileURLToPath(new URL('../../scripts/verify-dist.mjs', import.meta.url));

/**
 * @param {(dir: string) => void} mutate
 * @returns {Promise<string[]>}
 */
async function auditWith(mutate) {
  const dir = makePassingDist(policy, NOW);
  try {
    mutate(dir);
    return await auditDist(dir, policy, NOW);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * @param {string} dir
 * @param {string} name
 * @param {(html: string) => string} edit
 */
function editFile(dir, name, edit) {
  writeFile(dir, name, edit(readFileSync(join(dir, name), 'utf8')));
}

test('a compliant dist passes with zero failures', async () => {
  assert.deepEqual(await auditWith(() => {}), []);
});

/** @type {Array<[string, (dir: string) => void, RegExp]>} */
const failing = [
  ['a .js file', (d) => writeFile(d, '_astro/app.js', 'x'), /forbidden file type.*app\.js/],
  ['an inline executable script', (d) => editFile(d, 'index.html', (h) => h.replace('</body>', '<script>window.__pwned=1</script></body>')), /<script> without an allowed type/],
  ['an external script', (d) => editFile(d, 'index.html', (h) => h.replace('</body>', '<script src="https://evil.example/x.js"></script></body>')), /(<script>|external).*evil\.example|evil\.example.*(script|external)/],
  ['a module script', (d) => editFile(d, 'about/index.html', (h) => h.replace('</body>', '<script type="module" src="/a.mjs"></script></body>')), /<script> without an allowed type/],
  ['a style attribute', (d) => editFile(d, 'index.html', (h) => h.replace('<main id="main">', '<main id="main" style="color:red">')), /style= attribute/],
  ['a <style> block', (d) => editFile(d, '404.html', (h) => h.replace('</head>', '<style>p{}</style></head>')), /<style> block/],
  ['an iframe', (d) => editFile(d, 'index.html', (h) => h.replace('</main>', '<iframe src="/x/"></iframe></main>')), /<iframe>/],
  ['a form', (d) => editFile(d, 'index.html', (h) => h.replace('</main>', '<form action="/x"></form></main>')), /<form>/],
  ['an external image', (d) => editFile(d, 'index.html', (h) => h.replace('src="/og.png"', 'src="https://cdn.example.com/a.png"')), /external resource.*cdn\.example\.com/],
  ['a protocol-relative stylesheet', (d) => editFile(d, 'index.html', (h) => h.replace('href="/_astro/site.abc123.css"', 'href="//cdn.example.com/a.css"')), /external resource.*cdn\.example\.com/],
  ['an external CSS url()', (d) => writeFile(d, '_astro/x.css', 'a{background:url(https://cdn.example.com/x.png)}'), /external url\(\) in CSS/],
  ['the Astro whitespace regression (text<a)', (d) => editFile(d, 'index.html', (h) => h.replace('Read the <a', 'Read the<a')), /whitespace regression/],
  ['the Astro whitespace regression (</a>text)', (d) => editFile(d, 'index.html', (h) => h.replace('about page</a> or', 'about page</a>or')), /whitespace regression/],
  ['a fixture string', (d) => editFile(d, 'about/index.html', (h) => h.replace('About', 'Test Bitrot')), /forbidden string "Test Bitrot"/],
  ['an invalid ld+json block', (d) => editFile(d, 'index.html', (h) => h.replace('"WebSite"}', '"WebSite"')), /ld\+json.*does not parse/],
  ['a missing security.txt', (d) => rmSync(join(d, '.well-known/security.txt')), /missing required file \.well-known\/security\.txt/],
  ['an expired security.txt', (d) => writeFile(d, '.well-known/security.txt', renderSecurityTxt(NOW, -1)), /Expires.*past/],
  ['a security.txt expiring within 30 days', (d) => writeFile(d, '.well-known/security.txt', renderSecurityTxt(NOW, 10)), /Expires.*within 30 days/],
  ['a security.txt expiring more than a year out', (d) => writeFile(d, '.well-known/security.txt', renderSecurityTxt(NOW, 400)), /Expires.*more than 365 days/],
  ['a security.txt without Contact', (d) => editFile(d, '.well-known/security.txt', (t) => t.replace(/^Contact:.*\n/m, '')), /Contact/],
  ['an unparseable Expires', (d) => editFile(d, '.well-known/security.txt', (t) => t.replace(/^Expires:.*$/m, 'Expires: next year')), /Expires.*not a valid/],
  ['a missing _headers', (d) => rmSync(join(d, '_headers')), /missing required file _headers/],
  ["'unsafe-inline' in the _headers CSP", (d) => editFile(d, '_headers', (t) => t.replace("script-src 'none'", "script-src 'none' 'unsafe-inline'")), /_headers.*'unsafe-inline'/],
  ['HSTS removed from _headers', (d) => editFile(d, '_headers', (t) => t.replace(/^ {2}Strict-Transport-Security:.*\n/m, '')), /_headers.*Strict-Transport-Security.*missing/],
  ['a forbidden header in any _headers rule', (d) => editFile(d, '_headers', (t) => `${t}\n/x/*\n  Set-Cookie: a=b\n`), /_headers.*forbidden header Set-Cookie/],
  ['a required header detached with !', (d) => editFile(d, '_headers', (t) => `${t}\n/x/*\n  ! Content-Security-Policy\n`), /_headers.*removes required header Content-Security-Policy/],
  // Markup Cloudflare zone features inject at the edge (live-check runs checkHtml on served pages too).
  ['a Cloudflare email-obfuscation link', (d) => editFile(d, 'about/index.html', (h) => h.replace('</main>', '<a href="/cdn-cgi/l/email-protection#1a2b"><span class="__cf_email__" data-cfemail="1a2b">[email&#160;protected]</span></a></main>')), /\/cdn-cgi\//],
  ['the Cloudflare email-decode script', (d) => editFile(d, 'about/index.html', (h) => h.replace('</body>', '<script data-cfasync="false" src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js"></script></body>')), /<script> without an allowed type.*email-decode/],
  ['the Cloudflare Web Analytics beacon', (d) => editFile(d, 'index.html', (h) => h.replace('</body>', '<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon=\'{"token":"x"}\'></script></body>')), /cloudflareinsights/],
  // The host serves HTML/CSS/robots.txt without a charset parameter, so the files must carry it themselves.
  ['HTML without <meta charset="utf-8">', (d) => editFile(d, 'about/index.html', (h) => h.replace('<meta charset="utf-8">', '')), /meta charset/],
  ['<meta charset> after the first 1024 bytes', (d) => editFile(d, 'index.html', (h) => h.replace('<meta charset="utf-8">', `<!--${'x'.repeat(1100)}--><meta charset="utf-8">`)), /meta charset/],
  ['non-ASCII CSS', (d) => writeFile(d, '_astro/x.css', 'a::after{content:"\u2197"}'), /x\.css: non-ASCII/],
  ['non-ASCII robots.txt', (d) => writeFile(d, 'robots.txt', 'User-agent: *\n# caf\u00e9\n'), /robots\.txt: non-ASCII/],
];

for (const [name, mutate, pattern] of failing) {
  test(`verify-dist fails on ${name}`, async () => {
    const failures = await auditWith(mutate);
    assert.ok(failures.some((f) => pattern.test(f)), `expected a failure matching ${pattern}, got ${JSON.stringify(failures, null, 1)}`);
  });
}

test('the CLI exits 0 on a passing dist and 1 (with a readable list) on a failing one', () => {
  const dir = makePassingDist(policy, NOW);
  try {
    const ok = spawnSync(process.execPath, [CLI, '--dist', dir, '--now', NOW.toISOString()], { encoding: 'utf8' });
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    writeFile(dir, 'evil.js', 'alert(1)');
    const bad = spawnSync(process.execPath, [CLI, '--dist', dir, '--now', NOW.toISOString()], { encoding: 'utf8' });
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /FAIL.*evil\.js/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
