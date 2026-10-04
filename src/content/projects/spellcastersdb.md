---
title: "SpellcastersDB"
summary: "Community database and deck builder for Spellcasters Chronicles."
url: "https://www.spellcastersdb.com/"
repo: "https://github.com/TerribleTurtle/spellcastersdb"
year: 2026
status: "live"
order: 1
disclaimer: "Unofficial fan project. Not affiliated with or endorsed by Quantic Dream."
stack: ["Next.js", "TypeScript"]
languages: ["TypeScript"]
screenshot:
  src: "/images/work/spellcastersdb.jpg"
  alt: "The SpellcastersDB home page: a \"Spellcasters Chronicles Database\" heading above cards for the Deck Builder, Unit Database and Game Guide."
  width: 1440
  height: 900
---

I built a community database and deck builder for *Spellcasters Chronicles*. It is a Next.js application with these features:

- **The Archive**: A searchable, filterable database of all Units, Spells, Titans, and Spellcasters.
- **Knowledge Tracker**: An interactive calculator that connects to the community API to plan unlocks, track owned entities, and forecast daily progression.
- **Guide Hub**: A knowledge base covering game mechanics, ranked tier ladders, class upgrades, and progression systems.
- **The Forge**: A logic-validating deck builder with a CSS Grid layout, modals for saving/editing, short link sharing (via Upstash Redis), and toast notifications.
- **The Trinity (Team Builder)**: Build and manage teams of 3 decks with shared card pool validation and short link sharing.
- **Live Updates**: A static JSON API allows for rapid balance updates without full site rebuilds.
- **Accessibility**: Built to WCAG 2.1 AA guidelines, including skip navigation, focus-trapped modals, and ARIA labels.
- **Theming**: 7 CSS themes (Dark, Light, Arcane, Inferno, Frost, Retro, GlitchWitch) plus a Rainbow mode.
