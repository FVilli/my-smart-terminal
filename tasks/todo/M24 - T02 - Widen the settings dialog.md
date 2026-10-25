---
title: "M24 - T02 - Widen the settings dialog"
type: task
project: smart-terminal
created: 2026-10-25
id: "M24-T02"
milestone: "M24"
depends_on: "M24-T01"
deliverables: "Settings dialog at least 60% wider with responsive behaviour at 1024x700 and zoom"
---

# M24 - T02 - Widen the settings dialog

## Implementation
- Settings (edit mode) dialog width: from `min(520px, 92vw)` to at least `min(832px, 92vw)` (60% wider), keeping `height: min(620px,90vh)`, internal scroll and pinned footer.
- Two-column settings body where it improves density (AI actions editor) but keep single-column forms readable; no horizontal overflow at 1024×700.
- Update `docs/15` measurement note and the settings smoke height check; add a width assertion in the capture/layout check.
- Verify zoom 50/100/200 and both viewports; screenshots updated in T06/last docs task only.

## Acceptance
- Width ≥832 px on 1440 and 92vw at 1024, no clipping, fixed height preserved, tests/smokes/layout green.
