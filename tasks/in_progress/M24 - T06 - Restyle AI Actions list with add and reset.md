---
title: "M24 - T06 - Restyle AI Actions list with add and reset"
type: task
project: smart-terminal
created: 2026-10-25
id: "M24-T06"
milestone: "M24"
depends_on: "M24-T05"
deliverables: "Card-based AI Actions list with + and confirmed Reset, wider editor from T02"
---

# M24 - T06 - Restyle AI Actions list with add and reset

## Implementation
- Replace the plain list with the history/clipboard card pattern (`.card` tokens: bordered card, title, muted meta, selected state, actions area), showing Built-in/Custom tags and description; keep `ai-settings-action-<id>` test ids.
- Footer of the list: `+` add button and `Reset` button. `+` opens the existing add form; `Reset` asks for confirmation in a dialog ("Restore the five built-in templates to their defaults? Custom actions are kept.") and then resets each built-in (or a bulk reset API if added); no reset without confirmation.
- Editor section uses the extra width from T02 (two columns: list and editor), labels/counters unchanged.
- Extension to the ipc/store only if a bulk reset is cleaner; otherwise sequential resets in the renderer with error aggregation.
- Tests: reset confirmation accept/cancel; add flow; settings smoke updated.

## Acceptance
- Card list, + and confirmed Reset; no accidental data loss; tests/smoke/layout green.
