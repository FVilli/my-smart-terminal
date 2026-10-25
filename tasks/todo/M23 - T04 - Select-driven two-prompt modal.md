---
title: "M23 - T04 - Select-driven two-prompt modal"
type: task
project: smart-terminal
created: 2026-10-25
id: "M23-T04"
milestone: "M23"
depends_on: "M23-T03"
deliverables: "Modal with an action select, editable System/User prompt textareas and unchanged Use/Close semantics"
---

# M23 - T04 - Select-driven two-prompt modal

## Objective
Replace the radio list and single prompt with the select plus two editable prompts requested by the product owner.

## Implementation
- Replace the radiogroup with a labelled `<select>` populated from the stored actions (title — description); selecting re-composes both prompts (unless the user edited them: confirm or keep? keep the current text and show a subtle hint; documented).
- Two monospace textareas (`ai-system-prompt`, `ai-user-prompt`) with counters/limits; both sent on Send; Enter inserts newline, Ctrl/Cmd+Enter sends.
- Security note (non-editable): prompts go to the provider on Send, nothing is executed, secrets are blocked.
- Keep header (session/provider/env + Detect again), answer area, focus trap/Escape/focus return, Cancel/Use/Close; Use inserts selection/full answer.
- Update AI smoke to the select/two-prompt flow; unit tests for store state (compose with console, edited prompts sent verbatim, late answers).

## Acceptance
- Modal offers the select and both prompts, behaves as before for Use/Cancel/Close, accessibility preserved, layout unchanged.
