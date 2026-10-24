---
title: "M16B - Header redesign implementation"
type: milestone
project: smart-terminal
created: 2026-10-24
id: "M16B"
goal: "Implement the approved M16A header, panel toggles, custom window controls, transparent icon and 38px tabs with tests."
depends_on: "M16A"
---

# M16B - Header redesign implementation

## Delivered
- Full-window 35px title bar with transparent icon, dynamic version, Settings and single History/Clipboard panel toggle.
- Custom `_ □ ×` controls and validated IPC on Linux/Windows; native traffic lights on macOS.
- 38px session tabs and synchronized right-panel visibility.
- Transparent RGBA application icon.
- Header/layout/IPC/settings smokes and unit tests green.

Implementation reference: `docs/26 - M16A header design proposal.md`.
