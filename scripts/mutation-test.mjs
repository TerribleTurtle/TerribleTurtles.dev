#!/usr/bin/env node
// Mutation test CLI: proves the security verification suite is not vacuous.
// For each mutation, a deliberately weakened copy of dist must be CAUGHT.
// Exits 0 on all caught, 1 on uncaught mutation or failed precondition, 2 on usage/build error.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

/**
 * @typedef {{
 *   name: string,
 *   mutate?: (siteDir: string) => void,
 *   checkPath?: string,
 *   served: (res: Response, body: string) => boolean,
 *   isBaseline?: boolean,
 * }} MutationDef
 *
 * @typedef {{
 *   name: string,
 *   served: boolean,
 *   staticExit: number,
 *   browserExit: number,
 *   caught: boolean,
 *   failingChecks: string,
 *   isBaseline: boolean,
 * }} MutationRow
 */

const MUTATION_PORT = 8797;
const isWin = process.platform === 'win32';

/** @type {import('node:child_process').ChildProcess | null} */
let activeProc = null;

/**
 * Terminates the wrangler dev process tree.
 * @param {import('node:child_process').ChildProcess | null} proc
 */
function killWrangler(proc) {
  if (!proc || proc.pid === undefined) return;
  if (isWin) {
    try {
      spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {
      // Process may already be dead
    }
  } else {
    try {
      process.kill(-proc.pid, 'SIGKILL');
    } catch {
      try {
        proc.kill('SIGKILL');
      } catch {
        // Ignored
      }
    }
  }
}

process.on('SIGINT', () => {
  if (activeProc) {
    killWrangler(activeProc);
    activeProc = null;
  }
  process.exit(130);
});

process.on('SIGTERM', () => {
  if (activeProc) {
    killWrangler(activeProc);
    activeProc = null;
  }
  process.exit(143);
});

/**
 * Reads compatibility_date from repo wrangler.jsonc.
 * @returns {string}
 */
function readCompatibilityDate() {
  const content = readFileSync(resolve('wrangler.jsonc'), 'utf8');
  const match = /["']compatibility_date["']\s*:\s*["']([^"']+)["']/.exec(content);
  if (!match || !match[1]) {
    throw new Error('Could not find compatibility_date in wrangler.jsonc');
  }
  return match[1];
}

/**
 * Checks if a port is closed (connection refused).
 * @param {number} port
 * @param {string} [host]
 * @returns {Promise<boolean>}
 */
function isPortFree(port, host = '127.0.0.1') {
  return new Promise((res) => {
    const socket = new Socket();
    socket.setTimeout(500);
    socket.once('connect', () => {
      socket.destroy();
      res(false);
    });
    socket.once('timeout', () => {
      socket.destroy();
      res(false);
    });
    socket.once('error', () => {
      res(true);
    });
    socket.connect(port, host);
  });
}

/**
 * Waits until a port is free or throws on timeout.
 * @param {number} port
 * @param {number} [maxMs]
 * @returns {Promise<void>}
 */
async function waitUntilPortFree(port, maxMs = 15_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (await isPortFree(port)) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Port ${port} was not freed within ${maxMs / 1000}s`);
}

/**
 * Polls the running server until it answers, or throws on timeout.
 * @param {number} port
 * @param {import('node:child_process').ChildProcess} proc
 * @param {number} [maxMs]
 * @returns {Promise<void>}
 */
async function pollServerReady(port, proc, maxMs = 60_000) {
  const start = Date.now();
  const url = `http://127.0.0.1:${port}/`;
  while (Date.now() - start < maxMs) {
    if (proc.exitCode !== null) {
      throw new Error(`wrangler dev exited early with code ${proc.exitCode}`);
    }
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (res.status > 0) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server on port ${port} failed to answer within ${maxMs / 1000}s`);
}

/**
 * Performs a search-and-replace in a file, throwing loudly if not found.
 * @param {string} filePath
 * @param {string | RegExp} search
 * @param {string} replacement
 * @param {string} mutationName
 */
function replaceInFile(filePath, search, replacement, mutationName) {
  if (!existsSync(filePath)) {
    throw new Error(`Mutation "${mutationName}" failed: file ${filePath} does not exist`);
  }
  const original = readFileSync(filePath, 'utf8');
  let modified;
  if (typeof search === 'string') {
    if (!original.includes(search)) {
      throw new Error(`Mutation "${mutationName}" failed: search string ${JSON.stringify(search)} not found in ${filePath}`);
    }
    modified = original.replace(search, replacement);
  } else {
    if (!search.test(original)) {
      throw new Error(`Mutation "${mutationName}" failed: search pattern ${search} not found in ${filePath}`);
    }
    modified = original.replace(search, replacement);
  }
  writeFileSync(filePath, modified, 'utf8');
}

/**
 * Extracts static failures from verify-dist output.
 * @param {string} stderr
 * @param {string} stdout
 * @returns {string[]}
 */
function extractStaticFailures(stderr, stdout) {
  const combined = `${stderr}\n${stdout}`;
  /** @type {string[]} */
  const fails = [];
  for (const line of combined.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('FAIL ')) {
      fails.push(trimmed.slice(5).trim());
    }
  }
  return fails;
}

/**
 * Extracts browser test failure titles from playwright output (up to 3).
 * @param {string} stdout
 * @param {string} stderr
 * @returns {string[]}
 */
function extractBrowserFailures(stdout, stderr) {
  const combined = `${stdout}\n${stderr}`;
  /** @type {string[]} */
  const fails = [];
  for (const line of combined.split(/\r?\n/)) {
    const match = /^\s*\d+\)\s*(.+)$/.exec(line);
    if (match && match[1]) {
      const name = match[1].replace(/\\/g, '/').trim();
      if (!fails.includes(name)) {
        fails.push(name);
        if (fails.length >= 3) break;
      }
    }
  }
  return fails;
}

/**
 * Formats failing checks into a clean table cell string.
 * @param {string[]} staticFails
 * @param {string[]} browserFails
 * @param {number} staticExit
 * @param {number} browserExit
 * @returns {string}
 */
function formatFailingChecks(staticFails, browserFails, staticExit, browserExit) {
  /** @type {string[]} */
  const checks = [];
  for (const f of staticFails) {
    checks.push(`static: ${f}`);
    if (checks.length >= 3) break;
  }
  if (checks.length === 0 && staticExit !== 0) {
    checks.push(`static: verify-dist exit ${staticExit}`);
  }
  if (checks.length < 3) {
    for (const b of browserFails) {
      checks.push(b);
      if (checks.length >= 3) break;
    }
  }
  if (checks.length === 0 && browserExit !== 0) {
    checks.push(`browser: playwright exit ${browserExit}`);
  }
  if (checks.length === 0) return '(none)';
  return checks.map((c) => c.replace(/\|/g, '\\|')).join('; ');
}

/** @type {MutationDef[]} */
const MUTATIONS = [
  {
    name: 'baseline',
    isBaseline: true,
    checkPath: '/',
    served: (res) => res.status === 200 && res.headers.get('content-security-policy') !== null,
  },
  {
    name: 'csp-unsafe-inline',
    checkPath: '/',
    mutate: (siteDir) => {
      replaceInFile(
        join(siteDir, '_headers'),
        "script-src 'none'",
        "script-src 'none' 'unsafe-inline'",
        'csp-unsafe-inline'
      );
    },
    served: (res) => {
      const csp = res.headers.get('content-security-policy');
      return csp !== null && csp.includes("'unsafe-inline'");
    },
  },
  {
    name: 'csp-script-wildcard',
    checkPath: '/',
    mutate: (siteDir) => {
      replaceInFile(
        join(siteDir, '_headers'),
        "script-src 'none'",
        'script-src *',
        'csp-script-wildcard'
      );
    },
    served: (res) => {
      const csp = res.headers.get('content-security-policy');
      return csp !== null && csp.includes('script-src *');
    },
  },
  {
    name: 'no-hsts',
    checkPath: '/',
    mutate: (siteDir) => {
      replaceInFile(
        join(siteDir, '_headers'),
        /^[ \t]*Strict-Transport-Security:[^\r\n]*(?:\r?\n|$)/m,
        '',
        'no-hsts'
      );
    },
    served: (res) => res.headers.get('strict-transport-security') === null,
  },
  {
    name: 'no-frame-ancestors',
    checkPath: '/',
    mutate: (siteDir) => {
      replaceInFile(
        join(siteDir, '_headers'),
        "; frame-ancestors 'none'",
        '',
        'no-frame-ancestors'
      );
    },
    served: (res) => {
      const csp = res.headers.get('content-security-policy');
      return csp !== null && !csp.includes("frame-ancestors 'none'");
    },
  },
  {
    name: 'no-trusted-types',
    checkPath: '/',
    mutate: (siteDir) => {
      replaceInFile(
        join(siteDir, '_headers'),
        "; trusted-types 'none'",
        '',
        'no-trusted-types'
      );
    },
    served: (res) => {
      const csp = res.headers.get('content-security-policy');
      return csp !== null && !csp.includes("trusted-types 'none'");
    },
  },
  {
    name: 'acao-wildcard',
    checkPath: '/',
    mutate: (siteDir) => {
      const p = join(siteDir, '_headers');
      const content = readFileSync(p, 'utf8');
      const nl = content.includes('\r\n') ? '\r\n' : '\n';
      const target = `/*${nl}`;
      if (!content.includes(target)) {
        throw new Error('Mutation "acao-wildcard" failed: target "/*" line not found in _headers');
      }
      writeFileSync(p, content.replace(target, `/*${nl}  Access-Control-Allow-Origin: *${nl}`), 'utf8');
    },
    served: (res) => res.headers.get('access-control-allow-origin') === '*',
  },
  {
    name: 'set-cookie',
    checkPath: '/',
    mutate: (siteDir) => {
      const p = join(siteDir, '_headers');
      const content = readFileSync(p, 'utf8');
      const nl = content.includes('\r\n') ? '\r\n' : '\n';
      const target = `/*${nl}`;
      if (!content.includes(target)) {
        throw new Error('Mutation "set-cookie" failed: target "/*" line not found in _headers');
      }
      writeFileSync(p, content.replace(target, `/*${nl}  Set-Cookie: tt=1; Path=/${nl}`), 'utf8');
    },
    served: (res) => {
      const cookie = res.headers.get('set-cookie');
      return cookie !== null && cookie.includes('tt=1');
    },
  },
  {
    name: 'inline-script',
    checkPath: '/',
    mutate: (siteDir) => {
      replaceInFile(
        join(siteDir, 'index.html'),
        '</main>',
        '<script>window.__pwned=1</script></main>',
        'inline-script'
      );
    },
    served: (_res, body) => body.includes('<script>window.__pwned=1</script>'),
  },
  {
    name: 'external-script',
    checkPath: '/',
    mutate: (siteDir) => {
      replaceInFile(
        join(siteDir, 'index.html'),
        '</main>',
        '<script src="https://evil.example/x.js"></script></main>',
        'external-script'
      );
    },
    served: (_res, body) => body.includes('<script src="https://evil.example/x.js"></script>'),
  },
  {
    name: 'style-attr',
    checkPath: '/',
    mutate: (siteDir) => {
      replaceInFile(
        join(siteDir, 'index.html'),
        '</main>',
        '<p style="color:red">x</p></main>',
        'style-attr'
      );
    },
    served: (_res, body) => body.includes('<p style="color:red">x</p>'),
  },
  {
    name: 'no-security-txt',
    checkPath: '/.well-known/security.txt',
    mutate: (siteDir) => {
      const p = join(siteDir, '.well-known', 'security.txt');
      if (!existsSync(p)) {
        throw new Error(`Mutation "no-security-txt" failed: file ${p} does not exist`);
      }
      unlinkSync(p);
    },
    served: (res) => res.status === 404,
  },
  {
    name: 'expired-security-txt',
    checkPath: '/.well-known/security.txt',
    mutate: (siteDir) => {
      replaceInFile(
        join(siteDir, '.well-known', 'security.txt'),
        /^Expires:.*$/m,
        'Expires: 2020-01-01T00:00:00.000Z',
        'expired-security-txt'
      );
    },
    served: (_res, body) => body.includes('2020-01-01T00:00:00.000Z'),
  },
];

// 0. Require dist/ exists
const distDir = resolve('dist');
if (!existsSync(distDir)) {
  console.error('mutation-test: dist/ does not exist. Run `npm run build` first.');
  process.exit(2);
}

const compatibilityDate = readCompatibilityDate();

// Ensure port 8797 is initially free
await waitUntilPortFree(MUTATION_PORT, 5_000);

/** @type {MutationRow[]} */
const rows = [];

for (let i = 0; i < MUTATIONS.length; i++) {
  const mutation = MUTATIONS[i];
  if (!mutation) continue;

  const isBaseline = !!mutation.isBaseline;
  const baseTmpDir = join(tmpdir(), `tt-mutation-${mutation.name}`);
  const siteDir = join(baseTmpDir, 'site');

  try {
    rmSync(baseTmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {
    // Best-effort cleanup of previous temp dir
  }

  mkdirSync(siteDir, { recursive: true });
  cpSync(distDir, siteDir, { recursive: true });

  if (mutation.mutate) {
    mutation.mutate(siteDir);
  }

  const wranglerConfig = {
    name: 'tt-mutation',
    compatibility_date: compatibilityDate,
    assets: {
      directory: './site',
      html_handling: 'auto-trailing-slash',
      not_found_handling: '404-page',
    },
  };
  const configPath = join(baseTmpDir, 'wrangler.jsonc');
  writeFileSync(configPath, JSON.stringify(wranglerConfig, null, 2), 'utf8');

  // Layer A (static audit)
  const staticResult = spawnSync(
    process.execPath,
    [resolve('scripts/verify-dist.mjs'), '--dist', siteDir],
    {
      encoding: 'utf8',
      env: process.env,
    }
  );
  const staticExit = staticResult.status ?? 1;
  const staticFails = extractStaticFailures(staticResult.stderr ?? '', staticResult.stdout ?? '');

  /** @type {import('node:child_process').ChildProcess | null} */
  let wranglerProc = null;
  let isServed = false;
  let browserExit = 0;
  /** @type {string[]} */
  let browserFails = [];

  try {
    wranglerProc = spawn(
      'npx',
      ['wrangler', 'dev', '-c', configPath, '--port', String(MUTATION_PORT), '--ip', '127.0.0.1'],
      {
        shell: true,
        detached: !isWin,
        env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    activeProc = wranglerProc;

    await pollServerReady(MUTATION_PORT, wranglerProc, 60_000);

    // Precondition: prove mutation is live on the running server
    const checkUrl = `http://127.0.0.1:${MUTATION_PORT}${mutation.checkPath ?? '/'}`;
    const checkRes = await fetch(checkUrl, { signal: AbortSignal.timeout(5000) });
    const checkBody = await checkRes.text();
    isServed = mutation.served(checkRes, checkBody);

    if (!isServed) {
      console.error(`mutation-test: PRECONDITION FAILED for "${mutation.name}" at ${checkUrl}`);
      console.error(`Status: ${checkRes.status}, Headers: ${JSON.stringify(Object.fromEntries(checkRes.headers.entries()))}`);
      killWrangler(wranglerProc);
      activeProc = null;
      wranglerProc = null;
      await waitUntilPortFree(MUTATION_PORT, 15_000);
      process.exit(1);
    }

    // Layer B (browser test suite)
    const playwrightResult = spawnSync(
      'npx',
      ['playwright', 'test', '--project=headers', '--project=chromium', 'tests/security', '--reporter=line'],
      {
        shell: true,
        encoding: 'utf8',
        env: {
          ...process.env,
          TT_BASE_URL: `http://127.0.0.1:${MUTATION_PORT}`,
          WRANGLER_SEND_METRICS: 'false',
        },
      }
    );
    browserExit = playwrightResult.status ?? 1;
    browserFails = extractBrowserFailures(playwrightResult.stdout ?? '', playwrightResult.stderr ?? '');
  } finally {
    if (wranglerProc) {
      killWrangler(wranglerProc);
      if (activeProc === wranglerProc) activeProc = null;
      wranglerProc = null;
    }
    await waitUntilPortFree(MUTATION_PORT, 15_000);
    try {
      rmSync(baseTmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch {
      // Ignored if file lock delays removal
    }
  }

  const caught = isBaseline ? false : (staticExit !== 0 || browserExit !== 0);
  const failingChecks = formatFailingChecks(staticFails, browserFails, staticExit, browserExit);

  rows.push({
    name: mutation.name,
    served: isServed,
    staticExit,
    browserExit,
    caught,
    failingChecks,
    isBaseline,
  });

  if (isBaseline && (staticExit !== 0 || browserExit !== 0)) {
    console.error('mutation-test: suite fails on a clean build, cannot judge mutations');
    process.exit(1);
  }
}

// Build output table
const tableLines = [
  '| mutation | served? | static (verify-dist) | browser suite | caught | first failing checks |',
  '|---|---|---|---|---|---|',
];

let allCaught = true;
let uncaughtCount = 0;

for (const row of rows) {
  const servedCol = row.served ? 'yes' : 'no';
  const staticCol = row.staticExit === 0 ? 'pass (0)' : `fail (${row.staticExit})`;
  const browserCol = row.browserExit === 0 ? 'pass (0)' : `fail (${row.browserExit})`;
  const caughtCol = row.isBaseline ? 'clean' : (row.caught ? 'yes' : 'NO');
  tableLines.push(`| ${row.name} | ${servedCol} | ${staticCol} | ${browserCol} | ${caughtCol} | ${row.failingChecks} |`);

  if (!row.isBaseline && !row.caught) {
    allCaught = false;
    uncaughtCount++;
  }
}

const tableText = tableLines.join('\n');
const totalMutations = rows.length - 1;
const summaryLine = allCaught
  ? `Summary: All ${totalMutations} mutations caught (baseline clean).`
  : `Summary: FAILED - ${uncaughtCount} mutation(s) survived.`;

console.log(tableText);
console.log('');
console.log(summaryLine);

const scratchDir = resolve('scratch');
if (!existsSync(scratchDir)) {
  mkdirSync(scratchDir, { recursive: true });
}
writeFileSync(join(scratchDir, 'mutation_table.md'), `${tableText}\n\n${summaryLine}\n`, 'utf8');

if (!allCaught) {
  process.exit(1);
}
