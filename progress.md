# Current Session Progress

**Current Stage:** Technical SEO & Accessibility Updates.
**Target Goal:** Perfect bot crawlability via sitemaps/robots and fix skipped link focus management.

### 5-Question Reboot Check
1. **What is the immediate next step?** -> Commit and push the SEO/Accessibility fixes.
2. **Are there any blocking errors?** -> No, the site builds correctly.
3. **Have findings been updated?** -> Yes, `findings.md` correctly outlines the SEO metadata structure.
4. **Is the task plan accurate?** -> Yes.
5. **Are we straying from the SDD?** -> No, SEO optimizations fulfill the NFR for discoverability.

### Scratchpad
- **Major Milestone:** Technical SEO Audit & Implementation completed.
- Added `@astrojs/sitemap`, configured `astro.config.mjs` with production `site` URL.
- Updated `BaseLayout.astro` with Canonical, Open Graph, Twitter Cards, and JSON-LD schema.
- Added `robots.txt` and `llm.txt` to `public/` directory.
- User manually added `tabindex="-1"` to `<main>` to ensure programmatic focus for the "Skip to main content" link works correctly.
- Fixed WCAG 2.1 `heading-order` violations by updating `ProjectCard` to accept dynamic `headingLevel` props.
- Automated `axe-core` accessibility audits in the `.husky/pre-commit` hook using `start-server-and-test`.
