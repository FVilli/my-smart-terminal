---
title: "M13 - Assisted input implementation"
type: milestone
project: smart-terminal
created: 2026-10-23
id: "M13"
goal: "Implement the accepted M12 input contract: explicit focus transitions, caret/arrow behavior, Tab focus traversal, Enter/Shift+Enter/IME/Escape, and tests proving the PTY remains untouched."
depends_on: "M12"
---

# M13 - Assisted input implementation

## Goal
Implement the accepted ADR without intercepting terminal Enter or adding a third history.

## Scope
Focus transitions, composer key contract, accessibility and regression tests. No AI/STT behavior changes except ensuring they remain explicit/append-only.

## Acceptance
Ctrl/Cmd+Shift+E focuses the composer; Escape returns to the terminal preserving the draft; arrows move the caret; Tab traverses controls; Enter sends; Shift+Enter adds a line; IME composition does not send; terminal/SSH/TUI key passthrough tests pass.
