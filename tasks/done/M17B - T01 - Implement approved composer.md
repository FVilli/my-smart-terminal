---
title: "M17B - T01 - Implement approved composer"
type: task
project: smart-terminal
created: 2026-10-24
id: "M17B-T01"
milestone: "M17B"
depends_on: "M17A-T01"
deliverables: "Approved single-border composer implemented with unchanged keyboard/AI/STT behavior"
---
<!-- gsynchro:v1 id=e6045b09-341f-4009-895e-22c775f6a0cd registered=2026-10-24T17:17:12.610Z -->

# M17B - T01 - Implement approved composer

Blocked until user approval. Implement docs/27 exactly; add tests for composer states, focus, Enter/Shift+Enter/IME, AI/STT semantics and 1024/1440 layouts.

## Outcome
- Replaced separate control boxes with one 1px/8px bordered composer; AI/mic/send are borderless bottom-right controls inside it, send is the filled primary circle.
- Input measured 103px at 1024/1440 (within the 96–130 gate); keyboard/IME/AI/STT semantics and test IDs preserved.
- Editor/settings/layout/unit/lint/typecheck/build pass.
