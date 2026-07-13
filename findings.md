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

## Rejected Approaches (Mandatory Negative Knowledge)
*   **Logging to KV:** Rejected because KV is highly rate-limited for writes. We use native Tail Logs and Analytics Engine instead.
*   **Pure Static Astro Build:** Rejected because edge middleware required for D1/KV queries demands `output: 'hybrid'`.
*   **Strict `default-src 'self'` CSP:** Rejected because it blocks required Cloudflare Turnstile and Web Analytics. Whitelisted domains have been mapped in the SDD.
