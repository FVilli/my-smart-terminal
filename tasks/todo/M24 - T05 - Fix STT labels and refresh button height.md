---
title: "M24 - T05 - Fix STT labels and refresh button height"
type: task
project: smart-terminal
created: 2026-10-25
id: "M24-T05"
milestone: "M24"
depends_on: "M24-T04"
deliverables: "Clear STT label wording and aligned model refresh control"
---

# M24 - T05 - Fix STT labels and refresh button height

## Implementation
- Rename the first STT settings label to "Speech to Text provider" (and keep the shared-provider option text clear); update help copy if it references the old label.
- Make the refresh-models button the exact height of the adjacent model `<select>` at all zoom levels (same field height/padding/border; align-items: stretch/end), no visual jump.
- Update the STT smoke/capture assertions for the label and geometry (button height ≈ select height).
- Docs updated with the new wording.

## Acceptance
- Label and controls match; no layout shift; tests/smoke green.
