import type { Page, Route } from '@playwright/test';
import { loadPolicy, localePath } from '../../scripts/lib/policy.mjs';

export const policy = loadPolicy();
export { localePath };
export const EMBEDDER = `http://127.0.0.1:${process.env.TT_EMBEDDER_PORT ?? '8790'}`;

/** Records every `securitypolicyviolation` event (directive, blocked URI, sample) into window.__ttCspViolations. */
export async function recordViolations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const log: string[] = [];
    Object.defineProperty(window, '__ttCspViolations', { value: log, configurable: false });
    document.addEventListener(
      'securitypolicyviolation',
      (event) => log.push(`${event.effectiveDirective} | ${event.blockedURI} | ${event.sample}`),
      true,
    );
  });
}

export async function violations(page: Page): Promise<string[]> {
  return page.evaluate(() => [...(window.__ttCspViolations ?? [])]);
}

export async function pwned(page: Page): Promise<string | undefined> {
  return page.evaluate(() => window.__ttPwned);
}

export interface Injection {
  /** HTML inserted right before `</head>` or `</main>`. */
  html: string;
  where: 'head' | 'main';
}

/**
 * Serves `path` with its REAL production response headers from wrangler, but with attacker HTML spliced into the
 * body: a stored-XSS simulation. With `stripCsp` the CSP (and X-Frame-Options) are removed instead, which is the
 * positive control proving the payload really works when the policy is absent.
 */
export async function serveWithInjection(page: Page, path: string, injection: Injection | undefined, stripCsp: boolean): Promise<void> {
  await page.route((url) => url.pathname === path, async (route: Route) => {
    const response = await route.fetch();
    let body = await response.text();
    if (injection !== undefined) {
      const marker = injection.where === 'head' ? '</head>' : '</main>';
      if (!body.includes(marker)) throw new Error(`injection marker ${marker} not found in ${path}`);
      body = body.replace(marker, `${injection.html}${marker}`);
    }
    const headers = { ...response.headers() };
    delete headers['content-length'];
    if (stripCsp) {
      delete headers['content-security-policy'];
      delete headers['x-frame-options'];
    }
    await route.fulfill({ response, body, headers });
  });
}
