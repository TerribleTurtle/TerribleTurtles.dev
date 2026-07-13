# TerribleTurtles.dev - Project-Scoped Rules
**DO NOT IGNORE THESE RULES. THEY STRICTLY OVERRIDE GLOBAL DEFAULT AGENT BEHAVIORS.**

## 1. Pure Static Architecture
- This project is a 100% pure static site deployed via Cloudflare Pages GitHub integration.
- **NEVER** install server-side adapters (like `@astrojs/cloudflare`) or attempt to use SSR features like Middleware, Actions, or KV. Doing so will break the Pages UI deployment.
- Do not use Astro's default `sharp` image optimizer.

## 2. Strict Output Mode
- The Astro config MUST rely on the default `static` mode. Legacy `output: 'hybrid'` and pure server are prohibited.

## 3. Design Tokens & Styling
- Inline styles (`style="..."`) are strictly forbidden.
- You must exclusively use the established CSS root variables (`var(--bg-base)`, etc.) which will be defined in `findings.md` and `global.css`.

## 4. Verification Over Assumptions
- You cannot mark a task complete unless you have mathematically proven it passes via CLI automated tests (e.g., `grep`, `curl -I`, `axe-core`). 
- Do not rely on visual inspection or browser devtools. Faking verification will result in immediate failure.

## 5. D1 Migrations
- Never attempt to modify the database schema via raw runtime SQL queries.
- All schema changes require a formal SQL migration file, applied explicitly via `wrangler d1 migrations apply`.
