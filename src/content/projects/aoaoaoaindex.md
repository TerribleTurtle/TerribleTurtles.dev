---
title: "AOAOAOA Index"
summary: "Quote, character and bit search for Artists on Artists on Artists on Artists."
url: "https://aoaoaoaindex.com/"
year: 2026
status: "live"
order: 4
disclaimer: "Unofficial fan project. Not affiliated with or endorsed by the creators of Artists on Artists on Artists on Artists."
stack: ["Next.js", "TypeScript", "SQLite", "Python"]
languages: ["TypeScript", "Python"]
screenshot:
  src: "/images/work/aoaoaoaindex.jpg"
  alt: "The AOAOAOA Index home page: a sidebar of Cast & Guests and Gag Types filters beside a grid of episode cards with thumbnails, cast lists and links to episode breakdowns."
  width: 1440
  height: 900
---

*Artists on Artists on Artists on Artists* is an improv comedy podcast where four hosts and a guest play different industry experts every week. With hundreds of episodes and characters, finding a specific bit or quote meant scrubbing through hours of video. I built AOAOAOA Index to make the catalogue searchable.

It includes:

- **Transcript search**: full-text search across spoken lines, bit summaries and character names, with timestamped links that open YouTube two seconds before the line.
- **Episode breakdowns**: chronological bit timelines, cast lists and stage premises for each episode.
- **Character and performer directories**: profiles tracking every appearance, recurring character and highlight bit across the show.
- **Sidebar filters**: filter episodes by cast and guests (include or exclude), gag types, compilations and air dates, or roll a random bit.
- **Offline data pipeline**: a Python pipeline that pairs YouTube captions and community wiki data into a read-only SQLite snapshot served in memory.
