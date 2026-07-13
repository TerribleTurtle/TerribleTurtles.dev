# TerribleTurtles.dev

A highly performant portfolio and tool-hosting platform with zero manual maintenance requirements. Built with modern Astro 5+ and Cloudflare Pages/Workers architecture.

## 🚀 Tech Stack

- **Framework:** Astro (Static generation with Cloudflare Workers Assets for edge SSR)
- **Deployment:** Cloudflare Pages & Workers via Wrangler
- **Database:** Cloudflare D1
- **Key-Value Store:** Cloudflare KV
- **Styling:** Vanilla CSS Tokens (No Tailwind)

## 🧞 Commands

All commands are run from the root of the project:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server with Cloudflare proxy    |
| `npm run build`           | Build your production site to `./dist/client`    |
| `npm run generate-types`  | Update `worker-configuration.d.ts` from config   |
| `npm run deploy`          | Build and deploy the project via `wrangler deploy`|

## 🔒 Security & Architecture Notes
- This project enforces a strict **Zero-Cookie Policy**.
- All dependencies must be strictly compatible with Cloudflare's `workerd` edge runtime. Node.js native modules (`fs`, `crypto`, `child_process`) are forbidden.
- Security headers (CSP) are natively injected via `public/_headers`.
