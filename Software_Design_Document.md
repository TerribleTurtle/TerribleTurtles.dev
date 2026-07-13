# TerribleTurtles.dev - Software Design Document (SDD)

## 1. Introduction & Domain Strategy
**TerribleTurtles.dev** is designed to be a highly performant portfolio and tool-hosting platform with zero manual maintenance requirements. 

*   **Primary Domain:** `terribleturtles.dev` (Bound directly to the Cloudflare Pages project)
*   **Redirect Domain:** `terribleturtle.dev` (Bound via a Cloudflare Dynamic Redirect Rule: `concat("https://terribleturtles.dev", http.request.uri.path)` using HTTP 301 to prevent SEO duplicate content penalties and map deep links).

## 2. Tech Stack & Deployment Architecture
The platform leverages a modern, serverless edge architecture to guarantee high performance and strict zero-maintenance. 

*   **Framework:** Astro 7 (configured with `output: 'static'`, utilizing Astro's Content Layer API to act as a 100% static Git-based CMS).
*   **Hosting:** Cloudflare Pages.
*   **Database & Storage:** None. 100% Static file-based CMS.
*   **Development Workflow:** 100% AI Agent Managed.

### 2.1 Architecture Request Flow
```mermaid
graph TD
    Client[User Browser] -->|HTTPS Request| CFEdge[Cloudflare Edge Network / CDN]
    CFEdge --> PageRoute[Astro Static HTML]
```

### 2.2 Native GitHub Integration (Deployment)
Deployments are handled entirely by Cloudflare Pages native GitHub integration, eschewing manual `wrangler pages deploy` workflows. Pushing code to the `main` branch on GitHub automatically triggers Cloudflare's edge build process.
*   **Manual GitHub Link:** AI agents cannot link your GitHub repository to your Cloudflare account. You must manually connect the repo in the Cloudflare Pages dashboard to establish the CI/CD pipeline.
*   **Manual DNS Configuration:** 100% AI-managed code cannot control the domain registrar. The domains (`terribleturtles.dev`) must be manually mapped in the Cloudflare Dashboard, and registrar nameservers must be updated accordingly.

## 3. Design Tokens & Component Architecture (The "Best Friend's House" Vibe)
The aesthetic is welcoming, highly competent, modern, and clean, strictly avoiding corporate gloss or "AI slop" filler.

*   **Base Background:** Deep Charcoal (`#121212`)
*   **Surface (Cards/Panels):** Elevated Soft Black (`#1C1C1C`)
*   **Text (Primary):** Off-White (`#F4F4F4`)
*   **Text (Muted):** Cool Gray (`#64748B`)
*   **Accent (Primary):** Slate/Flat Tech Green (`#2A9D8F`)
*   **Borders:** 1px solid `#2E2E2E` (Grounds elements; replaces heavy corporate drop-shadows).
*   **Border Radius:** 6px to 8px (Soft but structured).
*   **Spacing:** Generous internal padding for breathing room.
*   **Primary Typography:** Clean Sans-Serif (Modern, highly readable).
*   **Code Typography:** Monospace (Strictly for code blocks and CLI commands).

### Component Architecture
Astro components must be highly modular to enforce strict design tokens. 
*   **Base Layout Wrappers:** Handle global padding, typography, and injection of CSS variables.
*   **Reusable UI Cards:** Ensure consistent border radiuses, borders, and surfaces across "Tools" and "Sites" buckets.

## 4. Architecture, Navigation & Content Strategy
The platform utilizes a "Bucket System": projects are built, placed in "Tools" or "Sites", and left to run.

*   **Header Menu:** Home, Tools, Sites.
*   **Footer Menu:** About, Privacy, Security, Changelog / RSS.
*   **System Pages:** Branded static 404 Error page routing back to active projects.

### 4.1 Core Route Mapping
*   `src/pages/index.astro`: Homepage (Welcome, Current Project, Archive Grid). Completely static.
*   `src/pages/tools/[slug].astro`: Statically generated routing for utility tools, driven by the Content Layer.
*   `src/pages/sites/[slug].astro`: Statically generated routing for hosted/archived sites, driven by the Content Layer.

### 4.2 Handling "Bucket System" Bit-Rot
While projects are intended to be zero-maintenance, external APIs deprecate. 
*   **Policy:** If an archived tool's external dependency fails, it will gracefully degrade into a "Static Showcase Mode" or display an automated "Deprecated: Requires Update" banner rather than breaking the parent UI.

### 4.3 High ROI Upgrades
*   **View Transitions:** App-like, seamless page loads without browser flashing.
*   **Command Palette (Cmd+K):** Keyboard-triggered search to filter projects via tags.

## 5. Data, State & Security Architecture

### 5.1 Secret & Credential Management
*   **Mechanism:** None. Pure static architecture has no secrets or runtime credentials.

### 5.2 Privacy-First Logging
*   **Mechanism:** Cloudflare Web Analytics (Cookie-free). No custom middleware required.

### 5.3 Backup & Disaster Recovery
*   **Mechanism:** Git Version Control.
*   **Implementation:** Since the architecture utilizes a 100% static Git-based CMS approach via Astro's Content Layer, all project metadata and content is stored in the repository. Disaster recovery is inherently managed by Git history and GitHub repository backups.

### 5.4 Data Models & Schemas
*   **Content Layer (Markdown):** Project metadata (title, status, type) is strictly enforced via Zod schemas in `src/content.config.ts` and stored in the frontmatter of individual Markdown files.

### 5.5 Client-Side State Boundaries
*   **Mechanism:** Vanilla Web Storage API.
*   **Implementation:** Persistent user state (e.g., dark-mode, configurations) is strictly bound to the browser's native `localStorage` or `sessionStorage`. Zero server-side session syncing or cookies.

## 6. Strict Non-Functional Requirements (NFRs)
All NFRs must be objectively verifiable prior to deployment:
*   **Perfect Speed:** Time to First Byte (TTFB) < 50ms and a 100/100 Lighthouse Performance score, achieved via hybrid architecture and zero unnecessary JS.
*   **Perfect Privacy:** Zero cookies, zero third-party tracking scripts. Analytics restricted to Cloudflare Web Analytics (server-side, cookie-free).
*   **Perfect Security:** Cloudflare enterprise DDoS protection, Turnstile bot protection, and an A+ Mozilla Observatory Score.
*   **Perfect Accessibility:** WCAG 2.1 AA Compliant semantic HTML, high-contrast color ratios, and full screen-reader support via ARIA tagging.

**Wrangler CSP Spec Example:**
The CSP strictly enforces domains while accommodating necessary Cloudflare utilities:
[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self' https://static.cloudflareinsights.com; frame-src 'self';"

## 7. AI Development Guardrails & Workflow
Crucial instructions for any LLM or AI agent interacting with the codebase:
1.  **Strict Style Enforcement:** Agents are forbidden from writing inline styles, using random hex colors, or overriding the Design Tokens. Components must use semantic HTML and token-mapped utility classes.
2.  **Dependency Lockdown:** Installing new npm packages or adding third-party scripts requires explicit human authorization. No exceptions.
3.  **Automated Quality Gates:** Any AI PR must pass CI/CD checkpoints (Astro builds, strict TypeScript compilation, accessibility/Lighthouse auditing) prior to merge.
4.  **Zero Tracking Mandate:** Enforce the zero-cookie policy. Agents must not inject iframes, external analytic tracking scripts, or non-approved third-party API calls under any circumstance.
5.  **The "Node.js Mirage":** Cloudflare Edge runs on `workerd`, not Node.js. Agents are strictly forbidden from installing npm packages that rely on native Node.js modules (`fs`, `child_process`, `crypto`, `sharp`). Rely solely on edge-compatible Web APIs.
6.  **Image Optimization Constraints:** Astro's default `<Image />` component relies on Node.js (Sharp) and fails on Cloudflare Pages. Agents must either pre-optimize images locally or explicitly configure Astro to use Cloudflare's native Image Resizing service.

## 8. Manual User Setup Guide (Non-AI Tasks)
Because AI agents operate locally and cannot securely authenticate into your Cloudflare or GitHub dashboards, the human user **must** perform the following manual setup actions:

1.  **Repository Connection:** Create a GitHub repository, push the local code, and log into the Cloudflare Pages dashboard to "Connect to Git" and enable automatic deployments.
2.  **DNS & Custom Domain:** Add `terribleturtles.dev` to Cloudflare, update your registrar's nameservers, and bind the Custom Domain to your Pages project in the Cloudflare dashboard.
