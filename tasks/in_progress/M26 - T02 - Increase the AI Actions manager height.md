---
title: "M26 - T02 - Increase the AI Actions manager height"
type: task
project: smart-terminal
created: 2026-10-25
id: "M26-T02"
milestone: "M26"
depends_on: "M26-T01"
deliverables: "AI Actions manager 10% taller with unchanged width and scrolling"
---
# M26 - T02 - Increase the AI Actions manager height

## Implementation
- Manager dialog max height from `min(720px, 90vh)` to `min(792px, 90vh)` (10%); width `min(1000px, 94vw)` unchanged; body remains the scroll container and footer pinned.
- Verify at 1440×900 and 1024×700 (clamped by 90vh) and with zoom.
## Acceptance
- Height +10% at 900 px viewport, no clipping/overflow, modal tests/smoke green.
