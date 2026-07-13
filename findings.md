# Architectural Findings & Rules (The Disk Brain)

*This file acts as the persistent, cross-session memory for all AI agents. It documents how the "connecting bits" actually work together. Agents must read this before writing code.*

## 0. Master Blueprint
*   The complete architectural spec is located in `Software_Design_Document.md`. Refer to it for exact token hex codes, routing strategies, and NFRs.

## 1. CSS & Styling Standards
*   **Implementation:** Phase 2 introduced `src/styles/global.css` with the strict SDD design tokens mapped to CSS variables (e.g., `--bg-base`, `--accent-primary`).
*   **Typography:** Google Fonts (`Inter`, `Fira Code`) are loaded via standard `<link>` tags in `<head>` rather than generic `@import`, enforcing `font-display: swap` for maximum performance and zero layout shift.
*   **Accessibility:** Semantic HTML (e.g., `<header>`, `<main>`, `<nav aria-label="...">`) is enforced across layouts. Axe-core audits ensure zero WCAG 2.1 AA violations.
*   **Inline Style Ban:** No `.astro` components are permitted to use the `style="..."` attribute. All modifications must leverage CSS root variables in their local `<style>` blocks.
*   **AI Guardrails & CI/CD Pipeline (Phase 6):** The project enforces mathematical adherence to the "No Magic" rule. 
    *   `stylelint` is configured with `color-named: "never"`, `function-disallowed-list: ["rgb", "hsl", ...]`, and strict property allowances to completely ban hex codes and force variables for all colors, fills, and strokes.
    *   `eslint` uses flat config and `typescript-eslint` parser.
    *   The `package.json` build command requires `astro check && eslint && stylelint` to pass before `astro build`, physically preventing broken or non-compliant AI-generated code from deploying to Cloudflare Pages.
    *   `axe-core` accessibility audits are integrated into GitHub Actions (`ci.yml`), mathematically proving WCAG 2.1 AA compliance on all routes via a background `astro preview` server.
## 2. Data Strategy
*   **Content Layer:** The project relies on Astro's Content Layer for 100% static project metadata. No relational databases (D1) are used for metadata.
*   **KV Configs:** Cloudflare KV is reserved strictly for fast-read runtime configurations.



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
