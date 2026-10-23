---
title: "M12 - T01 - Input interaction evidence matrix"
type: task
project: smart-terminal
created: 2026-10-23
id: "M12-T01"
milestone: "M12"
depends_on: "M11"
deliverables: "Evidence matrix comparing current input/terminal behavior and all three options"
---
<!-- gsynchro:v1 id=2fbe6c45-160d-44cd-9576-9b6ea0f6ae06 registered=2026-10-23T20:20:48.265Z -->

# M12 - T01 - Input interaction evidence matrix

## Objective
Capture exactly who receives each key and what would be lost or risked under each option.

## Constrained implementation
Create `docs/24 - Input interaction matrix.md` with:
- Current assisted-input behavior: Enter, Shift+Enter, IME, caret, no Arrow history/Tab completion, draft per tab, AI explicit review, STT append, history after send.
- Current xterm behavior: every `onData` byte goes to the PTY; arrows/Tab/Enter/paste belong to shell/readline/TUI; no raw-mode/prompt awareness; local and SSH share the path.
- Scenario matrix: single command, multiline, AI correction, STT, ArrowUp/Down, Tab, Escape, paste, shell history, TUI (`vim`/`htop`), SSH, focus change.
- Option A/B/C comparison: user value, terminal compatibility, AI safety, history integrity, accessibility, implementation and maintenance risk.
- Evidence references to `apps/renderer/src/app/assisted-input/assisted-input.ts`, `terminal-panel.ts`, `sessions-store.ts`, `ai-store.ts`, `apps/desktop/src/main/history-service.ts`, docs/05/08/12/14.

## Acceptance criteria
- Matrix is English-only, evidence-based and decision-neutral.
- It clearly shows why terminal Enter interception cannot know the shell buffer or TUI state.
- It distinguishes app history from native shell history.
- No code or behavior change.

## References
M12 milestone; docs/23; scout evidence.

## Do not
Do not recommend an option in this task; save the decision for the ADR.
