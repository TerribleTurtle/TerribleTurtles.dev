# TerribleTurtles.dev - Master Execution Plan

This document serves as the ultra-detailed, strict checklist for AI agents. An agent may NOT proceed to a subsequent phase until the current phase's verification gates have been explicitly passed and proven through automated CLI execution. Subjective or visual reviews are strictly forbidden.

## Phase 1: Core Infrastructure & Scaffolding
**Goal:** Establish the foundational Astro environment, Cloudflare integrations, and automated deployment pipeline.
- `[x]` **1.1 Astro Initialization:** Initialize a new Astro project in `c:\dev\personal\TerribleTurtles.dev` using the strict TypeScript template.
- `[x]` **1.2 Adapter Configuration:** Install `@astrojs/cloudflare` and configure `astro.config.mjs` with `output: 'static'`. Bypass the default `sharp` image adapter to respect Cloudflare constraints.
- `[x]` **1.3 Wrangler Setup:** Create `wrangler.jsonc` defining the D1 and KV bindings matching the Cloudflare Pages environment.
- `[x]` **1.4 CI/CD Pipeline:** Executing direct `wrangler deploy` locally to bypass Cloudflare UI bugs (updated from `pages deploy` to support Astro 5+ Workers Assets).
- `[x]` **1.5 Security Headers:** Implement the explicit CSP headers from the SDD inside `public/_headers` (allowing Turnstile and CF Analytics).
**Automated Verifiable Outcomes:**
*   *Test 1 (Build):* `npm run build` succeeds with zero strict TypeScript errors.
*   *Test 2 (CSP):* `curl -I http://localhost:8788 | grep -F "Content-Security-Policy: default-src 'self'"` succeeds.
*   *Test 3 (Node.js Mirage Trap):* `grep -r -E "import.*from '(fs|path|crypto|child_process|sharp)'" src/` must return no matches (exit code 1). CI must crash if this fails.

## Phase 2: Design Tokens & Base Architecture
**Goal:** Implement the "Best Friend's House" aesthetic using semantic HTML and vanilla CSS tokens.
- `[x]` **2.1 Global Tokens:** Create `src/styles/global.css` and map exact hex codes (`#121212`, `#1C1C1C`, `#2A9D8F`) to CSS variables.
- `[x]` **2.2 Typography:** Implement Google Fonts (Sans-Serif, Monospace) optimizing for zero layout shift (`font-display: swap`).
- `[x]` **2.3 Base Layout:** Create `src/layouts/BaseLayout.astro` ensuring semantic `<header>`, `<main>`, and `<footer>` tags.
- `[x]` **2.4 Reusable UI Cards:** Create the `ProjectCard.astro` component enforcing the 6px-8px border radius and 1px solid borders.
**Automated Verifiable Outcomes:**
*   *Test 1 (Token Integrity):* `grep -q "#121212" dist/styles/global.css` executes successfully.
*   *Test 2 (Inline Style Ban):* `grep -rn "style=" src/**/*.astro` must return nothing (exit code 1).
*   *Test 3 (Accessibility):* `npx @axe-core/cli http://localhost:8788` scans the index page and returns 0 violations (verifies WCAG 2.1 AA).

## Phase 2.5: Astro 6+ Migration & Documentation Adjustment
**Goal:** Align architectural memory with Astro 6+ and `workerd` parity.
- `[x]` **2.5.1 Update SDD & Findings:** Remove `Astro.locals.runtime` references, document `cloudflare:workers` and explicit `prerender = false` requirements.
- `[x]` **2.5.2 Plan Verification:** Execute `grep_search` to verify NO old legacy concepts exist in the memory files.

## Phase 3: Database, State & Middleware
**Goal:** Establish privacy-first edge error tracking and KV bindings.
- `[x]` **3.1 Astro Actions Integration:** Establish `src/actions/index.ts` utilizing `astro:actions` for all type-safe client-to-server mutations.
- `[x]` **3.2 Astro Middleware:** Create `src/middleware.ts` strictly scoped to intercept `next()` execution for dynamic error catching (NOT for static global headers, which belong in `public/_headers`).
- `[x]` **3.3 Telemetry Integration:** Configure Action handlers to strip PII and write sanitized logs to `console.error` (for native CF Tail / Workers Analytics Engine).
- `[x]` **3.4 KV Connections:** Configure the KV binding in `wrangler.jsonc` and implement accesses via `import { env } from "cloudflare:workers"`. Run `npm run generate-types` to update `worker-configuration.d.ts`.
- `[x]` **3.5 Client State APIs:** Create `src/utils/storage.ts` providing safe `localStorage` wrappers.
- `[x]` **3.6 Edge Rendering:** Ensure any dynamic API routes querying KV during their initial HTML render payload explicitly declare `export const prerender = false;`. purely static pages interacting with Actions via RPC do not require this.
**Automated Verifiable Outcomes:**
*   *Test 1 (Zero-Cookie Rule):* `curl -I http://localhost:8788 | grep -i "Set-Cookie"` must fail (return no matches).
*   *Test 2 (Telemetry Hook):* Execute an action via RPC to simulate an error. Assert HTTP code `500` is returned, and `stdout` of Wrangler contains the sanitized JSON log.
*   *Test 3 (KV Read):* `wrangler kv:key get --binding CONFIG_KV config:test --local` succeeds without binding errors.
*   *Test 4 (Storage Wrapper Safety):* `grep -q "try {" src/utils/storage.ts` succeeds (proving `localStorage` is safely wrapped against strict-mode browser crashes).

## Phase 4: Content Routing & The Bucket System
**Goal:** Build the static file-based routing architecture and Markdown parsing pipelines via Astro Content Layer.
- `[x]` **4.1 Homepage Grid:** Implement `src/pages/index.astro` to statically map Content Layer data to `ProjectCard.astro`.
- `[x]` **4.2 Dynamic Routes:** Create `src/pages/tools/[slug].astro` and `src/pages/sites/[slug].astro` using `getStaticPaths()` for static generation.
- `[x]` **4.3 Markdown Processing:** Configure Astro's modern Content Layer API (`src/content.config.ts` using `defineCollection({ loader: glob(...) })`) to parse the "Enhanced Readmes" and their frontmatter schemas.
- `[x]` **4.4 Graceful Degradation:** Implement the "Bit-Rot" banner component.
- `[x]` **4.5 Custom 404 Layout:** Create `src/pages/404.astro`.
**Automated Verifiable Outcomes:**
*   *Test 1 (Bit-Rot Policy):* Fetch a dedicated test route that simulates an API failure and verify the fallback UI: `curl -s http://localhost:8788/test-bitrot | grep "Deprecated: Requires Update"` succeeds.
*   *Test 2 (Syntax Highlighting):* `npm run build && grep -q "class=\"shiki\"" dist/tools/test-utility/index.html` succeeds.
*   *Test 3 (404 Routing):* `curl -s -o /dev/null -w "%{http_code}" http://localhost:8788/does-not-exist` outputs exactly `404`.

## Phase 5: Security & Final NFR Auditing
**Goal:** Lock down the application and verify all non-functional requirements before marking the project complete.
- `[x]` **5.1 Mozilla Observatory Headers:** Implement HSTS, X-Content-Type-Options, and Referrer-Policy headers.
- `[x]` **5.2 Secret Inspection:** Ensure no runtime functions are bleeding build-time `.env` variables via `import.meta.env`.
**Automated Verifiable Outcomes:**
*   *Test 1 (Speed):* `curl -o /dev/null -s -w "%{time_starttransfer}\n" http://localhost:8787` output is strictly `< 0.05` seconds.
*   *Test 2 (Secret Syntax Boundary):* `grep -rn "import.meta.env" src/` must return nothing (exit code 1). Ensures we explicitly use `astro:env/server` for string secrets and `import { env } from "cloudflare:workers"` for bindings.
