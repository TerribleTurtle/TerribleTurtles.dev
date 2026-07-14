# Architectural Findings & Rules (The Disk Brain)

*This file acts as the persistent, cross-session memory for all AI agents. It documents how the "connecting bits" actually work together. Agents must read this before writing code.*

## 0. Master Blueprint
*   The complete architectural spec is located in `Software_Design_Document.md`. Refer to it for exact token hex codes, routing strategies, and NFRs.

## 1. CSS & Styling Standards
*   **Implementation:** Phase 2 introduced `src/styles/global.css` with the strict SDD design tokens mapped to CSS variables (e.g., `--bg-base`, `--accent-primary`).
*   **Typography:** Google Fonts (`Inter`, `Fira Code`) are self-hosted using `@fontsource` packages and imported into `BaseLayout.astro`. To completely eliminate render-blocking network requests, Astro's `build.inlineStylesheets: 'always'` is configured in `astro.config.mjs` to inject all CSS natively into the `<head>`, achieving near-instant LCP (0ms Element render delay).
*   **Accessibility:** Semantic HTML (e.g., `<header>`, `<main>`, `<nav aria-label="...">`) is enforced across layouts. Axe-core audits ensure zero WCAG 2.1 AA violations.
*   **Inline Style Ban:** No `.astro` components are permitted to use the `style="..."` attribute. All modifications must leverage CSS root variables in their local `<style>` blocks.
*   **Fluid Typography & Spacing (Phase 8):** Hardcoded pixel boundaries and static padding are deprecated. The project relies on mathematical `clamp()` functions for all `--space-*` tokens and font sizes, dynamically scaling between mobile and 1440p displays up to a `1200px` container width.
*   **Visually Hidden Accessibility:** The deprecated `clip: rect(0, 0, 0, 0)` pattern is banned. Use `clip-path: inset(50%)` to visually hide elements (like `.skip-link`) without creating visual artifacts or violating Stylelint rules.
*   **AI Guardrails & CI/CD Pipeline (Phase 6):** The project enforces mathematical adherence to the "No Magic" rule. 
    *   `stylelint` is configured with `color-named: "never"`, `function-disallowed-list: ["rgb", "hsl", ...]`, and strict property allowances to completely ban hex codes and force variables for all colors, fills, and strokes. A `.stylelintignore` explicitly excludes `dist/` and `node_modules/` to prevent linting built vendor assets like `@fontsource`.
    *   `eslint` uses flat config and `typescript-eslint` parser.
    *   The `package.json` build command requires `astro check && eslint && stylelint` to pass before `astro build`, physically preventing broken or non-compliant AI-generated code from deploying to Cloudflare Pages.
    *   `axe-core` accessibility audits are strictly enforced locally on every commit via a `.husky/pre-commit` hook (using `start-server-and-test` to manage the `astro preview` lifecycle) and remotely in GitHub Actions (`ci.yml`), mathematically proving WCAG 2.1 AA compliance on all routes before deployment.
## 2. Data Strategy
*   **Content Layer:** The project relies on Astro's Content Layer for 100% static project metadata. No relational databases (D1) are used for metadata.
*   **KV Configs:** Cloudflare KV is reserved strictly for fast-read runtime configurations.

## 3. Testing Infrastructure (Phase 8 Remediation)
*   **Unit Testing:** `Vitest` is used exclusively for unit tests, ensuring fast, lightweight verification of utilities (e.g. `storage.ts`).
*   **E2E Testing:** `@playwright/test` is used for End-to-End browser verification. Tests explicitly verify critical UI states (e.g. Empty States, BitRot banners, Routing).
*   **CI Reliability:** The `ci.yml` must use dynamic polling mechanisms like `npx wait-on` before executing browser tests or axe-core audits. Hardcoded `sleep` statements are strictly banned due to inherent flakiness.

## Rejected Approaches (Mandatory Negative Knowledge)
*   **D1 for Project Metadata (The "Split Brain"):** Rejected. Storing project metadata (title, status) in a Cloudflare D1 database while storing the actual project content (READMEs) in Git Markdown creates an inefficient split-brain architecture. It forces all pages to be dynamically server-rendered (`prerender = false`) at the edge, costing worker invocations and losing static CDN caching. Instead, we use 100% static Astro Content Layer with Markdown frontmatter.
*   **Logging to KV:** Rejected because KV is highly rate-limited for writes. We use native Tail Logs and Analytics Engine instead.
*   **Legacy Content Collections:** Rejected. Astro 6 completely removed legacy content collections. Phase 4 must exclusively use the new Content Layer API (`content.config.ts` with `defineCollection({ loader: ... })`).
*   **Manual API Endpoints (`src/pages/api/`) for Mutations:** Rejected. Writing manual `POST` endpoints lacks type safety. Astro Actions (`astro:actions`) must be used instead.
*   **Raw `import.meta.env` in Server Logic:** Rejected. It provides zero build-time guarantees. Use `astro:env/server` instead.
*   **Strict `default-src 'self'` CSP:** Rejected because it blocks required Web Analytics. Whitelisted domains have been mapped in the SDD.
*   **Cloudflare Pages GitHub UI Integration with SSR:** Rejected. The Astro 5 Cloudflare adapter (`@astrojs/cloudflare` v14+) completely removed support for Cloudflare Pages and now only supports Cloudflare Workers. Because the user's GitHub is natively paired to Cloudflare Pages UI for automatic deployments, the project MUST remain a 100% pure static site built directly to `dist/`. Using SSR features (Actions, Middleware) will break the Pages UI deployment.
*   **Security Headers in wrangler.jsonc:** Rejected. Security headers MUST be placed in `public/_headers`, which the Astro compiler perfectly integrates into the output.
*   **Axe-core against `astro dev --background`:** Rejected. `npx wrangler dev` natively runs `workerd` correctly, serves the built edge assets perfectly, and allows for robust `curl` and `axe-core` verification.
*   **Strict `style-src 'self'` CSP:** Rejected. It completely blocks Astro's default CSS inlining optimization and Shiki syntax highlighting, which natively inject `<style>` blocks. `style-src` MUST include `'unsafe-inline'`. (Note: `script-src` remains strictly locked down to prevent XSS).
*   **Default Cloudflare Pages NPM Install (`npm ci`):** Rejected. Modern NPM strictly enforces peer dependencies (like `eslint-plugin-jsx-a11y` failing on newer `eslint` versions), causing automated Cloudflare builds to fail with `ERESOLVE`. We MUST maintain an `.npmrc` with `legacy-peer-deps=true` in the project root to ensure Cloudflare Pages successfully builds without manual intervention.

## 4. The "Quiet Workshop" Tone (Content Generation)
*   **Pseudonymous Identity:** "TerribleTurtles" is the user's online pseudonym. The site is built by a solo developer, not a faceless corporate brand. 
*   **Voice:** Always use **First-Person Singular ("I")** when generating copy for the platform. Strictly omit the user's real name.
*   **Vibe:** Minimalist, direct, open, and factual. Avoid marketing fluff, pretentious hacker personas ("I go by the name..."), or aggressive anti-tracking rants. Let the work speak for itself.
*   **Scope Promises:** Never make sweeping promises about the tools hosted here (e.g., do not claim *every* tool will be "accessible and fast"). The *platform shell* is static and secure, but the tools themselves are experimental and unboxed.
*   **Basic CSP without Trusted Types/COOP:** Rejected. To mitigate DOM XSS and prevent cross-origin leaks, CSP must enforce `require-trusted-types-for 'script'`, and `_headers` must include `Cross-Origin-Opener-Policy: same-origin`.

## 5. Search Engine Optimization (SEO) & Metadata
*   **Sitemap & Crawlability:** The site uses `@astrojs/sitemap` to generate XML sitemaps automatically at build time (`sitemap-index.xml`). A `public/robots.txt` explicitly allows crawling and points to this sitemap.
*   **AI Crawler Context:** A `public/llm.txt` manifest provides a high-level overview of the platform's purpose to AI agents.
*   **On-Page Meta:** `BaseLayout.astro` mandates the inclusion of canonical URLs, Open Graph (OG) tags, and Twitter Cards to ensure optimal social sharing and duplicate-content protection.
*   **Structured Data:** The site uses `JSON-LD` WebSite schema within `<script type="application/ld+json">`. ESLint's `astro/no-set-html-directive` rule is disabled in `eslint.config.mjs` to permit dynamic Schema.org markup injection safely.
