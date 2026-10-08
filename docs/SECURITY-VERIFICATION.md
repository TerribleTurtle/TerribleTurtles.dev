# Security Verification Guide

## What This Proves (and What It Doesn't)

This verification suite proves:
- Security headers are present on every route and strictly match the repository policy.
- Real web browsers enforce the Content Security Policy, Trusted Types and anti-framing rules.
- Build artifacts in `dist/` contain zero first-party JavaScript, zero inline scripts, zero inline style attributes, and valid metadata.
- No third-party network requests, cookies, or persistent storage items are created when pages load.

What it does not prove:
- It does not prove that Cloudflare's underlying infrastructure or edge network is uncompromised.
- It does not prove that the owner's accounts (GitHub, Cloudflare, domain registrar, or email) are secure.

## The One Command

The complete local verification pipeline runs with a single command:

```bash
npm run verify:security
```

This command executes five verification stages in sequence:
1. `build`: Compiles the Astro project into static HTML and CSS while executing unit tests and contrast checks.
2. `verify:dist`: Directly inspects the generated output in `dist/` on disk to ensure no JavaScript files exist, no unauthorized script tags are present, no inline styles exist, and `.well-known/security.txt` is present and valid.
3. `audit:deps`: Scans all project dependencies against known vulnerability databases, ensuring zero production vulnerabilities.
4. Playwright test suite: Boots a local static web server with production headers to test Chromium, Firefox, and WebKit for header compliance, browser policy enforcement, runtime console hygiene, and accessibility (axe-core, WCAG 2.2 AA).
5. `test:mutation`: Validates the verification harness itself by introducing deliberate security defects and confirming the test suite catches every single one.

## The Mutation Test

A security test suite is only trustworthy if it actively catches regressions. The mutation test temporarily introduces 12 deliberate vulnerabilities into server headers and page content to confirm that the static analyzer or browser test suite fails on every defect. The untouched baseline must pass cleanly.

| Mutation | Static (verify-dist) | Browser suite | Caught? | Description |
|---|---|---|---|---|
| baseline | pass (0) | pass (0) | clean | Untouched production build |
| csp-unsafe-inline | fail (1) | fail (1) | yes | Allows unsafe inline scripts in CSP |
| csp-script-wildcard | fail (1) | fail (1) | yes | Allows wildcard script execution in CSP |
| no-hsts | fail (1) | fail (1) | yes | Removes Strict-Transport-Security header |
| no-frame-ancestors | fail (1) | fail (1) | yes | Removes frame-ancestors anti-clickjacking directive |
| no-trusted-types | fail (1) | fail (1) | yes | Removes trusted-types directive |
| acao-wildcard | fail (1) | fail (1) | yes | Introduces wildcard Access-Control-Allow-Origin header |
| set-cookie | fail (1) | fail (1) | yes | Injects an unauthorized Set-Cookie header |
| inline-script | fail (1) | fail (1) | yes | Injects an inline `<script>` tag into HTML |
| external-script | fail (1) | fail (1) | yes | Injects a third-party external `<script>` tag into HTML |
| style-attr | fail (1) | fail (1) | yes | Injects an inline `style="..."` attribute into HTML |
| no-security-txt | fail (1) | fail (1) | yes | Deletes `.well-known/security.txt` |
| expired-security-txt | fail (1) | pass (0) | yes | Sets security.txt expiration date in the past |

Summary: All 12 mutations caught (baseline clean).

## Reading Results in GitHub

GitHub Actions runs the verification pipeline automatically on every pull request and every push to `main` under the **Actions** tab:
- **Green checkmark**: All verification checks passed. The commit meets all security and quality gates.
- **Red X**: A check failed. Click the run to open the job details; the failing step name reveals which layer caught the defect (`build`, `verify:dist`, `audit:deps`, Playwright tests, or `audit:signatures`). If browser tests fail, debugging artifacts (`test-results/` and `playwright-report/`) are uploaded automatically and retained for 7 days.

## Known Limits

- **Firefox dark mode emulation**: Due to an upstream bug in Playwright's Firefox color-scheme emulation, dark mode tests are skipped on Firefox. Dark mode rendering and token adherence are verified in Chromium and WebKit, while Firefox verifies the light mode baseline.
- **WebKit skip-link navigation**: Playwright on Windows WebKit does not shift keyboard focus on synthetic Tab key presses. Physical tab navigation is verified in Chromium and Firefox, while WebKit verifies skip-link positioning and programmatic focus order.
- **Braces development advisory**: The `braces` library has an upstream advisory with no patched release. It is used strictly for dev-time lint pattern globbing and is never deployed. It is allowlisted until `2027-01-04`; the audit will automatically fail after that date if an update is not applied.
- **Sharp development advisory**: The `sharp` library (CVE-2026-96889, GHSA-wq5f-xc86-pv6w) pulled via `wrangler` -> `miniflare` -> `sharp` has an upstream vulnerability in its bundled `librsvg` dependency. It is used strictly in local dev tooling and is never deployed to production static assets. It is allowlisted until `2027-04-08`; the audit will automatically fail after that date if an update is not applied.

## On-Demand Checks After Going Live

Once deployed to Cloudflare, the live site can be evaluated externally using three commands:
- `npm run check:live`: Queries live edge endpoints to verify deployed headers match local security policies, and checks every served page's HTML for scripts or `/cdn-cgi/` markup that Cloudflare features may inject at the edge.
- `npm run check:observatory`: Submits the domain to Mozilla HTTP Observatory (target grade: A+).
- `npm run check:dns -- --strict`: Performs strict verification of DNSSEC, CAA records, and mail anti-spoofing records (SPF, DMARC with p=reject).

## The Golden Rule

Never edit `security/policy.json` or modify tests just to make a failing test pass. A test failure indicates that code, configuration, or security headers have changed unexpectedly. Investigate the failure and fix the root cause.
