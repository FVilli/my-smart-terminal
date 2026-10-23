---
title: "M13 - T02 - Composer key contract"
type: task
project: smart-terminal
created: 2026-10-23
id: "M13-T02"
milestone: "M13"
depends_on: "M13-T01"
deliverables: "Caret/arrow, Tab, Enter, Shift+Enter, IME and Escape behavior in the assisted composer"
---
<!-- gsynchro:v1 id=d23fc504-27d2-40b1-b744-97356fe490bc registered=2026-10-23T20:20:48.282Z -->

# M13 - T02 - Composer key contract

## Objective
Make the assisted input predictable and keyboard-accessible without creating a second shell history.

## Constrained implementation
Preserve native caret movement for ArrowUp/ArrowDown (including multiline), normal Tab focus traversal, Enter send, Shift+Enter newline and IME-safe Enter. Escape returns focus to terminal (T01) without clearing. Do not add arrow history recall, Tab completion/insertion, or an app-level Ctrl handler. AI remains explicit/reviewable; STT remains append-only.

## Acceptance
Single-line and multiline caret tests; Tab focus order includes AI/mic/send; Enter/Shift+Enter/IME tests; no history on arrows; draft retained; no send from STT or AI.
