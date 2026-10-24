---
title: "M17B - Input section implementation"
type: milestone
project: smart-terminal
created: 2026-10-24
id: "M17B"
goal: "Implement the approved M17A composer with unchanged keyboard/AI/STT behavior and tests."
depends_on: "M17A"
---

# M17B - Input section implementation

## Delivered
- Single 1px/8px bordered composer with textarea and bottom action row.
- AI, mic and send inside the border at bottom right; send is the filled primary circle.
- Composer height 103px at 1024/1440; focus/disabled/recording states and notices preserved.
- Keyboard/IME/AI/STT semantics unchanged; editor/layout tests green.

Implementation reference: `docs/27 - M17A input design proposal.md`.
