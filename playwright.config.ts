import { defineConfig, devices } from '@playwright/test';

/**
 * All browser tests run against the BUILT site served by real `wrangler dev` (workerd), so they see the
 * production `_headers`. Run `npm run build` first: wrangler serves whatever is in dist/.
 *
 * TT_BASE_URL: point the suite at an already-running server instead (used by scripts/mutation-test.mjs,
 * which serves a mutated copy of dist on another port). When set, no wrangler server is started here.
 * TT_EMBEDDER_PORT: port of the second, cross-origin helper server (default 8790).
 */
const externalBaseURL = process.env.TT_BASE_URL;
const baseURL = externalBaseURL ?? 'http://127.0.0.1:8787';
const embedderPort = process.env.TT_EMBEDDER_PORT ?? '8790';
const browserSpecs = ['e2e/**/*.spec.ts', 'security/enforcement.spec.ts', 'security/runtime.spec.ts', 'security/structured-data.spec.ts'];

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // No retries: a security check that only passes sometimes must surface as a failure.
  retries: 0,
  reporter: 'list',
  use: {
    baseURL,
    // Never let Playwright switch off the page's CSP: the enforcement tests depend on it being live.
    bypassCSP: false,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'headers', testMatch: ['security/headers.spec.ts', 'security/harness.spec.ts'] },
    {
      name: 'layout',
      testMatch: 'layout/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: ['--disable-features=LocalNetworkAccessChecks'] },
        bypassCSP: true,
      },
    },
    {
      name: 'chromium',
      testMatch: browserSpecs,
      // Chromium's Local Network Access check blocks 127.0.0.1:8787 -> 127.0.0.1:8790 (the local "attacker" origin).
      // Disabling it in the harness makes cross-origin attacks reach the CSP, which must then block them itself.
      use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--disable-features=LocalNetworkAccessChecks'] } },
    },
    // Playwright 1.61 + Firefox 151: colorScheme emulation has no effect in either direction (verified with
    // scratch diagnostics), so Firefox runs only its default light scheme; dark-scheme tests skip there explicitly.
    // retries: 1 (Firefox only): ~1 in 600 Firefox page loads never fire `load` under Playwright 1.63 / Firefox on
    // this harness (investigated, findings.md §11). A retried test is reported as "flaky"; a real failure fails twice.
    { name: 'firefox', testMatch: browserSpecs, retries: 1, use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', testMatch: browserSpecs, use: { ...devices['Desktop Safari'] } },
  ],
  webServer: [
    ...(externalBaseURL === undefined
      ? [{
          command: 'npx wrangler dev --port 8787 --ip 127.0.0.1',
          url: 'http://127.0.0.1:8787/',
          // Always a fresh server: a long-running `wrangler dev` can keep a stale asset manifest after a
          // rebuild (observed 2026-10-04: `/` answered 404 until restart), which would test old files.
          reuseExistingServer: false,
          timeout: 60_000,
          env: { WRANGLER_SEND_METRICS: 'false' },
        }]
      : []),
    {
      command: 'node tests/security/embedder-server.mjs',
      url: `http://127.0.0.1:${embedderPort}/health`,
      reuseExistingServer: false,
      env: { TT_EMBEDDER_PORT: embedderPort },
    },
  ],
});
