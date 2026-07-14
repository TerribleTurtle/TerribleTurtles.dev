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
**Goal:** Align architectural memory with pure static nature.
- `[x]` **2.5.1 Update SDD & Findings:** Remove `Astro.locals.runtime` and `cloudflare:workers` references, and document pure static architecture without SSR.
- `[x]` **2.5.2 Plan Verification:** Execute `grep_search` to verify NO old legacy concepts exist in the memory files.

## Phase 3: Database, State & Middleware (ARCHIVED)
**Goal:** Establish privacy-first edge error tracking and KV bindings.
*Note: Phase 3 was entirely reverted in Phase 5 because the user's GitHub repo is natively paired to the Cloudflare Pages UI, which no longer supports Astro 5 SSR deployments via `@astrojs/cloudflare`. The project must remain 100% pure static.*
- `[x]` **3.1 Astro Actions Integration:** Removed.
- `[x]` **3.2 Astro Middleware:** Removed.
- `[x]` **3.3 Telemetry Integration:** Removed.
- `[x]` **3.4 KV Connections:** Removed.
- `[x]` **3.5 Client State APIs:** Create `src/utils/storage.ts` providing safe `localStorage` wrappers. (Retained, runs purely in browser).
- `[x]` **3.6 Edge Rendering:** Removed.
**Automated Verifiable Outcomes:**
*   *Test 1 (Storage Wrapper Safety):* `grep -q "try {" src/utils/storage.ts` succeeds (proving `localStorage` is safely wrapped against strict-mode browser crashes).

## Phase 4: Content Routing & The Bucket System
**Goal:** Build the static file-based routing architecture and Markdown parsing pipelines via Astro Content Layer.
- `[x]` **4.1 Homepage Grid:** Implement `src/pages/index.astro` to statically map Content Layer data to `ProjectCard.astro`.
- `[x]` **4.2 Dynamic Routes:** Create `src/pages/tools/[slug].astro` and `src/pages/sites/[slug].astro` using `getStaticPaths()` for static generation.
- `[x]` **4.3 Markdown Processing:** Configure Astro's modern Content Layer API (`src/content.config.ts` using `defineCollection({ loader: glob(...) })`) to parse the "Enhanced Readmes" and their frontmatter schemas.
- `[x]` **4.4 Graceful Degradation:** Implement the "Bit-Rot" banner component.
- `[x]` **4.5 Custom 404 Layout:** Create `src/pages/404.astro`.
**Automated Verifiable Outcomes:**
*   *Test 1 (Bit-Rot Policy):* Fetch a dedicated test route that simulates an API failure and verify the fallback UI: `curl -s http://localhost:8788/tools/test-bitrot | grep "Deprecated: Requires Update"` succeeds.
*   *Test 2 (Syntax Highlighting):* `npm run build && grep -q "class=\\"astro-code\\"" dist/tools/test-utility/index.html` succeeds.
*   *Test 3 (404 Routing):* `curl -s -o /dev/null -w "%{http_code}" http://localhost:8788/does-not-exist` outputs exactly `404`.

## Phase 5: Security & Final NFR Auditing
**Goal:** Lock down the application and verify all non-functional requirements before marking the project complete.
- `[x]` **5.1 Mozilla Observatory Headers:** Implement HSTS, X-Content-Type-Options, and Referrer-Policy headers.
- `[x]` **5.2 Secret Inspection:** Ensure no runtime functions are bleeding build-time `.env` variables via `import.meta.env`.
**Automated Verifiable Outcomes:**
*   *Test 1 (Speed):* `curl -o /dev/null -s -w "%{time_starttransfer}\n" http://localhost:8787` output is strictly `< 0.05` seconds.
*   *Test 2 (Secret Syntax Boundary):* `grep -rn "import.meta.env" src/` must return nothing (exit code 1). Ensures we explicitly use `astro:env/server` for string secrets and `import { env } from "cloudflare:workers"` for bindings.

## Phase 6: AI Guardrails & CI/CD Pipeline Enforcement
**Goal:** Mathematically lock down the codebase against magic colors, inline styles, and unapproved frameworks using strict 2026 CI/CD integrations.
- `[x]` **6.1 Project Rules Engine:** Append the Behavioral Rules (No Magic, Atomic Mod, Semantic A11y, Amnesia, Code Transparency) to `.agents/AGENTS.md`.
- `[x]` **6.2 ESLint (Flat Config):** Install `eslint`, `eslint-plugin-astro`, and configure `eslint.config.mjs` for Astro 7 strictness.
- `[x]` **6.3 Stylelint (Token Enforcement):** Install `stylelint`, `stylelint-config-astro`, and `stylelint-declaration-use-variable` to formally ban raw hex codes via `stylelint.config.mjs`.
- `[x]` **6.4 Script Definition:** Update `package.json` with `lint:js`, `lint:css`, and `typecheck`.
- `[x]` **6.5 Cloudflare Deployment Block:** Modify the `build` script in `package.json` to execute `npm run typecheck && npm run lint:js && npm run lint:css && astro build` to guarantee broken code never deploys.
- `[x]` **6.6 GitHub Actions CI:** Create `.github/workflows/ci.yml` to run the linters on push/PR for GitHub UI visibility.
- `[x]` **6.7 Accessibility Auditing (CI):** Integrate `axe-core` CLI into the GitHub Actions pipeline to strictly enforce WCAG 2.1 AA compliance.
**Automated Verifiable Outcomes:**
*   *Test 1 (Linter Installation):* `npm run lint:js` and `npm run lint:css` execute successfully.
*   *Test 2 (Deployment Blocker):* Inject a `color: #ff0000;` into a scratch file and run `npm run build`. The command MUST fail with exit code 1.
*   *Test 3 (Variable Enforcement):* `grep -q "stylelint-declaration-use-variable" package.json` succeeds.

## Phase 7: UI/UX Professional Polish
**Goal:** Resolve scaling issues, fix visual artifacts, and transition to a full-bleed grid architecture.
- `[x]` **7.1 Full-Bleed Architecture:** Update `BaseLayout.astro` and `global.css` to allow header/footer to span 100% width while the `.container` restricts inner content.
- `[x]` **7.2 Fluid Grid:** Update `ProjectCard.astro` and grid layouts to dynamically scale down without horizontal scrolling.
- `[x]` **7.3 Sticky Footer:** Convert the body to a Flexbox column with `min-height: 100vh` to anchor the footer.
- `[x]` **7.4 Visual Artifact Fix:** Refactor the `.skip-link` accessibility pattern to use `clip-path: inset(50%)` instead of `clip: rect(...)`, resolving the green artifact glitch and passing Stylelint v17 deprecation rules.

## Phase 8: Fluid Typography & Wide-Screen Adaptation
**Goal:** Transition static pixel tokens to mathematical fluid `clamp()` functions for native large-screen scaling.
- `[x]` **8.1 Wide Container:** Increase `.container` max-width from `900px` to `1200px` to utilize 1440p displays.
- `[x]` **8.2 Fluid Spaces:** Convert `--space` padding tokens to CSS `clamp()` in `global.css`.
- `[x]` **8.3 Fluid Typography:** Implement `clamp()` for base `html` font size and hero text in `index.astro`.
**Automated Verifiable Outcomes:**
*   *Test 1 (CSS Parsing):* `npm run lint:css` validates `clamp()` usage without stylelint errors.

## Phase 9: Deep Environment Clean & Tidy
**Goal:** Optimize repository hygiene, secure configuration boundaries, and remove package bloat based on a multi-agent domain audit.
- `[x]` **9.1 Security & Cruft Sweeping:** Update `.gitignore` with comprehensive rules, delete ghost files (`scratch.txt`, `script.py`), and add `.editorconfig`.
- `[x]` **9.2 Dependency Optimization:** Remove `jsdom` and `@typescript-eslint/parser`, add `"test"` script, and enforce Node-native Vitest environments.
- `[x]` **9.3 Professional Standards:** Add `.env.example` and a dual-licensed `LICENSE` file (MIT for Code, CC BY-NC 4.0 for Content).
**Automated Verifiable Outcomes:**
*   *Test 1 (Package Bloat Removal):* `npm run test` executes successfully natively without `jsdom`.

## Phase 10: Lighthouse Performance & CSP Hardening
**Goal:** Achieve perfect Lighthouse scores and harden the CSP.
- `[x]` **10.1 Font Optimization:** Self-host Google Fonts via `@fontsource` to eliminate render-blocking LCP delays.
- `[x]` **10.2 CSP & Headers:** Enforce `require-trusted-types-for` and `Cross-Origin-Opener-Policy: same-origin` in `public/_headers`.
- `[x]` **10.3 Contrast Ratios:** Update `--text-muted` to pass AAA contrast on dark backgrounds.
