// live-check CLI: served HTML must pass the same content checks as dist (catches edge-injected markup).
// Uses a local HTTP server only; no external requests (the http->https check is skipped for --origin).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../../scripts/live-check.mjs', import.meta.url));
const CLEAN = '<!doctype html><html lang="en"><head><title>x</title></head><body><main id="main"><p>x</p></main></body></html>';
const INJECTED = CLEAN.replace('</body>', '<script defer src="https://static.cloudflareinsights.com/beacon.min.js"></script></body>');

/**
 * Serve `html` for every path, run live-check against it, return its combined output.
 * @param {string} html
 * @returns {Promise<{ code: number, output: string }>}
 */
async function runAgainst(html) {
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(undefined)));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no TCP address');
  try {
    return await new Promise((resolve) => {
      execFile(process.execPath, [CLI, '--origin', `http://127.0.0.1:${address.port}`], (error, stdout, stderr) => {
        const code = error && typeof error.code === 'number' ? error.code : 0;
        resolve({ code, output: `${stdout}${stderr}` });
      });
    });
  } finally {
    server.close();
  }
}

test('live-check flags a script injected into served HTML', async () => {
  const { code, output } = await runAgainst(INJECTED);
  assert.equal(code, 1);
  assert.match(output, /<script> without an allowed type.*cloudflareinsights/);
});

test('live-check reports no HTML-content failure for clean served HTML', async () => {
  const { output } = await runAgainst(CLEAN);
  assert.doesNotMatch(output, /<script>|\/cdn-cgi\/|style= attribute|external resource/);
});

test('live-check skips the real-domain http->https check when --origin is given', async () => {
  const { output } = await runAgainst(CLEAN);
  assert.doesNotMatch(output, /FAIL \[httpRedirect\]/);
  assert.match(output, /httpRedirect.*skipped/);
});
