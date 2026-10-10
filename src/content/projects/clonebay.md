---
title: "Clone Bay"
summary: "Browser-only dashboard for EVE Online multiboxers."
url: "https://clonebay.terribleturtles.dev/"
repo: "https://github.com/TerribleTurtle/clonebay"
year: 2026
status: "live"
order: 3
disclaimer: "Unofficial fan project. Not affiliated with or endorsed by CCP Games."
stack: ["Next.js", "TypeScript"]
languages: ["TypeScript"]
screenshot:
  src: "/images/work/clonebay.jpg"
  alt: "The Clone Bay dashboard: a grid of six character cards showing portrait, location, wallet, skill points, clones, jump fatigue and ship, with status buttons for skills, mail and wars. Character names are blurred and portraits are softened."
  width: 1440
  height: 900
---

I run several EVE Online characters, and checking each one meant logging in or alt-tabbing just to see whether a skill queue had run dry or an extractor had stopped. Clone Bay puts all of them on one read-only page.

It shows:

- **Skill queues**: training progress, finish times and empty-queue warnings.
- **Planetary interaction**: extractor cycles and expiry alerts.
- **Industry jobs**: manufacturing, research and invention timers.
- **Character overview**: jump fatigue, clones, location, ship, wallet and mail.
- **Status lights**: green, yellow and red markers so problems stand out across the whole roster.

There is no backend. You log in with EVE SSO (OAuth 2.0 with PKCE), tokens stay in your browser, and every request goes straight to CCP's servers. A wipe button clears everything stored locally.
