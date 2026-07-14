---
title: "CheckModsExtended"
description: "A .NET 9 console application that validates Single Player Tarkov (SPT) mod compatibility using the Forge API."
type: "tool"
status: "active"
---

A .NET 9 console application that validates Single Player Tarkov (SPT) mod compatibility using the Forge API.

[View on GitHub](https://github.com/TerribleTurtle/CheckModsExtended)

## Features

- **Forge API Integration**: Verifies mods against the official SPT Forge database
- **Version Compatibility**: Checks installed mod versions against SPT version requirements
- **Update Detection**: Identifies mods with available updates and provides download links
- **Security Analysis**: Mod files are scanned safely without executing their underlying code.
- **Parallel Scanning**: The app checks your mods concurrently while respecting the Forge API's network limits.
- **Network Resilience**: Displays explicit warnings if the network drops or if a mod has an invalid version number.
- **Offline Commands**: Terminal commands like `check-mods list` and `check-mods ignore` allow you to manage your mod list without an internet connection.
- **Instant Web GUI**: A robust cache-then-network architecture instantly loads your previously scanned mods while fetching fresh data in the background.
