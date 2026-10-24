---
title: "M16B - T01 - Implement approved header"
type: task
project: smart-terminal
created: 2026-10-24
id: "M16B-T01"
milestone: "M16B"
depends_on: "M16A-T01"
deliverables: "Approved header mockup implemented with panel toggle state, window controls and 38px tabs"
---
<!-- gsynchro:v1 id=8c35b3b7-c9c1-4d36-8e51-73f435aa849f registered=2026-10-24T17:17:12.609Z -->

# M16B - T01 - Implement approved header

Blocked until user approval. Implement docs/26 exactly; add tests for panel toggles, title/version, minimize/maximize/close behavior, drag/no-drag, tab height and 1024px resilience.

## Outcome
- Full-window 35px title bar with transparent icon, runtime version, Settings, single panel toggle and Linux/Windows `_ □ ×` controls; macOS keeps native traffic lights.
- Added validated window-control IPC and maximized event; custom frame on Linux/Windows, native frame on macOS.
- History/Clipboard buttons select/open/hide the right panel and sync with the sidebar tabs; 38px session tabs; layout gate updated.
- Settings/editor/layout/IPC smokes, unit tests, lint, typecheck and build pass.
