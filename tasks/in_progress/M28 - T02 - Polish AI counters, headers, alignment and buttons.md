---
title: "M28 - T02 - Polish AI counters, headers, alignment and buttons"
type: task
project: smart-terminal
created: 2026-10-25
id: "M28-T02"
milestone: "M28"
depends_on: "M28-T01"
deliverables: "Right-aligned counters, inline manager header, aligned answer, icon buttons"
---
# M28 - T02 - Polish AI counters, headers, alignment and buttons

## Implementation
- Byte counters: right-aligned, muted, text-[10px].
- BUILT-IN/CUSTOM counter right-aligned inside the list container.
- AI Actions manager header inline (title + description on one row, compact padding).
- Assistant body grid so Answer top aligns with the AI action select and its bottom with the User prompt bottom; Send row below.
- Save/Reset this action/Delete with icons in a flex gap row; Send with paper-plane icon and label.
## Acceptance
- Alignment visible at 1440×900/1024×700; icons decorative aria-hidden; test ids/behaviour preserved.
