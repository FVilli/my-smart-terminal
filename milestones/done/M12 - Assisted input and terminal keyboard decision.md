---
title: "M12 - Assisted input and terminal keyboard decision"
type: milestone
project: smart-terminal
created: 2026-10-23
id: "M12"
goal: "Decide definitively whether to keep the assisted input or replace it with terminal Enter interception, document the keyboard contract, and prepare a future implementation without changing app behavior."
depends_on: "M11"
---
<!-- gsynchro:v1 id=6a809b52-05f0-4623-9427-0a1723162970 registered=2026-10-23T20:20:48.255Z -->

# M12 - Assisted input and terminal keyboard decision

## Goal
Resolve the input/terminal fork with evidence and an ADR. This is a decision milestone: no app code, runtime changes, or release.

## Decision under review
- Option A: remove the assisted input and intercept terminal Enter for AI correction.
- Option B: keep the assisted input and define correct ArrowUp/ArrowDown/Tab behavior.
- Option C: hybrid terminal/input bridge.

## Recommendation
Option B. The terminal remains a real PTY with untouched keys; the assisted input remains a command composer for multiline text, AI review and dictation. Intercepting terminal Enter cannot reliably know the shell buffer, raw/TUI mode or SSH application state, and would risk altering commands.

## Deliverables
- `docs/24 - Input interaction matrix.md`: evidence, key ownership, scenarios, option comparison.
- `docs/23 - ADR assisted input and terminal keyboard behavior.md`: decision, contract, consequences, rejected alternatives, future test plan.
- Independent review and user approval before closing M12.

## Non-goals
- No implementation of ArrowUp/ArrowDown/Tab changes.
- No terminal Enter interception.
- No history, AI, focus or UI changes.
- No release.

## Acceptance
The ADR is unambiguous, the matrix covers local/SSH/TUI/multiline/IME/AI/STT/history, the chosen option and rejected alternatives are justified, and reviewer approval is recorded. M12 closes only after user approval.
