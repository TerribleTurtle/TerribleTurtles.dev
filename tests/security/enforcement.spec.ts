import { test, expect, type Page } from '@playwright/test';
import { EMBEDDER, pwned, recordViolations, serveWithInjection, violations, type Injection } from './helpers';

/**
 * Browser enforcement (negative) tests, run in Chromium, Firefox and WebKit.
 * Every attack runs twice:
 *   1. against the real production headers -> it must be BLOCKED and fire a matching `securitypolicyviolation`;
 *   2. as a positive control with the CSP stripped -> it must SUCCEED, proving the payload is a real attack.
 * Without (2), a broken payload would "pass" (1) vacuously.
 */
const PAGE = '/about/';
const SCRIPT = /^(script-src|require-trusted-types-for|trusted-types)/;

interface Attack {
  name: string;
  directive: RegExp;
  /** Stored-XSS style: attacker HTML spliced into the served page (real headers kept). */
  injection?: Injection;
  /** Runs after load (DOM-based attacks, clicks). */
  act?: (page: Page) => Promise<void>;
  succeeded: (page: Page) => Promise<boolean>;
  needsTrustedTypes?: boolean;
}

const outlineIs13 = (selector: string) => async (page: Page) =>
  (await page.locator(selector).evaluate((el) => getComputedStyle(el).outlineWidth)) === '13px';
const pwnedIs = (marker: string) => async (page: Page) => (await pwned(page)) === marker;

const attacks: Attack[] = [
  { name: 'inline <script> in the HTML', directive: SCRIPT, injection: { where: 'main', html: "<script>window.__ttPwned='inline-script'</script>" }, succeeded: pwnedIs('inline-script') },
  { name: 'inline event-handler attribute', directive: SCRIPT, injection: { where: 'main', html: `<img src="/favicon.svg" alt="" onload="window.__ttPwned='inline-handler'">` }, succeeded: pwnedIs('inline-handler') },
  { name: 'external <script> from another origin', directive: SCRIPT, injection: { where: 'main', html: `<script src="${EMBEDDER}/evil.js"></script>` }, succeeded: pwnedIs('external-script') },
  { name: 'javascript: URL', directive: SCRIPT, injection: { where: 'main', html: `<a id="tt-js" href="javascript:window.__ttPwned='javascript-url'">x</a>` }, act: (p) => p.click('#tt-js'), succeeded: pwnedIs('javascript-url') },
  { name: 'injected <style> block', directive: /^style-src/, injection: { where: 'head', html: '<style>#main{outline:13px solid red}</style>' }, succeeded: outlineIs13('#main') },
  { name: 'style= attribute', directive: /^style-src/, injection: { where: 'main', html: '<p id="tt-styled" style="outline:13px solid red">x</p>' }, succeeded: outlineIs13('#tt-styled') },
  { name: 'cross-origin <iframe>', directive: /^(frame-src|child-src)/, injection: { where: 'main', html: `<iframe id="tt-frame" title="x" src="${EMBEDDER}/inner"></iframe>` }, succeeded: async (p) => (await p.frameLocator('#tt-frame').locator('h1').count()) === 1 },
  { name: 'cross-origin image', directive: /^img-src/, injection: { where: 'main', html: `<img id="tt-img" alt="" src="${EMBEDDER}/pixel.svg">` }, succeeded: async (p) => (await p.locator('#tt-img').evaluate((el) => (el instanceof HTMLImageElement ? el.naturalWidth : 0))) === 7 },
  { name: '<base> URL hijack', directive: /^base-uri/, injection: { where: 'head', html: `<base href="${EMBEDDER}/">` }, succeeded: async (p) => (await p.evaluate(() => document.baseURI)).startsWith(EMBEDDER) },
  { name: 'form submitting to another origin', directive: /^form-action/, injection: { where: 'main', html: `<form action="${EMBEDDER}/collect" method="get"><button id="tt-submit">send</button></form>` }, act: (p) => p.evaluate(() => document.querySelector('form')?.requestSubmit()), succeeded: async (p) => p.url().startsWith(EMBEDDER) },
  {
    name: 'innerHTML string into a Trusted Types sink', directive: /^require-trusted-types-for/, needsTrustedTypes: true,
    act: (p) => p.evaluate(() => { try { const main = document.querySelector('main'); if (main) main.innerHTML += '<b id="tt-inner">x</b>'; } catch { /* blocked */ } }),
    succeeded: async (p) => p.evaluate(() => document.getElementById('tt-inner') !== null),
  },
  {
    name: 'trustedTypes.createPolicy', directive: /^trusted-types/, needsTrustedTypes: true,
    act: (p) => p.evaluate(() => { try { window.trustedTypes?.createPolicy('tt-attack', { createHTML: (s: string) => s }); window.__ttPwned = 'policy-created'; } catch { /* blocked */ } }),
    succeeded: pwnedIs('policy-created'),
  },
  // eval/new Function run from a timer task, NOT directly inside page.evaluate: Chromium's DevTools protocol
  // exempts code it evaluates from the CSP eval check, which would make the attack bypass the page's policy.
  { name: 'eval()', directive: SCRIPT, act: (p) => p.evaluate(() => { setTimeout(() => { try { (0, eval)("window.__ttPwned='eval'"); } catch { /* blocked */ } }, 0); }), succeeded: pwnedIs('eval') },
  { name: 'new Function()', directive: SCRIPT, act: (p) => p.evaluate(() => { setTimeout(() => { try { new Function("window.__ttPwned='function'")(); } catch { /* blocked */ } }, 0); }), succeeded: pwnedIs('function') },
  { name: 'setTimeout(string)', directive: SCRIPT, act: (p) => p.evaluate(() => { try { setTimeout("window.__ttPwned='timeout'", 0); } catch { /* blocked */ } }), succeeded: pwnedIs('timeout') },
  { name: 'page.addScriptTag (inline content)', directive: SCRIPT, act: async (p) => { await p.addScriptTag({ content: "window.__ttPwned='add-script-tag'" }).catch(() => undefined); }, succeeded: pwnedIs('add-script-tag') },
  { name: 'page.addScriptTag (cross-origin url)', directive: SCRIPT, act: async (p) => { await p.addScriptTag({ url: `${EMBEDDER}/evil.js` }).catch(() => undefined); }, succeeded: pwnedIs('external-script') },
];

test.beforeAll(async ({ browser }, info) => {
  info.annotations.push({ type: 'browser', description: `${info.project.name} ${browser.version()}` });
});

for (const attack of attacks) {
  test(`blocks: ${attack.name}`, async ({ page, browser }) => {
    await recordViolations(page);
    await serveWithInjection(page, PAGE, attack.injection, false);
    const response = await page.goto(PAGE);
    expect(response?.status()).toBe(200);
    if (attack.needsTrustedTypes) {
      const supported = await page.evaluate(() => 'trustedTypes' in window);
      test.skip(!supported, `Trusted Types not implemented in ${browser.browserType().name()} ${browser.version()}`);
    }
    if (attack.act) await attack.act(page);
    await expect.poll(() => violations(page), { message: `no ${attack.directive} violation fired`, timeout: 5_000 })
      .toContainEqual(expect.stringMatching(attack.directive));
    expect(await attack.succeeded(page), 'the attack had an effect').toBe(false);
  });

  test(`control (CSP stripped, attack must work): ${attack.name}`, async ({ page }) => {
    await serveWithInjection(page, PAGE, attack.injection, true);
    await page.goto(PAGE);
    if (attack.act) await attack.act(page);
    await expect.poll(() => attack.succeeded(page), { timeout: 5_000 }).toBe(true);
  });
}

/** Opens the cross-origin embedder page that iframes the site, returns the h1 count inside the victim frame. */
async function frameSite(page: Page, baseURL: string | undefined): Promise<number> {
  const target = new URL('/', baseURL).href;
  const victimResponse = page.waitForResponse((r) => r.url() === target);
  await page.goto(`${EMBEDDER}/frame?target=${encodeURIComponent(target)}`);
  expect((await victimResponse).status(), 'the site was really requested by the frame').toBe(200);
  await expect(page.frameLocator('#control').locator('h1'), 'positive control frame renders').toHaveText('control frame');
  await expect.poll(() => page.evaluate(() => window.__victimLoads ?? 0), { message: 'victim iframe finished loading' }).toBeGreaterThan(0);
  const frame = await (await page.locator('#victim').elementHandle())?.contentFrame();
  return frame ? frame.locator('h1').count() : 0;
}

test('blocks: cross-origin framing of the site (frame-ancestors / X-Frame-Options)', async ({ page, baseURL }) => {
  const consoleLines: string[] = [];
  page.on('console', (m) => consoleLines.push(m.text()));
  expect(await frameSite(page, baseURL), 'site content rendered inside a cross-origin frame').toBe(0);
  // frame-ancestors fires no DOM event; the console text is secondary evidence only (wording differs per engine).
  test.info().annotations.push({ type: 'console', description: consoleLines.filter((l) => /frame/i.test(l)).join(' | ') || '(none)' });
});

test('control (CSP + XFO stripped, framing must work): cross-origin framing', async ({ page, baseURL }) => {
  await serveWithInjection(page, '/', undefined, true);
  expect(await frameSite(page, baseURL)).toBe(1);
});
