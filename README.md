# TerribleTurtles.dev

A personal archive of things I've built. Static, fast, and quiet.

## Stack

- **Framework:** [Astro](https://astro.build) (static output, zero client-side JavaScript)
- **Hosting:** Cloudflare Workers Static Assets (no Worker script, no database, no runtime)
- **Styling:** Vanilla CSS with design tokens (`src/styles/tokens.css`)
- **Content:** Astro Content Layer, Markdown in `src/content/projects/`

Interactive tools live on their own subdomains as separate projects, so the main site can keep a strict security policy.

## Prerequisites

- Node.js `>=22.12.0`

## Commands

| Command | Action |
| :-- | :-- |
| `npm install` | Install dependencies |
| `npm run dev` | Start the local dev server |
| `npm run build` | Typecheck, lint, and build to `./dist` |
| `npm run preview` | Serve the built site locally |
| `npm test` | Run the Playwright end-to-end and accessibility suite against the built site |

## Guardrails

- `npm run build` fails on type errors, ESLint, or Stylelint violations (raw colors are banned outside the token file).
- CI runs the build plus Playwright (routes, zero CSP violations, axe-core WCAG 2.2 AA) on every push and pull request.
- Security headers are defined in `public/_headers`.

## License

Code is MIT. Written content is CC BY-NC 4.0. See [LICENSE](LICENSE).
