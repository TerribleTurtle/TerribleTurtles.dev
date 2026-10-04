// Second, deliberately different origin (http://127.0.0.1:8790 by default) for the security tests:
// it frames the site (frame-ancestors test), and hosts "attacker" resources (external script, image, form target).
// Started by Playwright's webServer config. Never deployed. Node built-ins only.
import { createServer } from 'node:http';

const port = Number(process.env.TT_EMBEDDER_PORT ?? '8790');

/** @param {string} value */
function escapeAttr(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Only local http targets may be framed, so this helper cannot be abused as an open framer.
 * @param {string | null} raw
 * @returns {string | undefined}
 */
function localTarget(raw) {
  if (raw === null) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost') ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** @type {Record<string, { type: string, body: string }>} */
const STATIC = {
  '/health': { type: 'text/plain; charset=utf-8', body: 'ok' },
  '/inner': { type: 'text/html; charset=utf-8', body: '<!doctype html><title>control</title><h1>control frame</h1>' },
  '/evil.js': { type: 'text/javascript; charset=utf-8', body: "window.__ttPwned = 'external-script';" },
  '/pixel.svg': { type: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="7" height="7"><rect width="7" height="7"/></svg>' },
  '/collect': { type: 'text/html; charset=utf-8', body: '<!doctype html><title>collected</title><h1>collected</h1>' },
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
  const fixed = STATIC[url.pathname];
  if (fixed) {
    res.writeHead(200, { 'content-type': fixed.type, 'cache-control': 'no-store' });
    res.end(fixed.body);
    return;
  }
  if (url.pathname === '/frame') {
    const target = localTarget(url.searchParams.get('target'));
    if (target === undefined) {
      res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('target must be a local http URL');
      return;
    }
    // The embedder itself has no CSP: only the framed site's own headers may stop the framing.
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(`<!doctype html><title>embedder</title><h1>embedder</h1>
<iframe id="victim" title="victim" src="${escapeAttr(target)}" onload="window.__victimLoads = (window.__victimLoads || 0) + 1"></iframe>
<iframe id="control" title="control" src="/inner"></iframe>`);
    return;
  }
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('not found');
});

server.listen(port, '127.0.0.1', () => console.log(`embedder listening on http://127.0.0.1:${port}`));
