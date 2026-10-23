---
title: "M14 - T04 - Zoom and verification"
type: task
project: smart-terminal
created: 2026-10-23
id: "M14-T04"
milestone: "M14"
depends_on: "M14-T01, M14-T02, M14-T03"
deliverables: "Working Ctrl+plus/minus/0 zoom, ADR exception, visual/package verification"
---

# M14 - T04 - Zoom and verification

## Objective
Make zoom predictable without a general terminal key-interception layer.

## Constrained implementation
Implement zoom out/in/reset for `Ctrl/Cmd+-`, `Ctrl/Cmd++`, `Ctrl+=`, `Ctrl+Shift+=`, numpad plus and `Ctrl/Cmd+0`, clamped to sensible limits, even with xterm focus. Use one handler; no other keys intercepted. Document the ADR exception and terminal limitation. Add tests/smokes for zoom and final visual/package verification.

## Acceptance
All zoom variants work, reset returns 100%, xterm remains usable, no other Ctrl keys are consumed, documentation matches behavior.

## Outcome
- Zoom helper and one `before-input-event` handler: Ctrl/Cmd+- / + (including =, Shift+= and numpad) and Ctrl/Cmd+0, 10% steps, 50–200%, reset 100%; ADR exception scoped to zoom only.
- Menu policy/title/runtime icon implemented; Linux package includes `resources/icon.png`.
- Settings/onboarding/AI/STT setup smokes, layout, screenshots, unit tests, lint, typecheck, build and Linux package verification pass. Screenshots refreshed for the unified palette.
