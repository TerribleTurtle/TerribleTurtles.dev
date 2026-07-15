---
title: "CheckModsExtended"
description: "I built a .NET 9 console application to validate Single Player Tarkov (SPT) mod compatibility using the Forge API."
type: "tool"
status: "active"
---

I built a .NET 9 console application to validate Single Player Tarkov (SPT) mod compatibility using the Forge API.

[View on GitHub](https://github.com/TerribleTurtle/CheckModsExtended)

## Features

- **Forge API Integration**: Verifies mods against the official SPT Forge database.
- **Version Compatibility**: Checks installed mod versions against SPT version requirements.
- **Update Detection**: Identifies mods with available updates and provides download links.
- **Security Analysis**: I implemented safe file scanning that reads metadata without executing underlying code.
- **Parallel Scanning**: The app checks mods concurrently while respecting the Forge API's network limits.
- **Network Resilience**: Displays explicit warnings if the network drops or if a mod has an invalid version number.
- **Offline Commands**: Terminal commands like `check-mods list` and `check-mods ignore` allow managing the mod list without an internet connection.
- **Web GUI**: A cache-first architecture loads previously scanned mods locally while fetching fresh data in the background.
