---
title: "M14 - T01 - Menu title and icon"
type: task
project: smart-terminal
created: 2026-10-23
id: "M14-T01"
milestone: "M14"
depends_on: "M13"
deliverables: "Menu policy, dynamic version title and runtime/menu icon"
---
<!-- gsynchro:v1 id=301f3034-5134-44bf-b406-d7faa8c15a89 registered=2026-10-23T20:20:48.286Z -->

# M14 - T01 - Menu title and icon

## Objective
Reclaim Chrome space and make branding/version visible without breaking standard editing shortcuts.

## Constrained implementation
On Linux/Windows remove File/Edit/View/Window menu with `Menu.setApplicationMenu(null)`. On macOS keep only the essential app menu (About, Services, Hide, Quit), no File/Edit/View/Window. Set the window title to `Smart Terminal - Version <app.getVersion()>` from runtime metadata. Set BrowserWindow icon using the packaged Linux icon (add an extra resource if needed) and verify the stock Electron icon is gone. Preserve copy/paste shortcuts (renderer/browser defaults or minimal macOS menu where required).

## Acceptance
Menu absent/minimal as decided; title shows version; window/task switcher uses Smart Terminal icon in packaged Linux build; copy/paste works.
