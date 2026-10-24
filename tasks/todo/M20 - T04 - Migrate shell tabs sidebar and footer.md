---
title: "M20 - T04 - Migrate shell tabs sidebar and footer"
type: task
project: smart-terminal
created: 2026-10-24
id: "M20-T04"
milestone: "M20"
depends_on: "M20-T03"
deliverables: "Tailwind-based chrome for shell, tabs, sidebar and status footer"
---
<!-- gsynchro:v1 id=b7d49d0f-d8b2-4ca2-b074-0c577ed3cf9d registered=2026-10-24T17:27:35.704Z -->

# M20 - T04 - Migrate shell tabs sidebar and footer

## Objective
Replace duplicated layout/chrome styling while retaining measured geometry.

## Implementation
- Migrate outer 75/25 grid, header, session bar, sidebar Clipboard/History, status footer and shared surfaces component by component.
- Apply responsive min-width/overflow constraints, tab active/inactive semantics, sync/primary read-only status states and horizontal scroll behavior.
- Keep Electron native window chrome intact; do not alter application logic or event bindings.
- Delete each legacy rule only after checking equivalent computed layout and active/hover/focus states.

## Acceptance
Visual comparison matches documented proportions at 1440×900 and 1024×700; no clipping, regressions in tab selection or sidebar filters, and status icons remain accurate.
