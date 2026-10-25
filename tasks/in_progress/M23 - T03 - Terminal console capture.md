---
title: "M23 - T03 - Terminal console capture"
type: task
project: smart-terminal
created: 2026-10-25
id: "M23-T03"
milestone: "M23"
depends_on: "M23-T02"
deliverables: "Bounded, ANSI-free console text from the active terminal available to the AI request"
---

# M23 - T03 - Terminal console capture

## Objective
Provide the visible terminal output as AI context without touching PTY semantics.

## Implementation
- Terminal panels register a buffer reader with a small renderer service; the reader returns the last 200 lines of the active xterm buffer via `translateToString`, trimmed, ANSI-free, ≤8 000 characters.
- The active panel is the only source; switching tabs updates the source; no background reads, no polling, no writes to xterm/PTY.
- The modal prefill includes `{{console}}` through compose; when the buffer is unavailable the placeholder renders as an empty string.
- Tests for trimming/bounds/selection of the active panel; Electron smoke asserts console text reaches compose (test mode) and is absent from disk/history.

## Acceptance
- Console text is bounded and read-only; terminal input/focus behaviour unchanged.
