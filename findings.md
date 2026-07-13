# Architectural Findings & Rules (The Disk Brain)

*This file acts as the persistent, cross-session memory for all AI agents. It documents how the "connecting bits" actually work together. Agents must read this before writing code.*

## 0. Master Blueprint
*   The complete architectural spec is located in `Software_Design_Document.md`. Refer to it for exact token hex codes, routing strategies, and NFRs.

## 1. CSS & Styling Standards
*(To be populated by agents during Phase 2)*

## 2. D1 Schema & Queries
*(To be populated by agents during Phase 3)*

## 3. Middleware Context & Locals
*(To be populated by agents during Phase 3)*
*   **Local Development Bindings:** `astro.config.mjs` must use `platformProxy: { enabled: true }` within the Cloudflare adapter, otherwise `astro dev` cannot access `env.DB` or `env.CONFIG_KV`.
*   **Types:** `src/env.d.ts` must extend `Astro.locals` using `type Runtime = import('@astrojs/cloudflare').Runtime<Env>;` to prevent TypeScript errors when accessing Cloudflare bindings in middleware and pages.

## Rejected Approaches (Mandatory Negative Knowledge)
*   **Logging to KV:** Rejected because KV is highly rate-limited for writes. We use native Tail Logs and Analytics Engine instead.
*   **Pure Static Astro Build:** Rejected because edge middleware required for D1/KV queries demands Server-Side capabilities. Note: Astro 5+ removed the `output: 'hybrid'` config option, so we now use the default `static` mode which handles hybrid rendering under the hood automatically when an adapter is present.
*   **Strict `default-src 'self'` CSP:** Rejected because it blocks required Cloudflare Turnstile and Web Analytics. Whitelisted domains have been mapped in the SDD.
*   **Wrangler Pages Deploy:** Rejected because modern Astro Cloudflare adapters utilize the new Cloudflare Workers Assets structure (`dist/client` and `dist/server`). We MUST use `wrangler deploy` instead of `wrangler pages deploy` to ensure the worker and assets are properly uploaded.
*   **Security Headers in wrangler.jsonc:** Rejected. Although the SDD mentions placing headers in `wrangler.toml`, Cloudflare Workers Assets architecture (which Astro 5 targets) does not support the `headers` field in the root config. Security headers MUST be placed in `public/_headers`, which the Astro compiler perfectly integrates into `dist/client/_headers`.
