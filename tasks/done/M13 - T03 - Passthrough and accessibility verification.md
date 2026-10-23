---
title: "M13 - T03 - Passthrough and accessibility verification"
type: task
project: smart-terminal
created: 2026-10-23
id: "M13-T03"
milestone: "M13"
depends_on: "M13-T01, M13-T02"
deliverables: "Automated focus/composer tests and terminal/SSH/TUI passthrough regression coverage"
---
<!-- gsynchro:v1 id=4cc26ece-5abd-4916-bf6c-cbca9ef528de registered=2026-10-23T20:20:48.284Z -->

# M13 - T03 - Passthrough and accessibility verification

## Objective
Prove the app adds no rewriting to terminal input and the two surfaces remain operable.

## Constrained implementation
Add focused tests/smokes for focus transitions, visible focus, tab order, caret, Enter/Shift+Enter/IME, Escape, draft retention and first-key routing. Add terminal passthrough tests for representative ArrowUp/Down, Tab, Enter, Escape and bracketed paste, including SSH/TUI where feasible. Keep M12's zoom exception out of this milestone.

## Acceptance
All M13 tests pass; existing editor/tabs/AI/STT smokes remain green; no terminal Enter interception.
