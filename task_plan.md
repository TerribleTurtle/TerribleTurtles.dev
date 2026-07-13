# TerribleTurtles.dev - Master Execution Plan

This document serves as the ultra-detailed, strict checklist for AI agents. An agent may NOT proceed to a subsequent phase until the current phase's verification gates have been explicitly passed and proven through automated CLI execution. Subjective or visual reviews are strictly forbidden.

## Phase 1: Core Infrastructure & Scaffolding
**Goal:** Establish the foundational Astro environment, Cloudflare integrations, and automated deployment pipeline.
- `[x]` **1.1 Astro Initialization:** Initialize a new Astro project in `c:\dev\personal\TerribleTurtles.dev` using the strict TypeScript template.
- `[x]` **1.2 Adapter Configuration:** Install `@astrojs/cloudflare` and configure `astro.config.mjs` with `output: 'hybrid'`. Bypass the default `sharp` image adapter to respect Cloudflare constraints.
- `[x]` **1.3 Wrangler Setup:** Create `wrangler.jsonc` defining the D1 and KV bindings matching the Cloudflare Pages environment.
- `[x]` **1.4 CI/CD Pipeline:** Executing direct `wrangler deploy` locally to bypass Cloudflare UI bugs (updated from `pages deploy` to support Astro 5+ Workers Assets).
- `[x]` **1.5 Security Headers:** Implement the explicit CSP headers from the SDD inside `wrangler.toml` (allowing Turnstile and CF Analytics).
**Automated Verifiable Outcomes:**
*   *Test 1 (Build):* `npm run build` succeeds with zero strict TypeScript errors.
*   *Test 2 (CSP):* `curl -I http://localhost:8788 | grep -F "Content-Security-Policy: default-src 'self'"` succeeds.
*   *Test 3 (Node.js Mirage Trap):* `grep -r -E "import.*from '(fs|path|crypto|child_process|sharp)'" src/` must return no matches (exit code 1). CI must crash if this fails.

## Phase 2: Design Tokens & Base Architecture
**Goal:** Implement the "Best Friend's House" aesthetic using semantic HTML and vanilla CSS tokens.
- `[ ]` **2.1 Global Tokens:** Create `src/styles/global.css` and map exact hex codes (`#121212`, `#1C1C1C`, `#2A9D8F`) to CSS variables.
- `[ ]` **2.2 Typography:** Implement Google Fonts (Sans-Serif, Monospace) optimizing for zero layout shift (`font-display: swap`).
- `[ ]` **2.3 Base Layout:** Create `src/layouts/BaseLayout.astro` ensuring semantic `<header>`, `<main>`, and `<footer>` tags.
- `[ ]` **2.4 Reusable UI Cards:** Create the `ProjectCard.astro` component enforcing the 6px-8px border radius and 1px solid borders.
**Automated Verifiable Outcomes:**
*   *Test 1 (Token Integrity):* `grep -q "#121212" dist/styles/global.css` executes successfully.
*   *Test 2 (Inline Style Ban):* `grep -rn "style=" src/**/*.astro` must return nothing (exit code 1).
*   *Test 3 (Accessibility):* `npx @axe-core/cli http://localhost:8788` scans the index page and returns 0 violations (verifies WCAG 2.1 AA).

## Phase 3: Database, State & Middleware
**Goal:** Provision local mock databases, establish the D1 schemas, and implement privacy-first edge error tracking.
- `[ ]` **3.1 D1 Migrations:** Create initial SQL migration (`0001_init.sql`) defining the `projects` table and apply via `wrangler d1 migrations apply --local`.
- `[ ]` **3.2 Astro Middleware:** Create `src/middleware.ts` to intercept `next()` execution. 
- `[ ]` **3.3 Telemetry Integration:** Configure middleware to strip PII and write sanitized logs to `console.error` (for CF Tail).
- `[ ]` **3.4 KV Connections:** Configure the KV binding in `wrangler.toml` for cached configurations.
- `[ ]` **3.5 Client State APIs:** Create `src/utils/storage.ts` providing safe `localStorage` wrappers.
**Automated Verifiable Outcomes:**
*   *Test 1 (Zero-Cookie Rule):* `curl -I http://localhost:8788 | grep -i "Set-Cookie"` must fail (return no matches).
*   *Test 2 (Telemetry Hook):* Hit `curl -X POST http://localhost:8788/api/mock-error`. Assert HTTP code `500` is returned, and `stdout` of Wrangler contains the sanitized JSON log.
*   *Test 3 (KV Read):* `wrangler kv:key get config:test --local` succeeds without binding errors.

## Phase 4: Content Routing & The Bucket System
**Goal:** Build the dynamic file-based routing architecture and Markdown parsing pipelines.
- `[ ]` **4.1 Homepage Grid:** Implement `src/pages/index.astro` to map D1 data to `ProjectCard.astro`.
- `[ ]` **4.2 Dynamic Routes:** Create `src/pages/tools/[slug].astro` and `src/pages/sites/[slug].astro`.
- `[ ]` **4.3 Markdown Processing:** Configure Astro's content collections to parse the "Enhanced Readmes".
- `[ ]` **4.4 Graceful Degradation:** Implement the "Bit-Rot" banner component.
- `[ ]` **4.5 Custom 404 Layout:** Create `src/pages/404.astro`.
**Automated Verifiable Outcomes:**
*   *Test 1 (Bit-Rot Policy):* A test script overrides an API dependency var, fetches the page, and parses the DOM to assert "Deprecated: Requires Update" text is present (avoiding 500 crashes).
*   *Test 2 (Syntax Highlighting):* `grep -q "class=\"shiki\"" dist/tools/test-utility/index.html` succeeds.
*   *Test 3 (404 Routing):* `curl -s -o /dev/null -w "%{http_code}" http://localhost:8788/does-not-exist` outputs exactly `404`.

## Phase 5: Security & Final NFR Auditing
**Goal:** Lock down the application and verify all non-functional requirements before marking the project complete.
- `[ ]` **5.1 Turnstile Integration:** Inject the Cloudflare Turnstile widget.
- `[ ]` **5.2 Mozilla Observatory Headers:** Implement HSTS, X-Content-Type-Options, and Referrer-Policy headers.
- `[ ]` **5.3 Secret Inspection:** Ensure no runtime functions are bleeding build-time `.env` variables.
**Automated Verifiable Outcomes:**
*   *Test 1 (Speed):* `curl -o /dev/null -s -w "%{time_starttransfer}\n" http://localhost:8788` output is strictly `< 0.05` seconds.
*   *Test 2 (CSP Violation Catch):* A headless script loads the page and fails if `page.on('console')` emits `securitypolicyviolation` or Turnstile load errors.
*   *Test 3 (Secret Syntax Boundary):* `grep -rn "import.meta.env" src/pages/api/` must return nothing (exit code 1). Ensures serverless APIs exclusively use `Astro.locals.runtime.env`.
